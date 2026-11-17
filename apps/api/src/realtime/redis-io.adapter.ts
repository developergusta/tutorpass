import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Server, ServerOptions } from 'socket.io';
import Redis from 'ioredis';

// Adapter Socket.io com backplane Redis (Pub/Sub) — o broadcast de uma
// instância chega aos sockets conectados nas outras. Dois clientes são
// obrigatórios: uma conexão em modo subscribe não aceita comando nenhum,
// então pub e sub precisam ser conexões separadas (`duplicate()`).
//
// Limites conhecidos (ver docs/product/IDEAS.md, frente f, ciclo 21):
// - o adapter move o broadcast, NÃO o estado da aplicação (nonce do QR
//   e geofence vivem no RedisService; o catch-up continua no
//   EventLogService);
// - o adapter clássico NÃO suporta connection state recovery — o passo
//   seguinte é o adapter de Redis Streams;
// - multi-instância exige sticky sessions no balanceador (ou transporte
//   só-websocket no cliente), senão o handshake (polling) cai em
//   instâncias diferentes e dá HTTP 400.
//
// Se o Redis não conectar, `connectToRedis` devolve false e o `main.ts`
// nem registra o adapter: a API sobe com o adapter em memória (1
// instância), sem quebrar o boot.
export class RedisIoAdapter extends IoAdapter {
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;

  async connectToRedis(url: string, timeoutMs = 2000): Promise<boolean> {
    const pub = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      enableReadyCheck: true,
    });
    pub.on('error', () => undefined);
    const sub = pub.duplicate();
    sub.on('error', () => undefined);
    try {
      await this.withTimeout(
        Promise.all([pub.connect(), sub.connect()]),
        timeoutMs,
        'Redis adapter connect',
      );
      this.pubClient = pub;
      this.subClient = sub;
      return true;
    } catch {
      pub.disconnect();
      sub.disconnect();
      this.pubClient = null;
      this.subClient = null;
      return false;
    }
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options);
    if (this.pubClient && this.subClient) {
      server.adapter(createAdapter(this.pubClient, this.subClient));
    }
    return server;
  }

  async disconnect(): Promise<void> {
    this.pubClient?.disconnect();
    this.subClient?.disconnect();
    this.pubClient = null;
    this.subClient = null;
  }

  private withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} excedeu ${ms} ms`)), ms);
      timer.unref?.();
    });
    return Promise.race([promise, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }
}
