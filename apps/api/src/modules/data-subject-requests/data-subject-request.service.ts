import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';

// Exercício de direitos do titular (LGPD arts. 18 e 19) pelo painel do
// admin — ver docs/product/IDEAS.md, frente e (ciclo 26) e frente b
// (ciclo 29):
// O titular (ou o responsável legal do menor) pode pedir confirmação da
// existência do tratamento e acesso aos dados, correção, anonimização,
// bloqueio, eliminação, portabilidade, informação sobre compartilhamento e
// revogação do consentimento. O pedido é GRATUITO (art. 18, §5º) e a escola
// (controladora, art. 5º, VI) decide — o TutorPass (operadora, art. 5º,
// VII) executa e registra. O TutorPass nunca decide sozinho sobre dado de
// aluno.
// Regras de produto:
// - DOIS PRAZOS, não um (art. 19): a confirmação da existência + o acesso
//   em formato SIMPLIFICADO são IMEDIATOS — o pedido de ACCESS só é
//   dado como atendido depois de `provideSimplifiedAccess` (a secretaria
//   entrega a confirmação + o resumo no ato); a declaração COMPLETA (origem
//   dos dados, critérios e finalidade) tem até 15 DIAS corridos
//   (`dueAt = receivedAt + 15 dias`, art. 19, §2º). `listOverdue` é o que
//   o DPO abre toda manhã; `listSimplifiedAccessPending` é a fila do
//   "imediato" — um ACCESS sem acesso simplificado entregue já está atrasado.
// - O pedido de acesso é também vetor de ataque: ANTES de entregar
//   qualquer dado, a identidade do requerente é verificada
//   (`verifyIdentity`, com quem verificou registrado). Pedido sem
//   identidade verificada não anda — um acesso atendido sem verificação
//   vira vazamento com protocolo. O atendimento só começa depois da
//   verificação (OPEN → IDENTITY_VERIFIED → IN_PROGRESS).
// - ELIMINAÇÃO NEM SEMPRE É POSSÍVEL (art. 16): dado guardado por
//   obrigação legal ou p/ exercício regular de direitos não se apaga — e
//   o nosso PickupLog/auditoria com hash encadeado é exatamente esse caso:
//   apagar um evento quebra a cadeia e apaga a prova da saída. Por isso,
//   ERASURE e ANONYMIZATION só aceitam outcome PARTIAL e a resposta
//   carrega `retainedByLegalObligation` com as categorias mantidas e o
//   fundamento — nunca um "não" seco. O atendimento precisa dizer O QUE
//   foi apagado e O QUE foi mantido, com o fundamento.
// - Um pedido ativo por titular + tipo: o mesmo titular não abre dois
//   pedidos de acesso ao mesmo tempo (evita trabalho duplicado e dois
//   prazos correndo p/ a mesma coisa); tipos diferentes podem correr em
//   paralelo (acesso + correção, por exemplo).
// - Cada passo gera um evento append-only com hash encadeado (mesmo padrão
//   do PickupLog, do SecurityIncidentService e do RetentionService) — o
//   log do pedido é a prova p/ a ANPD de que o prazo foi cumprido.
// - O pedido guarda SÓ referências opacas (subjectId) — nenhum nome de
//   aluno/tutor no log; `details` é o texto do pedido, escrito por quem
//   abriu, e não deve conter dado sensível além do necessário.
// Integração Step 2: trocar o store in-memory por Prisma
// (DataSubjectRequest + DataSubjectRequestEvent, já no schema); o
// atendimento de ERASURE executa o expurgo de fato via RetentionService
// (o que for apagável) e registra o que foi mantido; notificar o DPO em
// dual-path (NotificationService) quando um pedido ficar a 2 dias do
// vencimento; o app do tutor abre o pedido direto (channel SUBJECT_APP).

/** Direitos do titular (art. 18, incisos I–IX). */
export type DataSubjectRequestType =
  | 'ACCESS' // confirmação da existência + acesso (I e II)
  | 'CORRECTION' // correção de dados incompletos/inexatos/desatualizados (III)
  | 'ANONYMIZATION' // anonimização (IV)
  | 'BLOCKING' // bloqueio (IV)
  | 'ERASURE' // eliminação (VI)
  | 'PORTABILITY' // portabilidade a outro fornecedor (V)
  | 'SHARING_INFO' // informação sobre compartilhamento com terceiros (VII)
  | 'CONSENT_REVOCATION'; // revogação do consentimento (IX)

