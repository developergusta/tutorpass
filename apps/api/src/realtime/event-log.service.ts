import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { RedisService } from '../infra/redis/redis.service';
import {
  MAX_EVENTS_PER_ROOM,
  MemoryEventLogStore,
  type CatchUpResult,
  type EventLogStore,
  type SequencedEvent,
} from './event-log.store';
import { RedisStreamsEventLogStore } from './redis-streams-event-log.store';

export { MAX_EVENTS_PER_ROOM };
export type { CatchUpResult, SequencedEvent };

// Log de eventos realtime por room, com sequência monotônica por room.
// Socket.io é at-most-once por padrão: o que a portaria perde durante uma queda de
// conexão some para sempre. Com seq por room, o cliente guarda o último seq visto e,
// ao reconectar, pede `events.catch_up` com ele — o servidor reenvia só o que faltou.
// Eventos antigos demais saem do log e o catch-up responde hasGap=true — aí o
// cliente pede snapshot completo (PickupService).
//
// Backend (ciclo 27): Redis Streams quando o Redis está conectado — uma
// Stream por room (`tutorpass:events:{room}`, ver
// redis-streams-event-log.store.ts) — e ring buffer em memória quando não
// está (dev sem Redis, ou Redis fora do ar). O backend é resolvido na
// primeira chamada e, se uma operação na Stream falhar, o serviço degrada
// p/ memória DE VEZ (flag `degraded`): misturar os dois backends no mesmo
// processo dividiria o seq da room e o catch-up perderia eventos. Na
// degradação o log volta a ser por instância — o comportamento de antes
// desta mudança, nunca pior. O Redis voltando só vale no próximo boot
// (o RedisService também só conecta no boot).
//
// O catch-up manual continua necessário mesmo com o connection state
// recovery do Socket.io (adapter de Streams, ver redis-io.adapter.ts):
// o recovery só cobre desconexões de até 2 min e falha quando a sessão
// expira — o catch-up cobre qualquer janela dentro do log retido.
@Injectable()
export class EventLogService {
  private readonly logger = new Logger(EventLogService.name);
  private readonly memoryStore = new MemoryEventLogStore();
  private streamsStore: RedisStreamsEventLogStore | null = null;
  private degraded = false;

  constructor(@Optional() @Inject(RedisService) private readonly redis?: RedisService) {}

  private resolveStore(): EventLogStore {
    if (this.degraded) return this.memoryStore;
    const client = this.redis?.getClient() ?? null;
    if (!client) return this.memoryStore;
    if (!this.streamsStore) this.streamsStore = new RedisStreamsEventLogStore(client);
    return this.streamsStore;
  }

  private async withFallback<T>(op: (store: EventLogStore) => Promise<T>): Promise<T> {
    const store = this.resolveStore();
    if (store === this.memoryStore) return op(store);
    try {
      return await op(store);
    } catch (err) {
      // Uma falha na Stream não pode quebrar a emissão da fila: degrada
      // p/ memória e segue — o evento ainda sai no socket.
      this.degraded = true;
      this.logger.warn(`EventLog em Streams falhou — degradado p/ memória: ${(err as Error)?.message}`);
      return op(this.memoryStore);
    }
  }

  append(room: string, type: string, data: unknown): Promise<SequencedEvent> {
    return this.withFallback((store) => store.append(room, type, data));
  }

  getSince(room: string, lastSeenSeq: number): Promise<CatchUpResult> {
    return this.withFallback((store) => store.getSince(room, lastSeenSeq));
  }

  latestSeq(room: string): Promise<number> {
    return this.withFallback((store) => store.latestSeq(room));
  }
}
