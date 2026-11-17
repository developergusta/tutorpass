import { EventLogService, MAX_EVENTS_PER_ROOM } from './event-log.service';
import { RedisStreamsEventLogStore } from './redis-streams-event-log.store';

// Cliente Redis falso p/ os testes do store em Streams: implementa só o
// que o store usa (eval do script de append, xrange, get), com a mesma
// semântica — INCR no contador, XADD com trim aproximado por MAXLEN ~.
export class FakeRedisClient {
  private readonly streams = new Map<string, { id: string; fields: string[] }[]>();
  private readonly counters = new Map<string, number>();
  private idSeq = 0;
  evalCalls = 0;
  failEval = false;

  async eval(
    _script: string,
    numKeys: number,
    streamKey: string,
    seqKey: string,
    maxLen: string,
    type: string,
    data: string,
    emittedAt: string,
  ): Promise<number> {
    this.evalCalls++;
    if (this.failEval) throw new Error('Redis caiu');
    if (numKeys !== 2) throw new Error('esperava 2 chaves');
    const seq = (this.counters.get(seqKey) ?? 0) + 1;
    this.counters.set(seqKey, seq);
    const entries = this.streams.get(streamKey) ?? [];
    entries.push({
      id: `${Date.now()}-${this.idSeq++}`,
      fields: [
        'seq',
        String(seq),
        'type',
        type,
        'data',
        data,
        'emittedAt',
        emittedAt,
      ],
    });
    while (entries.length > Number(maxLen)) entries.shift();
    this.streams.set(streamKey, entries);
    return seq;
  }

  async xrange(key: string, _start: string, _end: string): Promise<[string, string[]][]> {
    return (this.streams.get(key) ?? []).map((e) => [e.id, e.fields]);
  }

  async get(key: string): Promise<string | null> {
    const v = this.counters.get(key);
    return v === undefined ? null : String(v);
  }
}

