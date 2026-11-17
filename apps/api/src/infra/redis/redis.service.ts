import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { EphemeralStore } from './ephemeral-store';
import { MemoryEphemeralStore } from './memory-ephemeral-store';
import { RedisEphemeralStore } from './redis-ephemeral-store';
import { ResilientEphemeralStore } from './resilient-ephemeral-store';

export type RedisMode = 'disabled' | 'memory' | 'redis';
// Modos do serviço:
// - disabled: sem REDIS_URL — 1 instância, tudo em memória (dev sem Redis);
// - memory: REDIS_URL configurado mas inalcançável no boot — degradação
//   graciosa, mesmo comportamento de antes (por instância);
// - redis: conectado — estado compartilhado entre instâncias.

// Fail-fast: sem retry infinito. Se o Redis cai, o comando falha rápido
// e o ResilientEphemeralStore usa a memória; o processo nunca trava no
// boot nem na requisição esperando o Redis voltar.
const CLIENT_OPTIONS = {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  retryStrategy: () => null,
  enableReadyCheck: true,
} as const;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} excedeu ${ms} ms`)), ms);
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  readonly url: string | null;
  readonly enabled: boolean;
  mode: RedisMode;
  private client: Redis | null = null;
  private readonly memoryStore = new MemoryEphemeralStore();

  constructor() {
    // Só lê env no construtor — nunca conecta aqui, p/ o AppModule
    // compilar em teste sem Redis (ver app.module.spec.ts).
    const raw = (process.env.REDIS_URL ?? '').trim();
    this.url = raw ? raw : null;
    this.enabled = this.url !== null;
    this.mode = this.enabled ? 'memory' : 'disabled';
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled || !this.url) return;
    const client = new Redis(this.url, { ...CLIENT_OPTIONS });
    // Sem listener, um erro de conexão do ioredis vira exceção não
    // tratada e derruba o processo; o erro real já é tratado no catch.
    client.on('error', () => undefined);
    try {
      await withTimeout(client.connect(), 2000, 'Redis connect');
      await withTimeout(client.ping(), 2000, 'Redis ping');
      this.client = client;
      this.mode = 'redis';
    } catch {
      client.disconnect();
      this.client = null;
      this.mode = 'memory';
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.client?.disconnect();
    this.client = null;
  }

  // O store é resolvido a cada chamada (não guardado no construtor de
  // quem consome): o onModuleInit roda DEPOIS dos construtores, então
  // só na primeira requisição o modo já é o final.
  getStore(): EphemeralStore {
    if (this.mode === 'redis' && this.client) {
      return new ResilientEphemeralStore(new RedisEphemeralStore(this.client), this.memoryStore);
    }
    return this.memoryStore;
  }

  /** true = Redis respondeu; false = sem URL ou inalcançável. */
  async ping(timeoutMs = 2000): Promise<boolean> {
    if (!this.url) return false;
    if (this.client) {
      try {
        await withTimeout(this.client.ping(), timeoutMs, 'Redis ping');
        return true;
      } catch {
        return false;
      }
    }
    const probe = new Redis(this.url, { ...CLIENT_OPTIONS });
    probe.on('error', () => undefined);
    try {
      await withTimeout(probe.connect(), timeoutMs, 'Redis connect');
      await withTimeout(probe.ping(), timeoutMs, 'Redis ping');
      return true;
    } catch {
      return false;
    } finally {
      probe.disconnect();
    }
  }
}
