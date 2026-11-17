import { Inject, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { EphemeralStore } from '../../infra/redis/ephemeral-store';
import { MemoryEphemeralStore } from '../../infra/redis/memory-ephemeral-store';
import { RedisService } from '../../infra/redis/redis.service';
// QR dinâmico de 30s: payload mínimo (sem dado do aluno), HMAC, nonce de uso único.
// Anti-replay entre instâncias: o nonce vai p/ o store efêmero via SET NX
// (TTL 90s) — Redis quando configurado, memória quando não. Sem o Redis, o
// replay continua barrado dentro de 1 instância (comportamento anterior).
@Injectable() export class QrTokenService {
  private readonly memory = new MemoryEphemeralStore();
  private secret = process.env.QR_TOKEN_SECRET ?? 'dev-secret-troque';
  private windowS = Number(process.env.QR_WINDOW_SECONDS ?? 30);

  // @Optional: fora do Nest (teste com `new`) não há RedisService — usa memória.
  constructor(@Optional() @Inject(RedisService) private readonly redis?: RedisService) {}

  // Resolvido a cada chamada: o onModuleInit do RedisService roda depois
  // dos construtores, então só aqui o modo já é o final.
  private store(): EphemeralStore {
    return this.redis?.getStore() ?? this.memory;
  }

  issue(schoolId: string, tutorId: string) {
    const now = Math.floor(Date.now() / 1000);
    const payload = { schoolId, tutorId, iat: now, exp: now + this.windowS, nonce: randomUUID() };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', this.secret).update(body).digest('base64url');
    return { token: `${body}.${sig}`, expiresIn: this.windowS };
  }

  async validate(token: string) {
    const [body, sig] = token.split('.'); if (!body || !sig) throw new UnauthorizedException('QR inválido');
    const expected = createHmac('sha256', this.secret).update(body).digest('base64url');
    const sigBuf = Buffer.from(sig), expBuf = Buffer.from(expected);
    // timingSafeEqual lança RangeError se os buffers têm tamanhos diferentes:
    // assinatura adulterada/truncada deve dar 401, nunca 500.
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) throw new UnauthorizedException('QR inválido');
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    const now = Math.floor(Date.now() / 1000);
    if (p.exp < now - 10) throw new UnauthorizedException('QR expirado'); // grace 10s (janela anterior)
    // SET NX atômico: só o primeiro validate grava o nonce; o segundo
    // (mesma ou outra instância) vê que já existe e é barrado.
    const firstUse = await this.store().setNx(`qr:nonce:${p.nonce}`, '1', 90);
    if (!firstUse) throw new UnauthorizedException('QR já utilizado');
    return p as { schoolId: string; tutorId: string; nonce: string };
  }
}
