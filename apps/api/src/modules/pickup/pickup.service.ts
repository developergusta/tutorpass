import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { GateAlertService } from '../gate-alerts/gate-alert.service';
import { QrTokenService } from '../qr/qr-token.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { RosterService } from '../roster/roster.service';
import { DayAttendanceService } from './day-attendance.service';

// Núcleo do Step 2 — fila de retirada da portaria (REST pickup):
// join manual/geofence, call, validate-qr, release, cancel + PickupLog com
// hash encadeado a cada evento. Ver docs/product/IDEAS.md, frente a, ciclo 22:
// PikMyKid/CENTEGIX (2026) vende "aluno só sai quando verificado" + trilha de
// auditoria completa; aqui a verificação é o QR dinâmico de 30 s (QrTokenService)
// e a trilha é o PickupLog imutável (hash encadeado, sem update/delete).
// Regras de produto:
// - Fluxo: QUEUED -> CALLED -> VALIDATED -> RELEASED. O validate-qr aceita
//   QUEUED ou CALLED (a portaria pode validar o tutor que chega direto no
//   portão, sem chamar antes); o release exige VALIDATED — ninguém sai sem
//   verificação. Cancelar só vale enquanto QUEUED/CALLED.
// - Uma entrada ativa por aluno por escola: sem duplicata na fila — o tutor
//   que já está na fila não entra de novo (nem por geofence, nem manual).
// - Bloqueio vence fila: aluno bloqueado (ex.: pendência financeira, ordem da
//   secretaria) não entra na fila; bloquear um aluno com entrada ativa tira
//   a entrada da fila (vira BLOCKED) e registra o motivo no log.
// - QR de uso único: o nonce é consumido no primeiro validate (QrTokenService);
//   QR de outro tutor/outra escola é rejeitado e o evento QR_REJECTED fica no
//   log — tentativa de uso indevido deixa rastro, não some.
// - PickupLog é append-only: cada evento carrega prevHash/hash (SHA-256) e
//   `verifyChain` revalida a cadeia — adulterar um evento quebra os seguintes.
// - waitSeconds é o tempo total na fila (joinedAt -> releasedAt); o log de
//   RELEASED carrega calledAt/validatedAt, p/ o relatório calcular também
//   chamada -> liberação (DismissalReportService).
// Integração Step 2: trocar os stores in-memory por Prisma (PickupQueueEntry
// e PickupLog, já no schema) e ligar os eventos ao EventLogService/realtime
// (a fila do painel da portaria/sala lê daqui) e às notificações dual-path.

export type QueueStatus =
  | 'QUEUED'
  | 'CALLED'
  | 'VALIDATED'
  | 'RELEASED'
  | 'BLOCKED'
  | 'CANCELLED'
  | 'EXPIRED';

export type PickupSource = 'GEOFENCE' | 'MANUAL' | 'QR_GATE';

export type PickupEventType =
  | 'QUEUE_JOINED'
  | 'QUEUE_CALLED'
  | 'QR_SCANNED'
  | 'QR_REJECTED'
  | 'RELEASED'
  | 'BLOCKED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface PickupQueueEntry {
  id: string;
  schoolId: string;
  studentId: string;
  tutorId: string;
  authorizationId: string | null;
  source: PickupSource;
  /** Nome livre do portão onde o tutor vai retirar ("Portão A", "Fundos",
   * "Car Loop") — como a escola chama, não um código interno. Null = a
   * escola não separa por portão (fila única). Ver IDEAS.md, frente c,
   * ciclo 24: RapidDismiss/SDM/AuthExit filtram a fila por portão/faixa e
   * cada portão tem sua própria equipe; sem o campo, a portaria de uma
   * escola com 2+ portões vê uma fila só e chama aluno no portão errado. */
  gate: string | null;
  status: QueueStatus;
  joinedAt: Date;
  calledAt: Date | null;
  validatedAt: Date | null;
  releasedAt: Date | null;
  waitSeconds: number | null;
  createdAt: Date;
}