/** Quem é o titular dos dados do pedido. */
export type DataSubjectType = 'STUDENT' | 'TUTOR' | 'STAFF';

/** De onde o pedido nasceu: painel do admin da escola ou app do titular. */
export type DataSubjectRequestChannel = 'ADMIN_PANEL' | 'SUBJECT_APP';

export type DataSubjectRequestStatus =
  | 'OPEN'
  | 'IDENTITY_VERIFIED'
  | 'IN_PROGRESS'
  | 'FULFILLED'
  | 'PARTIALLY_FULFILLED'
  | 'DENIED'
  | 'CANCELLED';

export type DataSubjectRequestEventType =
  | 'OPENED'
  | 'IDENTITY_VERIFIED'
  | 'SIMPLIFIED_ACCESS_PROVIDED'
  | 'STARTED'
  | 'FULFILLED'
  | 'DENIED'
  | 'CANCELLED'
  | 'NOTE';

/** Prazo da declaração completa (art. 19, §2º) — dias corridos. */
export const FULL_DECLARATION_DAYS = 15;

/**
 * O que NUNCA é apagado numa eliminação/anonimização (art. 16, I —
 * cumprimento de obrigação legal/regulatória e exercício regular de
 * direitos): o registro de retirada e os logs de auditoria são a prova da
 * saída e da conformidade; apagar um evento quebra a cadeia de hash.
 */
export const ART16_RETAINED_CATEGORIES = [
  'PICKUP_LOG',
  'AUDIT_LOG',
  'CONSENT_LOG',
  'SECURITY_INCIDENT_LOG',
] as const;

export type Art16RetainedCategory = (typeof ART16_RETAINED_CATEGORIES)[number];

export const ART16_RETAINED_LABELS: Record<Art16RetainedCategory, string> = {
  PICKUP_LOG:
    'Registro de retirada (PickupLog) — prova de quem retirou cada aluno, quando e por qual meio (art. 16, I).',
  AUDIT_LOG:
    'Logs de auditoria com hash encadeado — prova de conformidade (art. 37); apagar um evento quebra a cadeia.',
  CONSENT_LOG:
    'Registro de consentimentos por finalidade — prova do consentimento dado e revogado (art. 8º, §3º).',
  SECURITY_INCIDENT_LOG:
    'Registro de incidentes de segurança — guarda p/ apuração e comunicação à ANPD (Res. CD/ANPD nº 15/2024).',
};

export interface DataSubjectRequest {
  id: string;
  schoolId: string;
  /** Id opaco do titular (aluno/tutor/staff) — nunca o nome no log. */
  subjectId: string;
  subjectType: DataSubjectType;
  /** Quem abriu o pedido (id do staff ou do próprio titular). */
  requestedBy: string;
  channel: DataSubjectRequestChannel;
  type: DataSubjectRequestType;
  /** Texto do pedido — o que o titular quer, sem dado sensível além do necessário. */
  details: string;
  status: DataSubjectRequestStatus;
  receivedAt: Date;
  /** Prazo da declaração completa: receivedAt + 15 dias corridos (art. 19, §2º). */
  dueAt: Date;
  /** Acesso simplificado (art. 19, I) — imediato; null até ser entregue. */
  simplifiedAccessProvidedAt: Date | null;
  /** Resumo do acesso simplificado entregue (o que foi confirmado). */
  simplifiedAccessSummary: string | null;
  identityVerifiedAt: Date | null;
  /** Quem verificou a identidade do requerente. */
  verifiedBy: string | null;
  startedAt: Date | null;
  fulfilledAt: Date | null;
  /** FULL = atendido por completo; PARTIAL = atendido em parte (ex.: eliminação com retenção do art. 16). */
  outcome: 'FULL' | 'PARTIAL' | null;
  /** Resposta ao titular: o que foi feito e, se parcial, o que ficou de fora e por quê. */
  fulfillmentNote: string | null;
  /** Categorias mantidas por obrigação legal (art. 16) — só em ERASURE/ANONYMIZATION. */
  retainedByLegalObligation: Art16RetainedCategory[];
  deniedAt: Date | null;
  denialReason: string | null;
  cancelledAt: Date | null;
  createdAt: Date;
}

export interface DataSubjectRequestEvent {
  id: string;
  requestId: string;
  type: DataSubjectRequestEventType;
  actor: string;
  note: string | null;
  at: Date;
  prevHash: string | null;
  hash: string;
}

