import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';

const SECRET = 'segredo-de-teste-com-mais-de-32-caracteres-123456';
const SCHOOL = 'escola-reset-teste';

describe('PasswordResetService', () => {
  let auth: AuthService;
  let resets: PasswordResetService;
  let userId: string;

  beforeEach(() => {
    auth = new AuthService(SECRET);
    resets = new PasswordResetService(auth);
    const user = auth.register('prof@escola.com', 'Professora Ana', 'SenhaAntiga#1');
    userId = user.id;
    auth.addMembership(userId, SCHOOL, 'TEACHER');
  });

  it('e-mail desconhecido não cria pedido (e não vaza nada)', () => {
    expect(resets.request('ninguem@escola.com')).toBe(false);
    expect(resets.listPendingForSchool(SCHOOL)).toHaveLength(0);
  });

  it('pedido aparece p/ o admin da escola com o token de entrega', () => {
    expect(resets.request('prof@escola.com')).toBe(true);
    const pending = resets.listPendingForSchool(SCHOOL);
    expect(pending).toHaveLength(1);
    expect(pending[0].email).toBe('prof@escola.com');
    expect(pending[0].token).toMatch(/^[a-f0-9]{64}$/);
    // Outra escola não vê:
    expect(resets.listPendingForSchool('outra-escola')).toHaveLength(0);
  });

  it('reset troca a senha, consome o token e derruba as sessões', () => {
    const session = auth.login('prof@escola.com', 'SenhaAntiga#1', SCHOOL);
    resets.request('prof@escola.com');
    const { token } = resets.listPendingForSchool(SCHOOL)[0];

    resets.reset(token, 'SenhaNova#2026');

    // Sessão antiga morreu (refresh revogado):
    expect(() => auth.refresh(session.refreshToken)).toThrow();
    // Senha antiga não entra; a nova entra:
    expect(() => auth.login('prof@escola.com', 'SenhaAntiga#1', SCHOOL)).toThrow();
    expect(auth.login('prof@escola.com', 'SenhaNova#2026', SCHOOL).accessToken).toBeTruthy();
    // Token é de uso único:
    expect(() => resets.reset(token, 'OutraSenha#3')).toThrow(BadRequestException);
    expect(resets.listPendingForSchool(SCHOOL)).toHaveLength(0);
  });

  it('token errado ou expirado é recusado', () => {
    resets.request('prof@escola.com');
    expect(() => resets.reset('0'.repeat(64), 'SenhaNova#2026')).toThrow(BadRequestException);
    const { token } = resets.listPendingForSchool(SCHOOL)[0];
    const depois = new Date(Date.now() + 61 * 60 * 1000);
    expect(() => resets.reset(token, 'SenhaNova#2026', depois)).toThrow(BadRequestException);
  });

  it('pedido novo invalida o token anterior', () => {
    resets.request('prof@escola.com');
    const primeiro = resets.listPendingForSchool(SCHOOL)[0].token;
    resets.request('prof@escola.com');
    const segundo = resets.listPendingForSchool(SCHOOL)[0].token;
    expect(segundo).not.toBe(primeiro);
    expect(() => resets.reset(primeiro, 'SenhaNova#2026')).toThrow(BadRequestException);
    expect(() => resets.reset(segundo, 'SenhaNova#2026')).not.toThrow();
  });
});
