import { EphemeralStore } from './ephemeral-store';

// Backend em memória do EphemeralStore — o comportamento de 1 instância.
// Expiração preguiçosa: a chave expirada some no primeiro `get`/`setNx`
// depois do prazo (sem timer, sem segurar o event loop). Cada instância
// do serviço tem o seu próprio store por padrão; para provar o
// comportamento multi-instância em teste, duas instâncias compartilham
// UM store passado no construtor de quem consome.
export class MemoryEphemeralStore implements EphemeralStore {
  private readonly data = new Map<string, { value: string; expiresAt: number | null }>();

  private isExpired(entry: { expiresAt: number | null }): boolean {
    return entry.expiresAt !== null && Date.now() >= entry.expiresAt;
  }

  async get(key: string): Promise<string | null> {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.data.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.data.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const existing = this.data.get(key);
    if (existing && !this.isExpired(existing)) return false;
    await this.set(key, value, ttlSeconds);
    return true;
  }

  async del(key: string): Promise<void> {
    this.data.delete(key);
  }
}
