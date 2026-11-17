import { PickupService } from '../pickup/pickup.service';
import { GateAlertService } from './gate-alert.service';

const SCHOOL = '11111111-1111-4111-8111-111111111111';

interface FetchCall {
  url: string;
  init?: { method?: string; headers?: Record<string, string>; body?: string };
}

function fakeFetch(response: { ok: boolean; status: number } | Error) {
  const calls: FetchCall[] = [];
  const fn = async (url: string, init?: FetchCall['init']) => {
    calls.push({ url, init });
    if (response instanceof Error) throw response;
    return response;
  };
  return { calls, fn: fn as unknown as typeof fetch };
}

describe('GateAlertService (ntfy da portaria)', () => {
  it('sem NTFY_BASE_URL, fica desligado e não chama a rede', async () => {
    const { calls, fn } = fakeFetch({ ok: true, status: 200 });
    const svc = new GateAlertService({}, fn);
    expect(svc.enabled).toBe(false);
    await expect(svc.tutorJoinedQueue(SCHOOL, 'Portão 1')).resolves.toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('publica no tópico da escola com título, prioridade e token — corpo enxuto (sem nomes)', async () => {
    const { calls, fn } = fakeFetch({ ok: true, status: 200 });
    const svc = new GateAlertService(
      { baseUrl: 'http://ntfy:80/', token: 'tk_teste' },
      fn,
    );
    expect(svc.enabled).toBe(true);
    expect(svc.topicFor(SCHOOL)).toBe(`tutorpass-${SCHOOL}-portaria`);
    await expect(svc.tutorJoinedQueue(SCHOOL, 'Portão 1')).resolves.toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`http://ntfy:80/tutorpass-${SCHOOL}-portaria`);
    expect(calls[0].init?.method).toBe('POST');
    expect(calls[0].init?.headers?.Authorization).toBe('Bearer tk_teste');
    expect(calls[0].init?.headers?.Priority).toBe('high');
    expect(calls[0].init?.body).toContain('Portão 1');
  });

  it('ntfy fora do ar (HTTP 500 ou erro de rede) → devolve false, nunca lança', async () => {
    const http500 = new GateAlertService(
      { baseUrl: 'http://ntfy:80' },
      fakeFetch({ ok: false, status: 500 }).fn,
    );
    await expect(http500.tutorJoinedQueue(SCHOOL, null)).resolves.toBe(false);
    const rede = new GateAlertService(
      { baseUrl: 'http://ntfy:80' },
      fakeFetch(new Error('ECONNREFUSED')).fn,
    );
    await expect(rede.tutorJoinedQueue(SCHOOL, null)).resolves.toBe(false);
  });

  it('PickupService.join apita a portaria com escola e portão da entrada', async () => {
    const tutorJoinedQueue = jest.fn(async () => true);
    const pickup = new PickupService(undefined, {
      tutorJoinedQueue,
    } as unknown as GateAlertService);
    const entry = pickup.join({
      schoolId: SCHOOL,
      studentId: 'aluno-1',
      tutorId: 'tutor-1',
      gate: 'Portão 1',
    });
    expect(entry.status).toBe('QUEUED');
    expect(tutorJoinedQueue).toHaveBeenCalledWith(SCHOOL, 'Portão 1');
  });
});
