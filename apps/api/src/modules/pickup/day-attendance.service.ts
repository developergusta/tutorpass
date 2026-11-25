import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../../realtime/realtime.service';
import {
  DismissalPlanService,
  type ResolvedDismissalPlan,
} from '../dismissal-plans/dismissal-plan.service';
import {
  NotificationService,
  type AppNotification,
} from '../notifications/notification.service';
import { RosterService, type PetClinicalAlertSummary } from '../roster/roster.service';

export const PET_ARRIVED_NOTIFICATION_BODY = 'Seu pet chegou à creche 🐾';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface DayAttendanceRecord {
  id: string;
  schoolId: string;
  studentId: string;
  /** Dia letivo / da presença no formato YYYY-MM-DD. */
  date: string;
  checkInAt: Date;
  checkInBy: string;
  checkOutAt: Date | null;
  pickupLogId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CheckInInput {
  schoolId: string;
  studentId: string;
  checkInBy: string;
  /** Data YYYY-MM-DD (default: data de `now` / fuso da escola). */
  date?: string;
  /** Horário do check-in (default: `now`). */
  checkInAt?: Date;
}

export type TodayArrivalStatus = 'ARRIVED' | 'CHECKED_OUT' | 'EXPECTED' | 'NOT_ARRIVED';

export interface TodayArrivalItem {
  studentId: string;
  studentName: string;
  enrollmentCode: string | null;
  classroomId: string;
  classroomName: string | null;
  isExpectedFromPlan: boolean;
  expectedPlan: ResolvedDismissalPlan;
  status: TodayArrivalStatus;
  attendance: DayAttendanceRecord | null;
  clinicalAlerts: PetClinicalAlertSummary;
}

export interface TodayArrivalsSummary {
  schoolId: string;
  date: string;
  counts: {
    arrived: number;
    checkedOut: number;
    expected: number;
    notArrived: number;
    totalActiveStudents: number;
  };
  items: TodayArrivalItem[];
}

export function formatIsoDateInTimezone(now: Date, timezone = 'America/Sao_Paulo'): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // fallback UTC
  }
  return now.toISOString().slice(0, 10);
}

function normalizeDateKey(raw: string | undefined, now: Date, timezone?: string): string {
  if (!raw) return formatIsoDateInTimezone(now, timezone);
  const trimmed = raw.trim();
  if (!DATE_RE.test(trimmed)) {
    throw new BadRequestException('Data inválida — use o formato YYYY-MM-DD.');
  }
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    throw new BadRequestException('Data inválida — use o formato YYYY-MM-DD.');
  }
  return trimmed;
}

function isValidUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

@Injectable()
export class DayAttendanceService implements OnModuleInit, OnModuleDestroy {
  /** Chave `${studentId}:${date}` -> DayAttendanceRecord (1 registro por pet por dia). */
  private readonly records = new Map<string, DayAttendanceRecord>();

