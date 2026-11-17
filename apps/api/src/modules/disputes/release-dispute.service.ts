import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PickupService } from '../pickup/pickup.service';
import { SecurityIncidentService } from '../incidents/security-incident.service';

// Sinalizar saída não reconhecida — fecha o loop da notificação dual-path:
// hoje a família é avisada de que o aluno saiu, mas não tem como contestar
// na hora. Ver docs/product/IDEAS.md, frente b ciclo 29 (Elo Saída, out/2026:
// o tutor pode sinalizar uma saída NÃO reconhecida na notificação) e frente c
// ciclo 30 (NIS Dismissal: uma exceção não pode travar a fila — a contestação
// corre em paralelo, sem bloquear a portaria; Positive Proof: o alerta de
// guarda/restrição tem de existir no ponto de contato, antes da liberação).
// Regras de produto:
// - A contestação mira um evento RELEASED do PickupLog (id do log), da mesma
//   escola e do mesmo aluno — contestar "a saída das 17:12", não "o aluno".
// - Janela de 24 h após a liberação: depois disso, a contestação vira
//   incidente manual pelo DPO (a memória do dia já não é confiável e o
//   registro do dia seguinte é outro expediente). O prazo fica no registro.
// - 1 contestação por liberação, para sempre: resolvida ou não, não se
//   re-contesta o mesmo evento — o caminho depois da resolução é o incidente
//   (que já existe) ou um pedido ao DPO.
// - Contestar ABRE um incidente de segurança (UNAUTHORIZED_ACCESS, risco
//   relevante — criança entregue a alguém não reconhecido pode acarretar
//   dano relevante, Res. CD/ANPD nº 15/2024 — e o relógio de 3 dias úteis
//   começa). O incidente tem vida própria: conter/comunicar/fechar é do DPO;
//   a contestação só registra a apuração (LEGITIMATE = engano/esquecimento,
//   UNRECOGNIZED = confirmado, o incidente segue aberto).
// - O registro da contestação guarda um snapshot da liberação (quem retirou,
//   hora, portão) — mesmo que o PickupLog seja expurgado depois, a
//   contestação continua legível. Só ids e hora, nunca nome/foto (minimização).
// - Log append-only com hash encadeado por contestação (mesmo padrão do
//   PickupLog e do SecurityIncidentService) — a apuração é prova auditável.
// - A contestação NÃO trava a fila nem reverte a liberação: o aluno já saiu;
//   o que ela faz é abrir o incidente e botar a escola p/ apurar. Reverter
//   saída é decisão humana, fora do sistema.
// Integração Step 2: trocar os stores in-memory por Prisma (ReleaseDispute
// e ReleaseDisputeEvent, já no schema); resolver o tutorId do contestante a
// partir de `user.sub` (mesma pendência do PickupController — hoje o TUTOR
// passa o tutorId no body); notificar ADMIN/COORDINATOR em dual-path quando
// uma contestação abrir (NotificationService p/ staff — hoje só existe
// notificação p/ tutor); exibir as contestadas abertas no painel da portaria
// (badge "CONTESTADA" no DisplayBoardService) e no telão da sala.

/** Janela p/ contestar uma liberação, em horas após a saída. */
export const DISPUTE_WINDOW_HOURS = 24;

export type ReleaseDisputeStatus =
  | 'OPEN'
  | 'RESOLVED_LEGITIMATE'
  | 'ESCALATED';

export type ReleaseDisputeOutcome = 'LEGITIMATE' | 'UNRECOGNIZED';

export type ReleaseDisputeEventType =
  | 'REPORTED'
  | 'NOTE'
  | 'RESOLVED_LEGITIMATE'
  | 'ESCALATED';

export interface ReleaseDispute {
  id: string;
  schoolId: string;
  studentId: string;
  /** Id do evento RELEASED no PickupLog que está sendo contestado. */
  releaseLogId: string;
  /** Quem retirou, segundo o registro da liberação (null = não registrado). */
  releasedTutorId: string | null;
  releasedAt: Date;
  /** Portão da retirada, como a escola chama (null = fila única). */
  gate: string | null;
  /** Tutor que contestou (quem recebeu a notificação e não reconheceu). */
  reportedByTutorId: string;
  /** Motivo da contestação, nas palavras do tutor (opcional, máx. 500). */
  note: string | null;
  /** Incidente de segurança aberto automaticamente na contestação. */
  incidentId: string;
  status: ReleaseDisputeStatus;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

export interface ReleaseDisputeEvent {
  id: string;
  disputeId: string;
  type: ReleaseDisputeEventType;
  actor: string;
  note: string | null;
  at: Date;
  prevHash: string | null;
  hash: string;
}

export interface ReportReleaseDisputeInput {
  schoolId: string;
  studentId: string;
  releaseLogId: string;
  tutorId: string;
  note?: string;
}

let seq = 0;
let eventSeq = 0;

@Injectable()
export class UnrecognizedReleaseService {
  private readonly disputes = new Map<string, ReleaseDispute>();
  private readonly events = new Map<string, ReleaseDisputeEvent[]>();