export interface PickupLogEntry {
  id: string;
  schoolId: string;
  studentId: string;
  queueEntryId: string | null;
  eventType: PickupEventType;
  actorUserId: string | null;
  tutorId: string | null;
  payload: Record<string, unknown>;
  prevHash: string | null;
  hash: string;
  createdAt: Date;
}

export interface JoinPickupInput {
  schoolId: string;
  studentId: string;
  tutorId: string;
  authorizationId?: string;
  source?: PickupSource;
  /** Nome do portão da retirada (opcional; vazio = fila única). */
  gate?: string;
}

/** Contagem de entradas ativas por portão — alimenta o painel "toda a
 * escola" (visão por portão, como o "All School" do RapidDismiss e o
 * dashboard por lane do Trellisgo). Só portões nomeados; entradas sem
 * portão não entram aqui (a fila única é o `listActiveForSchool` sem filtro). */
export interface GateCount {
  gate: string;
  count: number;
}

/** Tutor com filhos ativos em portões diferentes — o painel da portaria
 * sinaliza o conflito p/ o tutor não deixar um filho esperando no portão
 * errado (AuthExit sinaliza "irmãos divididos entre faixas", IDEAS.md
 * frente c ciclo 24). `gate: null` é a fila única — conta como um "portão"
 * distinto: um filho na fila única e outro no "Portão A" também é divisão.
 * Só entradas ativas (QUEUED/CALLED/VALIDATED); cancelado/liberado não
 * conta. Um tutor com 2 filhos no MESMO portão não é conflito. */
export interface SiblingGateConflict {
  tutorId: string;
  studentIds: string[];
  gates: { gate: string | null; studentIds: string[] }[];
}

const MAX_GATE_LENGTH = 40;

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/** Normaliza o nome do portão: tira espaços, vazio vira null (fila única),
 * nome longo demais é erro — o nome aparece no painel da portaria e no
 * telão, então não pode ser um texto livre sem limite. */
function normalizeGate(gate: string | undefined): string | null {
  if (gate === undefined) return null;
  const trimmed = gate.trim();
  if (trimmed === '') return null;
  if (trimmed.length > MAX_GATE_LENGTH) {
    throw new BadRequestException(
      `O nome do portão tem no máximo ${MAX_GATE_LENGTH} caracteres.`,
    );
  }
  return trimmed;
}

const ACTIVE_STATUSES: QueueStatus[] = ['QUEUED', 'CALLED', 'VALIDATED'];

@Injectable()
export class PickupService {
  static chainHash(prevHash: string | null, payload: unknown) {
    return createHash('sha256')
      .update(`${prevHash ?? 'GENESIS'}:${JSON.stringify(payload)}`)
      .digest('hex');
  }

  private readonly entries = new Map<string, PickupQueueEntry>();
  private readonly logs: PickupLogEntry[] = [];
  /** Aluno bloqueado por escola: `${schoolId}:${studentId}` -> motivo. */
  private readonly blocks = new Map<string, string>();
  private counter = 0;
  private logCounter = 0;

  // @Optional: fora do Nest (teste com `new`) o QR pode ser injetado à mão;
  // sem ele, validateQr recusa com erro claro em vez de quebrar. O alerta da
  // portaria (ntfy) é igualmente opcional: sem ele (ou desligado), o join
  // segue só com a fila/realtime.
  // O realtime e o roster também são opcionais pelo mesmo motivo — MAS em
  // produção eles são o que faz a fila existir nas telas: até 17/11/2026 o
  // RealtimeService não tinha NENHUM chamador (o PickupModule nem o
  // importava), então o socket conectava e nenhuma entrada chegava —
  // portaria/telão só viam a fila ao recarregar. O roster enriquece o
  // payload com nome/turma do aluno (a entrada crua só tem ids).
  constructor(
    @Optional() @Inject(QrTokenService) private readonly qr?: QrTokenService,
    @Optional() @Inject(GateAlertService) private readonly gateAlerts?: GateAlertService,
    @Optional() @Inject(RealtimeService) private readonly realtime?: RealtimeService,
    @Optional() @Inject(RosterService) private readonly roster?: RosterService,
    @Optional() @Inject(DayAttendanceService) private readonly attendance?: DayAttendanceService,
  ) {}

