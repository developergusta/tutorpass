import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-streams-adapter';
import type { Server, ServerOptions } from 'socket.io';
import Redis from 'ioredis';

// Adapter Socket.io com backplane Redis Streams — o broadcast de uma
// instância chega aos sockets conectados nas outras, com replay.
//
// Por que Streams e não o Pub/Sub clássico (@socket.io/redis-adapter,
// usado até o ciclo 26): o adapter clássico é at-most-once — o pacote
// perdido quando o Redis cai some — e NÃO suporta connection state
// recovery. O adapter de Streams guarda os pacotes num Redis Stream
// (XADD/XREAD) e as sessões em chaves `sio:session:*`, então o cliente
// que cai por até `maxDisconnectionDuration` volta com as rooms e os
// pacotes perdidos, em qualquer instância do cluster (ver
// docs/product/IDEAS.md, frente f, ciclo 27).
//
// Um cliente só basta: diferente do Pub/Sub, não há conexão em modo
// subscribe — o adapter lê o stream com XREAD e escreve com XADD na
// mesma conexão (ioredis >= 5.3.2 é suportado; ver package.json).
//
// Limites conhecidos:
// - o adapter move o broadcast, NÃO o estado da aplicação (nonce do QR
//   e geofence vivem no RedisService; o log de eventos vive no
//   EventLogService, também em Streams — ver event-log.service.ts);
// - multi-instância exige sticky sessions no balanceador (ou transporte
//   só-websocket no cliente), senão o handshake (polling) cai em
//   instâncias diferentes e dá HTTP 400;
// - o recovery só vale p/ desconexões curtas (<= 2 min): passou disso,
//   a sessão expira e o cliente usa o catch-up manual (`events.catch_up`
//   + `queue.snapshot`).
// - o stream do adapter tem `maxLen` próprio: se ele for menor que a
//   janela da sessão, o offset some antes da sessão expirar e o
//   recovery falha — o default do adapter cobre a janela de 2 min.
//
// Se o Redis não conectar, `connectToRedis` devolve false e o `main.ts`
// nem registra o adapter: a API sobe com o adapter em memória (1
// instância), sem quebrar o boot — e sem recovery, como antes.
export const CONNECTION_STATE_RECOVERY_MS = 2 * 60 * 1000;

export class RedisIoAdapter extends IoAdapter {
  private client: Redis | null = null;

  async connectToRedis(url: string, timeoutMs = 2000): Promise<boolean> {
    const client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      enableReadyCheck: true,
    });
    client.on('error', () => undefined);
    try {
      await this.withTimeout(Promise.all([client.connect(), client.ping()]), timeoutMs, 'Redis adapter connect');
      this.client = client;
      return true;
    } catch {
      client.disconnect();
      this.client = null;
      return false;
    }
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    // Connection state recovery SÓ com o adapter de Streams: o adapter
    // em memória (sem Redis) fica como antes, sem recovery — o catch-up
    // manual continua sendo o caminho de volta nesse modo.
    // O cast é seguro: `options`, quando existe, já é ServerOptions.
    const serverOptions: ServerOptions = (options ?? {}) as ServerOptions;
    if (this.client && !serverOptions.connectionStateRecovery) {
      serverOptions.connectionStateRecovery = {
        maxDisconnectionDuration: CONNECTION_STATE_RECOVERY_MS,
        // Revalida o JWT no recovery: o middleware roda de novo.
        skipMiddlewares: false,
      };
    }
    const server = super.createIOServer(port, serverOptions);
    if (this.client) {
      server.adapter(createAdapter(this.client));
    }
    return server;
  }

  async disconnect(): Promise<void> {
    this.client?.disconnect();
    this.client = null;
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
