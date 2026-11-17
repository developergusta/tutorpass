import { EtaService } from './eta.service';

describe('EtaService — ETA ao vivo + fila ordenada por proximidade', () => {
  const now = new Date('2026-11-17T04:30:00-03:00');
  const at = (ms: number) => new Date(now.getTime() + ms);
  const school = 'school-1';

  function serviceWith(
    entries: Array<{ tutor: string; distanceM: number; speedKmh?: number; mode?: 'CAR' | 'WALK' }>,
  ) {
    const s = new EtaService();
    for (const e of entries) {
      s.updatePosition(
        { schoolId: school, tutorId: e.tutor, distanceM: e.distanceM, speedKmh: e.speedKmh, mode: e.mode },
        now,
      );
    }
    return s;
  }

  it('dentro do raio de chegada (250 m): HERE, ETA 0, cor RED — "encaminhar já"', () => {
    const s = new EtaService();
    const e = s.updatePosition({ schoolId: school, tutorId: 't1', distanceM: 120 }, now);
    expect(e.band).toBe('HERE');
    expect(e.etaMinutes).toBe(0);
    expect(e.color).toBe('RED');
    expect(e.stale).toBe(false);
  });

  it('900 m de carro a 30 km/h (default): 1,8 min → 2 min, banda NOW', () => {
    const s = new EtaService();
    const e = s.updatePosition({ schoolId: school, tutorId: 't1', distanceM: 900 }, now);
    expect(e.etaMinutes).toBe(2);
    expect(e.band).toBe('NOW');
    expect(e.color).toBe('ORANGE');
  });

  it('velocidade do GPS é usada quando informada: 1200 m a 60 km/h → 2 min', () => {
    const s = new EtaService();
    const e = s.updatePosition(
      { schoolId: school, tutorId: 't1', distanceM: 1200, speedKmh: 60 },
      now,
    );
    expect(e.etaMinutes).toBe(2);
    expect(e.band).toBe('NOW');
  });

  it('a pé usa 5 km/h por default: 400 m → 5 min, banda SOON', () => {
    const s = new EtaService();
    const e = s.updatePosition(
      { schoolId: school, tutorId: 't1', distanceM: 400, mode: 'WALK' },
      now,
    );
    expect(e.etaMinutes).toBe(5);
    expect(e.band).toBe('SOON');
    expect(e.color).toBe('YELLOW');
  });

  it('velocidade inválida (0) cai no default do modo, nunca divide por zero', () => {
    const s = new EtaService();
    const e = s.updatePosition(
      { schoolId: school, tutorId: 't1', distanceM: 900, speedKmh: 0 },
      now,
    );
    expect(e.etaMinutes).toBe(2);
    expect(e.band).toBe('NOW');
  });

  it('faixas de ETA: 6 min LATER, 10 min LATER, 11 min FAR', () => {
    const s = serviceWith([
      { tutor: 'a', distanceM: 3000 }, // 6 min a 30 km/h
      { tutor: 'b', distanceM: 5000 }, // 10 min
      { tutor: 'c', distanceM: 5500 }, // 11 min
    ]);
    const q = s.getQueue(school, now);
    expect(q.map((e) => [e.tutorId, e.band])).toEqual([
      ['a', 'LATER'],
      ['b', 'LATER'],
      ['c', 'FAR'],
    ]);
    expect(q[2].color).toBe('GRAY');
  });

  it('fila ordena: chegados primeiro (por ordem de chegada), depois ETA crescente', () => {
    const s = new EtaService();
    s.updatePosition({ schoolId: school, tutorId: 'longe', distanceM: 5000 }, now); // 10 min
    s.updatePosition({ schoolId: school, tutorId: 'perto', distanceM: 1500 }, now); // 3 min
    s.markArrived(school, 'chegou-2', 'CAR', at(2000));
    s.markArrived(school, 'chegou-1', 'CAR', at(1000));
    const q = s.getQueue(school, now);
    expect(q.map((e) => e.tutorId)).toEqual(['chegou-1', 'chegou-2', 'perto', 'longe']);
    expect(q.map((e) => e.position)).toEqual([1, 2, 3, 4]);
  });

  it('desempate por distância quando o ETA é igual', () => {
    const s = serviceWith([
      { tutor: 'b', distanceM: 1600, speedKmh: 32 }, // ~3 min
      { tutor: 'a', distanceM: 1500 }, // 3 min
    ]);
    const q = s.getQueue(school, now);
    expect(q[0].tutorId).toBe('a');
    expect(q[0].etaMinutes).toBe(q[1].etaMinutes);
  });

  it('sem atualização por > 60 s: STALE, ETA null, cor GRAY, vai p/ o fim da fila', () => {
    const s = new EtaService();
    s.updatePosition({ schoolId: school, tutorId: 'velho', distanceM: 900 }, now);
    s.updatePosition({ schoolId: school, tutorId: 'fresco', distanceM: 5000 }, at(30_000));
    const q = s.getQueue(school, at(61_000));
    expect(q[0].tutorId).toBe('fresco');
    expect(q[0].band).toBe('LATER'); // atualizado há 31 s — ainda fresco
    const stale = q[1];
    expect(stale.tutorId).toBe('velho');
    expect(stale.band).toBe('STALE');
    expect(stale.etaMinutes).toBeNull();
    expect(stale.stale).toBe(true);
  });

  it('STALE nunca é removido por getQueue — só o refresh tira da fila após 5 min', () => {
    const s = serviceWith([{ tutor: 'velho', distanceM: 900 }]);
    expect(s.getQueue(school, at(61_000))).toHaveLength(1);
    expect(s.refresh(at(4 * 60_000))).toEqual({ removed: 0 });
    expect(s.refresh(at(5 * 60_000 + 1))).toEqual({ removed: 1 });
    expect(s.getQueue(school, at(5 * 60_000 + 1))).toHaveLength(0);
    expect(s.refresh(at(6 * 60_000))).toEqual({ removed: 0 }); // idempotente
  });

  it('botão "Estou aqui": marca HERE mesmo sem posição (fallback p/ GPS falho)', () => {
    const s = new EtaService();
    const e = s.markArrived(school, 't1', 'CAR', now);
    expect(e.band).toBe('HERE');
    expect(e.etaMinutes).toBe(0);
    expect(e.arrivedAt).toEqual(now);
    expect(s.getQueue(school, now)[0].tutorId).toBe('t1');
  });

  it('histerese: tutor chegado não "des-chega" com ping a 260 m, mas des-chega a 300 m', () => {
    const s = new EtaService();
    s.markArrived(school, 't1', 'CAR', now);
    const jitter = s.updatePosition({ schoolId: school, tutorId: 't1', distanceM: 260 }, at(1000));
    expect(jitter.band).toBe('HERE');
    const away = s.updatePosition({ schoolId: school, tutorId: 't1', distanceM: 300 }, at(2000));
    expect(away.band).toBe('NOW');
    expect(away.arrivedAt).toBeNull();
  });

  it('atualização da posição recalcula o ETA (tutor se aproximando)', () => {
    const s = new EtaService();
    const first = s.updatePosition({ schoolId: school, tutorId: 't1', distanceM: 5000 }, now);
    expect(first.etaMinutes).toBe(10);
    const second = s.updatePosition({ schoolId: school, tutorId: 't1', distanceM: 900 }, at(60_000));
    expect(second.etaMinutes).toBe(2);
    expect(second.band).toBe('NOW');
  });

  it('removeTutor tira da fila; getQueue isola por escola', () => {
    const s = serviceWith([{ tutor: 't1', distanceM: 900 }]);
    s.updatePosition({ schoolId: 'school-2', tutorId: 't2', distanceM: 900 }, now);
    expect(s.count(school)).toBe(1);
    expect(s.getQueue('school-2', now)).toHaveLength(1);
    expect(s.removeTutor(school, 't1')).toBe(true);
    expect(s.removeTutor(school, 't1')).toBe(false);
    expect(s.getQueue(school, now)).toHaveLength(0);
    expect(s.getQueue('school-2', now)).toHaveLength(1);
  });

  it('getEntry devolve null p/ tutor desconhecido e a vista STALE sem mutar o estado', () => {
    const s = serviceWith([{ tutor: 't1', distanceM: 900 }]);
    expect(s.getEntry(school, 'ninguem', now)).toBeNull();
    const staleView = s.getEntry(school, 't1', at(61_000));
    expect(staleView?.band).toBe('STALE');
    // nova posição reanima a entrada
    const fresh = s.updatePosition({ schoolId: school, tutorId: 't1', distanceM: 900 }, at(62_000));
    expect(fresh.band).toBe('NOW');
  });
});
