import { createHmac } from 'crypto';
import { QrTokenService } from './qr-token.service';
import { MemoryEphemeralStore } from '../../infra/redis/memory-ephemeral-store';
import type { RedisService } from '../../infra/redis/redis.service';

describe('QrTokenService', () => {
  const secret = 'dev-secret-troque';
  let svc: QrTokenService;

  beforeEach(() => {
    svc = new QrTokenService();
  });

  it('emite token com duas partes (body.sig) e expiresIn 30s', () => {
    const { token, expiresIn } = svc.issue('school-1', 'tutor-1');
    expect(token.split('.')).toHaveLength(2);
    expect(expiresIn).toBe(30);
  });

  it('valida um token recém-emitido e devolve schoolId/tutorId', async () => {
    const { token } = svc.issue('school-1', 'tutor-1');
    const p = await svc.validate(token);
    expect(p.schoolId).toBe('school-1');
    expect(p.tutorId).toBe('tutor-1');
    expect(typeof p.nonce).toBe('string');
  });

  it('rejeita token reutilizado (anti-replay)', async () => {
    const { token } = svc.issue('school-1', 'tutor-1');
    await svc.validate(token);
    await expect(svc.validate(token)).rejects.toThrow('QR já utilizado');
  });

  it('rejeita token reutilizado em OUTRA instância com o mesmo store (multi-instância)', async () => {
    // Duas instâncias do serviço compartilhando UM store (o papel do Redis):
    // o nonce gravado pela 1ª precisa barrar o replay na 2ª.
    const shared = new MemoryEphemeralStore();
    const fakeRedis = { getStore: () => shared } as unknown as RedisService;
    const svcA = new QrTokenService(fakeRedis);
    const svcB = new QrTokenService(fakeRedis);
    const { token } = svcA.issue('school-1', 'tutor-1');
    await svcA.validate(token);
    await expect(svcB.validate(token)).rejects.toThrow('QR já utilizado');
  });

  it('rejeita corpo adulterado', async () => {
    const { token } = svc.issue('school-1', 'tutor-1');
    const [body, sig] = token.split('.');
    const tampered = Buffer.from(JSON.stringify({ schoolId: 'school-2', tutorId: 'tutor-1', iat: 1, exp: 9999999999, nonce: 'x' })).toString('base64url');
    await expect(svc.validate(`${tampered}.${sig}`)).rejects.toThrow('QR inválido');
    void body;
  });

  it('rejeita assinatura truncada com 401 (não 500)', async () => {
    // Regressão: timingSafeEqual lançava RangeError quando os buffers tinham
    // tamanhos diferentes, virando 500 em vez de UnauthorizedException.
    const { token } = svc.issue('school-1', 'tutor-1');
    const [body, sig] = token.split('.');
    const truncated = `${body}.${sig.slice(0, 5)}`;
    await expect(svc.validate(truncated)).rejects.toThrow('QR inválido');
  });

  it('rejeita assinatura com tamanho maior que o esperado', async () => {
    const { token } = svc.issue('school-1', 'tutor-1');
    const [body, sig] = token.split('.');
    await expect(svc.validate(`${body}.${sig}AAAA`)).rejects.toThrow('QR inválido');
  });

  it('rejeita token sem ponto / malformado', async () => {
    await expect(svc.validate('nao-e-um-token')).rejects.toThrow('QR inválido');
    await expect(svc.validate('')).rejects.toThrow('QR inválido');
  });

  it('rejeita token expirado (mesmo com grace de 10s)', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = { schoolId: 'school-1', tutorId: 'tutor-1', iat: now - 120, exp: now - 60, nonce: 'expired-nonce' };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', secret).update(body).digest('base64url');
    await expect(svc.validate(`${body}.${sig}`)).rejects.toThrow('QR expirado');
  });

  it('aceita token dentro da janela de grace (expirou há < 10s)', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = { schoolId: 'school-1', tutorId: 'tutor-1', iat: now - 35, exp: now - 5, nonce: 'grace-nonce' };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', secret).update(body).digest('base64url');
    expect((await svc.validate(`${body}.${sig}`)).schoolId).toBe('school-1');
  });
});
