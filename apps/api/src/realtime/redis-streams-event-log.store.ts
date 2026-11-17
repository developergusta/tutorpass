import type Redis from 'ioredis';
import {
  buildCatchUp,
  MAX_EVENTS_PER_ROOM,
  type CatchUpResult,
  type EventLogStore,
  type SequencedEvent,
} from './event-log.store';

// Backend do log de eventos em Redis Streams — uma Stream por room.
// Resolve o que o ring buffer em memória não resolvia: com 2 instâncias,
// a instância B não via os eventos emitidos pela A, e se a instância que
// emitiu caísse, o histórico da room sumia junto. Na Stream, o evento
// sobrevive à queda da instância e o catch-up funciona em qualquer uma.
//
// Esquema de chaves (prefixo próprio, sem colidir com o adapter, que usa
// `sio:*`, nem com o estado efêmero `geo:*` / `qr:nonce:*`):
// - Stream:   `tutorpass:events:{room}` — entradas com os campos
//             `seq`, `type`, `data` (JSON) e `emittedAt` (ISO).
// - Contador: `tutorpass:events:{room}:seq` — o seq monotônico da room.
//   O contador é a fonte de verdade do `latestSeq` mesmo depois do trim.
// - Retenção: `XADD ... MAXLEN ~ 500` (o mesmo teto do ring buffer).
//   O `~` é trim aproximado: a Stream pode reter um pouco mais que 500,
//   nunca muito menos — o catch-up nunca perde evento que ainda deveria
//   estar lá por causa do teto.
//
// Atomicidade: o seq e a escrita vão juntos num script Lua (INCR +
// XADD) — duas instâncias emitindo na mesma room ao mesmo tempo não
// repetem nem trocam o seq. Sem o script, o INCR de A e o XADD de B
// podiam se cruzar e o catch-up devolver eventos fora de ordem.
//
// Sem TTL nas chaves: cada room retém no máximo ~500 entradas e o nº de
// rooms é limitado (escola × sala × dia); o custo de guardar o dia
// inteiro é menor que o risco de um TTL apagar o histórico no meio da
// saída. O expurgo de rooms antigas é trabalho do Step 2 (job diário).
//
// Limite: se o Redis cair no meio da operação, o chamador
// (EventLogService) degrada p/ o store em memória — o log volta a ser
// por instância, nunca pior que antes (ver event-log.service.ts).
export const EVENTS_KEY_PREFIX = 'tutorpass:events:';

// INCR + XADD numa única ida ao Redis. ARGV: [maxLen, type, data, emittedAt].
export const APPEND_LUA_SCRIPT = [
  'local seq = redis.call(\'INCR\', KEYS[2])',
  'redis.call(\'XADD\', KEYS[1], \'MAXLEN\', \'~\', ARGV[1], \'*\', \'seq\', seq, \'type\', ARGV[2], \'data\', ARGV[3], \'emittedAt\', ARGV[4])',
  'return seq',
].join('\n');

type StreamEntry = [id: string, fields: string[]];

function parseEntry(entry: StreamEntry, room: string): SequencedEvent | null {
  const fields = entry[1];
  const record: Record<string, string> = {};
  for (let i = 0; i + 1 < fields.length; i += 2) {
    record[fields[i]] = fields[i + 1];
  }
  const seq = Number(record.seq);
  if (!Number.isInteger(seq) || seq < 1) return null;
  let data: unknown = null;
  try {
    data = record.data !== undefined ? JSON.parse(record.data) : null;
  } catch {
    return null; // entrada corrompida: não quebra o catch-up inteiro
  }
  const emittedAt = record.emittedAt ? new Date(record.emittedAt) : new Date(0);
  return { seq, room, type: record.type ?? '', data, emittedAt };
}

export class RedisStreamsEventLogStore implements EventLogStore {
  constructor(private readonly client: Redis) {}

  private streamKey(room: string): string {
    return `${EVENTS_KEY_PREFIX}${room}`;
  }

  private seqKey(room: string): string {
    return `${EVENTS_KEY_PREFIX}${room}:seq`;
  }

  async append(room: string, type: string, data: unknown): Promise<SequencedEvent> {
    const emittedAt = new Date();
    const seq = (await this.client.eval(
      APPEND_LUA_SCRIPT,
      2,
      this.streamKey(room),
      this.seqKey(room),
      String(MAX_EVENTS_PER_ROOM),
      type,
      JSON.stringify(data),
      emittedAt.toISOString(),
    )) as number;
    return { seq, room, type, data, emittedAt };
  }

  async getSince(room: string, lastSeenSeq: number): Promise<CatchUpResult> {
    const entries = (await this.client.xrange(this.streamKey(room), '-', '+')) as StreamEntry[];
    const events = entries
      .map((e) => parseEntry(e, room))
      .filter((e): e is SequencedEvent => e !== null);
    const latest = await this.latestSeq(room);
    return buildCatchUp(events, lastSeenSeq, latest);
  }

  async latestSeq(room: string): Promise<number> {
    const raw = await this.client.get(this.seqKey(room));
    const seq = raw === null ? 0 : Number(raw);
    return Number.isInteger(seq) && seq > 0 ? seq : 0;
  }
}
