import { AuthService, ACCESS_TTL_MS } from './auth.service';

describe('AuthService — JWT + refresh rotativo com detecção de reuso', () => {
  const SECRET = '0123456789abcdef0123456789abcdef'; // 32 chars
  const now = new Date('2026-11-17T06:30:00-03:00');
  const minute = 60_000;
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService(SECRET);
  });

  function registerUser(email = 'ana@escola.com', password = 'senha-forte-42') {
    return service.register(email, 'Ana Silva', password, now);
  }

  function loginOk(email = 'ana@escola.com', password = 'senha-forte-42', schoolId?: string) {
    return service.login(email, password, schoolId, now);
  }

  describe('registro', () => {
    it('registra com e-mail normalizado p/ minúsculas e nunca expõe a senha', () => {
      const user = registerUser('ANA@Escola.COM');
      expect(user.email).toBe('ana@escola.com');
      expect(user.passwordHash).not.toContain('senha-forte-42');
      expect(user.passwordHash).toMatch(/^scrypt\$16384\$8\$1\$/);
    });

    it('rejeita e-mail inválido, nome curto, senha curta e senha comum', () => {
      expect(() => service.register('nao-email', 'Ana', 'senha-forte-42', now)).toThrow('E-mail inválido');
      expect(() => service.register('a@b.com', 'A', 'senha-forte-42', now)).toThrow('ao menos 2 caracteres');
      expect(() => service.register('a@b.com', 'Ana', 'curta', now)).toThrow('ao menos 8 caracteres');
      expect(() => service.register('a@b.com', 'Ana', 'password', now)).toThrow('muito comum');
      expect(() => service.register('a@b.com', 'Ana', 'tutorpass123', now)).toThrow('muito comum');
    });

    it('e-mail duplicado (mesmo com caixa diferente) dá conflito', () => {
      registerUser();
      expect(() => registerUser('ANA@escola.com')).toThrow('Já existe uma conta');
    });
  });

  describe('login e lockout', () => {
    it('login sem escola devolve par de tokens, access de 15 min, sem vínculo', () => {
      registerUser();
      const result = loginOk();
      expect(result.accessToken.split('.')).toHaveLength(3);
      expect(result.refreshToken.split('.')).toHaveLength(2);
      expect(result.expiresIn).toBe(ACCESS_TTL_MS / 1000);
      expect(result.schoolId).toBeNull();
      expect(result.roles).toEqual([]);
    });

    it('login com escola exige vínculo ATIVO e carrega os papéis', () => {
      const user = registerUser();
      service.addMembership(user.id, 'school-1', 'ADMIN');
      service.addMembership(user.id, 'school-1', 'TEACHER');
      const result = loginOk('ana@escola.com', 'senha-forte-42', 'school-1');
      expect(result.schoolId).toBe('school-1');
      expect(result.roles).toEqual(expect.arrayContaining(['ADMIN', 'TEACHER']));
    });

    it('senha errada e e-mail inexistente dão o mesmo 401 (não vazar quem existe)', () => {
      registerUser();
      expect(() => service.login('ana@escola.com', 'errada-123', null, now)).toThrow('E-mail ou senha inválidos');
      expect(() => service.login('ninguem@escola.com', 'errada-123', null, now)).toThrow('E-mail ou senha inválidos');
    });

    it('login na escola sem vínculo dá 403', () => {
      registerUser();
      expect(() => service.login('ana@escola.com', 'senha-forte-42', 'school-1', now)).toThrow(
        'sem vínculo ativo',
      );
    });

    it('5 senhas erradas travam a conta por 15 min; depois do prazo o login volta', () => {
      registerUser();
      for (let i = 0; i < 5; i++) {
        expect(() => service.login('ana@escola.com', 'errada-123', null, now)).toThrow('E-mail ou senha inválidos');
      }
      expect(() => service.login('ana@escola.com', 'senha-forte-42', null, now)).toThrow('bloqueada');
      const after = new Date(now.getTime() + 16 * minute);
      expect(service.login('ana@escola.com', 'senha-forte-42', null, after).user.email).toBe('ana@escola.com');
    });

    it('login com sucesso zera o contador de falhas', () => {
      registerUser();
      for (let i = 0; i < 4; i++) {
        expect(() => service.login('ana@escola.com', 'errada-123', null, now)).toThrow();
      }
      loginOk();
      for (let i = 0; i < 4; i++) {
        expect(() => service.login('ana@escola.com', 'errada-123', null, now)).toThrow('E-mail ou senha inválidos');
      }
      // 4 falhas após o reset ainda não travam — a 5ª é que travaria, não o login certo
      expect(loginOk().user.email).toBe('ana@escola.com');
    });
  });

  describe('access token (JWT HS256)', () => {
    it('verify devolve o payload com sub, escola, papéis, iss/aud e exp = iat + 15 min', () => {
      const user = registerUser();
      service.addMembership(user.id, 'school-1', 'GATE_AGENT');
      const { accessToken } = loginOk('ana@escola.com', 'senha-forte-42', 'school-1');
      const payload = service.verifyAccessToken(accessToken, now);
      expect(payload.sub).toBe(user.id);
      expect(payload.email).toBe('ana@escola.com');
      expect(payload.schoolId).toBe('school-1');
      expect(payload.roles).toEqual(['GATE_AGENT']);
      expect(payload.iss).toBe('tutorpass');
      expect(payload.aud).toBe('tutorpass-api');
      expect(payload.exp - payload.iat).toBe(900);
    });

    it('token expirado dá 401 de expirado; adulterado e malformado dão 401 de inválido', () => {
      registerUser();
      const { accessToken } = loginOk();
      const expired = new Date(now.getTime() + 16 * minute);
      expect(() => service.verifyAccessToken(accessToken, expired)).toThrow('Token expirado');
      const parts = accessToken.split('.');
      const tampered = `${parts[0]}.${parts[1].slice(0, -1)}x.${parts[2]}`;
      expect(() => service.verifyAccessToken(tampered, now)).toThrow('Token inválido');
      expect(() => service.verifyAccessToken('nao-e-token', now)).toThrow('Token inválido');
      expect(() => service.verifyAccessToken('', now)).toThrow('Token inválido');
    });

    it('alg none é rejeitado (nunca aceitar algoritmo não assinado)', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const body = Buffer.from(
        JSON.stringify({ sub: 'x', iss: 'tutorpass', aud: 'tutorpass-api', exp: 9999999999 }),
      ).toString('base64url');
      expect(() => service.verifyAccessToken(`${header}.${body}.`, now)).toThrow('Token inválido');
    });

    it('refresh token não passa por verifyAccessToken', () => {
      registerUser();
      const { refreshToken } = loginOk();
      expect(() => service.verifyAccessToken(refreshToken, now)).toThrow('Token inválido');
    });
  });

  describe('refresh com rotação e detecção de reuso', () => {
    it('refresh rota: novo par válido, token antigo morre', () => {
      registerUser();
      const first = loginOk();
      const second = service.refresh(first.refreshToken, now);
      expect(second.refreshToken).not.toBe(first.refreshToken);
      expect(second.accessToken).not.toBe(first.accessToken);
      expect(service.verifyAccessToken(second.accessToken, now).sub).toBe(first.user.id);
      // O token antigo já foi rotacionado: reapresentar fora da graça é reuso (ver teste abaixo).
    });

    it('reapresentar o token rotacionado dentro de 10 s devolve o MESMO sucessor (retry de rede)', () => {
      registerUser();
      const first = loginOk();
      const second = service.refresh(first.refreshToken, now);
      const replay = service.refresh(first.refreshToken, new Date(now.getTime() + 5_000));
      expect(replay.refreshToken).toBe(second.refreshToken);
      expect(service.listReuseDetections()).toHaveLength(0);
    });

    it('reapresentar o token rotacionado após a graça revoga a FAMÍLIA inteira e registra a detecção', () => {
      registerUser();
      const first = loginOk();
      const second = service.refresh(first.refreshToken, now);
      const late = new Date(now.getTime() + 11_000);
      expect(() => service.refresh(first.refreshToken, late)).toThrow('Sessão comprometida');
      // O sucessor legítimo morre junto — nem o cliente legítimo continua.
      expect(() => service.refresh(second.refreshToken, late)).toThrow('Sessão inválida');
      expect(service.listReuseDetections()).toHaveLength(1);
      expect(service.listReuseDetections()[0].userId).toBe(first.user.id);
      expect(service.listSessions(first.user.id, late)).toHaveLength(0);
    });

    it('refresh expirado (família além de 30 dias) dá 401 de expirado', () => {
      registerUser();
      const first = loginOk();
      const far = new Date(now.getTime() + 31 * 86_400_000);
      expect(() => service.refresh(first.refreshToken, far)).toThrow('Sessão expirada');
    });

    it('token de refresh desconhecido dá 401 sem vazar detalhe', () => {
      expect(() => service.refresh('jti-inexistente.segredo', now)).toThrow('Sessão inválida');
      expect(() => service.refresh('lixo', now)).toThrow('Sessão inválida');
    });
  });

  describe('logout, revogação e troca de senha', () => {
    it('logout revoga só aquela sessão e é idempotente', () => {
      registerUser();
      const first = loginOk();
      const other = service.login('ana@escola.com', 'senha-forte-42', null, now);
      service.logout(first.refreshToken);
      service.logout(first.refreshToken); // sem erro
      expect(() => service.refresh(first.refreshToken, now)).toThrow('Sessão inválida');
      expect(service.refresh(other.refreshToken, now).user.id).toBe(first.user.id);
    });

    it('logout NÃO dispara detecção de reuso (revogação legítima ≠ roubo)', () => {
      registerUser();
      const first = loginOk();
      service.logout(first.refreshToken);
      expect(() => service.refresh(first.refreshToken, now)).toThrow('Sessão inválida');
      expect(service.listReuseDetections()).toHaveLength(0);
    });

    it('revokeAllForUser derruba todas as sessões', () => {
      const user = registerUser();
      const a = service.login('ana@escola.com', 'senha-forte-42', null, now);
      const b = service.login('ana@escola.com', 'senha-forte-42', null, now);
      service.revokeAllForUser(user.id, now);
      expect(() => service.refresh(a.refreshToken, now)).toThrow('Sessão inválida');
      expect(() => service.refresh(b.refreshToken, now)).toThrow('Sessão inválida');
      expect(service.listReuseDetections()).toHaveLength(0);
    });

    it('troca de senha exige a atual, valida a nova e derruba as sessões antigas', () => {
      const user = registerUser();
      const oldSession = loginOk();
      expect(() => service.changePassword(user.id, 'errada-123', 'nova-senha-99')).toThrow('Senha atual incorreta');
      expect(() => service.changePassword(user.id, 'senha-forte-42', 'curta')).toThrow('ao menos 8 caracteres');
      service.changePassword(user.id, 'senha-forte-42', 'nova-senha-99');
      expect(() => service.refresh(oldSession.refreshToken, now)).toThrow('Sessão inválida');
      expect(() => service.login('ana@escola.com', 'senha-forte-42', null, now)).toThrow('E-mail ou senha inválidos');
      expect(service.login('ana@escola.com', 'nova-senha-99', null, now).user.id).toBe(user.id);
    });

    it('listSessions lista só sessões ativas, sem expor token ou hash', () => {
      const user = registerUser();
      const first = loginOk();
      service.refresh(first.refreshToken, now); // o antigo morre, nasce 1 sucessor
      const sessions = service.listSessions(user.id, now);
      expect(sessions).toHaveLength(1);
      expect(JSON.stringify(sessions)).not.toContain('tokenHash');
      expect(JSON.stringify(sessions)).not.toContain('refreshToken');
      expect(sessions[0].familyExpiresAt.getTime() - now.getTime()).toBe(30 * 86_400_000);
    });
  });

  describe('vínculos e autorização por tenant/papel', () => {
    it('addMembership é idempotente; suspender bloqueia o login na escola', () => {
      const user = registerUser();
      const a = service.addMembership(user.id, 'school-1', 'TEACHER', 'class-1');
      expect(service.addMembership(user.id, 'school-1', 'TEACHER', 'class-1')).toBe(a);
      expect(a.classroomId).toBe('class-1');
      service.setMembershipStatus(user.id, 'school-1', 'TEACHER', 'SUSPENDED');
      expect(() => service.login('ana@escola.com', 'senha-forte-42', 'school-1', now)).toThrow('sem vínculo ativo');
      service.setMembershipStatus(user.id, 'school-1', 'TEACHER', 'ACTIVE');
      expect(service.login('ana@escola.com', 'senha-forte-42', 'school-1', now).roles).toEqual(['TEACHER']);
    });

    it('authorize: tenant errado nega, papel errado nega, papel certo permite', () => {
      const user = registerUser();
      service.addMembership(user.id, 'school-1', 'GATE_AGENT');
      const { accessToken } = loginOk('ana@escola.com', 'senha-forte-42', 'school-1');
      const payload = service.verifyAccessToken(accessToken, now);
      expect(service.authorize(payload, 'school-1').allowed).toBe(true);
      expect(service.authorize(payload, 'school-1', ['GATE_AGENT']).allowed).toBe(true);
      expect(service.authorize(payload, 'school-1', ['ADMIN']).allowed).toBe(false);
      expect(service.authorize(payload, 'school-1', ['ADMIN']).reason).toMatch(/Requer papel ADMIN/);
      expect(service.authorize(payload, 'school-2').allowed).toBe(false);
      expect(service.authorize(payload, 'school-2').reason).toMatch(/outra escola/);
      expect(() => service.requireAuthorize(payload, 'school-2')).toThrow('outra escola');
      expect(user.id).toBe(payload.sub);
    });

    it('sessão sem escola não autoriza em nenhuma escola', () => {
      registerUser();
      const { accessToken } = loginOk();
      const payload = service.verifyAccessToken(accessToken, now);
      expect(service.authorize(payload, 'school-1').allowed).toBe(false);
    });

    it('desativar o usuário bloqueia o login e revoga as sessões', () => {
      const user = registerUser();
      const session = loginOk();
      service.deactivateUser(user.id);
      expect(() => service.login('ana@escola.com', 'senha-forte-42', null, now)).toThrow('E-mail ou senha inválidos');
      expect(() => service.refresh(session.refreshToken, now)).toThrow('Sessão inválida');
    });
  });

  describe('segredo', () => {
    it('segredo com menos de 32 caracteres é recusado na construção', () => {
      expect(() => new AuthService('curto')).toThrow('ao menos 32 caracteres');
    });
  });
});
