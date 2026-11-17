/**
 * Store efêmero de chave/valor com TTL — a abstração que permite ao
 * TutorPass rodar em 1 instância (memória) ou N instâncias (Redis)
 * sem mudar quem consome o estado.
 *
 * Usado para estado que NÃO pode ir ao Postgres e NÃO pode viver só na
 * memória de uma instância:
 * - nonce anti-replay do QR dinâmico (`qr:nonce:*`, TTL 90 s);
 * - estado do geofence por tutor (`geo:*`, TTL 10 min).
 *
 * Contrato mínimo, igual nos dois backends:
 * - `get` devolve `null` quando a chave não existe ou expirou;
 * - `set` com TTL expira sozinho; sem TTL, vive até `del`;
 * - `setNx` é ATÔMICO (grava só se não existir) — é o que torna o
 *   anti-replay do QR válido entre instâncias;
 * - nenhuma implementação persiste coordenada nem dado pessoal: os
 *   valores aqui são nonce opaco ou zona derivada (OUTSIDE/APPROACH/
 *   ARRIVAL + contadores), nunca lat/lng.
 */
export interface EphemeralStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  /** true = gravou (não existia); false = já existia (não gravou). */
  setNx(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  del(key: string): Promise<void>;
}
