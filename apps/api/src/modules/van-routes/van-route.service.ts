import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';

// Módulo van/fretado — o motorista retira vários alunos numa rota.
// Lógica pura, in-memory como os demais serviços; persistência no Step 2
// (modelos VanRoute + VanRouteStop, já no schema).
// Inspiração (pesquisa frente b, ciclo 13 — transporte escolar BR):
// - Escolar (lp.escolar.app.br, 2026): "a rota não fecha com criança a
//   bordo nem com criança sem registro"; alerta a cada 5 min se a rota
//   passa do tempo com criança a bordo (família avisada no dobro do tempo);
//   cada criança tem 3 toques — "Embarcou", "Entregue", "Não estava no
//   ponto"; "Corrigir pede um motivo e guarda o registro original — nada é
//   apagado: a hora de um embarque é prova"; o responsável avisa pelo app
//   que o aluno não vai, e o motorista já fica sabendo.
// - Vanep (2026): 4 avisos por dia (embarcou em casa, chegou na escola,
//   embarcou na volta, chegou em casa); "não vai hoje" com um toque.
// - Clickvan: motorista inicia o roteiro, registra embarque/ausência/
//   desembarque/não desembarque; responsáveis recebem notificação no início
//   e na aproximação da van.
// - Cadê a Van? / Via Van: localização só visível enquanto a rota roda;
//   aviso automático 5 min antes de chegar na casa do aluno.
// - VanEscola: notificação de aproximação com um clique; pai avisa a
//   ausência do aluno.
// O que o TutorPass traz de diferente: a rota da van alimenta a mesma fila
// de saída da escola (o aluno da van não passa pela portaria — ele já vem
// com o motorista), o registro de embarque é prova auditável (log
// append-only com hash encadeado, como o PickupLog) e a regra de segurança
// "não fecha com criança a bordo" é aplicada pelo servidor, não pela
// memória do motorista. Feature VAN_MODULE do plano (TRIAL/PRO — ver
// PlanService); no controller do Step 2, conferir hasFeature antes de
// criar a rota.
//
// Contrato de fuso: `now` chega no horário local da escola (mesmo
// contrato do DismissalPlanService); `date` é o dia letivo "YYYY-MM-DD".

export type VanDirection = 'TO_SCHOOL' | 'TO_HOME'; // ida / volta
export type VanRouteStatus = 'PLANNED' | 'RUNNING' | 'FINISHED' | 'CANCELLED';
export type VanStopStatus =
  | 'WAITING' // aguardando a van passar
  | 'BOARDED' // embarcou (a bordo agora)
  | 'DELIVERED' // entregue (na escola, na ida; em casa, na volta)
  | 'ABSENT' // "não estava no ponto" (motorista marcou)
  | 'NOT_RIDING'; // "não vai hoje" (responsável avisou antes)

export type VanRouteEventType =
  | 'ROUTE_CREATED'
  | 'ROUTE_STARTED'
  | 'STOP_BOARDED'
  | 'STOP_DELIVERED'
  | 'STOP_ABSENT'
  | 'STOP_NOT_RIDING'
  | 'STOP_CORRECTED'
  | 'ROUTE_FINISHED'
  | 'ROUTE_CANCELLED';

/** Duração esperada da rota quando a escola não informa (Escolar alerta a partir daí). */
export const DEFAULT_EXPECTED_DURATION_MIN = 90;
/** Estados finais de uma parada (nada mais a registrar naquele aluno). */
export const TERMINAL_STOP_STATUSES: VanStopStatus[] = ['DELIVERED', 'ABSENT', 'NOT_RIDING'];

export interface VanStop {
  studentId: string;
  /** Posição na rota (1 = primeira parada). */
  order: number;
  status: VanStopStatus;
  boardedAt: Date | null;
  deliveredAt: Date | null;
  absentAt: Date | null;
  notRidingAt: Date | null;
  /** Quem avisou "não vai hoje" (tutor do aluno). */
  notRidingBy: string | null;
  note: string | null;
}