export interface OpenRequestInput {
  schoolId: string;
  subjectId: string;
  subjectType: DataSubjectType;
  requestedBy: string;
  channel?: DataSubjectRequestChannel;
  type: DataSubjectRequestType;
  details: string;
}

export interface FulfillRequestInput {
  outcome: 'FULL' | 'PARTIAL';
  /** Resposta ao titular — obrigatória: o que foi feito e o que ficou de fora. */
  note: string;
}

const REQUEST_TYPES: DataSubjectRequestType[] = [
  'ACCESS',
  'CORRECTION',
  'ANONYMIZATION',
  'BLOCKING',
  'ERASURE',
  'PORTABILITY',
  'SHARING_INFO',
  'CONSENT_REVOCATION',
];

const SUBJECT_TYPES: DataSubjectType[] = ['STUDENT', 'TUTOR', 'STAFF'];

/** Tipos que eliminam dado — sempre com retenção do art. 16. */
const ERASURE_TYPES: DataSubjectRequestType[] = ['ERASURE', 'ANONYMIZATION'];

/** Status terminais — o pedido não aceita mais nenhuma transição. */
const TERMINAL_STATUSES: DataSubjectRequestStatus[] = [
  'FULFILLED',
  'PARTIALLY_FULFILLED',
  'DENIED',
  'CANCELLED',
];

/** Soma `n` dias corridos a `date` (mesmo horário do dia). */
export function addDays(date: Date, n: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + n);
  return result;
}

let seq = 0;

@Injectable()
export class DataSubjectRequestService {
  private readonly requests = new Map<string, DataSubjectRequest>();
  private readonly events = new Map<string, DataSubjectRequestEvent[]>();

  static chainHash(prevHash: string | null, payload: unknown): string {
    return createHash('sha256')
      .update(`${prevHash ?? 'GENESIS'}:${JSON.stringify(payload)}`)
      .digest('hex');
  }

  open(input: OpenRequestInput, now = new Date()): DataSubjectRequest {
    if (!REQUEST_TYPES.includes(input.type)) {
      throw new BadRequestException(`Tipo de pedido inválido: ${input.type}.`);
    }
    if (!SUBJECT_TYPES.includes(input.subjectType)) {
      throw new BadRequestException(`Tipo de titular inválido: ${input.subjectType}.`);
    }
    if (!input.subjectId.trim()) {
      throw new BadRequestException('subjectId (titular do pedido) é obrigatório.');
    }
    if (!input.requestedBy.trim()) {
      throw new BadRequestException('requestedBy (quem abriu o pedido) é obrigatório.');
    }
    if (!input.details.trim()) {
      throw new BadRequestException('details (o que o titular pede) é obrigatório.');
    }
    const duplicate = [...this.requests.values()].find(
      (r) =>
        r.schoolId === input.schoolId &&
        r.subjectId === input.subjectId &&
        r.type === input.type &&
        !TERMINAL_STATUSES.includes(r.status),
    );
    if (duplicate) {
      throw new BadRequestException(
        `Já existe um pedido ${input.type} ativo p/ este titular (id ${duplicate.id}, status ${duplicate.status}) — atenda ou cancele o pedido aberto antes de abrir outro.`,
      );
    }

    const id = `dsr-${++seq}`;
    const request: DataSubjectRequest = {
      id,
      schoolId: input.schoolId,
      subjectId: input.subjectId,
      subjectType: input.subjectType,
      requestedBy: input.requestedBy,
      channel: input.channel ?? 'ADMIN_PANEL',
      type: input.type,
      details: input.details,
      status: 'OPEN',
      receivedAt: now,
      dueAt: addDays(now, FULL_DECLARATION_DAYS),
      simplifiedAccessProvidedAt: null,
      simplifiedAccessSummary: null,
      identityVerifiedAt: null,
      verifiedBy: null,
      startedAt: null,
      fulfilledAt: null,
      outcome: null,
      fulfillmentNote: null,
      retainedByLegalObligation: [],
      deniedAt: null,
      denialReason: null,
      cancelledAt: null,
      createdAt: now,
    };
    this.requests.set(id, request);
    this.events.set(id, []);
    this.append(id, 'OPENED', input.requestedBy, null, now);
    return request;
  }

  get(id: string): DataSubjectRequest {
    const request = this.requests.get(id);
    if (!request) throw new NotFoundException('Pedido de direito do titular não encontrado.');
    return request;
  }

