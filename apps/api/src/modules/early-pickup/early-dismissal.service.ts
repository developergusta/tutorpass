import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';

// Saída antecipada solicitada no app com aprovação da secretaria — ver
// docs/product/IDEAS.md, frentes (a)/(f): dismissal.ai (2026) vende exatamente isso
// (dia, hora e motivo; a secretaria aprova ou recusa e o tutor vê a resposta no app),
// School Tag (Google Play, jul/2026) agenda "early releases" com data/hora/motivo e
// School Guardian (BR) só aceita o pedido pelo app, em janelas fixas (15h/16h/17h).
// Regras de produto:
// - Pedido SEMPRE com motivo (obrigatório): a secretaria precisa saber por que o aluno
//   sai antes — sem motivo, o pedido vira bilhete solto e não é auditável.
// - Cutoff de 30 min (configurável por escola no Step 2): o pedido precisa chegar com
//   pelo menos 30 min de antecedência do horário pedido, para a secretaria ter tempo de
//   preparar o aluno e a sala. Pedido em cima da hora é recusado na origem, não na fila.
// - Um pedido ativo (REQUESTED ou APPROVED) por aluno por dia: sem duplicata, a
//   secretaria não decide duas vezes o mesmo aluno.
// - Fluxo: REQUESTED -> APPROVED | REJECTED (só staff) -> USED (na retirada, pela
//   portaria via `validate-qr` no Step 2); REQUESTED pode ser CANCELLED só pelo tutor
//   que pediu; REQUESTED/APPROVED vencido vira EXPIRED via refresh() (job diário, junto
//   ao expurgo LGPD, ao refresh de planos e ao refresh de autorizações temporárias).
// - `isApprovedForPickup` é o que a portaria consulta na hora da retirada: pedido
//   APPROVED vale no dia pedido, a partir de 30 min antes do horário (tolerância p/ o
//   tutor chegar adiantado) até o fim do dia.
// - Notificação: a decisão (aprovar/recusar) PRECISA chegar ao tutor — no Step 2,
//   notificação dual-path (push Expo + registro durável in-app, ideia da frente f:
//   ReadyBell — push que falha não pode significar mensagem perdida). O serviço expõe
//   o evento (decisão registrada); o envio é do módulo de notificações.
// Integração Step 2: trocar o store in-memory por Prisma (EarlyDismissalRequest, já no
// schema) e cobrar a feature EARLY_PICKUP do plano (FREE não tem; TRIAL/PRO têm — ver
// PlanService). O pedido aprovado deve alimentar a fila realtime (EventLogService):
// o aluno entra como "saída antecipada" no painel da portaria/sala.

export type EarlyDismissalStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'USED'
  | 'EXPIRED';

/** Antecedência mínima do pedido em relação ao horário da saída (min). */
export const EARLY_DISMISSAL_CUTOFF_MINUTES = 30;

/** Tolerância: pedido aprovado vale a partir de X min antes do horário pedido. */
export const EARLY_DISMISSAL_EARLY_TOLERANCE_MINUTES = 30;

const MINUTE_MS = 60_000;

export interface EarlyDismissalRequest {
  id: string;
  schoolId: string;
  tutorId: string;
  studentIds: string[];
  requestedAt: Date;
  reason: string;
  pickupBy: string;
  status: EarlyDismissalStatus;
  decidedBy: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  usedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
}

export interface RequestEarlyDismissalInput {
  schoolId: string;
  tutorId: string;
  studentIds: string[];
  requestedAt: Date;
  reason: string;
  /** Quem vai buscar (nome do tutor ou do delegado autorizado). */
  pickupBy: string;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

@Injectable()
export class EarlyDismissalService {
  private readonly requests = new Map<string, EarlyDismissalRequest>();
  private counter = 0;

  request(
    input: RequestEarlyDismissalInput,
    now: Date = new Date(),
  ): EarlyDismissalRequest {
    const studentIds = [...new Set(input.studentIds)];
    if (studentIds.length === 0) {
      throw new BadRequestException('Pelo menos um aluno é obrigatório.');
    }
    const reason = input.reason.trim();
    if (reason.length < 3) {
      throw new BadRequestException('O motivo da saída antecipada é obrigatório.');
    }
    const pickupBy = input.pickupBy.trim();
    if (!pickupBy) {
      throw new BadRequestException('Informe quem vai buscar o aluno.');
    }
    const requestedAt = new Date(input.requestedAt);
    if (Number.isNaN(requestedAt.getTime())) {
      throw new BadRequestException('Horário da saída inválido.');
    }
    if (requestedAt.getTime() <= now.getTime()) {
      throw new BadRequestException(
        'O horário da saída antecipada precisa ser no futuro.',
      );
    }
    if (
      requestedAt.getTime() - now.getTime() <
      EARLY_DISMISSAL_CUTOFF_MINUTES * MINUTE_MS
    ) {
      throw new BadRequestException(
        `Peça a saída antecipada com pelo menos ${EARLY_DISMISSAL_CUTOFF_MINUTES} min de antecedência.`,
      );
    }
    // Um pedido ativo por aluno por dia — a secretaria não decide 2x o mesmo aluno.
    for (const existing of this.requests.values()) {
      if (
        existing.schoolId !== input.schoolId ||
        (existing.status !== 'REQUESTED' && existing.status !== 'APPROVED') ||
        !sameDay(existing.requestedAt, requestedAt)
      ) {
        continue;
      }
      if (existing.studentIds.some((id) => studentIds.includes(id))) {
        throw new BadRequestException(
          'Já existe um pedido ativo de saída antecipada para um desses alunos neste dia.',
        );
      }
    }

    const created: EarlyDismissalRequest = {
      id: `edr_${++this.counter}`,
      schoolId: input.schoolId,
      tutorId: input.tutorId,
      studentIds,
      requestedAt,
      reason,
      pickupBy,
      status: 'REQUESTED',
      decidedBy: null,
      decidedAt: null,
      decisionNote: null,
      usedAt: null,
      cancelledAt: null,
      createdAt: new Date(now),
    };
    this.requests.set(created.id, created);
    return created;
  }

