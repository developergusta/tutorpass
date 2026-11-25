import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

// Plano de saída padrão por aluno + exceção do dia com cutoff — ver
// docs/product/IDEAS.md, frente (a)/(d): é A dor nº 1 das secretarias e o motivo de
// existir do PickUp Patrol (que existe só para isso) e do School Dismissal Manager.
// Modelo copiado dos dois, adaptado ao Brasil:
// - Plano padrão (default): o jeito normal de o aluno ir embora em cada dia da semana
//   (ex.: ônibus 2ª/4ª/6ª, carro 3ª/5ª). É da ESCOLA: só staff define ou muda — o tutor
//   confere e pede mudança por exceção (PickUp Patrol: default só no portal web, não no
//   app; SDM: default só a secretaria muda). "Copiar segunda" replica o plano de um dia
//   para os demais, como o COPY MONDAY do PickUp Patrol — é o que torna o cadastro em
//   massa viável na implantação de 1 dia.
// - Exceção (plan change): desvio num dia específico (ex.: hoje vai de carro com a avó).
//   Pode ser criada com dias/semanas de antecedência; no MESMO dia, só até o
//   horário-limite (cutoff) da escola — padrão 13:30 (SDM usa 13:30; PickUp Patrol usa
//   14:00; WCS 13:20). Depois do cutoff, só emergência — ligue para a secretaria
//   (regra idêntica nos concorrentes: bilhete, e-mail e ligação não valem, exceto
//   emergência). Uma exceção ATIVA por aluno por dia; cancelar/atualizar também respeita
//   o cutoff no dia.
// - `resolvePlanForDate` é o que a portaria/sala consulta: exceção ativa vence o plano
//   padrão; sem nenhum dos dois, a resposta é NONE — e a secretaria precisa definir o
//   plano (o relatório diário sinaliza alunos sem plano, em vez de inventar um).
// - Saída ANTECIPADA não é um modo aqui: ela passa pelo EarlyDismissalService (pedido
//   com motivo + aprovação da secretaria), porque sair antes do horário é decisão,
//   não rotina.
// - Modos BR: CAR (carro — tutor/delegado busca), WALK (a pé/saída autorizada),
//   BUS (ônibus/van escolar) e AFTER_SCHOOL (atividade pós-aula/contraturno). CAR exige
//   quem busca; BUS exige a linha — igual ao PickUp Patrol, que exige nota/nº do carro
//   conforme a opção escolhida.
// - Contrato de fuso: `now` chega no horário LOCAL da escola (a camada de API converte
//   de UTC p/ School.timezone); o serviço compara só data e hora local, sem DST.
// - Auditoria: toda mudança de plano/exceção entra num log append-only in-memory
//   (`listChangeLog`); no Step 2, persistir em AuditLog (hash encadeado, mesmo padrão
//   do PickupLog/ConsentRecord). Integração Step 2: trocar os stores in-memory por
//   Prisma (DismissalDefaultPlan + DismissalException, já no schema); o relatório
//   diário da secretaria junta `resolvePlanForDate` com a matrícula (o serviço não
//   conhece a lista de alunos) e a notificação da mudança vai por dual-path
//   (push + registro durável — ideia da frente f) quando o módulo de notificações entrar.

export type DismissalMode = 'CAR' | 'WALK' | 'BUS' | 'AFTER_SCHOOL';

export type DismissalActorRole = 'STAFF' | 'TUTOR';

export type DismissalExceptionStatus = 'ACTIVE' | 'CANCELLED' | 'EXPIRED';

export type DismissalPlanSource = 'EXCEPTION' | 'DEFAULT' | 'NONE';