  /** Payload que vai pras telas: a entrada + nome/turma do aluno. */
  private entryPayload(entry: PickupQueueEntry) {
    const student = this.roster?.getStudent(entry.studentId) ?? null;
    const classroom =
      student != null
        ? (this.roster
            ?.listClassrooms(student.schoolId)
            .find((c) => c.id === student.classroomId) ?? null)
        : null;
    return {
      ...entry,
      studentName: student?.name ?? null,
      classroomId: student?.classroomId ?? null,
      classroomName: classroom?.name ?? null,
    };
  }

  // Fire-and-forget como o alerta ntfy: a emissão nunca pode derrubar
  // nem atrasar a operação da fila.
  private emitCreated(entry: PickupQueueEntry): void {
    if (!this.realtime) return;
    const payload = this.entryPayload(entry);
    void this.realtime
      .entryCreated(entry.schoolId, payload.classroomId ?? '', payload)
      .catch(() => {});
  }

  private emitStatus(entry: PickupQueueEntry): void {
    if (!this.realtime) return;
    const payload = this.entryPayload(entry);
    void this.realtime
      .entryStatus(entry.schoolId, payload.classroomId ?? '', payload)
      .catch(() => {});
  }

  /** Uma entrada pelo id (ou null) — o cancelamento do responsável
   * confere a posse por aqui antes de agir. */
  getEntry(id: string): PickupQueueEntry | null {
    return this.entries.get(id) ?? null;
  }

  /** Entrada na fila — manual (portaria) ou automática (geofence / QR do portão). */
  join(input: JoinPickupInput, now: Date = new Date()): PickupQueueEntry {
    if (!input.schoolId || !input.studentId || !input.tutorId) {
      throw new BadRequestException(
        'Escola, aluno e tutor são obrigatórios para entrar na fila.',
      );
    }
    const blockReason = this.blocks.get(`${input.schoolId}:${input.studentId}`);
    if (blockReason) {
      throw new ForbiddenException(
        `Retirada bloqueada: ${blockReason}`,
      );
    }
    for (const existing of this.entries.values()) {
      if (
        existing.schoolId === input.schoolId &&
        existing.studentId === input.studentId &&
        ACTIVE_STATUSES.includes(existing.status)
      ) {
        throw new BadRequestException(
          'Este aluno já está na fila de retirada.',
        );
      }
    }
    const gate = normalizeGate(input.gate);
    const entry: PickupQueueEntry = {
      id: `pq_${++this.counter}`,
      schoolId: input.schoolId,
      studentId: input.studentId,
      tutorId: input.tutorId,
      authorizationId: input.authorizationId ?? null,
      source: input.source ?? 'MANUAL',
      gate,
      status: 'QUEUED',
      joinedAt: new Date(now),
      calledAt: null,
      validatedAt: null,
      releasedAt: null,
      waitSeconds: null,
      createdAt: new Date(now),
    };
    this.entries.set(entry.id, entry);
    this.appendLog(
      entry,
      'QUEUE_JOINED',
      null,
      entry.tutorId,
      {
        source: entry.source,
        authorizationId: entry.authorizationId,
        gate: entry.gate,
      },
      entry.joinedAt,
    );
    // Apita o celular da portaria (ntfy) — fire-and-forget: o serviço nunca
    // lança e a fila não espera a rede p/ responder ao tutor.
    void this.gateAlerts?.tutorJoinedQueue(entry.schoolId, entry.gate);
    this.emitCreated(entry);
    return entry;
  }