  constructor(
    private readonly pickup: PickupService,
    private readonly incidents: SecurityIncidentService,
  ) {}

  static chainHash(prevHash: string | null, payload: unknown): string {
    return createHash('sha256')
      .update(`${prevHash ?? 'GENESIS'}:${JSON.stringify(payload)}`)
      .digest('hex');
  }

  /**
   * Contesta uma liberação: valida a janela de 24 h, abre o incidente de
   * segurança e registra a contestação com o snapshot da saída.
   */
  report(input: ReportReleaseDisputeInput, now = new Date()): ReleaseDispute {
    const log = this.pickup
      .listLogs(input.schoolId)
      .find((l) => l.id === input.releaseLogId);
    if (!log) {
      throw new NotFoundException('Liberação não encontrada.');
    }
    if (log.eventType !== 'RELEASED') {
      throw new BadRequestException(
        'Só é possível contestar uma liberação (evento RELEASED).',
      );
    }
    if (log.studentId !== input.studentId) {
      throw new BadRequestException(
        'A liberação contestada não é deste aluno.',
      );
    }
    const releasedAtRaw = log.payload['releasedAt'];
    if (typeof releasedAtRaw !== 'string') {
      throw new BadRequestException(
        'A liberação não carrega a hora da saída — registro incompleto.',
      );
    }
    const releasedAt = new Date(releasedAtRaw);
    const ageMs = now.getTime() - releasedAt.getTime();
    if (ageMs < 0) {
      throw new BadRequestException(
        'A liberação ainda não aconteceu (hora no futuro).',
      );
    }
    if (ageMs > DISPUTE_WINDOW_HOURS * 60 * 60 * 1000) {
      throw new BadRequestException(
        `A saída só pode ser contestada em até ${DISPUTE_WINDOW_HOURS} h após a liberação — depois disso, procure a secretaria/DPO.`,
      );
    }
    const note = input.note?.trim() ? input.note.trim() : null;
    if (note !== null && note.length > 500) {
      throw new BadRequestException(
        'O motivo da contestação tem no máximo 500 caracteres.',
      );
    }
    for (const d of this.disputes.values()) {
      if (d.releaseLogId === input.releaseLogId) {
        throw new ConflictException(
          'Esta liberação já foi contestada — acompanhe o incidente aberto.',
        );
      }
    }
    const entry = this.pickup
      .listForStudent(input.schoolId, input.studentId)
      .find((e) => e.id === log.queueEntryId);
    const gate = entry?.gate ?? null;

    const incident = this.incidents.report(
      {
        schoolId: input.schoolId,
        title: 'Saída não reconhecida contestada por tutor',
        description:
          `Tutor ${input.tutorId} contestou a liberação ${log.id} de ` +
          `${releasedAt.toISOString()} (portão: ${gate ?? 'fila única'}). ` +
          `Quem retirou, segundo o registro: ${log.tutorId ?? 'não registrado'}.`,
        category: 'UNAUTHORIZED_ACCESS',
        dataCategories: ['STUDENT_NAME', 'GUARDIAN_CONTACT'],
        affectedCount: 1,
        relevantRisk: true,
        detectedAt: now,
        reportedBy: `tutor:${input.tutorId}`,
      },
      now,
    );

    const id = `dispute-${++seq}`;
    const dispute: ReleaseDispute = {
      id,
      schoolId: input.schoolId,
      studentId: input.studentId,
      releaseLogId: log.id,
      releasedTutorId: log.tutorId,
      releasedAt,
      gate,
      reportedByTutorId: input.tutorId,
      note,
      incidentId: incident.id,
      status: 'OPEN',
      resolutionNote: null,
      resolvedBy: null,
      resolvedAt: null,
      createdAt: now,
    };
    this.disputes.set(id, dispute);
    this.events.set(id, []);
    this.append(id, 'REPORTED', `tutor:${input.tutorId}`, note, now);
    return dispute;
  }

  get(id: string): ReleaseDispute {
    const dispute = this.disputes.get(id);
    if (!dispute) throw new NotFoundException('Contestação não encontrada.');
    return dispute;
  }

