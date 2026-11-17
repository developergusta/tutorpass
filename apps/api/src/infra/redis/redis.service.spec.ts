import { RedisService } from './redis.service';
import { MemoryEphemeralStore } from './memory-ephemeral-store';
import { RedisEphemeralStore } from './redis-ephemeral-store';
import { ResilientEphemeralStore } from './resilient-ephemeral-store';
import type { EphemeralStore } from './ephemeral-store';

describe('MemoryEphemeralStore', () => {
  let store: MemoryEphemeralStore;

  beforeEach(() => {
    store = new MemoryEphemeralStore();
  });

  it('grava e lê de volta', async () => {
    await store.set('k', 'v');
    await expect(store.get('k')).resolves.toBe('v');
  });

  it('devolve null p/ chave inexistente', async () => {
    await expect(store.get('ausente')).resolves.toBeNull();
  });

  it('setNx: true na 1ª vez, false na 2ª (não sobrescreve)', async () => {
    await expect(store.setNx('k', 'a', 90)).resolves.toBe(true);
    await expect(store.setNx('k', 'b', 90)).resolves.toBe(false);
    await expect(store.get('k')).resolves.toBe('a');
  });

  it('setNx volta a gravar depois do TTL expirar', async () => {
    jest.useFakeTimers();
    try {
      await store.setNx('k', 'a', 1);
      jest.advanceTimersByTime(1001);
      await expect(store.setNx('k', 'b', 1)).resolves.toBe(true);
      await expect(store.get('k')).resolves.toBe('b');
    } finally {
      jest.useRealTimers();
    }
  });

  it('get devolve null depois do TTL expirar', async () => {
    jest.useFakeTimers();
    try {
      await store.set('k', 'v', 1);
      jest.advanceTimersByTime(1001);
      await expect(store.get('k')).resolves.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('del remove a chave', async () => {
    await store.set('k', 'v');
    await store.del('k');
    await expect(store.get('k')).resolves.toBeNull();
  });
});

describe('RedisEphemeralStore (cliente falso)', () => {
  // Imita o subconjunto do ioredis que o store usa.
  const fakeClient = () => {
    const data = new Map<string, string>();
    return {
      data,
      get: jest.fn(async (k: string) => data.get(k) ?? null),
      set: jest.fn(async (k: string, v: string, ...args: unknown[]) => {
        if (args.includes('NX') && data.has(k)) return null;
        data.set(k, v);
        return 'OK';
      }),
      del: jest.fn(async (k: string) => (data.delete(k) ? 1 : 0)),
    };
  };

  it('setNx usa SET NX EX e só grava quando não existe', async () => {
    const client = fakeClient();
    const store = new RedisEphemeralStore(client as never);
    await expect(store.setNx('k', 'a', 90)).resolves.toBe(true);
    await expect(store.setNx('k', 'b', 90)).resolves.toBe(false);
    expect(client.set).toHaveBeenCalledWith('k', 'a', 'EX', 90, 'NX');
    expect(client.data.get('k')).toBe('a');
  });

  it('set com TTL passa EX; sem TTL, não', async () => {
    const client = fakeClient();
    const store = new RedisEphemeralStore(client as never);
    await store.set('a', '1', 60);
    await store.set('b', '2');
    expect(client.set).toHaveBeenCalledWith('a', '1', 'EX', 60);
    expect(client.set).toHaveBeenCalledWith('b', '2');
  });
});

describe('ResilientEphemeralStore', () => {
  const failing = (): EphemeralStore => ({
    get: async () => {
      throw new Error('Redis caiu');
    },
    set: async () => {
      throw new Error('Redis caiu');
    },
    setNx: async () => {
      throw new Error('Redis caiu');
    },
    del: async () => {
      throw new Error('Redis caiu');
    },
  });

  it('usa o fallback quando o primário falha (sem lançar)', async () => {
    const store = new ResilientEphemeralStore(failing(), new MemoryEphemeralStore());
    await expect(store.setNx('k', 'a', 90)).resolves.toBe(true);
    await expect(store.setNx('k', 'b', 90)).resolves.toBe(false);
    await expect(store.get('k')).resolves.toBe('a');
    await store.set('k2', 'v');
    await expect(store.get('k2')).resolves.toBe('v');
    await store.del('k2');
    await expect(store.get('k2')).resolves.toBeNull();
  });

  it('usa o primário quando ele responde', async () => {
    const primary = new MemoryEphemeralStore();
    const fallback = new MemoryEphemeralStore();
    const store = new ResilientEphemeralStore(primary, fallback);
    await store.set('k', 'v');
    await expect(primary.get('k')).resolves.toBe('v');
    await expect(fallback.get('k')).resolves.toBeNull();
  });
});

describe('RedisService', () => {
  const OLD_ENV = process.env.REDIS_URL;

  afterEach(() => {
    if (OLD_ENV === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = OLD_ENV;
  });

  it('sem REDIS_URL: disabled, sem conectar, store é memória', async () => {
    delete process.env.REDIS_URL;
    const svc = new RedisService();
    expect(svc.enabled).toBe(false);
    expect(svc.mode).toBe('disabled');
    await expect(svc.onModuleInit()).resolves.toBeUndefined();
    expect(svc.getStore()).toBeInstanceOf(MemoryEphemeralStore);
    await expect(svc.ping(200)).resolves.toBe(false);
  });

  it('REDIS_URL inalcançável: onModuleInit degrada p/ memory sem lançar', async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6399';
    const svc = new RedisService();
    expect(svc.enabled).toBe(true);
    await expect(svc.onModuleInit()).resolves.toBeUndefined();
    expect(svc.mode).toBe('memory');
    // O store continua funcional (memória) — a API não quebra sem Redis.
    const store = svc.getStore();
    await store.set('k', 'v');
    await expect(store.get('k')).resolves.toBe('v');
    await expect(svc.ping(200)).resolves.toBe(false);
    await expect(svc.onModuleDestroy()).resolves.toBeUndefined();
  });
});
