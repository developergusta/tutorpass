import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import {
  base32Decode,
  base32Encode,
  hotpCode,
  totpCode,
  TwoFactorService,
  verifyTotpCode,
} from './two-factor.service';

// Segredo dos vetores do RFC 6238 Apêndice B: ASCII "12345678901234567890".
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const USER = 'user-1';
const SCHOOL = 'escola-1';

/** Cadastra e ativa o 2FA p/ USER; devolve o segredo ativo (p/ gerar códigos). */
function setupEnabled(svc: TwoFactorService, at: Date): { secret: string } {
  const { secret } = svc.beginSetup(USER, 'ana@escola.test');
  svc.confirmSetup(USER, totpCode(secret, at), at);
  return { secret };
}

describe('TOTP puro (RFC 4226/6238)', () => {
  it('base32 round-trip', () => {
    const buf = Buffer.from('12345678901234567890', 'ascii');
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
    expect(base32Encode(buf)).toBe(RFC_SECRET);
  });

  it('HOTP: vetores do RFC 4226 Apêndice D (contadores 0–9)', () => {
    const secret = Buffer.from('12345678901234567890', 'ascii');
    const expected = [
      '755224', '287082', '359152', '969429', '338314',
      '254676', '287922', '162583', '399871', '520489',
    ];
    expected.forEach((code, counter) => {
      expect(hotpCode(secret, counter)).toBe(code);
    });
  });

  it('TOTP: vetores do RFC 6238 Apêndice B (SHA-1, 8 dígitos)', () => {
    // 6 dígitos = últimos 6 do código de 8 (mod 10^6 do mesmo valor).
    expect(totpCode(RFC_SECRET, new Date(59_000), 8)).toBe('94287082');
    expect(totpCode(RFC_SECRET, new Date(59_000))).toBe('287082');
    expect(totpCode(RFC_SECRET, new Date(1_111_111_109_000), 8)).toBe('07081804');
    expect(totpCode(RFC_SECRET, new Date(1_111_111_111_000), 8)).toBe('14050471');
    expect(totpCode(RFC_SECRET, new Date(1_234_567_890_000), 8)).toBe('89005924');
    expect(totpCode(RFC_SECRET, new Date(2_000_000_000_000), 8)).toBe('69279037');
  });

  it('verifyTotpCode aceita ±1 passo e rejeita fora da janela', () => {
    const at = new Date(1_700_000_000_000);
    const code = totpCode(RFC_SECRET, at);
    expect(verifyTotpCode(RFC_SECRET, code, at)).toBe(Math.floor(at.getTime() / 1000 / 30));
    // Código do passo anterior e do próximo valem (relógio dessincronizado).
    expect(verifyTotpCode(RFC_SECRET, totpCode(RFC_SECRET, new Date(at.getTime() - 30_000)), at)).not.toBeNull();
    expect(verifyTotpCode(RFC_SECRET, totpCode(RFC_SECRET, new Date(at.getTime() + 30_000)), at)).not.toBeNull();
    // 2 passos de distância não vale.
    expect(verifyTotpCode(RFC_SECRET, totpCode(RFC_SECRET, new Date(at.getTime() - 60_000)), at)).toBeNull();
    expect(verifyTotpCode(RFC_SECRET, '000000', at)).toBeNull();
    expect(verifyTotpCode(RFC_SECRET, 'abc123', at)).toBeNull();
    expect(verifyTotpCode(RFC_SECRET, '12345', at)).toBeNull();
  });
});

