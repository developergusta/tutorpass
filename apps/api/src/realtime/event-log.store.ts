// Stores do log de eventos realtime por room.
// O EventLogService (event-log.service.ts) fala só com esta interface —
// o backend concreto é memória (1 instância, sem Redis) ou Redis
// Streams (multi-instância, replay após queda). Trocar o backend não
// muda o contrato: seq monotônico por room, catch-up por lastSeenSeq e
// hasGap quando o pedido é mais antigo que o retido.

export interface SequencedEvent {
  seq: number; // monotônico por room, começa em 1
  room: string;
  type: string; // ex.: 'queue.entry.created'
  data: unknown;
  emittedAt: Date;
}

export interface CatchUpResult {
  events: SequencedEvent[];
  hasGap: boolean; // true = parte do que foi pedido já saiu do buffer; pedir snapshot
  oldestRetainedSeq: number | null; // menor seq ainda no buffer (null = room sem eventos)
  latestSeq: number; // maior seq da room (0 = sem eventos)
}

export interface EventLogStore {
  append(room: string, type: string, data: unknown): Promise<SequencedEvent>;
  getSince(room: string, lastSeenSeq: number): Promise<CatchUpResult>;
  latestSeq(room: string): Promise<number>;
}

// Teto por room: uma portaria movimentada emite dezenas de eventos por dia; 500 cobre
// várias horas de saída e mantém o log limitado (~500 eventos × payload mínimo).
export const MAX_EVENTS_PER_ROOM = 500;

export function buildCatchUp(
  events: SequencedEvent[],
  lastSeenSeq: number,
  latestSeq: number,
): CatchUpResult {
  if (events.length === 0) {
    return { events: [], hasGap: false, oldestRetainedSeq: null, latestSeq };
  }
  const oldest = events[0].seq;
  // Pediu um seq mais antigo que o retido: parte da história se perdeu.
  const hasGap = lastSeenSeq < oldest - 1;
  return {
    events: events.filter((e) => e.seq > lastSeenSeq),
    hasGap,
    oldestRetainedSeq: oldest,
    latestSeq,
  };
}

/** Backend em memória (ring buffer por room) — o comportamento original. */
export class MemoryEventLogStore implements EventLogStore {
  private readonly rooms = new Map<string, { events: SequencedEvent[]; nextSeq: number }>();

  async append(room: string, type: string, data: unknown): Promise<SequencedEvent> {
    let state = this.rooms.get(room);
    if (!state) {
      state = { events: [], nextSeq: 1 };
      this.rooms.set(room, state);
    }
    const ev: SequencedEvent = { seq: state.nextSeq++, room, type, data, emittedAt: new Date() };
    state.events.push(ev);
    if (state.events.length > MAX_EVENTS_PER_ROOM) state.events.shift();
    return ev;
  }

  async getSince(room: string, lastSeenSeq: number): Promise<CatchUpResult> {
    const state = this.rooms.get(room);
    if (!state || state.events.length === 0) {
      return {
        events: [],
        hasGap: false,
        oldestRetainedSeq: null,
        latestSeq: state ? state.nextSeq - 1 : 0,
      };
    }
    return buildCatchUp(state.events, lastSeenSeq, state.nextSeq - 1);
  }

  async latestSeq(room: string): Promise<number> {
    const state = this.rooms.get(room);
    return state ? state.nextSeq - 1 : 0;
  }
}