/** Horário-limite padrão p/ mudanças no mesmo dia (HH:MM, horário local da escola). */
export const DEFAULT_CUTOFF = '13:30';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface DismissalDefaultPlan {
  id: string;
  schoolId: string;
  studentId: string;
  /** 0 = domingo … 6 = sábado. */
  weekday: number;
  mode: DismissalMode;
  busLine: string | null;
  pickupBy: string | null;
  note: string | null;
  setBy: string;
  setByRole: DismissalActorRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface DismissalException {
  id: string;
  schoolId: string;
  studentId: string;
  /** Data da exceção, YYYY-MM-DD (dia em que o plano desvia do padrão). */
  date: string;
  mode: DismissalMode;
  busLine: string | null;
  pickupBy: string | null;
  note: string | null;
  status: DismissalExceptionStatus;
  createdBy: string;
  createdByRole: DismissalActorRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface DismissalPlanChange {
  id: string;
  schoolId: string;
  studentId: string;
  action:
    | 'DEFAULT_SET'
    | 'DEFAULT_CLEARED'
    | 'EXCEPTION_CREATED'
    | 'EXCEPTION_UPDATED'
    | 'EXCEPTION_CANCELLED';
  date: string | null;
  weekday: number | null;
  mode: DismissalMode | null;
  fromMode: DismissalMode | null;
  by: string;
  byRole: DismissalActorRole;
  at: Date;
}

export interface ResolvedDismissalPlan {
  source: DismissalPlanSource;
  mode: DismissalMode | null;
  busLine: string | null;
  pickupBy: string | null;
  note: string | null;
  exceptionId: string | null;
}

export interface SetDefaultInput {
  schoolId: string;
  studentId: string;
  weekday: number;
  mode: DismissalMode;
  busLine?: string;
  pickupBy?: string;
  note?: string;
  setBy: string;
  setByRole: DismissalActorRole;
}

export interface CreateExceptionInput {
  schoolId: string;
  studentId: string;
  /** YYYY-MM-DD. */
  date: string;
  mode: DismissalMode;
  busLine?: string;
  pickupBy?: string;
  note?: string;
  createdBy: string;
  createdByRole: DismissalActorRole;
}

export interface UpdateExceptionInput {
  mode?: DismissalMode;
  busLine?: string;
  pickupBy?: string;
  note?: string;
}

function parseDateKey(date: string): Date {
  if (!DATE_RE.test(date)) {
    throw new BadRequestException('Data inválida — use o formato YYYY-MM-DD.');
  }
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || dateKey(d) !== date) {
    throw new BadRequestException('Data inválida — use o formato YYYY-MM-DD.');
  }
  return d;
}

/** YYYY-MM-DD a partir de um Date (partes UTC — `now` já vem no horário local). */
function dateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function minutesOfDay(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function parseCutoff(cutoff: string): number {
  if (!TIME_RE.test(cutoff)) {
    throw new BadRequestException('Horário-limite inválido — use o formato HH:MM.');
  }
  const [h, m] = cutoff.split(':').map(Number);
  return h * 60 + m;
}

function validateModeDetails(
  mode: DismissalMode,
  input: { busLine?: string; pickupBy?: string; note?: string },
): { busLine: string | null; pickupBy: string | null; note: string | null } {
  const busLine = input.busLine?.trim() || null;
  const pickupBy = input.pickupBy?.trim() || null;
  const note = input.note?.trim() || null;
  if (mode === 'CAR' && !pickupBy) {
    throw new BadRequestException('Informe quem vai buscar o aluno (carro).');
  }
  if (mode === 'BUS' && !busLine) {
    throw new BadRequestException('Informe a linha do ônibus/van.');
  }
  return { busLine, pickupBy, note };
}

@Injectable()
export class DismissalPlanService implements OnModuleInit, OnModuleDestroy {
  private readonly defaults = new Map<string, DismissalDefaultPlan>();
  private readonly exceptions = new Map<string, DismissalException>();
  private readonly changeLog: DismissalPlanChange[] = [];
  /** Cutoff por escola (HH:MM); sem configuração, vale DEFAULT_CUTOFF. */
  private readonly cutoffs = new Map<string, string>();
  private counter = 0;
  private changeCounter = 0;

  constructor(
    @Optional() @Inject(PrismaService) private readonly prisma?: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.prisma?.dismissalDefaultPlan) return;
    const rows = await this.prisma.dismissalDefaultPlan.findMany();
    this.defaults.clear();
    for (const r of rows) {
      this.defaults.set(`${r.studentId}:${r.weekday}`, {
        id: r.id,
        schoolId: r.schoolId,
        studentId: r.studentId,
        weekday: r.weekday,
        mode: r.mode as DismissalMode,
        busLine: r.busLine ?? null,
        pickupBy: r.pickupBy ?? null,
        note: r.note ?? null,
        setBy: r.setBy,
        setByRole: (r.setByRole as DismissalActorRole) ?? 'STAFF',
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma?.flushWrites();
  }

  private persistDefault(plan: DismissalDefaultPlan): void {
    if (!this.prisma?.dismissalDefaultPlan) return;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      plan.id,
    );
    const id = isUuid ? plan.id : randomUUID();
    const setByUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      plan.setBy,
    )
      ? plan.setBy
      : randomUUID();
    this.prisma.enqueueWrite((p?: PrismaService) => {
      const client = p ?? this.prisma!;
      return client.dismissalDefaultPlan.upsert({
        where: {
          studentId_weekday: {
            studentId: plan.studentId,
            weekday: plan.weekday,
          },
        },
        update: {
          mode: plan.mode,
          busLine: plan.busLine,
          pickupBy: plan.pickupBy,
          note: plan.note,
          setBy: setByUuid,
          setByRole: plan.setByRole,
          updatedAt: plan.updatedAt,
        },
        create: {
          id,
          schoolId: plan.schoolId,
          studentId: plan.studentId,
          weekday: plan.weekday,
          mode: plan.mode,
          busLine: plan.busLine,
          pickupBy: plan.pickupBy,
          note: plan.note,
          setBy: setByUuid,
          setByRole: plan.setByRole,
          createdAt: plan.createdAt,
          updatedAt: plan.updatedAt,
        },
      });
    });
  }

  /** Horário-limite da escola p/ mudanças no mesmo dia (configurado pela secretaria). */
  setCutoff(schoolId: string, cutoff: string): string {
    parseCutoff(cutoff); // valida o formato
    this.cutoffs.set(schoolId, cutoff);
    return cutoff;
  }

  getCutoff(schoolId: string): string {
    return this.cutoffs.get(schoolId) ?? DEFAULT_CUTOFF;
  }

  /**
   * Define (ou substitui) o plano padrão de um dia da semana. Só staff — o plano
   * padrão é da escola; o tutor pede mudança por exceção.
   */
  setDefault(input: SetDefaultInput, now: Date = new Date()): DismissalDefaultPlan {
    if (input.setByRole !== 'STAFF') {
      throw new ForbiddenException(
        'Só a secretaria pode definir o plano padrão — o tutor pede mudança por exceção do dia.',
      );
    }
    if (!Number.isInteger(input.weekday) || input.weekday < 0 || input.weekday > 6) {
      throw new BadRequestException('Dia da semana inválido (0 = domingo … 6 = sábado).');
    }
    const details = validateModeDetails(input.mode, input);
    const key = `${input.studentId}:${input.weekday}`;
    const previous = this.defaults.get(key);
    const plan: DismissalDefaultPlan = {
      id: previous?.id ?? `ddp_${++this.counter}`,
      schoolId: input.schoolId,
      studentId: input.studentId,
      weekday: input.weekday,
      mode: input.mode,
      ...details,
      setBy: input.setBy,
      setByRole: input.setByRole,
      createdAt: previous?.createdAt ?? new Date(now),
      updatedAt: new Date(now),
    };
    this.defaults.set(key, plan);
    this.persistDefault(plan);
    this.logChange({
      schoolId: input.schoolId,
      studentId: input.studentId,
      action: 'DEFAULT_SET',
      date: null,
      weekday: input.weekday,
      mode: input.mode,
      fromMode: previous?.mode ?? null,
      by: input.setBy,
      byRole: input.setByRole,
      at: new Date(now),
    });
    return plan;
  }

  /**
   * "Copiar segunda": replica o plano padrão de um dia da semana para os demais —
   * o atalho que torna o cadastro em massa viável na implantação de 1 dia.
   */
  copyDefault(
    schoolId: string,
    studentId: string,
    fromWeekday: number,
    toWeekdays: number[],
    setBy: string,
    now: Date = new Date(),
  ): DismissalDefaultPlan[] {
    const source = this.defaults.get(`${studentId}:${fromWeekday}`);
    if (!source) {
      throw new BadRequestException(
        'Não há plano padrão no dia de origem para copiar.',
      );
    }
    const copied: DismissalDefaultPlan[] = [];
    for (const weekday of [...new Set(toWeekdays)]) {
      if (weekday === fromWeekday) continue;
      copied.push(
        this.setDefault(
          {
            schoolId,
            studentId,
            weekday,
            mode: source.mode,
            busLine: source.busLine ?? undefined,
            pickupBy: source.pickupBy ?? undefined,
            note: source.note ?? undefined,
            setBy,
            setByRole: 'STAFF',
          },
          now,
        ),
      );
    }
    return copied;
  }

  clearDefault(
    schoolId: string,
    studentId: string,
    weekday: number,
    setBy: string,
    now: Date = new Date(),
  ): boolean {
    const key = `${studentId}:${weekday}`;
    const previous = this.defaults.get(key);
    if (!previous) return false;
    this.defaults.delete(key);
    this.logChange({
      schoolId,
      studentId,
      action: 'DEFAULT_CLEARED',
      date: null,
      weekday,
      mode: null,
      fromMode: previous.mode,
      by: setBy,
      byRole: 'STAFF',
      at: new Date(now),
    });
    return true;
  }

  getDefault(studentId: string, weekday: number): DismissalDefaultPlan | null {
    return this.defaults.get(`${studentId}:${weekday}`) ?? null;
  }

  listDefaultsForStudent(studentId: string): DismissalDefaultPlan[] {
    return [...this.defaults.values()]
      .filter((d) => d.studentId === studentId)
      .sort((a, b) => a.weekday - b.weekday);
  }

  listDefaultsForSchool(schoolId: string): DismissalDefaultPlan[] {
    return [...this.defaults.values()]
      .filter((d) => d.schoolId === schoolId)
      .sort((a, b) => a.weekday - b.weekday);
  }

  /**
   * Cria a exceção do dia. Tutor (p/ o próprio filho) ou staff; no mesmo dia, só
   * até o cutoff — depois disso, só emergência via secretaria (ligação).
   */
  createException(
    input: CreateExceptionInput,
    now: Date = new Date(),
  ): DismissalException {
    const date = parseDateKey(input.date);
    const today = dateKey(now);
    if (input.date < today) {
      throw new BadRequestException('A exceção precisa ser para hoje ou um dia futuro.');
    }
    if (input.date === today) {
      this.assertBeforeCutoff(input.schoolId, now);
    }
    const details = validateModeDetails(input.mode, input);
    for (const existing of this.exceptions.values()) {
      if (
        existing.studentId === input.studentId &&
        existing.date === input.date &&
        existing.status === 'ACTIVE'
      ) {
        throw new BadRequestException(
          'Já existe uma exceção ativa para este aluno neste dia — atualize ou cancele a atual.',
        );
      }
    }
    const created: DismissalException = {
      id: `dex_${++this.counter}`,
      schoolId: input.schoolId,
      studentId: input.studentId,
      date: input.date,
      mode: input.mode,
      ...details,
      status: 'ACTIVE',
      createdBy: input.createdBy,
      createdByRole: input.createdByRole,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
    this.exceptions.set(created.id, created);
    this.logChange({
      schoolId: input.schoolId,
      studentId: input.studentId,
      action: 'EXCEPTION_CREATED',
      date: input.date,
      weekday: date.getUTCDay(),
      mode: input.mode,
      fromMode: null,
      by: input.createdBy,
      byRole: input.createdByRole,
      at: new Date(now),
    });
    return created;
  }

  updateException(
    id: string,
    input: UpdateExceptionInput,
    actorId: string,
    actorRole: DismissalActorRole,
    now: Date = new Date(),
  ): DismissalException {
    const exception = this.getOrThrow(id);
    if (exception.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Só é possível atualizar uma exceção ativa (atual: ${exception.status}).`,
      );
    }
    if (actorRole === 'TUTOR' && exception.createdBy !== actorId) {
      throw new ForbiddenException('Só quem criou a exceção pode atualizá-la.');
    }
    if (exception.date === dateKey(now)) {
      this.assertBeforeCutoff(exception.schoolId, now);
    }
    const mode = input.mode ?? exception.mode;
    const details = validateModeDetails(mode, {
      busLine: input.busLine ?? exception.busLine ?? undefined,
      pickupBy: input.pickupBy ?? exception.pickupBy ?? undefined,
      note: input.note ?? exception.note ?? undefined,
    });
    const fromMode = exception.mode;
    exception.mode = mode;
    exception.busLine = details.busLine;
    exception.pickupBy = details.pickupBy;
    exception.note = details.note;
    exception.updatedAt = new Date(now);
    this.logChange({
      schoolId: exception.schoolId,
      studentId: exception.studentId,
      action: 'EXCEPTION_UPDATED',
      date: exception.date,
      weekday: parseDateKey(exception.date).getUTCDay(),
      mode,
      fromMode,
      by: actorId,
      byRole: actorRole,
      at: new Date(now),
    });
    return exception;
  }

  cancelException(
    id: string,
    actorId: string,
    actorRole: DismissalActorRole,
    now: Date = new Date(),
  ): DismissalException {
    const exception = this.getOrThrow(id);
    if (exception.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Só é possível cancelar uma exceção ativa (atual: ${exception.status}).`,
      );
    }
    if (actorRole === 'TUTOR' && exception.createdBy !== actorId) {
      throw new ForbiddenException('Só quem criou a exceção pode cancelá-la.');
    }
    if (exception.date === dateKey(now)) {
      this.assertBeforeCutoff(exception.schoolId, now);
    }
    exception.status = 'CANCELLED';
    exception.updatedAt = new Date(now);
    this.logChange({
      schoolId: exception.schoolId,
      studentId: exception.studentId,
      action: 'EXCEPTION_CANCELLED',
      date: exception.date,
      weekday: parseDateKey(exception.date).getUTCDay(),
      mode: exception.mode,
      fromMode: exception.mode,
      by: actorId,
      byRole: actorRole,
      at: new Date(now),
    });
    return exception;
  }

  /**
   * O que a portaria/sala consulta na hora da saída: a exceção ativa do dia vence o
   * plano padrão; sem nenhum dos dois, NONE — a secretaria precisa definir o plano.
   */
  resolvePlanForDate(studentId: string, date: string): ResolvedDismissalPlan {
    const parsed = parseDateKey(date);
    for (const exception of this.exceptions.values()) {
      if (
        exception.studentId === studentId &&
        exception.date === date &&
        exception.status === 'ACTIVE'
      ) {
        return {
          source: 'EXCEPTION',
          mode: exception.mode,
          busLine: exception.busLine,
          pickupBy: exception.pickupBy,
          note: exception.note,
          exceptionId: exception.id,
        };
      }
    }
    const plan = this.defaults.get(`${studentId}:${parsed.getUTCDay()}`);
    if (plan) {
      return {
        source: 'DEFAULT',
        mode: plan.mode,
        busLine: plan.busLine,
        pickupBy: plan.pickupBy,
        note: plan.note,
        exceptionId: null,
      };
    }
    return {
      source: 'NONE',
      mode: null,
      busLine: null,
      pickupBy: null,
      note: null,
      exceptionId: null,
    };
  }

  /** O que a secretaria vê: exceções ativas de um dia (para o relatório diário). */
  listExceptionsForSchool(schoolId: string, date: string): DismissalException[] {
    parseDateKey(date);
    return [...this.exceptions.values()]
      .filter(
        (e) => e.schoolId === schoolId && e.date === date && e.status === 'ACTIVE',
      )
      .sort((a, b) => a.studentId.localeCompare(b.studentId));
  }

  /** Log append-only de mudanças (auditoria; no Step 2, persistir em AuditLog). */
  listChangeLog(schoolId: string): DismissalPlanChange[] {
    // Desempate por ordem de inserção: duas mudanças no mesmo milissegundo (mesmo
    // `now` passado pelo chamador) ainda voltam na ordem mais recente primeiro.
    return this.changeLog
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.schoolId === schoolId)
      .sort((a, b) => b.c.at.getTime() - a.c.at.getTime() || b.i - a.i)
      .map(({ c }) => c);
  }

  /**
   * Job diário (junto ao expurgo LGPD e aos refreshes de planos/autorizações/
   * saídas antecipadas): exceções ATIVAS de dias passados viram EXPIRED.
   */
  refresh(now: Date = new Date()): number {
    const today = dateKey(now);
    let expired = 0;
    for (const exception of this.exceptions.values()) {
      if (exception.status === 'ACTIVE' && exception.date < today) {
        exception.status = 'EXPIRED';
        expired++;
      }
    }
    return expired;
  }

  private assertBeforeCutoff(schoolId: string, now: Date): void {
    const cutoff = parseCutoff(this.getCutoff(schoolId));
    if (minutesOfDay(now) >= cutoff) {
      throw new BadRequestException(
        `O horário-limite para mudanças no dia (${this.getCutoff(schoolId)}) já passou — ` +
          'só em emergência, ligue para a secretaria.',
      );
    }
  }

  private getOrThrow(id: string): DismissalException {
    const exception = this.exceptions.get(id);
    if (!exception) throw new BadRequestException('Exceção de plano não encontrada.');
    return exception;
  }

  private logChange(
    entry: Omit<DismissalPlanChange, 'id'>,
  ): DismissalPlanChange {
    const change: DismissalPlanChange = {
      id: `dpc_${++this.changeCounter}`,
      ...entry,
    };
    this.changeLog.push(change);
    return change;
  }
}