  /**
   * Verifica a identidade do requerente (OPEN → IDENTITY_VERIFIED).
   * Sem ela, o pedido não anda: entregar dado a quem não é o titular é
   * vazamento com protocolo. `verifiedBy` é quem conferiu (documento,
   * app autenticado, conferência na secretaria).
   */
  verifyIdentity(id: string, verifiedBy: string, now = new Date()): DataSubjectRequest {
    const request = this.get(id);
    if (request.status !== 'OPEN') {
      throw new BadRequestException(
        `Só é possível verificar a identidade de um pedido OPEN (atual: ${request.status}).`,
      );
    }
    if (!verifiedBy.trim()) {
      throw new BadRequestException('verifiedBy (quem verificou a identidade) é obrigatório.');
    }
    request.status = 'IDENTITY_VERIFIED';
    request.identityVerifiedAt = now;
    request.verifiedBy = verifiedBy;
    this.append(id, 'IDENTITY_VERIFIED', verifiedBy, null, now);
    return request;
  }

  /**
   * Acesso simplificado (art. 19, I) — confirmação da existência do
   * tratamento + acesso em formato simplificado, IMEDIATO. Só p/ ACCESS,
   * depois da verificação de identidade. O atendimento completo (declaração
   * em até 15 dias) continua correndo; sem este passo, o ACCESS não pode
   * ser dado como atendido.
   */
  provideSimplifiedAccess(
    id: string,
    actor: string,
    summary: string,
    now = new Date(),
  ): DataSubjectRequest {
    const request = this.get(id);
    if (request.type !== 'ACCESS') {
      throw new BadRequestException(
        `Acesso simplificado só existe p/ pedido ACCESS (este é ${request.type}).`,
      );
    }
    if (request.status !== 'IDENTITY_VERIFIED' && request.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `Acesso simplificado exige identidade verificada (atual: ${request.status}).`,
      );
    }
    if (request.simplifiedAccessProvidedAt) {
      throw new BadRequestException('Acesso simplificado já entregue p/ este pedido.');
    }
    if (!summary.trim()) {
      throw new BadRequestException('summary (o que foi confirmado no acesso simplificado) é obrigatório.');
    }
    request.simplifiedAccessProvidedAt = now;
    request.simplifiedAccessSummary = summary;
    this.append(id, 'SIMPLIFIED_ACCESS_PROVIDED', actor, summary, now);
    return request;
  }

  /** Inicia o atendimento (IDENTITY_VERIFIED → IN_PROGRESS). */
  startProcessing(id: string, actor: string, now = new Date()): DataSubjectRequest {
    const request = this.get(id);
    if (request.status !== 'IDENTITY_VERIFIED') {
      throw new BadRequestException(
        `Só é possível iniciar o atendimento de um pedido com identidade verificada (atual: ${request.status}).`,
      );
    }
    request.status = 'IN_PROGRESS';
    request.startedAt = now;
    this.append(id, 'STARTED', actor, null, now);
    return request;
  }

  /**
   * Atende o pedido (IN_PROGRESS → FULFILLED / PARTIALLY_FULFILLED).
   * - ACCESS exige o acesso simplificado já entregue (art. 19, I).
   * - ERASURE/ANONYMIZATION só aceitam PARTIAL: os logs do art. 16 são
   *   sempre retidos, e a resposta carrega o que foi mantido e o fundamento.
   * - A nota é obrigatória: é a resposta que o titular recebe — o que foi
   *   feito e, se parcial, o que ficou de fora e por quê.
   */
  fulfill(id: string, actor: string, input: FulfillRequestInput, now = new Date()): DataSubjectRequest {
    const request = this.get(id);
    if (request.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `Só é possível atender um pedido IN_PROGRESS (atual: ${request.status}).`,
      );
    }
    if (input.outcome !== 'FULL' && input.outcome !== 'PARTIAL') {
      throw new BadRequestException(`outcome inválido: ${input.outcome} (use FULL ou PARTIAL).`);
    }
    if (!input.note.trim()) {
      throw new BadRequestException('note (resposta ao titular) é obrigatória.');
    }
    if (request.type === 'ACCESS' && !request.simplifiedAccessProvidedAt) {
      throw new BadRequestException(
        'ACCESS exige o acesso simplificado entregue antes do atendimento completo (art. 19, I — provideSimplifiedAccess).',
      );
    }
    if (ERASURE_TYPES.includes(request.type)) {
      if (input.outcome === 'FULL') {
        throw new BadRequestException(
          `${request.type} nunca é FULL: os registros do art. 16 (PickupLog, logs de auditoria, consentimentos e incidentes) são sempre mantidos — use PARTIAL e explique o que foi mantido na nota.`,
        );
      }
      request.retainedByLegalObligation = [...ART16_RETAINED_CATEGORIES];
    }
    request.status = input.outcome === 'FULL' ? 'FULFILLED' : 'PARTIALLY_FULFILLED';
    request.outcome = input.outcome;
    request.fulfillmentNote = input.note;
    request.fulfilledAt = now;
    this.append(id, 'FULFILLED', actor, input.note, now);
    return request;
  }

  /** Nega o pedido com fundamento (ex.: identidade não confirmada, pedido manifestamente infundado). */
  deny(id: string, actor: string, reason: string, now = new Date()): DataSubjectRequest {
    const request = this.get(id);
    if (TERMINAL_STATUSES.includes(request.status)) {
      throw new BadRequestException(`Pedido ${request.status} não aceita negação.`);
    }
    if (!reason.trim()) {
      throw new BadRequestException('A negação exige um motivo (o titular tem direito a saber por quê).');
    }
    request.status = 'DENIED';
    request.deniedAt = now;
    request.denialReason = reason;
    this.append(id, 'DENIED', actor, reason, now);
    return request;
  }

  /** Cancela o pedido a pedido do titular (não terminal → CANCELLED). */
  cancel(id: string, actor: string, now = new Date()): DataSubjectRequest {
    const request = this.get(id);
    if (TERMINAL_STATUSES.includes(request.status)) {
      throw new BadRequestException(`Pedido ${request.status} não aceita cancelamento.`);
    }
    request.status = 'CANCELLED';
    request.cancelledAt = now;
    this.append(id, 'CANCELLED', actor, null, now);
    return request;
  }

  /** Anotação livre no log do pedido (não muda o status). */
  addNote(id: string, actor: string, note: string, now = new Date()): DataSubjectRequest {
    const request = this.get(id);
    if (TERMINAL_STATUSES.includes(request.status)) {
      throw new BadRequestException('Pedido finalizado não aceita anotações.');
    }
    if (!note.trim()) throw new BadRequestException('A anotação não pode ser vazia.');
    this.append(id, 'NOTE', actor, note, now);
    return request;
  }

  /** Dias corridos restantes até o prazo da declaração completa (negativo = vencido). */
  daysRemaining(id: string, now = new Date()): number {
    const request = this.get(id);
    return Math.floor((request.dueAt.getTime() - now.getTime()) / 86_400_000);
  }

  /** Pedidos com a declaração completa vencida e ainda não finalizados — o que o DPO abre toda manhã. */
  listOverdue(now = new Date()): DataSubjectRequest[] {
    return [...this.requests.values()]
      .filter((r) => !TERMINAL_STATUSES.includes(r.status) && now > r.dueAt)
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  }

  /** Pedidos ACCESS sem o acesso simplificado entregue — o "imediato" do art. 19, I, ainda pendente. */
  listSimplifiedAccessPending(): DataSubjectRequest[] {
    return [...this.requests.values()]
      .filter(
        (r) =>
          r.type === 'ACCESS' &&
          !TERMINAL_STATUSES.includes(r.status) &&
          !r.simplifiedAccessProvidedAt,
      )
      .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
  }

  listForSchool(schoolId: string): DataSubjectRequest[] {
    return [...this.requests.values()]
      .filter((r) => r.schoolId === schoolId)
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
  }

  listEvents(requestId: string): DataSubjectRequestEvent[] {
    this.get(requestId);
    return [...(this.events.get(requestId) ?? [])];
  }

  /** Verifica a cadeia de hashes do log de um pedido (auditoria imutável). */
  verifyChain(requestId: string): boolean {
    const events = this.events.get(requestId);
    if (!events) throw new NotFoundException('Pedido de direito do titular não encontrado.');
    let prev: string | null = null;
    for (const e of events) {
      const { hash, ...rest } = e;
      if (DataSubjectRequestService.chainHash(prev, rest) !== hash) return false;
      prev = hash;
    }
    return true;
  }

  private append(
    requestId: string,
    type: DataSubjectRequestEventType,
    actor: string,
    note: string | null,
    at: Date,
  ): DataSubjectRequestEvent {
    const log = this.events.get(requestId)!;
    const prevHash = log.length ? log[log.length - 1].hash : null;
    const base = { id: `dsr-event-${++seq}`, requestId, type, actor, note, at, prevHash };
    const hash = DataSubjectRequestService.chainHash(prevHash, base);
    const event: DataSubjectRequestEvent = { ...base, hash };
    log.push(event);
    return event;
  }
}
