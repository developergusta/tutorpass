import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'crypto';
import type { Role } from '../auth/auth.service';

// 2FA TOTP p/ staff (frente e — ver docs/product/IDEAS.md, ciclo 18).
// Padrão 2026: TOTP RFC 6238 (HMAC-SHA1, 6 dígitos, janela de 30 s, janela de
// verificação ±1 passo p/ tolerar relógio dessincronizado) + códigos de
// recuperação como "look-up secrets" do NIST SP 800-63B-4 (§3.1.2: uso único,
// hash com salt, rate limiting) + desafio de login opaco de uso único.
// Política (Realsmart/FACTS 2026, ver IDEAS.md, ciclo 15): ADMIN sempre com
// 2FA, sem como desligar; a escola pode estender p/ outros papéis do staff.
// Tutores NÃO entram aqui — entram por código SMS (2º fator por si só).
// Passkeys (FIDO2) são o substituto superior do TOTP, mas o TOTP continua o
// mais suportado — fica p/ fase 2. Step 2: trocar os stores in-memory por
// Prisma (modelo TwoFactorEnrollment no schema) e cifrar o segredo em repouso
// (aqui ele vive só em memória, como os demais serviços deste passo).

export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
export const TOTP_WINDOW = 1; // ±1 passo (30 s p/ cada lado)
export const TOTP_SECRET_BYTES = 20; // 160 bits, recomendado RFC 4226/6238
export const RECOVERY_CODE_COUNT = 10; // Google: 10 códigos de 8 dígitos
export const RECOVERY_CODE_DIGITS = 8;
export const MAX_FAILED_2FA = 5; // após 5 códigos errados, trava por 15 min
export const TWO_FA_LOCKOUT_MS = 15 * 60 * 1000;
export const TWO_FA_CHALLENGE_TTL_MS = 5 * 60 * 1000; // desafio de login: 5 min
const TOTP_ISSUER = 'TutorPass';
const DEFAULT_REQUIRED_ROLES: Role[] = ['ADMIN'];

// --- TOTP puro (RFC 4226/6238) — exportado p/ os testes usarem os vetores do RFC ---

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let out = '';
  let bits = 0;
  let value = 0;
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  while (out.length % 8 !== 0) out += '=';
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s=-]/g, '').toUpperCase();
  if (!/^[A-Z2-7]*$/.test(clean)) throw new Error('Segredo Base32 inválido');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** HOTP (RFC 4226): HMAC-SHA1 do contador + truncamento dinâmico. */
export function hotpCode(secret: Buffer, counter: number, digits = TOTP_DIGITS): string {
  const counterBuf = Buffer.alloc(8);
  // Contador de 64 bits big-endian (o JS não tem int64; o contador cabe em
  // 53 bits por séculos — TOTP em 30 s só estoura em ~ano 5000).
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', secret).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 10 ** digits).padStart(digits, '0');
}

/** TOTP (RFC 6238): contador = tempo Unix / período. */
export function totpCode(
  secretBase32: string,
  at: Date = new Date(),
  digits = TOTP_DIGITS,
  periodSeconds = TOTP_PERIOD_SECONDS,
): string {
  const counter = Math.floor(at.getTime() / 1000 / periodSeconds);
  return hotpCode(base32Decode(secretBase32), counter, digits);
}

/**
 * Verifica o código contra os passos [contador - janela, contador + janela].
 * Devolve o passo que casou, ou null. Não registra replay aqui — quem chama
 * decide se o passo já foi usado (TwoFactorService.lastUsedStep).
 */
export function verifyTotpCode(
  secretBase32: string,
  code: string,
  at: Date = new Date(),
  window = TOTP_WINDOW,
  digits = TOTP_DIGITS,
  periodSeconds = TOTP_PERIOD_SECONDS,
): number | null {
  if (!/^\d+$/.test(code) || code.length !== digits) return null;
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(at.getTime() / 1000 / periodSeconds);
  for (let step = counter - window; step <= counter + window; step++) {
    if (step < 0) continue;
    if (safeEqual(hotpCode(secret, step, digits), code)) return step;
  }
  return null;
}