  constructor(
    @Optional() @Inject(PrismaService) private readonly prisma?: PrismaService,
    @Optional() @Inject(RosterService) private readonly roster?: RosterService,
    @Optional() @Inject(DismissalPlanService) private readonly dismissalPlans?: DismissalPlanService,
    @Optional() @Inject(NotificationService) private readonly notifications?: NotificationService,
    @Optional() @Inject(RealtimeService) private readonly realtime?: RealtimeService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.prisma?.dayAttendance) return;
    const rows = await this.prisma.dayAttendance.findMany();
    this.records.clear();
    for (const r of rows) {
      const dateStr = r.date.toISOString().slice(0, 10);
      this.records.set(`${r.studentId}:${dateStr}`, {
        id: r.id,
        schoolId: r.schoolId,
        studentId: r.studentId,
        date: dateStr,
        checkInAt: r.checkInAt,
        checkInBy: r.checkInBy,
        checkOutAt: r.checkOutAt ?? null,
        pickupLogId: r.pickupLogId ?? null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma?.flushWrites();
  }

  private schoolTimezone(schoolId: string): string {
    return this.roster?.getSchool(schoolId)?.timezone ?? 'America/Sao_Paulo';
  }

  private persistRecord(record: DayAttendanceRecord): void {
    if (!this.prisma?.dayAttendance) return;
    const dateObj = new Date(`${record.date}T00:00:00.000Z`);
    const checkInByUuid = isValidUuid(record.checkInBy) ? record.checkInBy : randomUUID();
    // No banco, pickupLogId é uma FK UUID para PickupLog. Se o log veio do
    // PickupService in-memory (`pl_123`), guardamos `checkOutAt` no banco e
    // só enviamos `pickupLogId` ao Postgres quando for um UUID persistido.
    const dbPickupLogId = isValidUuid(record.pickupLogId) ? record.pickupLogId : null;
    this.prisma.enqueueWrite((p?: PrismaService) => {
      const client = p ?? this.prisma!;
      return client.dayAttendance.upsert({
        where: {
          studentId_date: {
            studentId: record.studentId,
            date: dateObj,
          },
        },
        update: {
          checkInAt: record.checkInAt,
          checkInBy: checkInByUuid,
          checkOutAt: record.checkOutAt,
          pickupLogId: dbPickupLogId,
          updatedAt: record.updatedAt,
        },
        create: {
          id: isValidUuid(record.id) ? record.id : randomUUID(),
          schoolId: record.schoolId,
          studentId: record.studentId,
          date: dateObj,
          checkInAt: record.checkInAt,
          checkInBy: checkInByUuid,
          checkOutAt: record.checkOutAt,
          pickupLogId: dbPickupLogId,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        },
      });
    });
  }

  /**
   * Registra a chegada da manhã ("Registrar chegada"):
   * - Cria `DayAttendance` (1 linha por pet por dia).
   * - Envia notificação a todos os tutores vinculados ao pet:
   *   `"Seu pet chegou à creche 🐾"`.
   * - Emite evento realtime `attendance.updated` para portaria, sala, admin e tutor.
   */
  async checkIn(
    input: CheckInInput,
    now: Date = new Date(),
  ): Promise<{ attendance: DayAttendanceRecord; notifications: AppNotification[] }> {
    if (!input.schoolId || !input.studentId || !input.checkInBy) {
      throw new BadRequestException('Escola, pet/aluno e operador são obrigatórios no check-in.');
    }
    const student = this.roster?.getStudent(input.studentId);
    if (this.roster && (!student || student.schoolId !== input.schoolId)) {
      throw new NotFoundException('Pet/aluno não encontrado nesta unidade.');
    }
    if (student && student.status !== 'ACTIVE') {
      throw new BadRequestException('Só é possível registrar chegada de um pet/aluno ativo.');
    }

    const tz = this.schoolTimezone(input.schoolId);
    const date = normalizeDateKey(input.date, input.checkInAt ?? now, tz);
    const key = `${input.studentId}:${date}`;
    const existing = this.records.get(key);
    if (existing) {
      throw new ConflictException('A chegada deste pet já foi registrada hoje.');
    }

    const checkInAt = input.checkInAt ? new Date(input.checkInAt) : new Date(now);
    if (Number.isNaN(checkInAt.getTime())) {
      throw new BadRequestException('Horário de check-in inválido.');
    }

    const record: DayAttendanceRecord = {
      id: randomUUID(),
      schoolId: input.schoolId,
      studentId: input.studentId,
      date,
      checkInAt,
      checkInBy: input.checkInBy,
      checkOutAt: null,
      pickupLogId: null,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };

    this.records.set(key, record);
    this.persistRecord(record);

    const sentNotifications: AppNotification[] = [];
    if (this.notifications && this.roster) {
      const links = this.roster.listTutorsOfStudent(input.studentId);
      const petName = student?.name ?? 'Seu pet';
      for (const link of links) {
        const notif = await this.notifications.create(
          {
            schoolId: input.schoolId,
            recipientId: link.tutorId,
            kind: 'PET_ARRIVED',
            title: `Chegada registrada — ${petName}`,
            body: PET_ARRIVED_NOTIFICATION_BODY,
            refId: record.id,
          },
          checkInAt,
        );
        sentNotifications.push(notif);
      }
    }

    this.emitRealtime(record, student?.classroomId ?? '');
    return { attendance: record, notifications: sentNotifications };
  }

  /**
   * Fecha automaticamente o `DayAttendance` do dia quando a retirada existente
   * (`PickupService.release`) acontece: preenche `checkOutAt` e `pickupLogId`.
   * Se não houver check-in registrado naquele dia, retorna `null` sem afetar
   * o fluxo de retirada.
   */
  closeOnPickupRelease(params: {
    schoolId: string;
    studentId: string;
    releasedAt: Date;
    pickupLogId: string;
    date?: string;
  }): DayAttendanceRecord | null {
    const tz = this.schoolTimezone(params.schoolId);
    const dateCandidates = [
      params.date,
      formatIsoDateInTimezone(params.releasedAt, tz),
      params.releasedAt.toISOString().slice(0, 10),
    ].filter((d): d is string => Boolean(d));

    let record: DayAttendanceRecord | undefined;
    for (const candidate of dateCandidates) {
      const found = this.records.get(`${params.studentId}:${candidate}`);
      if (found && found.schoolId === params.schoolId) {
        record = found;
        break;
      }
    }
    if (!record) return null;

    record.checkOutAt = new Date(params.releasedAt);
    record.pickupLogId = params.pickupLogId;
    record.updatedAt = new Date(params.releasedAt);
    this.persistRecord(record);

    const student = this.roster?.getStudent(params.studentId);
    this.emitRealtime(record, student?.classroomId ?? '');
    return record;
  }

  getForStudentOnDate(
    schoolId: string,
    studentId: string,
    date: string,
  ): DayAttendanceRecord | null {
    const rec = this.records.get(`${studentId}:${date}`);
    if (!rec || rec.schoolId !== schoolId) return null;
    return rec;
  }

  listForSchoolOnDate(schoolId: string, date: string): DayAttendanceRecord[] {
    return [...this.records.values()]
      .filter((r) => r.schoolId === schoolId && r.date === date)
      .sort((a, b) => a.checkInAt.getTime() - b.checkInAt.getTime());
  }

  /**
   * Painel "Chegadas de hoje" da recepção:
   * - Cruza todos os pets/alunos ativos da escola com o plano padrão/exceção do dia
   *   (`DismissalPlanService.resolvePlanForDate`) e com os registros de `DayAttendance`.
   * - Classifica cada pet em:
   *   - `ARRIVED`: fez check-in hoje e ainda está na creche (`checkOutAt === null`)
   *   - `CHECKED_OUT`: fez check-in hoje e já saiu pela retirada (`checkOutAt !== null`)
   *   - `EXPECTED`: ainda não chegou, mas tem plano esperado p/ hoje (`source !== 'NONE'`)
   *   - `NOT_ARRIVED`: ainda não chegou e não tinha plano cadastrado p/ hoje (disponível p/ walk-in)
   * - Nas contagens do painel:
   *   - `arrived`: total que chegou hoje (`ARRIVED` + `CHECKED_OUT`, com `checkedOut` destacado)
   *   - `expected`: total esperado pelos planos do dia
   *   - `notArrived`: quem ainda não chegou hoje
   */
  getTodayArrivalsSummary(
    schoolId: string,
    options: { date?: string; now?: Date } = {},
  ): TodayArrivalsSummary {
    const now = options.now ?? new Date();
    const tz = this.schoolTimezone(schoolId);
    const date = normalizeDateKey(options.date, now, tz);

    const activeStudents = this.roster?.listStudents(schoolId) ?? [];
    const classrooms = this.roster?.listClassrooms(schoolId, { includeInactive: true }) ?? [];
    const classroomNameById = new Map(classrooms.map((c) => [c.id, c.name]));

    let arrivedCount = 0;
    let checkedOutCount = 0;
    let expectedCount = 0;
    let notArrivedCount = 0;

    const items: TodayArrivalItem[] = activeStudents.map((student) => {
      const plan: ResolvedDismissalPlan = this.dismissalPlans?.resolvePlanForDate(
        student.id,
        date,
      ) ?? {
        source: 'NONE',
        mode: null,
        busLine: null,
        pickupBy: null,
        note: null,
        exceptionId: null,
      };
      const isExpectedFromPlan = plan.source !== 'NONE';
      if (isExpectedFromPlan) expectedCount++;

      const attendance = this.getForStudentOnDate(schoolId, student.id, date);
      let status: TodayArrivalStatus;
      if (attendance) {
        arrivedCount++;
        if (attendance.checkOutAt) {
          status = 'CHECKED_OUT';
          checkedOutCount++;
        } else {
          status = 'ARRIVED';
        }
      } else {
        notArrivedCount++;
        status = isExpectedFromPlan ? 'EXPECTED' : 'NOT_ARRIVED';
      }

      const clinicalAlerts = this.roster?.getPetClinicalAlerts(student.id, now) ?? {
        hasExpiredVaccination: false,
        expiredVaccines: [],
        hasExpiringVaccination: false,
        expiringVaccines: [],
        hasDaycareMedication: false,
        medicationSummary: null,
      };

      return {
        studentId: student.id,
        studentName: student.name,
        enrollmentCode: student.enrollmentCode ?? null,
        classroomId: student.classroomId,
        classroomName: classroomNameById.get(student.classroomId) ?? null,
        isExpectedFromPlan,
        expectedPlan: plan,
        status,
        attendance,
        clinicalAlerts,
      };
    });

    return {
      schoolId,
      date,
      counts: {
        arrived: arrivedCount,
        checkedOut: checkedOutCount,
        expected: expectedCount,
        notArrived: notArrivedCount,
        totalActiveStudents: activeStudents.length,
      },
      items,
    };
  }

  private emitRealtime(record: DayAttendanceRecord, classroomId: string): void {
    if (!this.realtime) return;
    const links = this.roster?.listTutorsOfStudent(record.studentId) ?? [];
    const primaryTutorId = (links.find((l) => l.isPrimary) ?? links[0])?.tutorId ?? null;
    void this.realtime
      .attendanceUpdated(record.schoolId, classroomId, {
        ...record,
        tutorId: primaryTutorId,
      })
      .catch(() => {});
  }
}