describe('EventLogService — eventos realtime com ID + catch-up', () => {
  const GATE = 'school:s1:gate';
  const ROOM = 'school:s1:classroom:c1';

  it('seq começa em 1 e incrementa por room; rooms são independentes', async () => {
    const log = new EventLogService();
    const a = await log.append(GATE, 'queue.entry.created', { id: 'e1' });
    const b = await log.append(GATE, 'queue.entry.status_changed', { id: 'e1' });
    const c = await log.append(ROOM, 'student.called', { id: 'e1' });
    expect(a.seq).toBe(1);
    expect(b.seq).toBe(2);
    expect(c.seq).toBe(1); // room nova começa do 1
    expect(a.room).toBe(GATE);
    expect(a.type).toBe('queue.entry.created');
    expect(a.data).toEqual({ id: 'e1' });
    expect(a.emittedAt).toBeInstanceOf(Date);
  });

  it('getSince(0) devolve tudo; getSince(n) devolve só o que veio depois', async () => {
    const log = new EventLogService();
    await log.append(GATE, 'queue.entry.created', { id: 'e1' });
    await log.append(GATE, 'queue.entry.called', { id: 'e1' });
    await log.append(GATE, 'queue.entry.status_changed', { id: 'e1' });

    const all = await log.getSince(GATE, 0);
    expect(all.events.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(all.hasGap).toBe(false);
    expect(all.oldestRetainedSeq).toBe(1);
    expect(all.latestSeq).toBe(3);

    const after1 = await log.getSince(GATE, 1);
    expect(after1.events.map((e) => e.seq)).toEqual([2, 3]);
    expect(after1.hasGap).toBe(false);

    const upToDate = await log.getSince(GATE, 3);
    expect(upToDate.events).toEqual([]);
    expect(upToDate.hasGap).toBe(false);
  });

  it('room desconhecida: vazio, sem gap, latestSeq 0', async () => {
    const log = new EventLogService();
    const res = await log.getSince('school:inexistente:gate', 0);
    expect(res).toEqual({ events: [], hasGap: false, oldestRetainedSeq: null, latestSeq: 0 });
    expect(await log.latestSeq('school:inexistente:gate')).toBe(0);
  });

  it('overflow do buffer: hasGap=true quando o pedido é mais antigo que o retido', async () => {
    const log = new EventLogService();
    for (let i = 0; i < MAX_EVENTS_PER_ROOM + 5; i++) {
      await log.append(GATE, 'queue.entry.status_changed', { i });
    }
    // Retidos: seq 6..505; seq 1..5 saíram do buffer.
    const gap = await log.getSince(GATE, 2);
    expect(gap.hasGap).toBe(true);
    expect(gap.oldestRetainedSeq).toBe(6);
    expect(gap.latestSeq).toBe(MAX_EVENTS_PER_ROOM + 5);
    expect(gap.events[0].seq).toBe(6);

    // Pedido dentro da janela retida: sem gap, só o que falta.
    const ok = await log.getSince(GATE, MAX_EVENTS_PER_ROOM);
    expect(ok.hasGap).toBe(false);
    expect(ok.events.map((e) => e.seq)).toEqual([
      MAX_EVENTS_PER_ROOM + 1,
      MAX_EVENTS_PER_ROOM + 2,
      MAX_EVENTS_PER_ROOM + 3,
      MAX_EVENTS_PER_ROOM + 4,
      MAX_EVENTS_PER_ROOM + 5,
    ]);
  });

  it('latestSeq acompanha o último append por room', async () => {
    const log = new EventLogService();
    expect(await log.latestSeq(GATE)).toBe(0);
    await log.append(GATE, 'queue.entry.created', {});
    await log.append(GATE, 'queue.entry.created', {});
    expect(await log.latestSeq(GATE)).toBe(2);
    expect(await log.latestSeq(ROOM)).toBe(0);
  });
});

describe('EventLogService — backend em Redis Streams', () => {
  const GATE = 'school:s1:gate';

  function serviceWithRedis(client: FakeRedisClient): EventLogService {
    const redis = { getClient: () => client as never } as never;
    return new EventLogService(redis);
  }

  it('duas instâncias compartilham o log: catch-up vê evento da outra instância', async () => {
    const client = new FakeRedisClient();
    const a = serviceWithRedis(client);
    const b = serviceWithRedis(client);
    await a.append(GATE, 'queue.entry.created', { id: 'e1' });
    await a.append(GATE, 'queue.entry.status_changed', { id: 'e1' });

    const res = await b.getSince(GATE, 0);
    expect(res.events.map((e) => e.seq)).toEqual([1, 2]);
    expect(res.latestSeq).toBe(2);
    expect(await b.latestSeq(GATE)).toBe(2);

    const third = await b.append(GATE, 'queue.entry.status_changed', { id: 'e1' });
    expect(third.seq).toBe(3); // o seq continua, não recomeça na instância B
    expect((await a.getSince(GATE, 2)).events.map((e) => e.seq)).toEqual([3]);
  });

  it('Stream trima no teto e o catch-up sinaliza o gap', async () => {
    const client = new FakeRedisClient();
    const log = serviceWithRedis(client);
    for (let i = 0; i < MAX_EVENTS_PER_ROOM + 5; i++) {
      await log.append(GATE, 'queue.entry.status_changed', { i });
    }
    const gap = await log.getSince(GATE, 2);
    expect(gap.hasGap).toBe(true);
    expect(gap.oldestRetainedSeq).toBe(6);
    expect(gap.latestSeq).toBe(MAX_EVENTS_PER_ROOM + 5);
  });

  it('falha na Stream degrada p/ memória e não quebra a emissão', async () => {
    const client = new FakeRedisClient();
    client.failEval = true;
    const log = serviceWithRedis(client);
    const ev = await log.append(GATE, 'queue.entry.created', { id: 'e1' });
    expect(ev.seq).toBe(1); // caiu p/ o ring buffer em memória
    expect(client.evalCalls).toBe(1); // tentou a Stream uma vez

    // Degradação é definitiva no processo: a 2ª emissão nem tenta a Stream.
    const ev2 = await log.append(GATE, 'queue.entry.created', { id: 'e2' });
    expect(ev2.seq).toBe(2);
    expect(client.evalCalls).toBe(1);

    const res = await log.getSince(GATE, 0);
    expect(res.events.map((e) => e.seq)).toEqual([1, 2]);
  });

  it('sem RedisService, o log é em memória (mesmo comportamento de antes)', async () => {
    const log = new EventLogService();
    await log.append(GATE, 'queue.entry.created', { id: 'e1' });
    expect((await log.getSince(GATE, 0)).events).toHaveLength(1);
  });
});

describe('RedisStreamsEventLogStore — unidade', () => {
  const GATE = 'school:s1:gate';

  it('append devolve o seq e o catch-up lê data e tipo', async () => {
    const client = new FakeRedisClient();
    const store = new RedisStreamsEventLogStore(client as never);
    const ev = await store.append(GATE, 'queue.entry.created', { id: 'e1', status: 'QUEUED' });
    expect(ev.seq).toBe(1);
    const res = await store.getSince(GATE, 0);
    expect(res.events).toHaveLength(1);
    expect(res.events[0].type).toBe('queue.entry.created');
    expect(res.events[0].data).toEqual({ id: 'e1', status: 'QUEUED' });
    expect(res.events[0].emittedAt).toBeInstanceOf(Date);
  });
});
