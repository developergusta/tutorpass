import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'crypto';

// Auth JWT + refresh rotativo com detecção de reuso (frente e — ver docs/product/IDEAS.md, ciclo 15).
// Padrão 2026 (OAuth 2.1 / RFC 9700, OWASP): access token curto (15 min, JWT HS256,
// assinado com JWT_ACCESS_SECRET), refresh token opaco de uso único que ROTACIONA a cada
// uso, com detecção de reuso — se um refresh já rotacionado reaparecer, a família inteira
// é revogada (sinal de roubo) e o usuário precisa logar de novo. Refresh nunca é JWT:
// opaco + só o hash SHA-256 é guardado, então vazar o store não entrega sessões.
// Step 2 (parcial, 17/11/2026): User e SchoolMember persistidos no Postgres via
// hidratação no boot + write-through (ver o construtor) — contas e vínculos
// sobrevivem a restart/deploy. Refresh tokens e lockout seguem em memória
// (RefreshToken no schema é o passo seguinte; Redis p/ o lockout entre
// instâncias); o controller devolve o refresh em cookie httpOnly + Secure +
// SameSite com path /auth/refresh (nunca localStorage).

export type Role = 'ADMIN' | 'COORDINATOR' | 'GATE_AGENT' | 'TEACHER' | 'TUTOR';
export type MemberStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';

export const ACCESS_TTL_MS = 15 * 60 * 1000; // 15 min — igual a JWT_ACCESS_TTL=15m do .env.example
export const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30); // teto absoluto da família
export const MAX_FAILED_LOGINS = 5; // após 5 senhas erradas, a conta trava por 15 min
export const LOCKOUT_MS = 15 * 60 * 1000;
export const REPLAY_GRACE_MS = 10_000; // reapresentação do token recém-rotacionado devolve o mesmo sucessor
const TOKEN_ISSUER = 'tutorpass';
const TOKEN_AUDIENCE = 'tutorpass-api';
const MIN_PASSWORD_LENGTH = 8;

// NIST SP 800-63B (rev. 2025): sem regra de complexidade forçada nem troca periódica —
// o que vale é comprimento mínimo + bloqueio das senhas mais comuns/vazadas.
const BLOCKED_PASSWORDS = new Set([
  'password', '12345678', '123456789', 'qwerty123', 'senha123', 'tutorpass',
  'tutorpass123', 'escola123', 'admin123', '11111111', '00000000', 'abcdefgh',
  'letmein123', 'welcome1', 'brasil123',
]);

export interface AuthUser {
  id: string;
  email: string; // normalizado p/ minúsculas
  name: string;
  passwordHash: string; // scrypt — nunca guardar senha em claro
  isActive: boolean;
  createdAt: Date;
}

export interface Membership {
  userId: string;
  schoolId: string;
  role: Role;
  status: MemberStatus;
  classroomId?: string | null;
}

export interface AccessTokenPayload {
  sub: string; // userId
  email: string;
  name: string;
  schoolId: string | null; // null = sessão sem escola (ex.: dono criando a escola)
  roles: Role[];
  iss: string;
  aud: string;
  iat: number; // segundos
  exp: number; // segundos
  jti: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // segundos até o access expirar
}

export interface LoginResult extends AuthTokens {
  user: { id: string; email: string; name: string };
  schoolId: string | null;
  roles: Role[];
}

export interface RefreshSession {
  jti: string;
  familyId: string;
  createdAt: Date;
  expiresAt: Date;
  familyExpiresAt: Date;
}

export interface ReuseDetection {
  userId: string;
  familyId: string;
  jti: string;
  detectedAt: Date;
}

interface RefreshRecord extends RefreshSession {
  userId: string;
  schoolId: string | null; // tenant da sessão — a família nunca muda de escola no refresh
  tokenHash: string;
  revokedAt: Date | null;
  replacedByJti: string | null;
  replacedAt: Date | null;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return `scrypt$16384$8$1$${salt}$${hash}`;
}

