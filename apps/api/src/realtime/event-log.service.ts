import { Injectable } from '@nestjs/common';

// Log de eventos realtime por room, com sequência monotônica por room.
// Socket.io é at-most-once por padrão: o que a portaria perde durante uma queda de
// conexão some para sempre. Com seq por room, o cliente guarda o último seq visto e,
// ao reconectar, pede `events.catch_up` com ele — o servidor reenvia só o que faltou.
// Buffer limitado (ring buffer): eventos antigos demais saem do buffer e o catch-up
// responde hasGap=true — aí o cliente pede snapshot completo (PickupService).
// Step 2 (parcial, ciclo 21): o adapter Redis clássico já está ligado
// (RedisIoAdapter no main.ts) e o estado efêmero já é compartilhado
// (RedisService) — mas o log de eventos em si continua em memória, por
// instância. O passo seguinte é trocar este store por Redis Streams e
// ligar o catch-up ao Connection State Recovery do Socket.io 4.6+ via o
// adapter de Streams (@socket.io/redis-streams-adapter, ainda não
// instalado) — o adapter clássico não suporta o recovery. Até lá, o
// catch-up cobre a reconexão do cliente dentro de 1 instância.

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

// Teto por room: uma portaria movimentada emite dezenas de eventos por dia; 500 cobre
// várias horas de saída e mantém a memória limitada (~500 eventos × payload mínimo).
export const MAX_EVENTS_PER_ROOM = 500;

@Injectable()
export class EventLogService {
  private readonly rooms = new Map<string, { events: SequencedEvent[]; nextSeq: number }>();

  append(room: string, type: string, data: unknown): SequencedEvent {
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

  getSince(room: string, lastSeenSeq: number): CatchUpResult {
    const state = this.rooms.get(room);
    if (!state || state.events.length === 0) {
      return {
        events: [],
        hasGap: false,
        oldestRetainedSeq: null,
        latestSeq: state ? state.nextSeq - 1 : 0,
      };
    }
    const oldest = state.events[0].seq;
    // Pediu um seq mais antigo que o buffer retém: parte da história se perdeu.
    const hasGap = lastSeenSeq < oldest - 1;
    return {
      events: state.events.filter((e) => e.seq > lastSeenSeq),
      hasGap,
      oldestRetainedSeq: oldest,
      latestSeq: state.nextSeq - 1,
    };
  }

  latestSeq(room: string): number {
    const state = this.rooms.get(room);
    return state ? state.nextSeq - 1 : 0;
  }
}