  /** Portaria chama o aluno (a sala é avisada pelo painel/realtime no Step 2). */
  call(id: string, staffId: string, now: Date = new Date()): PickupQueueEntry {
    const entry = this.getOrThrow(id);
    if (entry.status !== 'QUEUED') {
      throw new BadRequestException(
        `Só é possível chamar um aluno na fila (atual: ${entry.status}).`,
      );
    }
    entry.status = 'CALLED';
    entry.calledAt = new Date(now);
    this.appendLog(
      entry,
      'QUEUE_CALLED',
      staffId,
      entry.tutorId,
      {
        calledAt: entry.calledAt.toISOString(),
      },
      entry.calledAt,
    );
    this.emitStatus(entry);
    return entry;
  }

  /**
   * Valida o QR dinâmico do tutor na portaria. O token precisa ser da mesma
   * escola e do mesmo tutor da entrada; QR de outro tutor/escola, expirado ou
   * reutilizado é rejeitado — e a tentativa fica no log (QR_REJECTED).
   * O estado da entrada é checado ANTES de validar o token, p/ não consumir
   * o nonce de uso único à toa.
   */
  async validateQr(
    id: string,
    token: string,
    staffId: string,
    now: Date = new Date(),
  ): Promise<PickupQueueEntry> {
    const entry = this.getOrThrow(id);
    if (entry.status !== 'QUEUED' && entry.status !== 'CALLED') {
      throw new BadRequestException(
        `Só é possível validar o QR de um aluno na fila ou chamado (atual: ${entry.status}).`,
      );
    }
    if (!this.qr) {
      throw new BadRequestException(
        'Validação por QR indisponível (serviço de QR não configurado).',
      );
    }
    let payload: { schoolId: string; tutorId: string; nonce: string };
    try {
      payload = await this.qr.validate(token);
    } catch (err) {
      this.appendLog(entry, 'QR_REJECTED', staffId, entry.tutorId, {
        reason: err instanceof Error ? err.message : 'QR inválido',
      });
      throw err;
    }
    if (payload.schoolId !== entry.schoolId || payload.tutorId !== entry.tutorId) {
      this.appendLog(entry, 'QR_REJECTED', staffId, entry.tutorId, {
        reason: 'QR de outra escola ou de outro tutor',
      });
      throw new UnauthorizedException('QR de outra escola ou de outro tutor.');
    }
    entry.status = 'VALIDATED';
    entry.validatedAt = new Date(now);
    this.appendLog(
      entry,
      'QR_SCANNED',
      staffId,
      entry.tutorId,
      {
        validatedAt: entry.validatedAt.toISOString(),
        nonce: payload.nonce,
      },
      entry.validatedAt,
    );
    this.emitStatus(entry);
    return entry;
  }

  /** Liberação: só aluno validado sai — registra o tempo total na fila. */
  release(id: string, staffId: string, now: Date = new Date()): PickupQueueEntry {
    const entry = this.getOrThrow(id);
    if (entry.status !== 'VALIDATED') {
      throw new BadRequestException(
        `Só é possível liberar um aluno validado (atual: ${entry.status}).`,
      );
    }
    entry.status = 'RELEASED';
    entry.releasedAt = new Date(now);
    entry.waitSeconds = Math.round(
      (entry.releasedAt.getTime() - entry.joinedAt.getTime()) / 1000,
    );
    const releaseLog = this.appendLog(
      entry,
      'RELEASED',
      staffId,
      entry.tutorId,
      {
        releasedAt: entry.releasedAt.toISOString(),
        calledAt: entry.calledAt?.toISOString() ?? null,
        validatedAt: entry.validatedAt?.toISOString() ?? null,
        waitSeconds: entry.waitSeconds,
      },
      entry.releasedAt,
    );
    // Fecha automaticamente o check-in do dia (DayAttendance), se houver,
    // sem alterar o comportamento do fluxo de retirada.
    this.attendance?.closeOnPickupRelease({
      schoolId: entry.schoolId,
      studentId: entry.studentId,
      releasedAt: entry.releasedAt,
      pickupLogId: releaseLog.id,
    });
    this.emitStatus(entry);
    return entry;
  }