export interface VanRouteEvent {
  seq: number;
  type: VanRouteEventType;
  at: Date;
  actorId: string | null;
  studentId: string | null;
  from: VanStopStatus | VanRouteStatus | null;
  to: VanStopStatus | VanRouteStatus | null;
  reason: string | null;
  hash: string;
  prevHash: string | null;
}

export interface VanRoute {
  id: string;
  schoolId: string;
  driverId: string;
  direction: VanDirection;
  /** Dia letivo da rota, "YYYY-MM-DD". */
  date: string;
  expectedDurationMin: number;
  status: VanRouteStatus;
  stops: VanStop[];
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  cancelledAt: Date | null;
  events: VanRouteEvent[];
}

export interface OverdueRoute {
  route: VanRoute;
  /** Minutos além da duração esperada. */
  overdueMinutes: number;
  childrenOnBoard: VanStop[];
}

function isDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

@Injectable()
export class VanRouteService {
  private routes = new Map<string, VanRoute>();

  static chainHash(prevHash: string | null, payload: unknown): string {
    return createHash('sha256')
      .update(`${prevHash ?? 'GENESIS'}:${JSON.stringify(payload)}`)
      .digest('hex');
  }

  private appendEvent(
    route: VanRoute,
    event: Omit<VanRouteEvent, 'seq' | 'hash' | 'prevHash'>,
  ): VanRouteEvent {
    const prev = route.events.length > 0 ? route.events[route.events.length - 1] : null;
    const prevHash = prev?.hash ?? null;
    const payload = { type: event.type, at: event.at, actorId: event.actorId, studentId: event.studentId, from: event.from, to: event.to, reason: event.reason };
    const full: VanRouteEvent = {
      ...event,
      seq: route.events.length + 1,
      prevHash,
      hash: VanRouteService.chainHash(prevHash, payload),
    };
    route.events.push(full);
    return full;
  }

  private getRouteOrThrow(schoolId: string, routeId: string): VanRoute {
    const route = this.routes.get(routeId);
    if (!route || route.schoolId !== schoolId) {
      throw new NotFoundException('Rota não encontrada');
    }
    return route;
  }

  private getStopOrThrow(route: VanRoute, studentId: string): VanStop {
    const stop = route.stops.find((s) => s.studentId === studentId);
    if (!stop) throw new NotFoundException('Aluno não está nesta rota');
    return stop;
  }

  private requireDriver(route: VanRoute, driverId: string): void {
    if (route.driverId !== driverId) {
      throw new ForbiddenException('Só o motorista desta rota pode registrar embarques');
    }
  }

