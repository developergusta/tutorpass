import { Injectable } from '@nestjs/common';

// Relatório de tempo de saída p/ a diretoria ("escola amiga do trânsito").
// Lógica pura, in-memory como os demais serviços; persistência no Step 2
// sobre `PickupQueueEntry` (joinedAt/calledAt/validatedAt/releasedAt +
// waitSeconds, já no schema) e `PickupLog`.
//
// Inspiração (pesquisa frente d, ciclo 14): PikMyKid/TechAhead — "33% menos
// tempo na fila" como argumento de venda, US$ 47 mil economizados/escola/ano
// e 75 min/semana devolvidos ao professor; Albion (PikMyKid) — saída média
// de 15 min do início ao fim; comparativo 2026 (eathealthy365) — "Reporting
// & Analytics" é critério de compra: quanto o tempo de saída caiu, quais os
// dias mais cheios, p/ mostrar o valor ao conselho e à comunidade de pais;
// Placa.ai (2026) — 45+ min de saída média com coordenação manual, relatório
// diário + tendências + gargalos, e o "One-Lane Pilot": medir a redução do
// tempo de espera depois de 30 dias. GoHome já vende o ângulo "escola amiga
// do trânsito" no BR.
//
// O relatório é a PROVA do valor: a diretoria usa os números p/ captar
// alunos (e o piloto de 30 dias mede o antes/depois). Nenhum número é
// inventado: sem eventos de retirada, as estatísticas de espera são null e
// o score não existe — nunca "0 min" nem "100" sem dado.
//
// Contrato de fuso (mesmo do DismissalPlanService): as datas chegam no
// horário local da escola; o dia de um evento é a data UTC de `releasedAt`
// e a janela de pico usa a hora UTC — o controller do Step 2 converte o
// horário local da escola p/ UTC na ingestão (o DB guarda timestamptz).
// Agregados nunca carregam nome de aluno ou tutor: só contagens e médias
// (por sala, por modo). Sem persistência de posição — só os instantes da
// retirada, que já são o registro de auditoria do PickupLog.

export type PickupMode = 'CAR' | 'WALK' | 'BUS' | 'VAN';

export interface PickupEvent {
  eventId: string;
  schoolId: string;
  studentId: string;
  classroomId: string | null;
  mode: PickupMode;
  joinedAt: Date;
  calledAt: Date | null;
  releasedAt: Date;
  /** Minutos entre a chamada e a liberação; null quando nunca houve chamada. */
  waitMinutes: number | null;
  /** Minutos na fila antes da chamada; null quando nunca houve chamada. */
  queueMinutes: number | null;
}

export interface ModeBreakdown {
  mode: PickupMode;
  count: number;
  avgWaitMinutes: number | null;
}

export interface ClassroomBreakdown {
  classroomId: string;
  count: number;
  avgWaitMinutes: number | null;
}

export type TrafficLabel =
  | 'EXCELENTE'
  | 'BOA'
  | 'ATENCAO'
  | 'CRITICA';

export interface DailySummary {
  schoolId: string;
  date: string; // YYYY-MM-DD
  totalPickups: number;
  withWait: number; // retiradas com chamada registrada (entram nas estatísticas)
  avgWaitMinutes: number | null;
  medianWaitMinutes: number | null;
  p95WaitMinutes: number | null;
  maxWaitMinutes: number | null;
  /** Fração das esperas ≤ 5 min (0–1); null sem dado de espera. */
  shareUnder5Min: number | null;
  /** Janela de 15 min com mais liberações ("HH:MM–HH:MM"); null sem retiradas. */
  peakWindow: string | null;
  peakWindowCount: number;
  byMode: ModeBreakdown[];
  byClassroom: ClassroomBreakdown[];
  /** 0–100; null sem dado de espera. Ver fórmula no README do módulo. */
  trafficScore: number | null;
  trafficLabel: TrafficLabel | null;
}

export interface DayPoint {
  date: string;
  totalPickups: number;
  avgWaitMinutes: number | null;
  trafficScore: number | null;
}