describe('TwoFactorService — setup', () => {
  let svc: TwoFactorService;
  const now = new Date(1_700_000_000_000);

  beforeEach(() => {
    svc = new TwoFactorService();
  });

  it('beginSetup devolve segredo + URL otpauth:// válida', () => {
    const { secret, otpauthUrl } = svc.beginSetup(USER, 'ana@escola.test');
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(otpauthUrl).toBe(
      `otpauth://totp/TutorPass%3Aana%40escola.test?secret=${secret}&issuer=TutorPass&algorithm=SHA1&digits=6&period=30`,
    );
    expect(svc.status(USER).hasPendingSetup).toBe(true);
    expect(svc.status(USER).enabled).toBe(false);
  });

  it('segredo pendente NÃO autentica antes do confirm', () => {
    const { secret } = svc.beginSetup(USER, 'ana@escola.test');
    expect(() => svc.verifyCode(USER, totpCode(secret, now), now)).toThrow(
      '2FA não está ativo para este usuário',
    );
  });

  it('confirm com código errado → 401 e sem ativar; com o certo → ativa + 10 códigos de recuperação', () => {
    const { secret } = svc.beginSetup(USER, 'ana@escola.test');
    expect(() => svc.confirmSetup(USER, '000000', now)).toThrow(UnauthorizedException);
    expect(svc.status(USER).enabled).toBe(false);
    const { recoveryCodes } = svc.confirmSetup(USER, totpCode(secret, now), now);
    expect(recoveryCodes).toHaveLength(10);
    for (const c of recoveryCodes) expect(c).toMatch(/^\d{8}$/);
    expect(new Set(recoveryCodes).size).toBe(10);
    expect(svc.status(USER).enabled).toBe(true);
    expect(svc.status(USER).recoveryCodesRemaining).toBe(10);
  });

  it('confirm sem setup pendente → 400', () => {
    expect(() => svc.confirmSetup(USER, '123456', now)).toThrow('Nenhum cadastro de 2FA pendente');
  });

  it('novo beginSetup substitui o pendente; o antigo não confirma', () => {
    const first = svc.beginSetup(USER, 'ana@escola.test');
    const second = svc.beginSetup(USER, 'ana@escola.test');
    expect(() => svc.confirmSetup(USER, totpCode(first.secret, now), now)).toThrow(
      UnauthorizedException,
    );
    expect(svc.confirmSetup(USER, totpCode(second.secret, now), now).recoveryCodes).toHaveLength(10);
  });

  it('re-cadastro com 2FA ativo: o segredo antigo segue valendo até confirmar o novo', () => {
    const { secret: oldSecret } = setupEnabled(svc, now);
    const { secret: newSecret } = svc.beginSetup(USER, 'ana@escola.test');
    const next = new Date(now.getTime() + 30_000);
    // O antigo ainda verifica (o confirm consumiu o passo de `now`, não o de `next`).
    expect(svc.verifyCode(USER, totpCode(oldSecret, next), next).method).toBe('totp');
    // O novo ainda NÃO verifica antes do confirm.
    const next2 = new Date(next.getTime() + 30_000);
    expect(() => svc.verifyCode(USER, totpCode(newSecret, next2), next2)).toThrow(
      UnauthorizedException,
    );
    // Confirmado o novo, o antigo morre.
    expect(svc.confirmSetup(USER, totpCode(newSecret, next2), next2).recoveryCodes).toHaveLength(10);
    const next3 = new Date(next2.getTime() + 30_000);
    expect(() => svc.verifyCode(USER, totpCode(oldSecret, next3), next3)).toThrow(
      UnauthorizedException,
    );
  });
});

describe('TwoFactorService — verificação', () => {
  let svc: TwoFactorService;
  const now = new Date(1_700_000_000_000);

  beforeEach(() => {
    svc = new TwoFactorService();
  });

  it('código TOTP válido verifica; o MESMO código no mesmo passo é rejeitado (anti-replay)', () => {
    const { secret } = setupEnabled(svc, now);
    const next = new Date(now.getTime() + 30_000);
    const code = totpCode(secret, next);
    expect(svc.verifyCode(USER, code, next).method).toBe('totp');
    expect(() => svc.verifyCode(USER, code, next)).toThrow('Código já usado');
  });

  it('código TOTP do passo anterior vale (janela ±1), desde que nunca usado', () => {
    const { secret } = setupEnabled(svc, now);
    const later = new Date(now.getTime() + 60_000);
    // Passo de now+30s nunca foi usado (o confirm consumiu o passo de now).
    expect(svc.verifyCode(USER, totpCode(secret, new Date(now.getTime() + 30_000)), later).method).toBe(
      'totp',
    );
  });

  it('código errado 5 vezes trava o 2FA por 15 min; após o prazo, volta', () => {
    const { secret } = setupEnabled(svc, now);
    for (let i = 0; i < 5; i++) {
      expect(() => svc.verifyCode(USER, '000000', now)).toThrow(UnauthorizedException);
    }
    expect(svc.status(USER).lockedUntil).toBe(now.getTime() + 15 * 60_000);
    expect(() => svc.verifyCode(USER, totpCode(secret, now), now)).toThrow('temporariamente bloqueado');
    const after = new Date(now.getTime() + 15 * 60_000 + 1_000);
    expect(svc.verifyCode(USER, totpCode(secret, after), after).method).toBe('totp');
  });

  it('código de recuperação funciona 1 vez e some da lista; o 2º uso falha', () => {
    const { secret } = setupEnabled(svc, now);
    const next = new Date(now.getTime() + 30_000);
    const { recoveryCodes: codes } = svc.regenerateRecoveryCodes(
      USER,
      totpCode(secret, next),
      next,
    );
    expect(svc.status(USER).recoveryCodesRemaining).toBe(10);
    const used = svc.verifyCode(USER, codes[0], next);
    expect(used.method).toBe('recovery');
    expect(used.recoveryCodesRemaining).toBe(9);
    expect(() => svc.verifyCode(USER, codes[0], next)).toThrow(UnauthorizedException);
  });

  it('regenerar o lote invalida os códigos antigos', () => {
    const { secret } = setupEnabled(svc, now);
    const next = new Date(now.getTime() + 30_000);
    const { recoveryCodes: old } = svc.regenerateRecoveryCodes(USER, totpCode(secret, next), next);
    const later = new Date(next.getTime() + 30_000);
    const { recoveryCodes: fresh } = svc.regenerateRecoveryCodes(
      USER,
      totpCode(secret, later),
      later,
    );
    expect(fresh).not.toEqual(old);
    expect(() => svc.verifyCode(USER, old[0], later)).toThrow(UnauthorizedException);
    expect(svc.verifyCode(USER, fresh[0], later).method).toBe('recovery');
  });
});