  /** Cancelamento — só enquanto QUEUED/CALLED (depois de validado, é release). */
  cancel(id: string, staffId: string, now: Date = new Date()): PickupQueueEntry {
    const entry = this.getOrThrow(id);
    if (entry.status !== 'QUEUED' && entry.status !== 'CALLED') {
      throw new BadRequestException(
        `Só é possível cancelar um aluno na fila ou chamado (atual: ${entry.status}).`,
      );
    }
    entry.status = 'CANCELLED';
    this.appendLog(entry, 'CANCELLED', staffId, entry.tutorId, {});
    this.emitStatus(entry);
    return entry;
  }

  /**
   * Bloqueio de retirada (secretaria): aluno bloqueado não entra na fila;
   * se já estiver nela, a entrada vira BLOCKED. O desbloqueio é explícito
   * (`unblock`) — o bloqueio nunca some sozinho.
   */
  block(
    schoolId: string,
    studentId: string,
    reason: string,
    staffId: string,
    now: Date = new Date(),
  ): void {
    const trimmed = reason.trim();
    if (!trimmed) {
      throw new BadRequestException('O bloqueio precisa de um motivo.');
    }
    this.blocks.set(`${schoolId}:${studentId}`, trimmed);
    for (const entry of this.entries.values()) {
      if (
        entry.schoolId === schoolId &&
        entry.studentId === studentId &&
        ACTIVE_STATUSES.includes(entry.status)
      ) {
        entry.status = 'BLOCKED';
        this.appendLog(entry, 'BLOCKED', staffId, entry.tutorId, {
          reason: trimmed,
        });
        this.emitStatus(entry);
      }
    }
  }

  unblock(schoolId: string, studentId: string): void {
    this.blocks.delete(`${schoolId}:${studentId}`);
  }

  isBlocked(schoolId: string, studentId: string): string | null {
    return this.blocks.get(`${schoolId}:${studentId}`) ?? null;
  }

  /**
   * Job diário (junto ao expurgo LGPD e aos refreshes): entradas QUEUED/CALLED
   * de dias anteriores viram EXPIRED — a fila de ontem não contamina a de hoje.
   */
  expireStale(now: Date = new Date()): number {
    let expired = 0;
    for (const entry of this.entries.values()) {
      if (
        (entry.status === 'QUEUED' || entry.status === 'CALLED') &&
        !sameDay(entry.joinedAt, now)
      ) {
        entry.status = 'EXPIRED';
        this.appendLog(entry, 'EXPIRED', null, entry.tutorId, {
          joinedAt: entry.joinedAt.toISOString(),
        });
        this.emitStatus(entry);
        expired++;
      }
    }
    return expired;
  }

  /** Fila ativa da escola, em ordem de chegada (FIFO real). Com `gate`,
   * só as entradas daquele portão — a portaria filtra a SUA fila (Cheguei/
   * ClassApp, RapidDismiss, SDM: cada portão tem sua equipe e sua fila).
   * Sem `gate`, a fila inteira da escola (visão "toda a escola"). */
  listActiveForSchool(schoolId: string, gate?: string): PickupQueueEntry[] {
    const wanted = normalizeGate(gate);
    return [...this.entries.values()]
      .filter(
        (e) =>
          e.schoolId === schoolId &&
          ACTIVE_STATUSES.includes(e.status) &&
          (wanted === null || e.gate === wanted),
      )
      .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
  }