  /**
   * Cria a rota do dia: motorista + paradas ordenadas (a ordem é a ordem de
   * embarque — o motorista pode abrir a rota no Waze/Google Maps, como no
   * Vanep). Um motorista só roda uma rota ativa por vez (PLANNED ou RUNNING).
   */
  createRoute(
    input: {
      schoolId: string;
      driverId: string;
      direction: VanDirection;
      date: string;
      studentIds: string[];
      expectedDurationMin?: number;
    },
    now: Date = new Date(),
  ): VanRoute {
    if (!input.studentIds || input.studentIds.length === 0) {
      throw new BadRequestException('A rota precisa de ao menos um aluno');
    }
    if (new Set(input.studentIds).size !== input.studentIds.length) {
      throw new BadRequestException('A rota não pode ter o mesmo aluno duas vezes');
    }
    if (!isDateString(input.date)) {
      throw new BadRequestException('Data inválida — use YYYY-MM-DD');
    }
    const active = [...this.routes.values()].find(
      (r) =>
        r.schoolId === input.schoolId &&
        r.driverId === input.driverId &&
        (r.status === 'PLANNED' || r.status === 'RUNNING'),
    );
    if (active) {
      throw new ConflictException('O motorista já tem uma rota ativa nesta escola');
    }
    const route: VanRoute = {
      id: randomUUID(),
      schoolId: input.schoolId,
      driverId: input.driverId,
      direction: input.direction,
      date: input.date,
      expectedDurationMin: input.expectedDurationMin ?? DEFAULT_EXPECTED_DURATION_MIN,
      status: 'PLANNED',
      stops: input.studentIds.map((studentId, i) => ({
        studentId,
        order: i + 1,
        status: 'WAITING' as VanStopStatus,
        boardedAt: null,
        deliveredAt: null,
        absentAt: null,
        notRidingAt: null,
        notRidingBy: null,
        note: null,
      })),
      createdAt: now,
      startedAt: null,
      finishedAt: null,
      cancelledAt: null,
      events: [],
    };
    this.appendEvent(route, {
      type: 'ROUTE_CREATED',
      at: now,
      actorId: input.driverId,
      studentId: null,
      from: null,
      to: 'PLANNED',
      reason: null,
    });
    this.routes.set(route.id, route);
    return { ...route, stops: route.stops.map((s) => ({ ...s })), events: [...route.events] };
  }

  getRoute(schoolId: string, routeId: string): VanRoute {
    const route = this.getRouteOrThrow(schoolId, routeId);
    return { ...route, stops: route.stops.map((s) => ({ ...s })), events: [...route.events] };
  }

