import { RedisIoAdapter } from './redis-io.adapter';

describe('RedisIoAdapter', () => {
  it('connectToRedis devolve false (rápido) quando o Redis não existe', async () => {
    const adapter = new RedisIoAdapter();
    await expect(adapter.connectToRedis('redis://127.0.0.1:6399', 500)).resolves.toBe(false);
    await adapter.disconnect();
  });

  it('connectToRedis devolve false p/ URL inválida', async () => {
    const adapter = new RedisIoAdapter();
    await expect(adapter.connectToRedis('not-a-redis-url', 500)).resolves.toBe(false);
    await adapter.disconnect();
  });

  it('createIOServer sem Redis usa o adapter em memória (não quebra)', async () => {
    const adapter = new RedisIoAdapter();
    const server = adapter.createIOServer(0);
    expect(server).toBeDefined();
    // Fecha o servidor HTTP efêmero p/ não segurar o jest.
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await adapter.disconnect();
  });
});
