import { EphemeralStore } from './ephemeral-store';

// Store resiliente: tenta o primário (Redis) e, se ele falhar por
// qualquer motivo (queda, timeout, rede), usa o fallback (memória)
// sem quebrar a requisição.
//
// Trade-off documentado: durante a indisponibilidade do Redis o estado
// volta a ser por instância — exatamente o comportamento de antes deste
// ciclo. Ou seja, a degradação nunca é pior que o que já existia; quando
// o Redis volta, o próximo `getStore()` do RedisService volta a entregar
// o primário. Não há migração de estado do fallback p/ o primário:
// nonce de QR já validado em memória continua válido só naquela
// instância até expirar (90 s), e o geofence reconstrói o estado nos
// próximos pings (no máximo 2 pings p/ reconfirmar ARRIVAL).
export class ResilientEphemeralStore implements EphemeralStore {
  constructor(
    private readonly primary: EphemeralStore,
    private readonly fallback: EphemeralStore,
  ) {}

  async get(key: string): Promise<string | null> {
    try {
      return await this.primary.get(key);
    } catch {
      return this.fallback.get(key);
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      await this.primary.set(key, value, ttlSeconds);
    } catch {
      await this.fallback.set(key, value, ttlSeconds);
    }
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    try {
      return await this.primary.setNx(key, value, ttlSeconds);
    } catch {
      return this.fallback.setNx(key, value, ttlSeconds);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.primary.del(key);
    } catch {
      await this.fallback.del(key);
    }
  }
}