export interface PeriodSummary {
  schoolId: string;
  from: string; // YYYY-MM-DD (inclusivo)
  to: string; // YYYY-MM-DD (inclusivo)
  days: number;
  totalPickups: number;
  withWait: number;
  avgWaitMinutes: number | null;
  medianWaitMinutes: number | null;
  p95WaitMinutes: number | null;
  maxWaitMinutes: number | null;
  shareUnder5Min: number | null;
  trafficScore: number | null;
  trafficLabel: TrafficLabel | null;
  /** Dia com a menor espera média (≥ 1 espera); null sem dado. */
  bestDay: string | null;
  /** Dia com a maior espera média (≥ 1 espera); null sem dado. */
  worstDay: string | null;
  /** Dia com mais retiradas; null sem retiradas. */
  busiestDay: string | null;
  daily: DayPoint[];
}

const MODES: PickupMode[] = ['CAR', 'WALK', 'BUS', 'VAN'];
/** Espera considerada "rápida" — o padrão que a portaria promete aos pais. */
export const FAST_WAIT_MINUTES = 5;
/** Espera a partir da qual o score zera no componente de média. */
export const SLOW_WAIT_MINUTES = 15;
/** Retenção in-memory dos eventos (Step 2: o DB guarda o histórico). */
export const RETENTION_DAYS = 90;