  listRoutesForSchool(
    schoolId: string,
    filter: { driverId?: string; date?: string; status?: VanRouteStatus } = {},
  ): VanRoute[] {
    return [...this.routes.values()]
      .filter(
        (r) =>
          r.schoolId === schoolId &&
          (filter.driverId === undefined || r.driverId === filter.driverId) &&
          (filter.date === undefined || r.date === filter.date) &&
          (filter.status === undefined || r.status === filter.status),
      )
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.getTime() - b.createdAt.getTime());
  }

  listActiveForDriver(schoolId: string, driverId: string): VanRoute[] {
    return this.listRoutesForSchool(schoolId, { driverId }).filter(
      (r) => r.status === 'PLANNED' || r.status === 'RUNNING',
    );
  }

  /** O motorista inicia a rota — a partir daqui os responsáveis veem a van no mapa (Cadê a Van?). */
  startRoute(schoolId: string, routeId: string, driverId: string, now: Date = new Date()): VanRoute {
    const route = this.getRouteOrThrow(schoolId, routeId);
    this.requireDriver(route, driverId);
    if (route.status !== 'PLANNED') {
      throw new ConflictException(`Rota ${route.status.toLowerCase()} — só rota planejada pode iniciar`);
    }
    route.status = 'RUNNING';
    route.startedAt = now;
    this.appendEvent(route, {
      type: 'ROUTE_STARTED',
      at: now,
      actorId: driverId,
      studentId: null,
      from: 'PLANNED',
      to: 'RUNNING',
      reason: null,
    });
    return this.getRoute(schoolId, routeId);
  }

  private transitionStop(
    schoolId: string,
    routeId: string,
    studentId: string,
    actorId: string,
    expected: VanStopStatus,
    to: VanStopStatus,
    eventType: VanRouteEventType,
    now: Date,
    opts: { driverOnly: boolean; note?: string; notRidingBy?: string } = { driverOnly: true },
  ): VanRoute {
    const route = this.getRouteOrThrow(schoolId, routeId);
    if (opts.driverOnly) this.requireDriver(route, actorId);
    if (route.status !== 'RUNNING') {
      throw new ConflictException('A rota precisa estar em andamento para registrar embarques');
    }
    const stop = this.getStopOrThrow(route, studentId);
    if (stop.status !== expected) {
      throw new ConflictException(
        `Aluno está ${stop.status.toLowerCase()} — esperado ${expected.toLowerCase()}`,
      );
    }
    const from = stop.status;
    stop.status = to;
    if (to === 'BOARDED') stop.boardedAt = now;
    if (to === 'DELIVERED') stop.deliveredAt = now;
    if (to === 'ABSENT') {
      stop.absentAt = now;
      stop.note = opts.note ?? null;
    }
    if (to === 'NOT_RIDING') {
      stop.notRidingAt = now;
      stop.notRidingBy = opts.notRidingBy ?? actorId;
    }
    this.appendEvent(route, {
      type: eventType,
      at: now,
      actorId,
      studentId,
      from,
      to,
      reason: opts.note ?? null,
    });
    return this.getRoute(schoolId, routeId);
  }

  /** "Embarcou" — o responsável é avisado na hora (Vanep/Clickvan). */
  markBoarded(schoolId: string, routeId: string, studentId: string, driverId: string, now: Date = new Date()): VanRoute {
    return this.transitionStop(schoolId, routeId, studentId, driverId, 'WAITING', 'BOARDED', 'STOP_BOARDED', now);
  }

  /** "Não estava no ponto" — o motorista registra e segue a rota (Escolar). */
  markAbsent(
    schoolId: string,
    routeId: string,
    studentId: string,
    driverId: string,
    note: string | undefined,
    now: Date = new Date(),
  ): VanRoute {
    return this.transitionStop(schoolId, routeId, studentId, driverId, 'WAITING', 'ABSENT', 'STOP_ABSENT', now, {
      driverOnly: true,
      note,
    });
  }

  /** "Entregue" — na escola (ida) ou em casa (volta). */
  markDelivered(schoolId: string, routeId: string, studentId: string, driverId: string, now: Date = new Date()): VanRoute {
    return this.transitionStop(schoolId, routeId, studentId, driverId, 'BOARDED', 'DELIVERED', 'STOP_DELIVERED', now);
  }

  /**
   * "Não vai hoje" — o responsável avisa pelo app e o motorista já fica
   * sabendo (Vanep/Escolar): não para numa casa vazia. Vale antes de
   * iniciar ou durante a rota, enquanto o aluno ainda estiver WAITING.
   * Não exige rota RUNNING: o pai avisa de manhã, antes de o motorista sair.
   */
  markWillNotRide(
    schoolId: string,
    routeId: string,
    studentId: string,
    tutorId: string,
    now: Date = new Date(),
  ): VanRoute {
    const route = this.getRouteOrThrow(schoolId, routeId);
    if (route.status !== 'PLANNED' && route.status !== 'RUNNING') {
      throw new ConflictException('Rota encerrada — não dá mais para avisar que o aluno não vai');
    }
    const stop = this.getStopOrThrow(route, studentId);
    if (stop.status !== 'WAITING') {
      throw new ConflictException(`Aluno está ${stop.status.toLowerCase()} — não dá mais para avisar`);
    }
    stop.status = 'NOT_RIDING';
    stop.notRidingAt = now;
    stop.notRidingBy = tutorId;
    this.appendEvent(route, {
      type: 'STOP_NOT_RIDING',
      at: now,
      actorId: tutorId,
      studentId,
      from: 'WAITING',
      to: 'NOT_RIDING',
      reason: null,
    });
    return this.getRoute(schoolId, routeId);
  }

  /**
   * A "criança da vez" (Escolar: o botão amarelo é o da criança da vez) —
   * a primeira parada ainda WAITING na ordem da rota, ou null quando não há
   * mais ninguém para buscar.
   */
  nextStop(schoolId: string, routeId: string): VanStop | null {
    const route = this.getRouteOrThrow(schoolId, routeId);
    const stop = route.stops.filter((s) => s.status === 'WAITING').sort((a, b) => a.order - b.order)[0];
    return stop ? { ...stop } : null;
  }

  /** Quem está a bordo agora — o que a regra de segurança protege. */
  childrenOnBoard(schoolId: string, routeId: string): VanStop[] {
    const route = this.getRouteOrThrow(schoolId, routeId);
    return route.stops.filter((s) => s.status === 'BOARDED').map((s) => ({ ...s }));
  }

  /**
   * A rota NÃO fecha com criança a bordo nem com criança sem registro
   * (Escolar): para encerrar, toda parada precisa estar DELIVERED, ABSENT
   * ou NOT_RIDING. O erro lista quem bloqueia, para o motorista resolver
   * na hora — nunca some com o problema em silêncio.
   */
  finishRoute(schoolId: string, routeId: string, driverId: string, now: Date = new Date()): VanRoute {
    const route = this.getRouteOrThrow(schoolId, routeId);
    this.requireDriver(route, driverId);
    if (route.status !== 'RUNNING') {
      throw new ConflictException(`Rota ${route.status.toLowerCase()} — só rota em andamento pode encerrar`);
    }
    const onBoard = route.stops.filter((s) => s.status === 'BOARDED');
    const pending = route.stops.filter((s) => s.status === 'WAITING');
    if (onBoard.length > 0 || pending.length > 0) {
      const parts: string[] = [];
      if (onBoard.length > 0) {
        parts.push(`a bordo: ${onBoard.map((s) => s.studentId).join(', ')}`);
      }
      if (pending.length > 0) {
        parts.push(`sem registro: ${pending.map((s) => s.studentId).join(', ')}`);
      }
      throw new ConflictException(`A rota não fecha — ${parts.join('; ')}`);
    }
    route.status = 'FINISHED';
    route.finishedAt = now;
    this.appendEvent(route, {
      type: 'ROUTE_FINISHED',
      at: now,
      actorId: driverId,
      studentId: null,
      from: 'RUNNING',
      to: 'FINISHED',
      reason: null,
    });
    return this.getRoute(schoolId, routeId);
  }

  /**
   * Cancelar também respeita a segurança: com criança a bordo, primeiro
   * entrega — cancelar não pode apagar uma criança do mapa.
   */
  cancelRoute(schoolId: string, routeId: string, driverId: string, now: Date = new Date()): VanRoute {
    const route = this.getRouteOrThrow(schoolId, routeId);
    this.requireDriver(route, driverId);
    if (route.status === 'FINISHED' || route.status === 'CANCELLED') {
      throw new ConflictException(`Rota ${route.status.toLowerCase()} — não pode ser cancelada`);
    }
    const onBoard = route.stops.filter((s) => s.status === 'BOARDED');
    if (onBoard.length > 0) {
      throw new ConflictException(
        `Não dá para cancelar com criança a bordo: ${onBoard.map((s) => s.studentId).join(', ')}`,
      );
    }
    const from = route.status;
    route.status = 'CANCELLED';
    route.cancelledAt = now;
    this.appendEvent(route, {
      type: 'ROUTE_CANCELLED',
      at: now,
      actorId: driverId,
      studentId: null,
      from,
      to: 'CANCELLED',
      reason: null,
    });
    return this.getRoute(schoolId, routeId);
  }

  /**
   * Correção com motivo, sem apagar o original (Escolar: "a hora de um
   * embarque é prova"). O evento original fica no log append-only; a
   * correção é um evento novo com de/para + motivo. Só entre estados já
   * registrados (BOARDED/DELIVERED/ABSENT) — WAITING e NOT_RIDING não se
   * "corrigem", se registram pelos métodos próprios.
   */
  correctStop(
    schoolId: string,
    routeId: string,
    studentId: string,
    toStatus: 'BOARDED' | 'DELIVERED' | 'ABSENT',
    reason: string,
    by: string,
    now: Date = new Date(),
  ): VanRoute {
    const route = this.getRouteOrThrow(schoolId, routeId);
    if (route.status !== 'RUNNING') {
      throw new ConflictException('Só dá para corrigir parada de rota em andamento');
    }
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException('A correção precisa de um motivo (ao menos 3 caracteres)');
    }
    const stop = this.getStopOrThrow(route, studentId);
    const from = stop.status;
    if (from !== 'BOARDED' && from !== 'DELIVERED' && from !== 'ABSENT') {
      throw new ConflictException(`Parada ${from.toLowerCase()} não pode ser corrigida — registre o embarque primeiro`);
    }
    if (from === toStatus) {
      throw new BadRequestException('A correção precisa mudar o estado da parada');
    }
    stop.status = toStatus;
    if (toStatus === 'BOARDED') {
      stop.boardedAt = now;
      stop.deliveredAt = null;
    }
    if (toStatus === 'DELIVERED') {
      stop.boardedAt = stop.boardedAt ?? now;
      stop.deliveredAt = now;
    }
    if (toStatus === 'ABSENT') {
      stop.boardedAt = null;
      stop.deliveredAt = null;
      stop.absentAt = now;
    }
    this.appendEvent(route, {
      type: 'STOP_CORRECTED',
      at: now,
      actorId: by,
      studentId,
      from,
      to: toStatus,
      reason: reason.trim(),
    });
    return this.getRoute(schoolId, routeId);
  }

  /**
   * Alerta de criança a bordo (Escolar: alerta a cada 5 min quando a rota
   * passa do tempo com criança a bordo; no dobro do tempo, a família é
   * avisada). O serviço devolve as rotas vencidas; o job do Step 2 dispara
   * a notificação dual-path (push + registro in-app) a cada ciclo.
   */
  listOverdueRoutes(schoolId: string, now: Date = new Date()): OverdueRoute[] {
    return [...this.routes.values()]
      .filter((r) => r.schoolId === schoolId && r.status === 'RUNNING' && r.startedAt !== null)
      .map((r) => {
        const elapsedMin = (now.getTime() - (r.startedAt as Date).getTime()) / 60_000;
        const overdueMinutes = Math.floor(elapsedMin - r.expectedDurationMin);
        return { route: r, overdueMinutes, childrenOnBoard: r.stops.filter((s) => s.status === 'BOARDED') };
      })
      .filter((o) => o.overdueMinutes > 0 && o.childrenOnBoard.length > 0)
      .sort((a, b) => b.overdueMinutes - a.overdueMinutes);
  }

  /** Recomputa a cadeia de hashes do log da rota (auditoria — mesmo padrão do PickupLog). */
  verifyChain(schoolId: string, routeId: string): { valid: boolean; brokenAtSeq: number | null } {
    const route = this.getRouteOrThrow(schoolId, routeId);
    let prevHash: string | null = null;
    for (const event of route.events) {
      const payload = { type: event.type, at: event.at, actorId: event.actorId, studentId: event.studentId, from: event.from, to: event.to, reason: event.reason };
      const expected = VanRouteService.chainHash(prevHash, payload);
      if (event.prevHash !== prevHash || event.hash !== expected) {
        return { valid: false, brokenAtSeq: event.seq };
      }
      prevHash = event.hash;
    }
    return { valid: true, brokenAtSeq: null };
  }

  /** Job diário (junto aos demais refreshes): cancela rotas planejadas de dias passados. Idempotente. */
  refresh(now: Date = new Date()): { cancelled: number } {
    const today = now.toISOString().slice(0, 10);
    let cancelled = 0;
    for (const route of this.routes.values()) {
      if (route.status === 'PLANNED' && route.date < today) {
        route.status = 'CANCELLED';
        route.cancelledAt = now;
        this.appendEvent(route, {
          type: 'ROUTE_CANCELLED',
          at: now,
          actorId: null,
          studentId: null,
          from: 'PLANNED',
          to: 'CANCELLED',
          reason: 'rota de dia passado sem execução',
        });
        cancelled++;
      }
    }
    return { cancelled };
  }
}
