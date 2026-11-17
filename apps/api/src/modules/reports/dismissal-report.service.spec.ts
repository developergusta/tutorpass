import { DismissalReportService, PickupMode } from './dismissal-report.service';

describe('DismissalReportService — relatório de tempo de saída ("escola amiga do trânsito")', () => {
  const school = 'school-1';
  const now = new Date('2026-11-17T21:00:00Z');
  const at = (iso: string) => new Date(iso);

  function pickup(
    s: DismissalReportService,
    o: {
      student: string;
      room?: string | null;
      mode?: PickupMode;
      joined: string;
      called?: string | null;
      released: string;
      schoolId?: string;
      eventId?: string;
      nowAt?: Date;
    },
  ) {
    return s.recordPickup(
      {
        schoolId: o.schoolId ?? school,
        studentId: o.student,
        classroomId: o.room ?? null,
        mode: o.mode ?? 'CAR',
        joinedAt: at(o.joined),
        calledAt: o.called === undefined ? null : o.called === null ? null : at(o.called),
        releasedAt: at(o.released),
        eventId: o.eventId,
      },
      o.nowAt ?? now,
    );
  }

  /** Dia 17/11 com 4 retiradas: esperas 2, 4, 6 e 10 min. */
  function serviceWithDay17() {
    const s = new DismissalReportService();
    pickup(s, { student: 'stu-1', room: 'room-A', mode: 'CAR', joined: '2026-11-17T17:00:00Z', called: '2026-11-17T17:02:00Z', released: '2026-11-17T17:04:00Z' });
    pickup(s, { student: 'stu-2', room: 'room-A', mode: 'CAR', joined: '2026-11-17T17:01:00Z', called: '2026-11-17T17:05:00Z', released: '2026-11-17T17:09:00Z' });
    pickup(s, { student: 'stu-3', room: 'room-B', mode: 'WALK', joined: '2026-11-17T17:03:00Z', called: '2026-11-17T17:06:00Z', released: '2026-11-17T17:12:00Z' });
    pickup(s, { student: 'stu-4', room: 'room-B', mode: 'BUS', joined: '2026-11-17T17:00:00Z', called: '2026-11-17T17:10:00Z', released: '2026-11-17T17:20:00Z' });
    return s;
  }

  it('registra a retirada com espera (chamada→liberação) e tempo na fila (entrada→chamada)', () => {
    const s = new DismissalReportService();
    const e = pickup(s, { student: 'stu-1', joined: '2026-11-17T17:00:00Z', called: '2026-11-17T17:02:00Z', released: '2026-11-17T17:04:00Z' });
    expect(e.waitMinutes).toBe(2);
    expect(e.queueMinutes).toBe(2);
  });

  it('sem chamada registrada: espera null, mas a retirada conta no total', () => {
    const s = new DismissalReportService();
    const e = pickup(s, { student: 'stu-1', joined: '2026-11-17T17:00:00Z', called: null, released: '2026-11-17T17:15:00Z' });
    expect(e.waitMinutes).toBeNull();
    expect(e.queueMinutes).toBeNull();
    const d = s.dailySummary(school, '2026-11-17');
    expect(d.totalPickups).toBe(1);
    expect(d.withWait).toBe(0);
    expect(d.avgWaitMinutes).toBeNull();
    expect(d.trafficScore).toBeNull();
  });

  it('rejeita releasedAt antes de joinedAt, calledAt fora do intervalo e releasedAt no futuro', () => {
    const s = new DismissalReportService();
    const base = { student: 'stu-1', joined: '2026-11-17T17:00:00Z', called: '2026-11-17T17:02:00Z', released: '2026-11-17T17:04:00Z' };
    expect(() => pickup(s, { ...base, released: '2026-11-17T16:59:00Z' })).toThrow('releasedAt não pode ser antes de joinedAt');
    expect(() => pickup(s, { ...base, called: '2026-11-17T16:59:00Z' })).toThrow('calledAt precisa estar entre joinedAt e releasedAt');
    expect(() => pickup(s, { ...base, called: '2026-11-17T17:05:00Z' })).toThrow('calledAt precisa estar entre joinedAt e releasedAt');
    expect(() => pickup(s, { ...base, released: '2026-11-17T22:00:00Z' })).toThrow('releasedAt não pode estar no futuro');
  });

  it('rejeita mode inválido e ids obrigatórios', () => {
    const s = new DismissalReportService();
    expect(() =>
      s.recordPickup(
        { schoolId: school, studentId: 'stu-1', mode: 'HELICOPTER' as PickupMode, joinedAt: at('2026-11-17T17:00:00Z'), releasedAt: at('2026-11-17T17:04:00Z') },
        now,
      ),
    ).toThrow('mode inválido');
    expect(() =>
      s.recordPickup(
        { schoolId: '', studentId: 'stu-1', mode: 'CAR', joinedAt: at('2026-11-17T17:00:00Z'), releasedAt: at('2026-11-17T17:04:00Z') },
        now,
      ),
    ).toThrow('são obrigatórios');
  });

  it('ingestão idempotente por eventId: reenvio não duplica', () => {
    const s = new DismissalReportService();
    const input = { student: 'stu-1', joined: '2026-11-17T17:00:00Z', called: '2026-11-17T17:02:00Z', released: '2026-11-17T17:04:00Z', eventId: 'evt-1' };
    const first = pickup(s, input);
    const second = pickup(s, input);
    expect(second.eventId).toBe(first.eventId);
    expect(s.count(school)).toBe(1);
  });

  it('dia sem retiradas: totais zero e estatísticas null — nunca inventa número', () => {
    const s = new DismissalReportService();
    const d = s.dailySummary(school, '2026-11-17');
    expect(d.totalPickups).toBe(0);
    expect(d.avgWaitMinutes).toBeNull();
    expect(d.medianWaitMinutes).toBeNull();
    expect(d.p95WaitMinutes).toBeNull();
    expect(d.maxWaitMinutes).toBeNull();
    expect(d.shareUnder5Min).toBeNull();
    expect(d.peakWindow).toBeNull();
    expect(d.trafficScore).toBeNull();
    expect(d.trafficLabel).toBeNull();
    expect(d.byMode).toEqual([]);
    expect(d.byClassroom).toEqual([]);
  });

  it('resumo diário: média, mediana, p95, máxima e fração ≤ 5 min (esperas 2, 4, 6, 10)', () => {
    const s = serviceWithDay17();
    const d = s.dailySummary(school, '2026-11-17');
    expect(d.totalPickups).toBe(4);
    expect(d.withWait).toBe(4);
    expect(d.avgWaitMinutes).toBe(5.5);
    expect(d.medianWaitMinutes).toBe(5);
    expect(d.p95WaitMinutes).toBe(10);
    expect(d.maxWaitMinutes).toBe(10);
    expect(d.shareUnder5Min).toBe(0.5);
  });

  it('mediana com nº ímpar e p95 pelo nearest-rank (esperas 2, 4, 9)', () => {
    const s = new DismissalReportService();
    pickup(s, { student: 'a', joined: '2026-11-17T17:00:00Z', called: '2026-11-17T17:00:00Z', released: '2026-11-17T17:02:00Z' });
    pickup(s, { student: 'b', joined: '2026-11-17T17:00:00Z', called: '2026-11-17T17:00:00Z', released: '2026-11-17T17:04:00Z' });
    pickup(s, { student: 'c', joined: '2026-11-17T17:00:00Z', called: '2026-11-17T17:00:00Z', released: '2026-11-17T17:09:00Z' });
    const d = s.dailySummary(school, '2026-11-17');
    expect(d.medianWaitMinutes).toBe(4);
    expect(d.p95WaitMinutes).toBe(9);
  });

  it('janela de pico de 15 min: 17:00–17:15 com 3 liberações', () => {
    const s = serviceWithDay17();
    const d = s.dailySummary(school, '2026-11-17');
    expect(d.peakWindow).toBe('17:00–17:15');
    expect(d.peakWindowCount).toBe(3);
  });

  it('empate na janela de pico: a mais cedo vence', () => {
    const s = new DismissalReportService();
    pickup(s, { student: 'a', joined: '2026-11-17T17:00:00Z', called: '2026-11-17T17:00:00Z', released: '2026-11-17T17:05:00Z' });
    pickup(s, { student: 'b', joined: '2026-11-17T17:00:00Z', called: '2026-11-17T17:00:00Z', released: '2026-11-17T17:20:00Z' });
    const d = s.dailySummary(school, '2026-11-17');
    expect(d.peakWindow).toBe('17:00–17:15');
    expect(d.peakWindowCount).toBe(1);
  });

  it('quebra por modo (só modos com retiradas) e por sala, ordenada', () => {
    const s = serviceWithDay17();
    const d = s.dailySummary(school, '2026-11-17');
    expect(d.byMode).toEqual([
      { mode: 'CAR', count: 2, avgWaitMinutes: 3 },
      { mode: 'WALK', count: 1, avgWaitMinutes: 6 },
      { mode: 'BUS', count: 1, avgWaitMinutes: 10 },
    ]);
    expect(d.byClassroom).toEqual([
      { classroomId: 'room-A', count: 2, avgWaitMinutes: 3 },
      { classroomId: 'room-B', count: 2, avgWaitMinutes: 8 },
    ]);
  });

  it('score: todas as esperas ≤ 5 min e média 2 → 93, EXCELENTE', () => {
    const s = new DismissalReportService();
    for (const stu of ['a', 'b', 'c']) {
      pickup(s, { student: stu, joined: '2026-11-17T17:00:00Z', called: '2026-11-17T17:00:00Z', released: '2026-11-17T17:02:00Z' });
    }
    const d = s.dailySummary(school, '2026-11-17');
    expect(d.trafficScore).toBe(93);
    expect(d.trafficLabel).toBe('EXCELENTE');
  });

  it('score: esperas 20 e 25 min → 0, CRITICA', () => {
    const s = new DismissalReportService();
    pickup(s, { student: 'a', joined: '2026-11-17T17:00:00Z', called: '2026-11-17T17:00:00Z', released: '2026-11-17T17:20:00Z' });
    pickup(s, { student: 'b', joined: '2026-11-17T17:00:00Z', called: '2026-11-17T17:00:00Z', released: '2026-11-17T17:25:00Z' });
    const d = s.dailySummary(school, '2026-11-17');
    expect(d.trafficScore).toBe(0);
    expect(d.trafficLabel).toBe('CRITICA');
  });

  it('score do dia 17/11 (esperas 2, 4, 6, 10): 57, ATENCAO', () => {
    const s = serviceWithDay17();
    const d = s.dailySummary(school, '2026-11-17');
    expect(d.trafficScore).toBe(57);
    expect(d.trafficLabel).toBe('ATENCAO');
  });

  it('isolamento por escola: eventos de outra escola não entram no resumo', () => {
    const s = serviceWithDay17();
    pickup(s, { student: 'x', schoolId: 'school-2', joined: '2026-11-17T17:00:00Z', called: '2026-11-17T17:00:00Z', released: '2026-11-17T17:01:00Z' });
    expect(s.dailySummary(school, '2026-11-17').totalPickups).toBe(4);
    expect(s.dailySummary('school-2', '2026-11-17').totalPickups).toBe(1);
  });

  it('resumo do período: totais, melhor/pior dia, dia mais cheio e série diária', () => {
    const s = serviceWithDay17();
    const now2 = new Date('2026-11-19T21:00:00Z');
    pickup(s, { student: 'stu-5', joined: '2026-11-18T17:00:00Z', called: '2026-11-18T17:00:00Z', released: '2026-11-18T17:01:00Z', nowAt: now2 });
    pickup(s, { student: 'stu-6', joined: '2026-11-18T17:00:00Z', called: '2026-11-18T17:00:00Z', released: '2026-11-18T17:03:00Z', nowAt: now2 });
    const p = s.periodSummary(school, '2026-11-17', '2026-11-18');
    expect(p.days).toBe(2);
    expect(p.totalPickups).toBe(6);
    expect(p.avgWaitMinutes).toBe(4.33);
    expect(p.medianWaitMinutes).toBe(3.5);
    expect(p.p95WaitMinutes).toBe(10);
    expect(p.bestDay).toBe('2026-11-18');
    expect(p.worstDay).toBe('2026-11-17');
    expect(p.busiestDay).toBe('2026-11-17');
    expect(p.daily).toEqual([
      { date: '2026-11-17', totalPickups: 4, avgWaitMinutes: 5.5, trafficScore: 57 },
      { date: '2026-11-18', totalPickups: 2, avgWaitMinutes: 2, trafficScore: 93 },
    ]);
  });

  it('período sem dados: extremos null e série com dias vazios', () => {
    const s = new DismissalReportService();
    const p = s.periodSummary(school, '2026-11-17', '2026-11-18');
    expect(p.totalPickups).toBe(0);
    expect(p.bestDay).toBeNull();
    expect(p.worstDay).toBeNull();
    expect(p.busiestDay).toBeNull();
    expect(p.daily).toEqual([
      { date: '2026-11-17', totalPickups: 0, avgWaitMinutes: null, trafficScore: null },
      { date: '2026-11-18', totalPickups: 0, avgWaitMinutes: null, trafficScore: null },
    ]);
  });

  it('validação do período: formato e from depois de to', () => {
    const s = new DismissalReportService();
    expect(() => s.dailySummary(school, '17/11/2026')).toThrow('YYYY-MM-DD');
    expect(() => s.periodSummary(school, '2026-11-18', '2026-11-17')).toThrow('from não pode ser depois de to');
    expect(() => s.periodSummary(school, '2026-11-17', '18/11/2026')).toThrow('YYYY-MM-DD');
  });

  it('export CSV: cabeçalho + uma linha por dia, com números ausentes vazios', () => {
    const s = serviceWithDay17();
    pickup(s, { student: 'stu-5', joined: '2026-11-18T17:00:00Z', called: '2026-11-18T17:00:00Z', released: '2026-11-18T17:01:00Z', nowAt: new Date('2026-11-19T21:00:00Z') });
    const p = s.periodSummary(school, '2026-11-17', '2026-11-19');
    expect(s.toCsv(p)).toBe(
      [
        'date,total_pickups,avg_wait_minutes,traffic_score,traffic_label',
        '2026-11-17,4,5.50,57,ATENCAO',
        '2026-11-18,1,1.00,97,EXCELENTE',
        '2026-11-19,0,,,',
      ].join('\n'),
    );
  });

  it('expurgo por retenção: evento antigo sai, recente fica; idempotente', () => {
    const s = new DismissalReportService();
    pickup(s, { student: 'old', joined: '2026-08-01T17:00:00Z', called: '2026-08-01T17:00:00Z', released: '2026-08-01T17:05:00Z' });
    pickup(s, { student: 'new', joined: '2026-11-17T17:00:00Z', called: '2026-11-17T17:00:00Z', released: '2026-11-17T17:02:00Z' });
    expect(s.purgeOlderThan(90, now)).toEqual({ removed: 1 });
    expect(s.count(school)).toBe(1);
    expect(s.purgeOlderThan(90, now)).toEqual({ removed: 0 });
  });
});
