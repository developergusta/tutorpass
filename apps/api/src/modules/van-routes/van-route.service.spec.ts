import { VanRouteService } from './van-route.service';

describe('VanRouteService — módulo van/fretado', () => {
  const now = new Date('2026-11-17T06:00:00-03:00');
  const at = (min: number) => new Date(now.getTime() + min * 60_000);
  const school = 'school-1';
  const driver = 'driver-1';
  const students = ['stu-1', 'stu-2', 'stu-3'];

  function route(s: VanRouteService, opts: { driverId?: string; date?: string; studentIds?: string[] } = {}) {
    return s.createRoute(
      {
        schoolId: school,
        driverId: opts.driverId ?? driver,
        direction: 'TO_SCHOOL',
        date: opts.date ?? '2026-11-17',
        studentIds: opts.studentIds ?? students,
      },
      now,
    );
  }

  function running(s: VanRouteService, opts: Parameters<typeof route>[1] = {}) {
    const r = route(s, opts);
    return s.startRoute(school, r.id, opts.driverId ?? driver, at(1));
  }

  it('cria a rota com as paradas na ordem informada', () => {
    const s = new VanRouteService();
    const r = route(s);
    expect(r.status).toBe('PLANNED');
    expect(r.stops.map((x) => x.studentId)).toEqual(students);
    expect(r.stops.map((x) => x.order)).toEqual([1, 2, 3]);
    expect(r.stops.every((x) => x.status === 'WAITING')).toBe(true);
    expect(r.events).toHaveLength(1);
    expect(r.events[0].type).toBe('ROUTE_CREATED');
  });

  it('rejeita rota sem aluno, com aluno duplicado e com data inválida', () => {
    const s = new VanRouteService();
    expect(() => route(s, { studentIds: [] })).toThrow('ao menos um aluno');
    expect(() => route(s, { studentIds: ['stu-1', 'stu-1'] })).toThrow('duas vezes');
    expect(() => route(s, { date: '17/11/2026' })).toThrow('Data inválida');
  });

  it('um motorista só roda uma rota ativa por vez', () => {
    const s = new VanRouteService();
    route(s);
    expect(() => route(s, { date: '2026-11-18' })).toThrow('já tem uma rota ativa');
    // outro motorista pode; mesma escola, outro dia, não interfere
    expect(() => route(s, { driverId: 'driver-2' })).not.toThrow();
  });

  it('só o motorista da rota inicia; só rota planejada inicia', () => {
    const s = new VanRouteService();
    const r = route(s);
    expect(() => s.startRoute(school, r.id, 'driver-2', at(1))).toThrow('Só o motorista');
    const started = s.startRoute(school, r.id, driver, at(1));
    expect(started.status).toBe('RUNNING');
    expect(started.startedAt).toEqual(at(1));
    expect(() => s.startRoute(school, r.id, driver, at(2))).toThrow('só rota planejada');
  });

  it('fluxo feliz: embarcou → entregue, um a um', () => {
    const s = new VanRouteService();
    const r = running(s);
    let v = s.markBoarded(school, r.id, 'stu-1', driver, at(5));
    expect(v.stops[0].status).toBe('BOARDED');
    expect(v.stops[0].boardedAt).toEqual(at(5));
    v = s.markDelivered(school, r.id, 'stu-1', driver, at(20));
    expect(v.stops[0].status).toBe('DELIVERED');
    // embarcar de novo é erro; entregar sem embarcar é erro
    expect(() => s.markBoarded(school, r.id, 'stu-1', driver, at(21))).toThrow('esperado waiting');
    expect(() => s.markDelivered(school, r.id, 'stu-2', driver, at(21))).toThrow('esperado boarded');
  });

  it('"não estava no ponto" registra ausência com observação e segue a rota', () => {
    const s = new VanRouteService();
    const r = running(s);
    const v = s.markAbsent(school, r.id, 'stu-2', driver, 'ninguém no portão', at(10));
    expect(v.stops[1].status).toBe('ABSENT');
    expect(v.stops[1].absentAt).toEqual(at(10));
    expect(v.stops[1].note).toBe('ninguém no portão');
    expect(v.events.at(-1)?.type).toBe('STOP_ABSENT');
  });

  it('"não vai hoje": o responsável avisa antes e durante a rota; depois de embarcado, não', () => {
    const s = new VanRouteService();
    const r = route(s);
    let v = s.markWillNotRide(school, r.id, 'stu-3', 'tutor-9', at(0));
    expect(v.stops[2].status).toBe('NOT_RIDING');
    expect(v.stops[2].notRidingBy).toBe('tutor-9');
    const r2 = running(s, { driverId: 'driver-2', studentIds: ['stu-1', 'stu-2'] });
    v = s.markWillNotRide(school, r2.id, 'stu-1', 'tutor-9', at(3));
    expect(v.stops[0].status).toBe('NOT_RIDING');
    v = s.markBoarded(school, r2.id, 'stu-2', 'driver-2', at(4));
    expect(() => s.markWillNotRide(school, r2.id, 'stu-2', 'tutor-9', at(5))).toThrow('não dá mais para avisar');
  });

  it('nextStop é a "criança da vez": primeira WAITING na ordem', () => {
    const s = new VanRouteService();
    const r = running(s);
    expect(s.nextStop(school, r.id)?.studentId).toBe('stu-1');
    s.markBoarded(school, r.id, 'stu-1', driver, at(5));
    expect(s.nextStop(school, r.id)?.studentId).toBe('stu-2');
    s.markWillNotRide(school, r.id, 'stu-2', 'tutor-9', at(6));
    expect(s.nextStop(school, r.id)?.studentId).toBe('stu-3');
  });

  it('a rota NÃO fecha com criança a bordo — o erro lista quem está a bordo', () => {
    const s = new VanRouteService();
    const r = running(s);
    s.markBoarded(school, r.id, 'stu-1', driver, at(5));
    expect(() => s.finishRoute(school, r.id, driver, at(30))).toThrow('não fecha');
    expect(() => s.finishRoute(school, r.id, driver, at(30))).toThrow('stu-1');
    s.markDelivered(school, r.id, 'stu-1', driver, at(20));
    // ainda há WAITING sem registro — também bloqueia
    expect(() => s.finishRoute(school, r.id, driver, at(30))).toThrow('sem registro');
    s.markAbsent(school, r.id, 'stu-2', driver, undefined, at(25));
    s.markWillNotRide(school, r.id, 'stu-3', 'tutor-9', at(26));
    const v = s.finishRoute(school, r.id, driver, at(30));
    expect(v.status).toBe('FINISHED');
    expect(v.finishedAt).toEqual(at(30));
  });

  it('cancelar com criança a bordo é bloqueado; sem criança a bordo, cancela', () => {
    const s = new VanRouteService();
    const r = running(s);
    s.markBoarded(school, r.id, 'stu-1', driver, at(5));
    expect(() => s.cancelRoute(school, r.id, driver, at(6))).toThrow('criança a bordo');
    s.markDelivered(school, r.id, 'stu-1', driver, at(20));
    const v = s.cancelRoute(school, r.id, driver, at(21));
    expect(v.status).toBe('CANCELLED');
    expect(() => s.cancelRoute(school, r.id, driver, at(22))).toThrow('não pode ser cancelada');
  });

  it('correção exige motivo e guarda o registro original no log (nada apagado)', () => {
    const s = new VanRouteService();
    const r = running(s);
    s.markBoarded(school, r.id, 'stu-1', driver, at(5));
    expect(() => s.correctStop(school, r.id, 'stu-1', 'ABSENT', 'ok', driver, at(6))).toThrow('motivo');
    const v = s.correctStop(school, r.id, 'stu-1', 'ABSENT', 'embarquei o aluno errado', driver, at(6));
    expect(v.stops[0].status).toBe('ABSENT');
    expect(v.stops[0].absentAt).toEqual(at(6));
    const types = v.events.map((e) => e.type);
    expect(types).toContain('STOP_BOARDED');
    expect(types).toContain('STOP_CORRECTED');
    const correction = v.events.find((e) => e.type === 'STOP_CORRECTED');
    expect(correction?.from).toBe('BOARDED');
    expect(correction?.to).toBe('ABSENT');
    expect(correction?.reason).toBe('embarquei o aluno errado');
    expect(s.verifyChain(school, r.id).valid).toBe(true);
  });

  it('correção de parada WAITING não existe — registra-se o embarque', () => {
    const s = new VanRouteService();
    const r = running(s);
    expect(() => s.correctStop(school, r.id, 'stu-1', 'ABSENT', 'motivo ok', driver, at(6))).toThrow(
      'registre o embarque primeiro',
    );
  });

  it('listOverdueRoutes: rota além do tempo com criança a bordo aparece; sem criança, não', () => {
    const s = new VanRouteService();
    const r = running(s, { driverId: 'driver-2', studentIds: ['stu-1'] });
    s.markBoarded(school, r.id, 'stu-1', 'driver-2', at(5));
    // 90 min de duração esperada: aos 95 min, 5 min de atraso
    const overdue = s.listOverdueRoutes(school, at(1 + 95));
    expect(overdue).toHaveLength(1);
    expect(overdue[0].overdueMinutes).toBe(5);
    expect(overdue[0].childrenOnBoard.map((x) => x.studentId)).toEqual(['stu-1']);
    // dentro do tempo, nada
    expect(s.listOverdueRoutes(school, at(30))).toHaveLength(0);
    // entregou: some da lista de alerta
    s.markDelivered(school, r.id, 'stu-1', 'driver-2', at(100));
    expect(s.listOverdueRoutes(school, at(1 + 95))).toHaveLength(0);
  });

  it('verifyChain detecta adulteração no log', () => {
    const s = new VanRouteService();
    const r = running(s);
    const stored = (s as unknown as { routes: Map<string, { events: { type: string }[] }> }).routes.get(r.id);
    expect(stored).toBeDefined();
    stored!.events[0].type = 'ROUTE_CANCELLED';
    expect(s.verifyChain(school, r.id)).toEqual({ valid: false, brokenAtSeq: 1 });
  });

  it('refresh cancela rotas planejadas de dias passados (idempotente)', () => {
    const s = new VanRouteService();
    const old = route(s, { date: '2026-11-16' });
    const today = route(s, { driverId: 'driver-2', date: '2026-11-17' });
    expect(s.refresh(at(10))).toEqual({ cancelled: 1 });
    expect(s.getRoute(school, old.id).status).toBe('CANCELLED');
    expect(s.getRoute(school, today.id).status).toBe('PLANNED');
    expect(s.refresh(at(11))).toEqual({ cancelled: 0 });
  });

  it('isolamento por escola: rota de outra escola não existe aqui', () => {
    const s = new VanRouteService();
    const r = route(s);
    expect(() => s.getRoute('school-2', r.id)).toThrow('não encontrada');
    expect(s.listRoutesForSchool('school-2')).toHaveLength(0);
    expect(s.listRoutesForSchool(school, { date: '2026-11-17' })).toHaveLength(1);
    expect(s.listActiveForDriver(school, driver)).toHaveLength(1);
    expect(s.listActiveForDriver(school, 'driver-9')).toHaveLength(0);
  });

  it('só o motorista da rota registra embarques e entregas', () => {
    const s = new VanRouteService();
    const r = running(s);
    expect(() => s.markBoarded(school, r.id, 'stu-1', 'driver-2', at(5))).toThrow('Só o motorista');
    expect(() => s.markAbsent(school, r.id, 'stu-1', 'driver-2', undefined, at(5))).toThrow('Só o motorista');
  });
});
