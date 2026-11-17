import { EventLogService, MAX_EVENTS_PER_ROOM } from './event-log.service';

describe('EventLogService — eventos realtime com ID + catch-up', () => {
  const GATE = 'school:s1:gate';
  const ROOM = 'school:s1:classroom:c1';

  it('seq começa em 1 e incrementa por room; rooms são independentes', () => {
    const log = new EventLogService();
    const a = log.append(GATE, 'queue.entry.created', { id: 'e1' });
    const b = log.append(GATE, 'queue.entry.status_changed', { id: 'e1' });
    const c = log.append(ROOM, 'student.called', { id: 'e1' });
    expect(a.seq).toBe(1);
    expect(b.seq).toBe(2);
    expect(c.seq).toBe(1); // room nova começa do 1
    expect(a.room).toBe(GATE);
    expect(a.type).toBe('queue.entry.created');
    expect(a.data).toEqual({ id: 'e1' });
    expect(a.emittedAt).toBeInstanceOf(Date);
  });

  it('getSince(0) devolve tudo; getSince(n) devolve só o que veio depois', () => {
    const log = new EventLogService();
    log.append(GATE, 'queue.entry.created', { id: 'e1' });
    log.append(GATE, 'queue.entry.called', { id: 'e1' });
    log.append(GATE, 'queue.entry.status_changed', { id: 'e1' });

    const all = log.getSince(GATE, 0);
    expect(all.events.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(all.hasGap).toBe(false);
    expect(all.oldestRetainedSeq).toBe(1);
    expect(all.latestSeq).toBe(3);

    const after1 = log.getSince(GATE, 1);
    expect(after1.events.map((e) => e.seq)).toEqual([2, 3]);
    expect(after1.hasGap).toBe(false);

    const upToDate = log.getSince(GATE, 3);
    expect(upToDate.events).toEqual([]);
    expect(upToDate.hasGap).toBe(false);
  });

  it('room desconhecida: vazio, sem gap, latestSeq 0', () => {
    const log = new EventLogService();
    const res = log.getSince('school:inexistente:gate', 0);
    expect(res).toEqual({ events: [], hasGap: false, oldestRetainedSeq: null, latestSeq: 0 });
    expect(log.latestSeq('school:inexistente:gate')).toBe(0);
  });

  it('overflow do buffer: hasGap=true quando o pedido é mais antigo que o retido', () => {
    const log = new EventLogService();
    for (let i = 0; i < MAX_EVENTS_PER_ROOM + 5; i++) {
      log.append(GATE, 'queue.entry.status_changed', { i });
    }
    // Retidos: seq 6..505; seq 1..5 saíram do buffer.
    const gap = log.getSince(GATE, 2);
    expect(gap.hasGap).toBe(true);
    expect(gap.oldestRetainedSeq).toBe(6);
    expect(gap.latestSeq).toBe(MAX_EVENTS_PER_ROOM + 5);
    expect(gap.events[0].seq).toBe(6);

    // Pedido dentro da janela retida: sem gap, só o que falta.
    const ok = log.getSince(GATE, MAX_EVENTS_PER_ROOM);
    expect(ok.hasGap).toBe(false);
    expect(ok.events.map((e) => e.seq)).toEqual([
      MAX_EVENTS_PER_ROOM + 1,
      MAX_EVENTS_PER_ROOM + 2,
      MAX_EVENTS_PER_ROOM + 3,
      MAX_EVENTS_PER_ROOM + 4,
      MAX_EVENTS_PER_ROOM + 5,
    ]);
  });

  it('latestSeq acompanha o último append por room', () => {
    const log = new EventLogService();
    expect(log.latestSeq(GATE)).toBe(0);
    log.append(GATE, 'queue.entry.created', {});
    log.append(GATE, 'queue.entry.created', {});
    expect(log.latestSeq(GATE)).toBe(2);
    expect(log.latestSeq(ROOM)).toBe(0);
  });
});