describe('TwoFactorService — política e desafio de login', () => {
  let svc: TwoFactorService;
  const now = new Date(1_700_000_000_000);

  beforeEach(() => {
    svc = new TwoFactorService();
  });

  it('ADMIN é obrigado por padrão; TEACHER não; a escola pode ampliar, nunca afrouxar', () => {
    expect(svc.isRequiredByPolicy(['ADMIN'], SCHOOL)).toBe(true);
    expect(svc.isRequiredByPolicy(['TEACHER'], SCHOOL)).toBe(false);
    expect(svc.setSchoolPolicy(SCHOOL, ['TEACHER'])).toEqual(
      expect.arrayContaining(['ADMIN', 'TEACHER']),
    );
    expect(svc.isRequiredByPolicy(['TEACHER'], SCHOOL)).toBe(true);
    // Mesmo pedindo só GATE_AGENT, ADMIN continua obrigado.
    expect(svc.setSchoolPolicy(SCHOOL, ['GATE_AGENT'])).toEqual(
      expect.arrayContaining(['ADMIN']),
    );
  });

  it('desativar com ADMIN na sessão é recusado (403); sem ADMIN, desativa com código válido', () => {
    const { secret } = setupEnabled(svc, now);
    const next = new Date(now.getTime() + 30_000);
    expect(() => svc.disable(USER, totpCode(secret, next), ['ADMIN'], SCHOOL, next)).toThrow(
      ForbiddenException,
    );
    expect(svc.isEnabled(USER)).toBe(true);
    svc.disable(USER, totpCode(secret, next), ['TEACHER'], SCHOOL, next);
    expect(svc.isEnabled(USER)).toBe(false);
    expect(svc.status(USER).recoveryCodesRemaining).toBe(0);
  });

  it('desafio: cria token opaco, consome 1 vez com código válido e devolve o contexto da sessão', () => {
    const { secret } = setupEnabled(svc, now);
    const challenge = svc.createChallenge(USER, SCHOOL, ['ADMIN'], now);
    expect(challenge.token).toMatch(/^[0-9a-f-]+\.[A-Za-z0-9_-]+$/);
    const next = new Date(now.getTime() + 30_000);
    const ctx = svc.consumeChallenge(challenge.token, totpCode(secret, next), next);
    expect(ctx).toEqual({ userId: USER, schoolId: SCHOOL, roles: ['ADMIN'] });
    // Uso único: o mesmo token não vale 2 vezes.
    expect(() => svc.consumeChallenge(challenge.token, totpCode(secret, next), next)).toThrow(
      UnauthorizedException,
    );
  });

  it('desafio: código errado NÃO queima o desafio; token expirado é recusado', () => {
    const { secret } = setupEnabled(svc, now);
    const challenge = svc.createChallenge(USER, SCHOOL, ['ADMIN'], now);
    const next = new Date(now.getTime() + 30_000);
    expect(() => svc.consumeChallenge(challenge.token, '000000', next)).toThrow('Código inválido');
    // Ainda vale com o código certo.
    expect(svc.consumeChallenge(challenge.token, totpCode(secret, next), next).userId).toBe(USER);

    const challenge2 = svc.createChallenge(USER, SCHOOL, ['ADMIN'], now);
    const expired = new Date(now.getTime() + 5 * 60_000 + 1_000);
    expect(() => svc.consumeChallenge(challenge2.token, totpCode(secret, expired), expired)).toThrow(
      'expirado',
    );
    expect(() => svc.consumeChallenge('token-invalido', '123456', now)).toThrow(
      UnauthorizedException,
    );
  });

  it('auditoria registra setup, ativação, verificação e falha — sem segredo nem código', () => {
    setupEnabled(svc, now);
    const events = svc.listAuditEvents(USER);
    expect(events.map((e) => e.type)).toEqual(
      expect.arrayContaining(['SETUP_STARTED', 'ENABLED']),
    );
    expect(() => svc.verifyCode(USER, '000000', now)).toThrow(UnauthorizedException);
    const failed = svc.listAuditEvents(USER).find((e) => e.type === 'FAILED');
    expect(failed).toBeDefined();
    expect(JSON.stringify(svc.listAuditEvents(USER))).not.toContain('000000');
  });
});