  /** Portões com fila ativa agora + quantos alunos em cada um, do maior
   * p/ o menor (desempate alfabético) — o painel da portaria monta as
   * colunas por portão a partir daqui, sem varrer a fila inteira. */
  listGates(schoolId: string): GateCount[] {
    const counts = new Map<string, number>();
    for (const e of this.entries.values()) {
      if (
        e.schoolId === schoolId &&
        e.gate !== null &&
        ACTIVE_STATUSES.includes(e.status)
      ) {
        counts.set(e.gate, (counts.get(e.gate) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([gate, count]) => ({ gate, count }))
      .sort((a, b) => b.count - a.count || a.gate.localeCompare(b.gate));
  }

  /** Irmãos em portões diferentes: tutores com entradas ativas em 2+
   * portões distintos (a fila única conta como um portão). O painel usa
   * isso p/ avisar o tutor antes de chamar — sem o alerta, um filho
   * espera no portão errado enquanto o outro já foi liberado. Ordenado
   * por tutorId p/ a resposta ser determinística. */
  listSiblingGateConflicts(schoolId: string): SiblingGateConflict[] {
    const byTutor = new Map<string, PickupQueueEntry[]>();
    for (const e of this.entries.values()) {
      if (e.schoolId === schoolId && ACTIVE_STATUSES.includes(e.status)) {
        const list = byTutor.get(e.tutorId) ?? [];
        list.push(e);
        byTutor.set(e.tutorId, list);
      }
    }
    const conflicts: SiblingGateConflict[] = [];
    for (const [tutorId, entries] of [...byTutor.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      const byGate = new Map<string | null, string[]>();
      for (const e of entries) {
        const list = byGate.get(e.gate) ?? [];
        list.push(e.studentId);
        byGate.set(e.gate, list);
      }
      if (byGate.size < 2) continue;
      conflicts.push({
        tutorId,
        studentIds: entries.map((e) => e.studentId).sort(),
        gates: [...byGate.entries()]
          .sort((a, b) => (a[0] ?? '').localeCompare(b[0] ?? ''))
          .map(([gate, studentIds]) => ({ gate, studentIds: studentIds.sort() })),
      });
    }
    return conflicts;
  }

  listForStudent(schoolId: string, studentId: string): PickupQueueEntry[] {
    return [...this.entries.values()]
      .filter((e) => e.schoolId === schoolId && e.studentId === studentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /** Trilha de auditoria da escola (append-only, ordem cronológica). */
  listLogs(schoolId: string): PickupLogEntry[] {
    return this.logs.filter((l) => l.schoolId === schoolId);
  }

  /**
   * Revalida a cadeia de hashes do log da escola: qualquer adulteração num
   * evento quebra o hash dele e o encadeamento dos seguintes.
   */
  verifyChain(schoolId: string): { valid: boolean; firstBadIndex: number } {
    const logs = this.listLogs(schoolId);
    let prev: string | null = null;
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      if (log.prevHash !== prev) return { valid: false, firstBadIndex: i };
      const expected = PickupService.chainHash(prev, {
        eventType: log.eventType,
        queueEntryId: log.queueEntryId,
        payload: log.payload,
      });
      if (log.hash !== expected) return { valid: false, firstBadIndex: i };
      prev = log.hash;
    }
    return { valid: true, firstBadIndex: -1 };
  }

  private appendLog(
    entry: PickupQueueEntry,
    eventType: PickupEventType,
    actorUserId: string | null,
    tutorId: string | null,
    payload: Record<string, unknown>,
    now: Date = new Date(),
  ): PickupLogEntry {
    const prevHash =
      this.logs.length > 0 ? this.logs[this.logs.length - 1].hash : null;
    const logPayload = {
      eventType,
      queueEntryId: entry.id,
      payload,
    };
    const log: PickupLogEntry = {
      id: `pl_${++this.logCounter}`,
      schoolId: entry.schoolId,
      studentId: entry.studentId,
      queueEntryId: entry.id,
      eventType,
      actorUserId,
      tutorId,
      payload,
      prevHash,
      hash: PickupService.chainHash(prevHash, logPayload),
      createdAt: new Date(now),
    };
    this.logs.push(log);
    return log;
  }

  private getOrThrow(id: string): PickupQueueEntry {
    const entry = this.entries.get(id);
    if (!entry) throw new BadRequestException('Entrada da fila não encontrada.');
    return entry;
  }
}