export function buildOtpAuthUrl(issuer: string, account: string, secretBase32: string): string {
  const label = `${issuer}:${account}`;
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

// Códigos de recuperação: "look-up secrets" (NIST SP 800-63B-4 §3.1.2) —
// hash scrypt com salt aleatório por código (8 dígitos têm só ~27 bits de
// entropia, então o salt é obrigatório); nunca guardar em claro.
function hashLookupSecret(code: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(code, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return `scrypt$16384$8$1$${salt}$${hash}`;
}

function verifyLookupSecret(code: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, hash] = parts;
  const candidate = scryptSync(code, salt, 64, {
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

function normalizeCode(code: string): string {
  return code.replace(/[\s-]/g, '');
}

function randomRecoveryCode(): string {
  // 8 dígitos via bytes aleatórios (nunca Math.random p/ segredo).
  let out = '';
  while (out.length < RECOVERY_CODE_DIGITS) {
    out += String(randomBytes(1)[0] % 10);
  }
  return out;
}

export interface TwoFactorStatus {
  enabled: boolean;
  hasPendingSetup: boolean;
  recoveryCodesRemaining: number;
  lastUsedAt: Date | null;
  lockedUntil: number | null;
}

export interface TwoFactorChallenge {
  token: string; // opaco, uso único, 5 min — como o refresh token do AuthService
  userId: string;
  schoolId: string | null;
  roles: Role[];
}

export type TwoFactorAuditType =
  | 'SETUP_STARTED'
  | 'ENABLED'
  | 'DISABLED'
  | 'VERIFIED_TOTP'
  | 'VERIFIED_RECOVERY'
  | 'FAILED'
  | 'LOCKED'
  | 'CHALLENGE_CREATED'
  | 'CHALLENGE_CONSUMED'
  | 'RECOVERY_REGENERATED';

export interface TwoFactorAuditEvent {
  at: Date;
  userId: string;
  type: TwoFactorAuditType;
  detail: string; // nunca contém código nem segredo
}

interface Enrollment {
  userId: string;
  secretBase32: string | null; // segredo ATIVO (null até o 1º confirm)
  pendingSecretBase32: string | null; // segredo aguardando confirmação
  enabled: boolean;
  enabledAt: Date | null;
  lastUsedStep: number | null; // anti-replay: cada passo de 30 s vale 1 vez
  lastUsedAt: Date | null;
  recoveryCodeHashes: string[]; // só hashes — o texto some após a exibição
  failedCount: number;
  lockedUntil: number | null;
  createdAt: Date;
}

interface ChallengeRecord {
  jti: string;
  tokenHash: string;
  userId: string;
  schoolId: string | null;
  roles: Role[];
  expiresAt: Date;
  usedAt: Date | null;
}

@Injectable()
export class TwoFactorService {
  private enrollments = new Map<string, Enrollment>();
  private challenges = new Map<string, ChallengeRecord>();
  private schoolPolicies = new Map<string, Role[]>(); // schoolId -> papéis obrigados
  private audit: TwoFactorAuditEvent[] = [];

  // --- Cadastro (setup) -----------------------------------------------------

  /**
   * Inicia o cadastro: gera segredo novo e devolve a URL otpauth:// (o app
   * web/mobile renderiza o QR a partir dela) + o segredo em texto p/ digitação
   * manual. Se o usuário já tem 2FA ativo, o segredo antigo segue valendo até
   * o novo ser confirmado — nunca deixar a conta sem 2FA no meio da troca.
   */
  beginSetup(userId: string, account: string): { secret: string; otpauthUrl: string } {
    const secret = base32Encode(randomBytes(TOTP_SECRET_BYTES));
    const enrollment = this.getOrCreate(userId);
    enrollment.pendingSecretBase32 = secret;
    this.log(userId, 'SETUP_STARTED', 'cadastro de 2FA iniciado');
    return { secret, otpauthUrl: buildOtpAuthUrl(TOTP_ISSUER, account, secret) };
  }

  /**
   * Confirma o cadastro com um código do app autenticador. Só então o 2FA
   * passa a valer — segredo não confirmado nunca autentica ninguém. Devolve
   * os códigos de recuperação em texto CLARO, uma única vez: quem chama
   * precisa exibi-los e nunca mais poderá lê-los (só os hashes ficam).
   */
  confirmSetup(userId: string, code: string, now: Date = new Date()): { recoveryCodes: string[] } {
    const enrollment = this.enrollments.get(userId);
    if (!enrollment?.pendingSecretBase32) {
      throw new BadRequestException('Nenhum cadastro de 2FA pendente — inicie o cadastro primeiro');
    }
    this.assertNotLocked(enrollment, now);
    const matched = verifyTotpCode(enrollment.pendingSecretBase32, normalizeCode(code), now);
    if (matched === null) {
      this.registerFailed(enrollment, userId, now);
      throw new UnauthorizedException('Código inválido');
    }
    enrollment.secretBase32 = enrollment.pendingSecretBase32;
    enrollment.pendingSecretBase32 = null;
    enrollment.enabled = true;
    enrollment.enabledAt = now;
    enrollment.lastUsedStep = matched;
    enrollment.lastUsedAt = now;
    enrollment.failedCount = 0;
    enrollment.lockedUntil = null;
    const recoveryCodes = this.generateRecoveryCodes(enrollment);
    this.log(userId, 'ENABLED', '2FA ativado');
    return { recoveryCodes };
  }

  // --- Verificação (login) ---------------------------------------------------

  /** 2FA ativo p/ o usuário (o login deve pedir o 2º fator). */
  isEnabled(userId: string): boolean {
    return this.enrollments.get(userId)?.enabled === true;
  }

  /** Papéis obrigados a usar 2FA nesta escola (padrão: só ADMIN). */
  requiredRolesFor(schoolId: string | null): Role[] {
    if (!schoolId) return [...DEFAULT_REQUIRED_ROLES];
    return [...(this.schoolPolicies.get(schoolId) ?? DEFAULT_REQUIRED_ROLES)];
  }

  /** A escola obriga 2FA p/ algum dos papéis da sessão (ex.: ADMIN). */
  isRequiredByPolicy(roles: Role[], schoolId: string | null): boolean {
    const required = this.requiredRolesFor(schoolId);
    return roles.some((r) => required.includes(r));
  }

  /**
   * A escola define quem é obrigado (ex.: ['ADMIN'] ou ['ADMIN',
   * 'COORDINATOR', 'GATE_AGENT', 'TEACHER']). ADMIN nunca sai da lista —
   * a política só pode ampliar, nunca afrouxar o padrão (Realsmart 2026).
   */
  setSchoolPolicy(schoolId: string, roles: Role[]): Role[] {
    const merged = Array.from(new Set([...DEFAULT_REQUIRED_ROLES, ...roles]));
    this.schoolPolicies.set(schoolId, merged);
    return [...merged];
  }

  status(userId: string): TwoFactorStatus {
    const e = this.enrollments.get(userId);
    if (!e) {
      return {
        enabled: false,
        hasPendingSetup: false,
        recoveryCodesRemaining: 0,
        lastUsedAt: null,
        lockedUntil: null,
      };
    }
    return {
      enabled: e.enabled,
      hasPendingSetup: e.pendingSecretBase32 !== null,
      recoveryCodesRemaining: e.recoveryCodeHashes.length,
      lastUsedAt: e.lastUsedAt,
      lockedUntil: e.lockedUntil,
    };
  }

  /**
   * Verifica um código TOTP ou de recuperação. TOTP reutilizado no mesmo
   * passo de 30 s é rejeitado (anti-replay); código de recuperação é de uso
   * único e some da lista ao ser usado. Falha conta p/ o lockout (5/15 min).
   */
  verifyCode(
    userId: string,
    code: string,
    now: Date = new Date(),
  ): { method: 'totp' | 'recovery'; recoveryCodesRemaining: number } {
    const enrollment = this.enrollments.get(userId);
    if (!enrollment?.enabled || !enrollment.secretBase32) {
      throw new BadRequestException('2FA não está ativo para este usuário');
    }
    this.assertNotLocked(enrollment, now);
    const clean = normalizeCode(code);

    // TOTP primeiro (o caminho comum).
    const matched = verifyTotpCode(enrollment.secretBase32, clean, now);
    if (matched !== null) {
      if (enrollment.lastUsedStep !== null && matched <= enrollment.lastUsedStep) {
        this.registerFailed(enrollment, userId, now);
        throw new UnauthorizedException('Código já usado — aguarde o próximo código');
      }
      enrollment.lastUsedStep = matched;
      enrollment.lastUsedAt = now;
      enrollment.failedCount = 0;
      this.log(userId, 'VERIFIED_TOTP', 'código TOTP aceito');
      return { method: 'totp', recoveryCodesRemaining: enrollment.recoveryCodeHashes.length };
    }

    // Código de recuperação (8 dígitos, uso único).
    if (clean.length === RECOVERY_CODE_DIGITS) {
      const idx = enrollment.recoveryCodeHashes.findIndex((h) => verifyLookupSecret(clean, h));
      if (idx >= 0) {
        enrollment.recoveryCodeHashes.splice(idx, 1);
        enrollment.lastUsedAt = now;
        enrollment.failedCount = 0;
        this.log(
          userId,
          'VERIFIED_RECOVERY',
          `código de recuperação usado (restam ${enrollment.recoveryCodeHashes.length})`,
        );
        return { method: 'recovery', recoveryCodesRemaining: enrollment.recoveryCodeHashes.length };
      }
    }

    this.registerFailed(enrollment, userId, now);
    throw new UnauthorizedException('Código inválido');
  }

  // --- Desafio de login (senha ok, falta o 2º fator) -------------------------

  /**
   * Cria o desafio que o login devolve quando a senha passou mas o 2FA está
   * ativo: token opaco de uso único (5 min), sem sessão ainda — o access e o
   * refresh só nascem no consumeChallenge, após o código. Mesmo padrão do
   * refresh token do AuthService (só o hash SHA-256 é guardado).
   */
  createChallenge(
    userId: string,
    schoolId: string | null,
    roles: Role[],
    now: Date = new Date(),
  ): TwoFactorChallenge {
    const jti = randomUUID();
    const rawSecret = randomBytes(32).toString('base64url');
    this.challenges.set(jti, {
      jti,
      tokenHash: createHash('sha256').update(rawSecret).digest('hex'),
      userId,
      schoolId,
      roles: [...roles],
      expiresAt: new Date(now.getTime() + TWO_FA_CHALLENGE_TTL_MS),
      usedAt: null,
    });
    this.log(userId, 'CHALLENGE_CREATED', 'desafio de 2FA criado após senha válida');
    return { token: `${jti}.${rawSecret}`, userId, schoolId, roles: [...roles] };
  }

  consumeChallenge(
    token: string,
    code: string,
    now: Date = new Date(),
  ): { userId: string; schoolId: string | null; roles: Role[] } {
    const parts = token.split('.');
    if (parts.length !== 2) throw new UnauthorizedException('Desafio de 2FA inválido');
    const [jti, secret] = parts;
    const record = this.challenges.get(jti);
    if (!record || record.usedAt) throw new UnauthorizedException('Desafio de 2FA inválido');
    const expectedHash = createHash('sha256').update(secret).digest('hex');
    if (!safeEqual(record.tokenHash, expectedHash)) {
      throw new UnauthorizedException('Desafio de 2FA inválido');
    }
    if (record.expiresAt.getTime() <= now.getTime()) {
      throw new UnauthorizedException('Desafio de 2FA expirado — faça login novamente');
    }
    // O código é verificado ANTES de marcar o desafio como usado: código
    // errado não queima o desafio (o usuário pode tentar de novo).
    this.verifyCode(record.userId, code, now);
    record.usedAt = now;
    this.log(record.userId, 'CHALLENGE_CONSUMED', 'desafio de 2FA concluído — sessão emitida');
    return { userId: record.userId, schoolId: record.schoolId, roles: [...record.roles] };
  }

  // --- Desativar / regenerar --------------------------------------------------

  /**
   * Desativa o 2FA — exige um código válido (quem desativa prova que tem o
   * autenticador). Recusado quando a política obriga o 2FA p/ os papéis da
   * sessão: ADMIN nunca desliga (nem a escola pode afrouxar).
   */
  disable(userId: string, code: string, roles: Role[], schoolId: string | null, now: Date = new Date()): void {
    if (this.isRequiredByPolicy(roles, schoolId)) {
      throw new ForbiddenException('2FA é obrigatório para o seu papel — não pode ser desativado');
    }
    this.verifyCode(userId, code, now);
    const enrollment = this.enrollments.get(userId);
    if (!enrollment) return;
    enrollment.enabled = false;
    enrollment.secretBase32 = null;
    enrollment.pendingSecretBase32 = null;
    enrollment.recoveryCodeHashes = [];
    enrollment.lastUsedStep = null;
    this.log(userId, 'DISABLED', '2FA desativado pelo usuário');
  }

  /**
   * Gera um lote novo de códigos de recuperação (invalida o lote anterior —
   * o conserto quando a lista pode ter vazado, como Google/GitHub). Exige
   * um código 2FA válido.
   */
  regenerateRecoveryCodes(
    userId: string,
    code: string,
    now: Date = new Date(),
  ): { recoveryCodes: string[] } {
    this.verifyCode(userId, code, now);
    const enrollment = this.enrollments.get(userId);
    if (!enrollment) throw new BadRequestException('2FA não está ativo para este usuário');
    const recoveryCodes = this.generateRecoveryCodes(enrollment);
    this.log(userId, 'RECOVERY_REGENERATED', 'novo lote de códigos de recuperação gerado');
    return { recoveryCodes };
  }

  // --- Auditoria ---------------------------------------------------------------

  listAuditEvents(userId?: string): TwoFactorAuditEvent[] {
    const all = [...this.audit];
    return userId ? all.filter((e) => e.userId === userId) : all;
  }

  // --- Internos -----------------------------------------------------------------

  private generateRecoveryCodes(enrollment: Enrollment): string[] {
    const codes: string[] = [];
    const seen = new Set<string>();
    while (codes.length < RECOVERY_CODE_COUNT) {
      const code = randomRecoveryCode();
      if (seen.has(code)) continue;
      seen.add(code);
      codes.push(code);
    }
    enrollment.recoveryCodeHashes = codes.map((c) => hashLookupSecret(c));
    return codes;
  }

  private getOrCreate(userId: string): Enrollment {
    let enrollment = this.enrollments.get(userId);
    if (!enrollment) {
      enrollment = {
        userId,
        secretBase32: null,
        pendingSecretBase32: null,
        enabled: false,
        enabledAt: null,
        lastUsedStep: null,
        lastUsedAt: null,
        recoveryCodeHashes: [],
        failedCount: 0,
        lockedUntil: null,
        createdAt: new Date(),
      };
      this.enrollments.set(userId, enrollment);
    }
    return enrollment;
  }

  private assertNotLocked(enrollment: Enrollment, now: Date): void {
    if (enrollment.lockedUntil && now.getTime() < enrollment.lockedUntil) {
      const minutes = Math.ceil((enrollment.lockedUntil - now.getTime()) / 60_000);
      throw new UnauthorizedException(`2FA temporariamente bloqueado — tente novamente em ~${minutes} min`);
    }
  }

  private registerFailed(enrollment: Enrollment, userId: string, now: Date): void {
    enrollment.failedCount += 1;
    this.log(userId, 'FAILED', `código 2FA inválido (${enrollment.failedCount}/${MAX_FAILED_2FA})`);
    if (enrollment.failedCount >= MAX_FAILED_2FA) {
      enrollment.lockedUntil = now.getTime() + TWO_FA_LOCKOUT_MS;
      enrollment.failedCount = 0;
      this.log(userId, 'LOCKED', '2FA bloqueado por 15 min após 5 tentativas');
    }
  }

  private log(userId: string, type: TwoFactorAuditType, detail: string): void {
    this.audit.push({ at: new Date(), userId, type, detail });
  }
}