function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function datePart(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function minutesBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 60_000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Mediana (média dos dois centrais quando par). Null sem valores. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? round2(sorted[mid])
    : round2((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Percentil pelo método nearest-rank. Null sem valores. */
function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return round2(sorted[rank - 1]);
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return round2(values.reduce((s, v) => s + v, 0) / values.length);
}

function trafficScoreFor(waits: number[]): { score: number; label: TrafficLabel } | null {
  if (waits.length === 0) return null;
  const mean = waits.reduce((s, v) => s + v, 0) / waits.length;
  const shareUnder5 = waits.filter((w) => w <= FAST_WAIT_MINUTES).length / waits.length;
  const meanComponent = Math.max(0, 1 - mean / SLOW_WAIT_MINUTES);
  const score = Math.round(50 * shareUnder5 + 50 * meanComponent);
  const label: TrafficLabel =
    score >= 80 ? 'EXCELENTE' : score >= 60 ? 'BOA' : score >= 40 ? 'ATENCAO' : 'CRITICA';
  return { score, label };
}

function peakWindowFor(events: PickupEvent[]): { window: string; count: number } | null {
  if (events.length === 0) return null;
  const buckets = new Map<string, number>();
  for (const e of events) {
    const h = e.releasedAt.getUTCHours();
    const m = e.releasedAt.getUTCMinutes();
    const startMin = Math.floor((h * 60 + m) / 15) * 15;
    const key = `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  let best: { window: string; count: number } | null = null;
  for (const [start, count] of buckets) {
    // Empate: a janela mais cedo vence (determinístico).
    if (!best || count > best.count) {
      const [hh, mm] = start.split(':').map(Number);
      const endMin = hh * 60 + mm + 15;
      const end = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
      best = { window: `${start}–${end}`, count };
    }
  }
  return best;
}

interface Aggregate {
  totalPickups: number;
  withWait: number;
  avgWaitMinutes: number | null;
  medianWaitMinutes: number | null;
  p95WaitMinutes: number | null;
  maxWaitMinutes: number | null;
  shareUnder5Min: number | null;
  peakWindow: string | null;
  peakWindowCount: number;
  byMode: ModeBreakdown[];
  byClassroom: ClassroomBreakdown[];
  trafficScore: number | null;
  trafficLabel: TrafficLabel | null;
}

function summarizeEvents(inRange: PickupEvent[]): Aggregate {
  const waits = inRange
    .map((e) => e.waitMinutes)
    .filter((w): w is number => w !== null);
const score = trafficScoreFor(waits);
const byMode: ModeBreakdown[] = MODES.map((mode) => {
    const modeEvents = inRange.filter((e) => e.mode === mode);
    const modeWaits = modeEvents
      .map((e) => e.waitMinutes)
      .filter((w): w is number => w !== null);
    return { mode, count: modeEvents.length, avgWaitMinutes: avg(modeWaits) };
  }).filter((b) => b.count > 0);
const classroomIds = [...new Set(
    inRange.filter((e) => e.classroomId !== null).map((e) => e.classroomId as string),
  )].sort();
const byClassroom: ClassroomBreakdown[] = classroomIds.map((classroomId) => {
    const roomEvents = inRange.filter((e) => e.classroomId === classroomId);
    const roomWaits = roomEvents
      .map((e) => e.waitMinutes)
      .filter((w): w is number => w !== null);
    return { classroomId, count: roomEvents.length, avgWaitMinutes: avg(roomWaits) };
  });
const peak = peakWindowFor(inRange);
return {
    totalPickups: inRange.length,
    withWait: waits.length,
    avgWaitMinutes: avg(waits),
    medianWaitMinutes: median(waits),
    p95WaitMinutes: percentile(waits, 95),
    maxWaitMinutes: waits.length ? round2(Math.max(...waits)) : null,
    shareUnder5Min:
      waits.length === 0
        ? null
        : round2(waits.filter((w) => w <= FAST_WAIT_MINUTES).length / waits.length),
    peakWindow: peak?.window ?? null,
    peakWindowCount: peak?.count ?? 0,
    byMode,
    byClassroom,
    trafficScore: score?.score ?? null,
    trafficLabel: score?.label ?? null,
  };
}

@Injectable()
export class DismissalReportService {
  private events: PickupEvent[] = [];

  /**
   * Registra uma retirada concluída. No Step 2, o controller alimenta este
   * serviço a partir de `PickupQueueEntry` (releasedAt preenchido) — aqui o
   * evento chega pronto, p/ a lógica de agregação ser testável sem DB.
   * `eventId` torna a ingestão idempotente: reenviar o mesmo evento devolve
   * o registro original sem duplicar.
   */
  recordPickup(
    input: {
      schoolId: string;
      studentId: string;
      classroomId?: string | null;
      mode: PickupMode;
      joinedAt: Date;
      calledAt?: Date | null;
      releasedAt: Date;
      eventId?: string;
    },
    now: Date = new Date(),
  ): PickupEvent {
    if (!input.schoolId || !input.studentId) throw new Error('schoolId e studentId são obrigatórios');
    if (!MODES.includes(input.mode)) throw new Error(`mode inválido: ${String(input.mode)}`);
    if (!isValidDate(input.joinedAt) || !isValidDate(input.releasedAt)) {
      throw new Error('joinedAt e releasedAt precisam ser datas válidas');
    }
    const calledAt = input.calledAt ?? null;
    if (calledAt !== null && !isValidDate(calledAt)) throw new Error('calledAt inválida');
    if (input.releasedAt.getTime() < input.joinedAt.getTime()) {
      throw new Error('releasedAt não pode ser antes de joinedAt');
    }
    if (calledAt !== null && (calledAt.getTime() < input.joinedAt.getTime() || calledAt.getTime() > input.releasedAt.getTime())) {
      throw new Error('calledAt precisa estar entre joinedAt e releasedAt');
    }
    if (input.releasedAt.getTime() > now.getTime()) {
      throw new Error('releasedAt não pode estar no futuro');
    }
    const eventId =
      input.eventId ?? `${input.schoolId}:${input.studentId}:${input.releasedAt.getTime()}`;
    const existing = this.events.find((e) => e.eventId === eventId);
    if (existing) return { ...existing };
    const event: PickupEvent = {
      eventId,
      schoolId: input.schoolId,
      studentId: input.studentId,
      classroomId: input.classroomId ?? null,
      mode: input.mode,
      joinedAt: input.joinedAt,
      calledAt,
      releasedAt: input.releasedAt,
      waitMinutes: calledAt ? round2(minutesBetween(calledAt, input.releasedAt)) : null,
      queueMinutes: calledAt ? round2(minutesBetween(input.joinedAt, calledAt)) : null,
    };
    this.events.push(event);
    return { ...event };
  }

  private eventsFor(schoolId: string): PickupEvent[] {
    return this.events.filter((e) => e.schoolId === schoolId);
  }

  /** Resumo de um dia (YYYY-MM-DD — data UTC de `releasedAt`, ver contrato de fuso). */
  dailySummary(schoolId: string, date: string): DailySummary {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date precisa ser YYYY-MM-DD');
    const inRange = this.eventsFor(schoolId).filter((e) => datePart(e.releasedAt) === date);
    const s = summarizeEvents(inRange);
    return { schoolId, date, ...s };
  }

  /**
   * Resumo de um período (datas inclusivas) com a série diária p/ gráfico e
   * os extremos do período — é o que alimenta o piloto de 30 dias (comparar
   * o período antes e depois de ligar o TutorPass) e o material da diretoria.
   */
  periodSummary(schoolId: string, from: string, to: string): PeriodSummary {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw new Error('from e to precisam ser YYYY-MM-DD');
    }
    if (from > to) throw new Error('from não pode ser depois de to');
    const inRange = this.eventsFor(schoolId).filter((e) => {
      const d = datePart(e.releasedAt);
      return d >= from && d <= to;
    });
    const s = summarizeEvents(inRange);
    const days: DayPoint[] = [];
    const cursor = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    while (cursor <= end) {
      const d = datePart(cursor);
      const day = this.dailySummary(schoolId, d);
      days.push({ date: d, totalPickups: day.totalPickups, avgWaitMinutes: day.avgWaitMinutes, trafficScore: day.trafficScore });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    const daysWithWait = days.filter((d) => d.avgWaitMinutes !== null);
    const bestDay =
      daysWithWait.length === 0
        ? null
        : daysWithWait.reduce((best, d) => ((d.avgWaitMinutes as number) < (best.avgWaitMinutes as number) ? d : best)).date;
    const worstDay =
      daysWithWait.length === 0
        ? null
        : daysWithWait.reduce((worst, d) => ((d.avgWaitMinutes as number) > (worst.avgWaitMinutes as number) ? d : worst)).date;
    const busiestDay =
      days.length === 0 || days.every((d) => d.totalPickups === 0)
        ? null
        : days.reduce((busy, d) => (d.totalPickups > busy.totalPickups ? d : busy)).date;
    return {
      schoolId,
      from,
      to,
      days: days.length,
      totalPickups: s.totalPickups,
      withWait: s.withWait,
      avgWaitMinutes: s.avgWaitMinutes,
      medianWaitMinutes: s.medianWaitMinutes,
      p95WaitMinutes: s.p95WaitMinutes,
      maxWaitMinutes: s.maxWaitMinutes,
      shareUnder5Min: s.shareUnder5Min,
      trafficScore: s.trafficScore,
      trafficLabel: s.trafficLabel,
      bestDay,
      worstDay,
      busiestDay,
      daily: days,
    };
  }

  /**
   * Exporta o resumo do período em CSV (uma linha por dia, separador `,`,
   * decimais com ponto) — o arquivo que a secretaria anexa ao e-mail da
   * diretoria ou abre no Excel. Números ausentes saem vazios, nunca zero.
   */
  toCsv(summary: PeriodSummary): string {
    const header = 'date,total_pickups,avg_wait_minutes,traffic_score,traffic_label';
    const rows = summary.daily.map((d) =>
      [
        d.date,
        d.totalPickups,
        d.avgWaitMinutes === null ? '' : d.avgWaitMinutes.toFixed(2),
        d.trafficScore === null ? '' : d.trafficScore,
        d.trafficScore === null ? '' : (this.dailySummary(summary.schoolId, d.date).trafficLabel ?? ''),
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }

  count(schoolId: string): number {
    return this.eventsFor(schoolId).length;
  }

  /** Job periódico: apaga eventos mais antigos que `days` (default 90). Idempotente. */
  purgeOlderThan(days: number = RETENTION_DAYS, now: Date = new Date()): { removed: number } {
    const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
    const before = this.events.length;
    this.events = this.events.filter((e) => e.releasedAt.getTime() >= cutoff);
    return { removed: before - this.events.length };
  }
}
