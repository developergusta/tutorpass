import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TwoFactorService, totpCode } from '../two-factor/two-factor.service';
import { PasswordResetService } from './password-reset.service';

const SECRET = 'segredo-de-teste-com-mais-de-32-caracteres-123456';
const SCHOOL = 'escola-demo-teste';

type FakeRes = {
  cookie: jest.Mock;
  clearCookie: jest.Mock;
};

function fakeRes(): FakeRes {
  return { cookie: jest.fn(), clearCookie: jest.fn() };
}

describe('AuthController (/auth/*)', () => {
  let service: AuthService;
  let twoFactor: TwoFactorService;
  let controller: AuthController;

  beforeEach(() => {
    service = new AuthService(SECRET);
    twoFactor = new TwoFactorService();
    controller = new AuthController(service, twoFactor, new PasswordResetService(service));
  });

  it('register devolve o usuário sem passwordHash; e-mail duplicado → 409', () => {
    const created = controller.register({
      email: 'ana@escola.test',
      name: 'Ana',
      password: 'SenhaForte1!',
    });
    expect(created.email).toBe('ana@escola.test');
    expect(created).not.toHaveProperty('passwordHash');
    expect(() =>
      controller.register({ email: 'ana@escola.test', name: 'Ana 2', password: 'SenhaForte1!' }),
    ).toThrow(ConflictException);
  });

  it('login seta o refresh em cookie httpOnly e NÃO o devolve no corpo', () => {
    const user = service.register('admin@escola.test', 'Admin', 'SenhaForte1!');
    service.addMembership(user.id, SCHOOL, 'ADMIN');
    const res = fakeRes();
    const body = controller.login(
      { email: 'admin@escola.test', password: 'SenhaForte1!', schoolId: SCHOOL },
      res as never,
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'tutorpass_refresh',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, path: '/api/auth/refresh' }),
    );
    expect(body).toHaveProperty('accessToken');
    expect(body).not.toHaveProperty('refreshToken');
    expect(body.roles).toEqual(['ADMIN']);
    expect(body.schoolId).toBe(SCHOOL);
  });

  it('login com senha errada → 401 e sem cookie', () => {
    service.register('ana@escola.test', 'Ana', 'SenhaForte1!');
    const res = fakeRes();
    expect(() =>
      controller.login({ email: 'ana@escola.test', password: 'errada123' }, res as never),
    ).toThrow(UnauthorizedException);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('refresh pelo cookie rotaciona e devolve access novo sem o refresh no corpo', () => {
    const user = service.register('ana@escola.test', 'Ana', 'SenhaForte1!');
    service.addMembership(user.id, SCHOOL, 'ADMIN');
    const first = service.login('ana@escola.test', 'SenhaForte1!', SCHOOL);
    const res = fakeRes();
    const body = controller.refresh(
      {},
      { headers: { cookie: `tutorpass_refresh=${first.refreshToken}` } },
      res as never,
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'tutorpass_refresh',
      expect.not.stringContaining(first.refreshToken),
      expect.objectContaining({ httpOnly: true }),
    );
    expect(body).toHaveProperty('accessToken');
    expect(body).not.toHaveProperty('refreshToken');
  });

  it('refresh pelo body funciona quando não há cookie (fallback mobile)', () => {
    service.register('ana@escola.test', 'Ana', 'SenhaForte1!');
    const first = service.login('ana@escola.test', 'SenhaForte1!');
    const res = fakeRes();
    const body = controller.refresh(
      { refreshToken: first.refreshToken },
      { headers: {} },
      res as never,
    );
    expect(body).toHaveProperty('accessToken');
  });

  it('refresh sem token e com token inválido → 401', () => {
    const res = fakeRes();
    expect(() => controller.refresh({}, { headers: {} }, res as never)).toThrow(
      UnauthorizedException,
    );
    expect(() =>
      controller.refresh({ refreshToken: 'lixo' }, { headers: {} }, res as never),
    ).toThrow(UnauthorizedException);
  });

  it('logout limpa o cookie e é idempotente sem token', () => {
    service.register('ana@escola.test', 'Ana', 'SenhaForte1!');
    const first = service.login('ana@escola.test', 'SenhaForte1!');
    const res = fakeRes();
    expect(
      controller.logout(
        {},
        { headers: { cookie: `tutorpass_refresh=${first.refreshToken}` } },
        res as never,
      ),
    ).toEqual({ ok: true });
    expect(res.clearCookie).toHaveBeenCalledWith('tutorpass_refresh', {
      path: '/api/auth/refresh',
    });
    const res2 = fakeRes();
    expect(controller.logout({}, { headers: {} }, res2 as never)).toEqual({ ok: true });
  });

  it('me devolve o usuário da sessão; sessions lista a sessão ativa', () => {
    const user = service.register('ana@escola.test', 'Ana', 'SenhaForte1!');
    service.addMembership(user.id, SCHOOL, 'TEACHER');
    const login = service.login('ana@escola.test', 'SenhaForte1!', SCHOOL);
    const payload = service.verifyAccessToken(login.accessToken);
    expect(controller.me(payload)).toEqual({
      id: user.id,
      email: 'ana@escola.test',
      name: 'Ana',
      schoolId: SCHOOL,
      roles: ['TEACHER'],
    });
    expect(controller.sessions(payload)).toHaveLength(1);
  });

  it('change-password troca a senha e a antiga para de funcionar', () => {
    service.register('ana@escola.test', 'Ana', 'SenhaForte1!');
    const login = service.login('ana@escola.test', 'SenhaForte1!');
    const payload = service.verifyAccessToken(login.accessToken);
    expect(
      controller.changePassword(payload, {
        currentPassword: 'SenhaForte1!',
        newPassword: 'OutraSenha2!',
      }),
    ).toEqual({ ok: true });
    expect(() => service.login('ana@escola.test', 'SenhaForte1!')).toThrow(
      UnauthorizedException,
    );
    expect(
      service.login('ana@escola.test', 'OutraSenha2!').user.email,
    ).toBe('ana@escola.test');
  });

  it('revoke-all-sessions derruba as sessões e limpa o cookie', () => {
    service.register('ana@escola.test', 'Ana', 'SenhaForte1!');
    service.login('ana@escola.test', 'SenhaForte1!');
    service.login('ana@escola.test', 'SenhaForte1!');
    const login = service.login('ana@escola.test', 'SenhaForte1!');
    const payload = service.verifyAccessToken(login.accessToken);
    expect(controller.sessions(payload)).toHaveLength(3);
    const res = fakeRes();
    expect(controller.revokeAll(payload, res as never)).toEqual({ ok: true });
    expect(controller.sessions(payload)).toHaveLength(0);
    expect(res.clearCookie).toHaveBeenCalledWith('tutorpass_refresh', {
      path: '/api/auth/refresh',
    });
  });

  it('login de ADMIN sem 2FA avisa twoFactorSetupRequired; TEACHER não', () => {
    const admin = service.register('admin@escola.test', 'Admin', 'SenhaForte1!');
    service.addMembership(admin.id, SCHOOL, 'ADMIN');
    const teacher = service.register('prof@escola.test', 'Prof', 'SenhaForte1!');
    service.addMembership(teacher.id, SCHOOL, 'TEACHER');
    const res = fakeRes();
    const adminBody = controller.login(
      { email: 'admin@escola.test', password: 'SenhaForte1!', schoolId: SCHOOL },
      res as never,
    );
    expect(adminBody).toMatchObject({ twoFactorSetupRequired: true });
    const teacherBody = controller.login(
      { email: 'prof@escola.test', password: 'SenhaForte1!', schoolId: SCHOOL },
      res as never,
    );
    expect(teacherBody).toMatchObject({ twoFactorSetupRequired: false });
  });

  it('2FA: setup → confirm → login pede o 2º fator → verify emite a sessão', () => {
    const user = service.register('ana@escola.test', 'Ana', 'SenhaForte1!');
    service.addMembership(user.id, SCHOOL, 'ADMIN');
    const first = service.login('ana@escola.test', 'SenhaForte1!', SCHOOL);
    const payload = service.verifyAccessToken(first.accessToken);

    const setup = controller.setup2fa(payload);
    expect(setup.otpauthUrl).toMatch(/^otpauth:\/\/totp\/TutorPass/);
    const confirm = controller.confirm2fa(payload, { code: totpCode(setup.secret) });
    expect(confirm.recoveryCodes).toHaveLength(10);
    expect(controller.status2fa(payload).enabled).toBe(true);

    // Login com a senha: sem sessão, só o desafio.
    const res = fakeRes();
    const pending = controller.login(
      { email: 'ana@escola.test', password: 'SenhaForte1!', schoolId: SCHOOL },
      res as never,
    );
    expect(pending).toMatchObject({ requires2fa: true });
    const challengeToken = (pending as { twoFactorToken?: string }).twoFactorToken;
    if (!challengeToken) throw new Error('login deveria devolver twoFactorToken');
    expect(pending).not.toHaveProperty('accessToken');
    expect(res.cookie).not.toHaveBeenCalled();

    // Código errado não emite sessão; o certo emite (e o desafio morre).
    // O código do passo SEGUINTE: o confirm já consumiu o código do passo
    // atual (anti-replay — cada código de 30 s vale 1 vez), e a janela ±1
    // do servidor aceita o código do próximo passo.
    const nextStepCode = () => totpCode(setup.secret, new Date(Date.now() + 30_000));
    const res2 = fakeRes();
    expect(() =>
      controller.verify2fa({ twoFactorToken: challengeToken, code: '000000' }, res2 as never),
    ).toThrow(UnauthorizedException);
    expect(res2.cookie).not.toHaveBeenCalled();
    const body = controller.verify2fa(
      { twoFactorToken: challengeToken, code: nextStepCode() },
      res2 as never,
    );
    expect(body).toHaveProperty('accessToken');
    expect(res2.cookie).toHaveBeenCalledWith(
      'tutorpass_refresh',
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
    expect(() =>
      controller.verify2fa(
        { twoFactorToken: challengeToken, code: totpCode(setup.secret) },
        fakeRes() as never,
      ),
    ).toThrow(UnauthorizedException);
  });

  it('2FA: ADMIN não consegue desativar; TEACHER consegue', () => {
    const user = service.register('ana@escola.test', 'Ana', 'SenhaForte1!');
    service.addMembership(user.id, SCHOOL, 'ADMIN');
    service.addMembership(user.id, SCHOOL, 'TEACHER');
    const first = service.login('ana@escola.test', 'SenhaForte1!', SCHOOL);
    const payload = service.verifyAccessToken(first.accessToken);
    const setup = controller.setup2fa(payload);
    controller.confirm2fa(payload, { code: totpCode(setup.secret) });
    // A sessão é ADMIN: recusado.
    expect(() =>
      controller.disable2fa(payload, { code: totpCode(setup.secret) }),
    ).toThrow(ForbiddenException);
    expect(controller.status2fa(payload).enabled).toBe(true);
  });
});
