import { EventLogService } from './event-log.service';
import { RealtimeService } from './realtime.service';

// Gateway falso: captura o que seria emitido para a room, sem socket de verdade.
function stubGateway() {
  const emitted: { room: string; event: string; payload: unknown }[] = [];
  const server = {
    to: (room: string) => ({
      emit: (event: string, payload: unknown) => {
        emitted.push({ room, event, payload });
      },
    }),
  };
  return { gw: { server } as any, emitted };
}

describe('RealtimeService — envelope com seq por room', () => {
  it('emite { seq, data } e o seq incrementa por room', async () => {
    const { gw, emitted } = stubGateway();
    const svc = new RealtimeService(gw, new EventLogService());

    await svc.entryCreated('s1', 'c1', { entryId: 'e1' });
    await svc.entryStatus('s1', 'c1', { entryId: 'e1', status: 'CALLED' });

    // entryCreated: gate + classroom; entryStatus: gate + classroom + admin = 5 emissões.
    expect(emitted).toHaveLength(5);
    const gate = emitted.filter((e) => e.room === 'school:s1:gate');
    expect(gate.map((e) => e.event)).toEqual(['queue.entry.created', 'queue.entry.status_changed']);
    expect(gate[0].payload).toEqual({ seq: 1, data: { entryId: 'e1' } });
    expect(gate[1].payload).toEqual({ seq: 2, data: { entryId: 'e1', status: 'CALLED' } });

    const classroom = emitted.filter((e) => e.room === 'school:s1:classroom:c1');
    expect(classroom[0].event).toBe('student.called');
    expect(classroom[0].payload).toEqual({ seq: 1, data: { entryId: 'e1' } });
  });

  it('sem servidor (gateway ainda não subiu) não quebra', async () => {
    const svc = new RealtimeService({} as any, new EventLogService());
    await expect(svc.entryCreated('s1', 'c1', { entryId: 'e1' })).resolves.not.toThrow();
  });
});