// Exportado p/ o seed (prisma/seed.ts) usar o MESMO formato de hash do login —
// sem ele, o seed duplicaria a função e os dois formatos poderiam divergir.

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, hash] = parts;
  const candidate = scryptSync(password, salt, 64, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  private readonly secret: string;
  private users = new Map<string, AuthUser>(); // id -> user
  private usersByEmail = new Map<string, string>(); // email normalizado -> id
  private memberships = new Map<string, Membership>(); // `${schoolId}:${userId}:${role}` -> membership
  private refreshTokens = new Map<string, RefreshRecord>(); // jti -> registro
  private failedLogins = new Map<string, { count: number; lockedUntil: number | null }>();
  private reuseDetections: ReuseDetection[] = [];

  // O segredo vem do provider JWT_ACCESS_SECRET (AuthModule) quando o Nest
  // instancia o serviço; `new AuthService('segredo')` direto (testes/seed)
  // continua funcionando. Sem @Optional() @Inject, o DI tentaria resolver o
  // parâmetro `string` como provider e o módulo nem subia ("Nest can't resolve
  // dependencies of the AuthService (String)").
  constructor(
    @Optional() @Inject('JWT_ACCESS_SECRET') secret?: string,
    // Persistência (Step 2, parcial — espinha de identidade): com o
    // PrismaService presente (app real, via PrismaModule global), usuários e
    // vínculos são hidratados do Postgres no boot e cada mutação é gravada
    // em write-through (fila serial do PrismaService). Nos testes unitários
    // (new AuthService('segredo')) o parâmetro fica undefined e o serviço é
    // 100% em memória, como antes. Sessões/refresh e lockout seguem em
    // memória por enquanto: um restart pede login novo, mas ninguém perde a
    // conta nem a escola.
    @Optional() @Inject(PrismaService) private readonly prisma?: PrismaService,
  ) {
    this.secret = secret ?? process.env.JWT_ACCESS_SECRET ?? '';
    if (!this.secret) {
      // Segue o padrão do QrTokenService (fallback dev): em produção JWT_ACCESS_SECRET
      // é obrigatório — sem ele o AppModule nem deveria subir; aqui o aviso é explícito.
      // eslint-disable-next-line no-console
      console.warn('[AuthService] JWT_ACCESS_SECRET não definido — usando segredo dev. NUNCA em produção.');
      this.secret = 'dev-only-secret-troque-em-producao-32+';
    }
    if (this.secret.length < 32) {
      throw new Error('JWT_ACCESS_SECRET precisa ter ao menos 32 caracteres');
    }
  }

  // --- Persistência (hidratação + write-through) ------------------------------

  async onModuleInit(): Promise<void> {
    if (!this.prisma) return;
    const [users, members] = await Promise.all([
      this.prisma.user.findMany(),
      this.prisma.schoolMember.findMany(),
    ]);
    for (const u of users) {
      const user: AuthUser = {
        id: u.id,
        email: u.email,
        name: u.name,
        passwordHash: u.passwordHash ?? '',
        isActive: u.isActive,
        createdAt: u.createdAt,
      };
      this.users.set(user.id, user);
      this.usersByEmail.set(user.email, user.id);
    }
    for (const m of members) {
      this.memberships.set(`${m.schoolId}:${m.userId}:${m.role}`, {
        userId: m.userId,
        schoolId: m.schoolId,
        role: m.role,
        status: m.status,
        classroomId: m.classroomId,
      });
    }
    // eslint-disable-next-line no-console
    console.log(
      `[AuthService] hidratação: ${users.length} usuário(s), ${members.length} vínculo(s) do Postgres`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma?.flushWrites();
  }

  private persist(op: (prisma: PrismaService) => Promise<unknown>): void {
    const prisma = this.prisma;
    if (!prisma) return;
    prisma.enqueueWrite(() => op(prisma));
  }

  // --- Usuários -------------------------------------------------------------

  register(email: string, name: string, password: string, now: Date = new Date()): AuthUser {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new BadRequestException('E-mail inválido');
    }
    if (!name || name.trim().length < 2) {
      throw new BadRequestException('Nome precisa ter ao menos 2 caracteres');
    }
    this.validatePassword(password);
    if (this.usersByEmail.has(normalized)) {
      throw new ConflictException('Já existe uma conta com este e-mail');
    }
    const user: AuthUser = {
      id: randomUUID(),
      email: normalized,
      name: name.trim(),
      passwordHash: hashPassword(password),
      isActive: true,
      createdAt: now,
    };
    this.users.set(user.id, user);
    this.usersByEmail.set(normalized, user.id);
    this.persist((prisma) =>
      prisma.user.create({
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          passwordHash: user.passwordHash,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
      }),
    );
    return user;
  }

  private validatePassword(password: string): void {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`Senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres`);
    }
    if (BLOCKED_PASSWORDS.has(password.toLowerCase())) {
      throw new BadRequestException('Senha muito comum — escolha outra');
    }
  }

  deactivateUser(userId: string): void {
    const user = this.getUserOrThrow(userId);
    user.isActive = false;
    this.persist((prisma) =>
      prisma.user.update({ where: { id: userId }, data: { isActive: false } }),
    );
    this.revokeAllForUser(userId, new Date());
  }

  changePassword(userId: string, currentPassword: string, newPassword: string): void {
    const user = this.getUserOrThrow(userId);
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      throw new UnauthorizedException('Senha atual incorreta');
    }
    this.validatePassword(newPassword);
    user.passwordHash = hashPassword(newPassword);
    const newHash = user.passwordHash;
    this.persist((prisma) =>
      prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } }),
    );
    // Troca de senha derruba TODAS as sessões (o refresh roubado morre junto).
    this.revokeAllForUser(userId, new Date());
  }

  private getUserOrThrow(userId: string): AuthUser {
    const user = this.users.get(userId);
    if (!user) throw new UnauthorizedException('Usuário não encontrado');
    return user;
  }

  /** Busca por e-mail normalizado — apoio ao fluxo de redefinição de senha. */
  findUserByEmail(email: string): AuthUser | null {
    const id = this.usersByEmail.get(email.trim().toLowerCase());
    return id ? (this.users.get(id) ?? null) : null;
  }

  /**
   * Redefinição de senha por token (fluxo "esqueci minha senha"): mesma
   * política da troca de senha, persiste o hash novo e revoga TODAS as
   * sessões — se o pedido partiu de um vazamento, o invasor cai junto.
   */
  resetPasswordWithToken(userId: string, newPassword: string): void {
    const user = this.getUserOrThrow(userId);
    this.validatePassword(newPassword);
    user.passwordHash = hashPassword(newPassword);
    const newHash = user.passwordHash;
    this.persist((prisma) =>
      prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } }),
    );
    this.revokeAllForUser(userId, new Date());
  }

  // --- Login / logout -------------------------------------------------------

  /**
   * Passo 1 do login: valida senha + vínculo, sem emitir tokens. O passo 2
   * (issueSession) emite os tokens — separado p/ o 2FA: quando o segundo
   * fator está ativo, o controller cria um desafio entre os dois passos e
   * só chama issueSession após o código (TwoFactorService.consumeChallenge).
   */
  loginStep1(
    email: string,
    password: string,
    schoolId?: string | null,
    now: Date = new Date(),
  ): { user: AuthUser; schoolId: string | null; roles: Role[] } {
    const normalized = email.trim().toLowerCase();
    this.assertNotLocked(normalized, now);
    const userId = this.usersByEmail.get(normalized);
    const user = userId ? this.users.get(userId) : undefined;
    // Senha errada ou usuário inexistente/inativo: mesma resposta (não vazar quem existe).
    if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
      this.registerFailedLogin(normalized, now);
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }
    let roles: Role[] = [];
    if (schoolId) {
      roles = this.listMemberships(user.id)
        .filter((m) => m.schoolId === schoolId && m.status === 'ACTIVE')
        .map((m) => m.role);
      if (roles.length === 0) {
        throw new ForbiddenException('Usuário sem vínculo ativo com esta escola');
      }
    }
    this.failedLogins.delete(normalized);
    return { user, schoolId: schoolId ?? null, roles };
  }

  /** Passo 2 do login: emite access + refresh p/ um usuário já autenticado. */
  issueSession(userId: string, schoolId: string | null, roles: Role[], now: Date = new Date()): LoginResult {
    const user = this.getUserOrThrow(userId);
    if (!user.isActive) throw new UnauthorizedException('Usuário não encontrado');
    const tokens = this.issueTokens(user, schoolId, roles, now);
    return {
      ...tokens,
      user: { id: user.id, email: user.email, name: user.name },
      schoolId,
      roles,
    };
  }

  /** Dados públicos do usuário (p/ o controller montar a URL otpauth://). */
  getPublicUser(userId: string): { id: string; email: string; name: string } {
    const user = this.getUserOrThrow(userId);
    return { id: user.id, email: user.email, name: user.name };
  }

  login(email: string, password: string, schoolId?: string | null, now: Date = new Date()): LoginResult {
    const step1 = this.loginStep1(email, password, schoolId, now);
    return this.issueSession(step1.user.id, step1.schoolId, step1.roles, now);
  }

  logout(refreshToken: string): void {
    const record = this.findRefreshRecord(refreshToken);
    if (record && !record.revokedAt) record.revokedAt = new Date();
    // Token desconhecido ou já revogado: idempotente, sem erro (logout não vaza estado).
  }

  revokeAllForUser(userId: string, now: Date = new Date()): void {
    for (const record of this.refreshTokens.values()) {
      if (record.userId === userId && !record.revokedAt) record.revokedAt = now;
    }
  }

  listSessions(userId: string, now: Date = new Date()): RefreshSession[] {
    return [...this.refreshTokens.values()]
      .filter((r) => r.userId === userId && !r.revokedAt && r.expiresAt.getTime() > now.getTime())
      .map(({ jti, familyId, createdAt, expiresAt, familyExpiresAt }) => ({
        jti, familyId, createdAt, expiresAt, familyExpiresAt,
      }));
  }

  listReuseDetections(): ReuseDetection[] {
    return [...this.reuseDetections];
  }

  // --- Refresh com rotação + detecção de reuso ------------------------------

  refresh(refreshToken: string, now: Date = new Date()): LoginResult {
    const record = this.findRefreshRecord(refreshToken);
    if (!record) throw new UnauthorizedException('Sessão inválida — faça login novamente');
    const user = this.users.get(record.userId);
    if (!user || !user.isActive) throw new UnauthorizedException('Sessão inválida — faça login novamente');

    if (record.revokedAt) {
      // Reapresentação dentro da janela de graça: o cliente pode ter repetido o refresh
      // por falha de rede — devolver o MESMO sucessor, sem tratar como roubo (RFC 9700 §4.14.2).
      if (
        record.replacedByJti &&
        record.replacedAt &&
        now.getTime() - record.replacedAt.getTime() <= REPLAY_GRACE_MS
      ) {
        const successor = this.refreshTokens.get(record.replacedByJti);
        if (successor && !successor.revokedAt) {
          return this.tokensForRecord(user, successor, now);
        }
      }
      // Só token ROTACIONADO que reaparece é reuso (sinal de roubo). Token revogado por
      // logout, troca de senha ou expiração (replacedByJti null) é só sessão inválida —
      // sem alarme e sem revogar a família.
      if (record.replacedByJti) {
        this.revokeFamily(record.familyId, now);
        this.reuseDetections.push({
          userId: record.userId,
          familyId: record.familyId,
          jti: record.jti,
          detectedAt: now,
        });
        throw new UnauthorizedException('Sessão comprometida — faça login novamente');
      }
      throw new UnauthorizedException('Sessão inválida — faça login novamente');
    }

    if (record.expiresAt.getTime() <= now.getTime() || record.familyExpiresAt.getTime() <= now.getTime()) {
      record.revokedAt = now;
      throw new UnauthorizedException('Sessão expirada — faça login novamente');
    }

    // Rotação: o token usado morre e nasce um sucessor na mesma família.
    const successor = this.createRefreshRecord(user.id, record.familyId, record.familyExpiresAt, now);
    record.revokedAt = now;
    record.replacedByJti = successor.jti;
    record.replacedAt = now;
    return this.tokensForRecord(user, successor, now);
  }

  private tokensForRecord(user: AuthUser, record: RefreshRecord, now: Date): LoginResult {
    const schoolId = record.schoolId;
    const roles = schoolId
      ? this.listMemberships(user.id)
          .filter((m) => m.schoolId === schoolId && m.status === 'ACTIVE')
          .map((m) => m.role)
      : [];
    return {
      accessToken: this.signAccessToken(user, schoolId, roles, now),
      refreshToken: this.renderRefreshToken(record),
      expiresIn: ACCESS_TTL_MS / 1000,
      user: { id: user.id, email: user.email, name: user.name },
      schoolId,
      roles,
    };
  }

  private findRefreshRecord(refreshToken: string): RefreshRecord | undefined {
    const parts = refreshToken.split('.');
    if (parts.length !== 2) return undefined;
    const [jti, secret] = parts;
    const record = this.refreshTokens.get(jti);
    if (!record) return undefined;
    const expectedHash = createHash('sha256').update(secret).digest('hex');
    return safeEqual(record.tokenHash, expectedHash) ? record : undefined;
  }

  private issueTokens(user: AuthUser, schoolId: string | null, roles: Role[], now: Date): AuthTokens {
    const familyId = randomUUID();
    const familyExpiresAt = new Date(now.getTime() + REFRESH_TTL_DAYS * 86_400_000);
    const record = this.createRefreshRecord(user.id, familyId, familyExpiresAt, now, schoolId);
    return {
      accessToken: this.signAccessToken(user, schoolId, roles, now),
      refreshToken: this.renderRefreshToken(record),
      expiresIn: ACCESS_TTL_MS / 1000,
    };
  }

  private createRefreshRecord(
    userId: string,
    familyId: string,
    familyExpiresAt: Date,
    now: Date,
    schoolId: string | null = null,
  ): RefreshRecord {
    const rawSecret = randomBytes(32).toString('base64url');
    const record: RefreshRecord = {
      jti: randomUUID(),
      userId,
      familyId,
      schoolId,
      tokenHash: createHash('sha256').update(rawSecret).digest('hex'),
      createdAt: now,
      expiresAt: new Date(now.getTime() + REFRESH_TTL_DAYS * 86_400_000),
      familyExpiresAt,
      revokedAt: null,
      replacedByJti: null,
      replacedAt: null,
    };
    // O segredo bruto só existe no token devolvido ao cliente — o store guarda o hash.
    (record as unknown as { _rawSecret: string })._rawSecret = rawSecret;
    this.refreshTokens.set(record.jti, record);
    return record;
  }

  private renderRefreshToken(record: RefreshRecord): string {
    const raw = (record as unknown as { _rawSecret?: string })._rawSecret;
    if (!raw) throw new Error('Refresh token sem segredo bruto — bug interno');
    return `${record.jti}.${raw}`;
  }

  private revokeFamily(familyId: string, now: Date): void {
    for (const record of this.refreshTokens.values()) {
      if (record.familyId === familyId && !record.revokedAt) record.revokedAt = now;
    }
  }

  // --- Access token (JWT HS256) ----------------------------------------------

  signAccessToken(user: AuthUser, schoolId: string | null, roles: Role[], now: Date = new Date()): string {
    const iat = Math.floor(now.getTime() / 1000);
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      schoolId,
      roles,
      iss: TOKEN_ISSUER,
      aud: TOKEN_AUDIENCE,
      iat,
      exp: iat + ACCESS_TTL_MS / 1000,
      jti: randomUUID(),
    };
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', this.secret).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${sig}`;
  }

  verifyAccessToken(token: string, now: Date = new Date()): AccessTokenPayload {
    const parts = token.split('.');
    if (parts.length !== 3) throw new UnauthorizedException('Token inválido');
    const [header, body, sig] = parts;
    let headerJson: { alg?: string };
    try {
      headerJson = JSON.parse(Buffer.from(header, 'base64url').toString());
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
    // Algoritmo fixo: nunca aceitar `none` nem outro alg (OWASP JWT Cheat Sheet).
    if (headerJson.alg !== 'HS256') throw new UnauthorizedException('Token inválido');
    const expected = createHmac('sha256', this.secret).update(`${header}.${body}`).digest('base64url');
    if (!safeEqual(sig, expected)) throw new UnauthorizedException('Token inválido');
    let payload: AccessTokenPayload;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
    if (payload.iss !== TOKEN_ISSUER || payload.aud !== TOKEN_AUDIENCE) {
      throw new UnauthorizedException('Token inválido');
    }
    // exp com 10 s de tolerância p/ relógio (mesmo padrão do QR dinâmico).
    if (!payload.exp || payload.exp < Math.floor(now.getTime() / 1000) - 10) {
      throw new UnauthorizedException('Token expirado');
    }
    return payload;
  }

  // --- Vínculos escola/papel (tenant + RBAC) ----------------------------------

  addMembership(userId: string, schoolId: string, role: Role, classroomId?: string | null): Membership {
    this.getUserOrThrow(userId);
    const key = `${schoolId}:${userId}:${role}`;
    const existing = this.memberships.get(key);
    if (existing) return existing;
    const membership: Membership = { userId, schoolId, role, status: 'ACTIVE', classroomId: classroomId ?? null };
    this.memberships.set(key, membership);
    // classroomId fica null no banco nesta etapa: a sala é do RosterService
    // (ainda em memória) e o FK exige a sala persistida. O vínculo
    // escola/usuário/papel — o que o login e o RBAC usam — persiste inteiro.
    this.persist((prisma) =>
      prisma.schoolMember.upsert({
        where: { schoolId_userId_role: { schoolId, userId, role } },
        create: { schoolId, userId, role, status: 'ACTIVE', classroomId: null },
        update: {},
      }),
    );
    return membership;
  }

  setMembershipStatus(userId: string, schoolId: string, role: Role, status: MemberStatus): Membership {
    const membership = this.memberships.get(`${schoolId}:${userId}:${role}`);
    if (!membership) throw new BadRequestException('Vínculo não encontrado');
    membership.status = status;
    this.persist((prisma) =>
      prisma.schoolMember.updateMany({
        where: { schoolId, userId, role },
        data: { status },
      }),
    );
    return membership;
  }

  listMemberships(userId: string): Membership[] {
    return [...this.memberships.values()].filter((m) => m.userId === userId);
  }

  /**
   * Autorização por tenant + papel, a partir do payload do access token.
   * O schoolId NUNCA vem do body — só do token (docs/01-arquitetura.md, módulo tenancy).
   * Retorna { allowed, reason } em vez de lançar, p/ o guard decidir o status HTTP.
   */
  authorize(
    payload: AccessTokenPayload,
    schoolId: string,
    requiredRoles?: Role[],
  ): { allowed: boolean; reason: string } {
    if (!payload.schoolId || payload.schoolId !== schoolId) {
      return { allowed: false, reason: 'Sessão de outra escola' };
    }
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.some((r) => payload.roles.includes(r));
      if (!hasRole) {
        return { allowed: false, reason: `Requer papel ${requiredRoles.join(' ou ')}` };
      }
    }
    return { allowed: true, reason: 'ok' };
  }

  requireAuthorize(payload: AccessTokenPayload, schoolId: string, requiredRoles?: Role[]): void {
    const check = this.authorize(payload, schoolId, requiredRoles);
    if (!check.allowed) throw new ForbiddenException(check.reason);
  }

  // --- Lockout por tentativas --------------------------------------------------

  private assertNotLocked(email: string, now: Date): void {
    const entry = this.failedLogins.get(email);
    if (entry?.lockedUntil && now.getTime() < entry.lockedUntil) {      const minutes = Math.ceil((entry.lockedUntil - now.getTime()) / 60_000);
      throw new UnauthorizedException(`Conta temporariamente bloqueada — tente novamente em ~${minutes} min`);
    }
  }

  private registerFailedLogin(email: string, now: Date): void {
    const entry = this.failedLogins.get(email) ?? { count: 0, lockedUntil: null };
    entry.count += 1;
    if (entry.count >= MAX_FAILED_LOGINS) {
      entry.lockedUntil = now.getTime() + LOCKOUT_MS;
      entry.count = 0; // o contador recomeça quando o bloqueio expira
    }
    this.failedLogins.set(email, entry);
  }
}