  /**
   * Apuração pela escola (ADMIN/COORDINATOR): LEGITIMATE = a saída era
   * legítima (engano, esquecimento, autorizado que o tutor não lembrava);
   * UNRECOGNIZED = confirmado — o incidente segue aberto p/ o DPO. A nota
   * é obrigatória: é a resposta registrada p/ a família.
   */
  resolve(
    id: string,
    actor: string,
    outcome: ReleaseDisputeOutcome,
    note: string,
    now = new Date(),
  ): ReleaseDispute {
    const dispute = this.get(id);
    if (dispute.status !== 'OPEN') {
      throw new BadRequestException(
        `Só é possível apurar uma contestação aberta (atual: ${dispute.status}).`,
      );
    }
    if (outcome !== 'LEGITIMATE' && outcome !== 'UNRECOGNIZED') {
      throw new BadRequestException(`Resultado inválido: ${outcome}.`);
    }
    const trimmed = note.trim();
    if (!trimmed) {
      throw new BadRequestException(
        'A apuração exige uma nota (o que foi verificado).',
      );
    }
    // A nota vai p/ o incidente ANTES de mudar a contestação: se o
    // incidente já estiver fechado, nada muda aqui (o erro propaga).
    if (outcome === 'LEGITIMATE') {
      this.incidents.addNote(
        dispute.incidentId,
        actor,
        `Contestação apurada: saída legítima. ${trimmed}`,
        now,
      );
      dispute.status = 'RESOLVED_LEGITIMATE';
      dispute.resolutionNote = trimmed;
      dispute.resolvedBy = actor;
      dispute.resolvedAt = now;
      this.append(id, 'RESOLVED_LEGITIMATE', actor, trimmed, now);
    } else {
      this.incidents.addNote(
        dispute.incidentId,
        actor,
        `Contestação CONFIRMADA pela escola: saída não reconhecida. ${trimmed} O incidente segue aberto p/ o DPO.`,
        now,
      );
      dispute.status = 'ESCALATED';
      dispute.resolutionNote = trimmed;
      dispute.resolvedBy = actor;
      dispute.resolvedAt = now;
      this.append(id, 'ESCALATED', actor, trimmed, now);
    }
    return dispute;
  }

  /** Anotação livre no log da contestação (só enquanto aberta). */
  addNote(id: string, actor: string, note: string, now = new Date()): ReleaseDispute {
    const dispute = this.get(id);
    if (dispute.status !== 'OPEN') {
      throw new BadRequestException(
        'Contestação apurada não aceita anotações — a resposta é a nota da apuração.',
      );
    }
    if (!note.trim()) {
      throw new BadRequestException('A anotação não pode ser vazia.');
    }
    this.append(id, 'NOTE', actor, note.trim(), now);
    return dispute;
  }

  /** Fila da secretaria/DPO: contestações abertas, da mais antiga p/ a mais nova. */
  listOpenForSchool(schoolId: string): ReleaseDispute[] {
    return [...this.disputes.values()]
      .filter((d) => d.schoolId === schoolId && d.status === 'OPEN')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  listForStudent(schoolId: string, studentId: string): ReleaseDispute[] {
    return [...this.disputes.values()]
      .filter((d) => d.schoolId === schoolId && d.studentId === studentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  listEvents(id: string): ReleaseDisputeEvent[] {
    this.get(id);
    return [...(this.events.get(id) ?? [])];
  }

  /**
   * Revalida a cadeia de hashes da contestação: qualquer adulteração num
   * evento quebra o hash dele e o encadeamento dos seguintes.
   */
  verifyChain(id: string): { valid: boolean; firstBadIndex: number } {
    const events = this.listEvents(id);
    let prev: string | null = null;
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (event.prevHash !== prev) return { valid: false, firstBadIndex: i };
      const expected = UnrecognizedReleaseService.chainHash(prev, {
        type: event.type,
        actor: event.actor,
        note: event.note,
      });
      if (event.hash !== expected) return { valid: false, firstBadIndex: i };
      prev = event.hash;
    }
    return { valid: true, firstBadIndex: -1 };
  }

  private append(
    disputeId: string,
    type: ReleaseDisputeEventType,
    actor: string,
    note: string | null,
    at: Date,
  ): ReleaseDisputeEvent {
    const list = this.events.get(disputeId) ?? [];
    const prevHash = list.length > 0 ? list[list.length - 1].hash : null;
    const event: ReleaseDisputeEvent = {
      id: `dispute-event-${++eventSeq}`,
      disputeId,
      type,
      actor,
      note,
      at: new Date(at),
      prevHash,
      hash: UnrecognizedReleaseService.chainHash(prevHash, {
        type,
        actor,
        note,
      }),
    };
    list.push(event);
    this.events.set(disputeId, list);
    return event;
  }
}
