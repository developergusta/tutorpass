import type Redis from 'ioredis';
import { EphemeralStore } from './ephemeral-store';

// Backend Redis do EphemeralStore (ioredis). Os métodos delegam direto;
// quem decide o que fazer quando o Redis cai é o ResilientEphemeralStore
// (fallback p/ memória) — aqui o erro propaga, sem esconder falha.
// `SET ... NX EX` é um único comando atômico no Redis: é o que garante
// que dois validates do mesmo QR, em instâncias diferentes, não passem
// os dois (só o primeiro grava o nonce).
export class RedisEphemeralStore implements EphemeralStore {
  constructor(private readonly client: Redis) {}

  get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) await this.client.set(key, value, 'EX', ttlSeconds);
    else await this.client.set(key, value);
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const res = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return res === 'OK';
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