  approve(
    id: string,
    staffId: string,
    note?: string,
    now: Date = new Date(),
  ): EarlyDismissalRequest {
    const req = this.getOrThrow(id);
    if (req.status !== 'REQUESTED') {
      throw new BadRequestException(
        `Só é possível aprovar um pedido aguardando decisão (atual: ${req.status}).`,
      );
    }
    req.status = 'APPROVED';
    req.decidedBy = staffId;
    req.decidedAt = new Date(now);
    req.decisionNote = note?.trim() || null;
    return req;
  }

  reject(
    id: string,
    staffId: string,
    note: string,
    now: Date = new Date(),
  ): EarlyDismissalRequest {
    const req = this.getOrThrow(id);
    if (req.status !== 'REQUESTED') {
      throw new BadRequestException(
        `Só é possível recusar um pedido aguardando decisão (atual: ${req.status}).`,
      );
    }
    if (!note?.trim()) {
      throw new BadRequestException('A recusa precisa de um motivo para o tutor.');
    }
    req.status = 'REJECTED';
    req.decidedBy = staffId;
    req.decidedAt = new Date(now);
    req.decisionNote = note.trim();
    return req;
  }

  cancel(
    id: string,
    tutorId: string,
    now: Date = new Date(),
  ): EarlyDismissalRequest {
    const req = this.getOrThrow(id);
    if (req.tutorId !== tutorId) {
      throw new ForbiddenException('Só o tutor que pediu pode cancelar o pedido.');
    }
    if (req.status !== 'REQUESTED') {
      throw new BadRequestException(
        `Só é possível cancelar um pedido aguardando decisão (atual: ${req.status}).`,
      );
    }
    req.status = 'CANCELLED';
    req.cancelledAt = new Date(now);
    return req;
  }

  /** Chamado pela portaria (`validate-qr`, Step 2) quando a retirada acontece. */
  markUsed(id: string, now: Date = new Date()): EarlyDismissalRequest {
    const req = this.getOrThrow(id);
    if (req.status !== 'APPROVED') {
      throw new BadRequestException(
        `Só um pedido aprovado pode ser usado na retirada (atual: ${req.status}).`,
      );
    }
    req.status = 'USED';
    req.usedAt = new Date(now);
    return req;
  }

  /**
   * Job diário (junto ao expurgo LGPD e aos refreshes de planos/autorizações):
   * REQUESTED/APPROVED cujo horário pedido já passou vira EXPIRED.
   */
  refresh(now: Date = new Date()): number {
    let expired = 0;
    for (const req of this.requests.values()) {
      if (
        (req.status === 'REQUESTED' || req.status === 'APPROVED') &&
        req.requestedAt.getTime() < now.getTime()
      ) {
        req.status = 'EXPIRED';
        expired++;
      }
    }
    return expired;
  }

  /** O que a secretaria vê: pedidos aguardando decisão, do mais urgente p/ o mais tarde. */
  listPendingForSchool(schoolId: string): EarlyDismissalRequest[] {
    return [...this.requests.values()]
      .filter((r) => r.schoolId === schoolId && r.status === 'REQUESTED')
      .sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime());
  }

  listForTutor(tutorId: string): EarlyDismissalRequest[] {
    return [...this.requests.values()]
      .filter((r) => r.tutorId === tutorId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * O que a portaria consulta na retirada: pedido APPROVED p/ o aluno, no dia pedido,
   * a partir de 30 min antes do horário (tutor adiantado) até o fim do dia.
   */
  isApprovedForPickup(
    studentId: string,
    at: Date = new Date(),
  ): EarlyDismissalRequest | null {
    for (const req of this.requests.values()) {
      if (req.status !== 'APPROVED' || !req.studentIds.includes(studentId)) {
        continue;
      }
      if (!sameDay(req.requestedAt, at)) continue;
      if (
        at.getTime() >=
        req.requestedAt.getTime() -
          EARLY_DISMISSAL_EARLY_TOLERANCE_MINUTES * MINUTE_MS
      ) {
        return req;
      }
    }
    return null;
  }

  private getOrThrow(id: string): EarlyDismissalRequest {
    const req = this.requests.get(id);
    if (!req) throw new BadRequestException('Pedido de saída antecipada não encontrado.');
    return req;
  }
}
