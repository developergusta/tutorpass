import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';

// Registro de incidentes de segurança com prazo de comunicação à ANPD — ver
// docs/product/IDEAS.md, frente e (ciclo 9) e frente a (ciclo 10):
// Resolução CD/ANPD nº 15/2024 — quando o incidente puder acarretar risco ou
// dano relevante, o controlador comunica a ANPD e os titulares afetados em
// até 3 DIAS ÚTEIS (complementação em até 20 dias úteis). A infração mais
// comum apurada pela ANPD não é o vazamento — é a falha em comunicar no
// prazo. Arquivo enviado à família errada, planilha com permissão aberta e
// equipamento perdido também contam como incidente. Nenhum concorrente de
// dismissal publica um registro estruturado de incidentes — é o nosso
// diferencial de auditoria (tese: auditoria imutável) e o motivo real: em
// 2026, a Frontline Education (ago/2026, 1,3 mi+ de pessoas, SSNs e Medicaid
// IDs de alunos) e o app Equipple na Irlanda do Norte (50 mil usuários,
// contato de pais + dados de alunos) vazaram — e a comunicação aos afetados
// levou semanas. O TutorPass dá à escola o relógio e o checklist prontos.
// Regras de produto:
// - Categorias cobrem os incidentes típicos de escola (não só invasão):
//   WRONG_RECIPIENT (arquivo p/ família errada), OPEN_SPREADSHEET (permissão
//   aberta), LOST_DEVICE (equipamento perdido/roubado), UNAUTHORIZED_ACCESS,
//   RANSOMWARE, OTHER.
// - Só categorias de dados e contagem de titulares — NUNCA o conteúdo vazado
//   (minimização: o registro do incidente não pode virar um segundo vazamento).
// - `relevantRisk` decide a obrigação: com risco relevante, ANPD + titulares
//   têm de ser comunicados; sem ele, o incidente é registrado e contido, e o
//   fechamento não exige comunicação (a escola documenta o porquê).
// - Relógio em dias úteis (sáb/dom fora; feriados fora do escopo desta versão
//   — documentado): `communicationDueAt` = detectedAt + 3 dias úteis;
//   `supplementDueAt` = detectedAt + 20 dias úteis (complementação).
// - Fluxo: OPEN → CONTAINED → COMMUNICATED → CLOSED. A comunicação à ANPD
//   e aos titulares pode ser registrada a partir de OPEN ou CONTAINED (na vida
//   real, comunica-se antes de conter tudo); o status vira COMMUNICATED quando
//   as comunicações obrigatórias estão feitas. Fechar exige: contido + (ANPD
//   comunicada, se obrigatória) + (titulares comunicados, se obrigatória).
// - Cada passo (registro, contenção, comunicação, fechamento, anotação) gera
//   um evento append-only com hash encadeado (mesmo padrão do PickupLog e do
//   RetentionService) — o log do incidente é a prova p/ a ANPD.
// - `listOverdue` é o que a diretoria/DPO abre toda manhã: incidentes com
//   comunicação vencida (ANPD ou complementação) e ainda não feita.
// Integração Step 2: trocar o store in-memory por Prisma (SecurityIncident,
// já no schema; eventos em SecurityIncidentEvent); o painel do admin lista
// `listOverdue` + `listForSchool`; o DPO da escola é o responsável
// (`dpoContact`); no Step 2, notificar o DPO em dual-path (NotificationService)
// quando um incidente ficar a 1 dia útil do vencimento.

export type IncidentCategory =
  | 'WRONG_RECIPIENT'
  | 'OPEN_SPREADSHEET'
  | 'LOST_DEVICE'
  | 'UNAUTHORIZED_ACCESS'
  | 'RANSOMWARE'
  | 'OTHER';

/** Categorias de dados envolvidos — só o tipo, nunca o conteúdo. */
export type IncidentDataCategory =
  | 'STUDENT_NAME'
  | 'GUARDIAN_CONTACT'
  | 'STUDENT_PHOTO'
  | 'DOCUMENT_ID'
  | 'HEALTH_INFO'
  | 'LOCATION'
  | 'OTHER';

export type IncidentStatus = 'OPEN' | 'CONTAINED' | 'COMMUNICATED' | 'CLOSED';

export type IncidentEventType =
  | 'REPORTED'
  | 'CONTAINED'
  | 'ANPD_NOTIFIED'
  | 'SUBJECTS_NOTIFIED'
  | 'SUPPLEMENT_SENT'
  | 'NOTE'
  | 'CLOSED';

/** Prazo de comunicação à ANPD e aos titulares (dias úteis, Res. 15/2024). */
export const ANPD_COMMUNICATION_BUSINESS_DAYS = 3;
/** Prazo da complementação das informações à ANPD (dias úteis). */
export const ANPD_SUPPLEMENT_BUSINESS_DAYS = 20;

export interface SecurityIncident {
  id: string;
  schoolId: string;
  title: string;
  description: string;
  category: IncidentCategory;
  dataCategories: IncidentDataCategory[];
  /** Quantos titulares tiveram dados envolvidos (0 = ainda desconhecido). */
  affectedCount: number;
  /** Se o incidente pode acarretar risco ou dano relevante (Res. 15/2024). */
  relevantRisk: boolean;
  detectedAt: Date;
  /** Quem registrou (id/nome do staff) e contato do DPO responsável. */
  reportedBy: string;
  dpoContact: string | null;
  status: IncidentStatus;
  communicationDueAt: Date;
  supplementDueAt: Date;
  anpdNotifiedAt: Date | null;
  subjectsNotifiedAt: Date | null;
  supplementSentAt: Date | null;
  containedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
}

export interface IncidentEvent {
  id: string;
  incidentId: string;
  type: IncidentEventType;
  actor: string;
  note: string | null;
  at: Date;
  prevHash: string | null;
  hash: string;
}

export interface ReportIncidentInput {
  schoolId: string;
  title: string;
  description: string;
  category: IncidentCategory;
  dataCategories: IncidentDataCategory[];
  affectedCount: number;
  relevantRisk: boolean;
  detectedAt: Date;
  reportedBy: string;
  dpoContact?: string | null;
}

const INCIDENT_CATEGORIES: IncidentCategory[] = [
  'WRONG_RECIPIENT',
  'OPEN_SPREADSHEET',
  'LOST_DEVICE',
  'UNAUTHORIZED_ACCESS',
  'RANSOMWARE',
  'OTHER',
];

const DATA_CATEGORIES: IncidentDataCategory[] = [
  'STUDENT_NAME',
  'GUARDIAN_CONTACT',
  'STUDENT_PHOTO',
  'DOCUMENT_ID',
  'HEALTH_INFO',
  'LOCATION',
  'OTHER',
];

/** Soma `n` dias úteis a `date` (sáb/dom fora; mesmo horário do dia). */
export function addBusinessDays(date: Date, n: number): Date {
  const result = new Date(date.getTime());
  let remaining = n;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    const day = result.getUTCDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  return result;
}

/** Dias úteis de `from` até `to` (negativo = vencido há N dias úteis). */
export function businessDaysBetween(from: Date, to: Date): number {
  if (to.getTime() === from.getTime()) return 0;
  const step = to > from ? 1 : -1;
  let count = 0;
  const cursor = new Date(from.getTime());
  while ((step > 0 && cursor < to) || (step < 0 && cursor > to)) {
    cursor.setUTCDate(cursor.getUTCDate() + step);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += step;
  }
  return count;
}

let seq = 0;

@Injectable()
export class SecurityIncidentService {
  private readonly incidents = new Map<string, SecurityIncident>();
  private readonly events = new Map<string, IncidentEvent[]>();

  static chainHash(prevHash: string | null, payload: unknown): string {
    return createHash('sha256')
      .update(`${prevHash ?? 'GENESIS'}:${JSON.stringify(payload)}`)
      .digest('hex');
  }

  report(input: ReportIncidentInput, now = new Date()): SecurityIncident {
    if (!input.title.trim() || !input.description.trim()) {
      throw new BadRequestException('Título e descrição do incidente são obrigatórios.');
    }
    if (!INCIDENT_CATEGORIES.includes(input.category)) {
      throw new BadRequestException(`Categoria inválida: ${input.category}.`);
    }
    if (!input.dataCategories.length) {
      throw new BadRequestException('Informe ao menos uma categoria de dados envolvidos.');
    }
    for (const c of input.dataCategories) {
      if (!DATA_CATEGORIES.includes(c)) {
        throw new BadRequestException(`Categoria de dados inválida: ${c}.`);
      }
    }
    if (!Number.isInteger(input.affectedCount) || input.affectedCount < 0) {
      throw new BadRequestException('affectedCount deve ser um inteiro maior ou igual a 0.');
    }
    if (input.detectedAt.getTime() > now.getTime()) {
      throw new BadRequestException('detectedAt não pode estar no futuro.');
    }
    if (!input.reportedBy.trim()) {
      throw new BadRequestException('reportedBy (quem registrou) é obrigatório.');
    }

    const id = `incident-${++seq}`;
    const incident: SecurityIncident = {
      id,
      schoolId: input.schoolId,
      title: input.title,
      description: input.description,
      category: input.category,
      dataCategories: [...input.dataCategories],
      affectedCount: input.affectedCount,
      relevantRisk: input.relevantRisk,
      detectedAt: input.detectedAt,
      reportedBy: input.reportedBy,
      dpoContact: input.dpoContact ?? null,
      status: 'OPEN',
      communicationDueAt: addBusinessDays(input.detectedAt, ANPD_COMMUNICATION_BUSINESS_DAYS),
      supplementDueAt: addBusinessDays(input.detectedAt, ANPD_SUPPLEMENT_BUSINESS_DAYS),
      anpdNotifiedAt: null,
      subjectsNotifiedAt: null,
      supplementSentAt: null,
      containedAt: null,
      closedAt: null,
      createdAt: now,
    };
    this.incidents.set(id, incident);
    this.events.set(id, []);
    this.append(id, 'REPORTED', input.reportedBy, null, now);
    return incident;
  }

  get(id: string): SecurityIncident {
    const incident = this.incidents.get(id);
    if (!incident) throw new NotFoundException('Incidente não encontrado.');
    return incident;
  }

  /** Contenção: OPEN → CONTAINED. Registrar a contenção não fecha o incidente. */
  contain(id: string, actor: string, note: string, now = new Date()): SecurityIncident {
    const incident = this.get(id);
    if (incident.status !== 'OPEN') {
      throw new BadRequestException(
        `Só é possível conter um incidente OPEN (atual: ${incident.status}).`,
      );
    }
    if (!note.trim()) {
      throw new BadRequestException('A contenção exige uma nota (o que foi feito).');
    }
    incident.status = 'CONTAINED';
    incident.containedAt = now;
    this.append(id, 'CONTAINED', actor, note, now);
    return incident;
  }

  /** Registra a comunicação à ANPD (a partir de OPEN ou CONTAINED). */
  recordAnpdNotification(id: string, actor: string, now = new Date()): SecurityIncident {
    const incident = this.get(id);
    if (incident.status === 'CLOSED') {
      throw new BadRequestException('Incidente fechado não aceita nova comunicação.');
    }
    if (incident.anpdNotifiedAt) {
      throw new BadRequestException('ANPD já comunicada para este incidente.');
    }
    incident.anpdNotifiedAt = now;
    this.append(id, 'ANPD_NOTIFIED', actor, null, now);
    this.maybeCommunicated(incident);
    return incident;
  }

  /** Registra a comunicação aos titulares afetados (a partir de OPEN ou CONTAINED). */
  recordSubjectsNotification(id: string, actor: string, now = new Date()): SecurityIncident {
    const incident = this.get(id);
    if (incident.status === 'CLOSED') {
      throw new BadRequestException('Incidente fechado não aceita nova comunicação.');
    }
    if (incident.subjectsNotifiedAt) {
      throw new BadRequestException('Titulares já comunicados para este incidente.');
    }
    incident.subjectsNotifiedAt = now;
    this.append(id, 'SUBJECTS_NOTIFIED', actor, null, now);
    this.maybeCommunicated(incident);
    return incident;
  }

  /** Registra o envio da complementação à ANPD (até 20 dias úteis). */
  recordSupplement(id: string, actor: string, now = new Date()): SecurityIncident {
    const incident = this.get(id);
    if (!incident.anpdNotifiedAt) {
      throw new BadRequestException('Complementação exige a comunicação inicial à ANPD.');
    }
    if (incident.supplementSentAt) {
      throw new BadRequestException('Complementação já enviada para este incidente.');
    }
    incident.supplementSentAt = now;
    this.append(id, 'SUPPLEMENT_SENT', actor, null, now);
    return incident;
  }

  /** Anotação livre no log do incidente (não muda o status). */
  addNote(id: string, actor: string, note: string, now = new Date()): SecurityIncident {
    const incident = this.get(id);
    if (incident.status === 'CLOSED') {
      throw new BadRequestException('Incidente fechado não aceita anotações.');
    }
    if (!note.trim()) throw new BadRequestException('A anotação não pode ser vazia.');
    this.append(id, 'NOTE', actor, note, now);
    return incident;
  }

  /** Fecha o incidente: exige contenção + comunicações obrigatórias feitas. */
  close(id: string, actor: string, now = new Date()): SecurityIncident {
    const incident = this.get(id);
    if (incident.status === 'CLOSED') {
      throw new BadRequestException('Incidente já fechado.');
    }
    if (incident.status === 'OPEN') {
      throw new BadRequestException('Feche só após conter o incidente (contain).');
    }
    if (incident.relevantRisk) {
      if (!incident.anpdNotifiedAt) {
        throw new BadRequestException(
          'Com risco relevante, a comunicação à ANPD é obrigatória antes de fechar.',
        );
      }
      if (!incident.subjectsNotifiedAt) {
        throw new BadRequestException(
          'Com risco relevante, a comunicação aos titulares é obrigatória antes de fechar.',
        );
      }
    }
    incident.status = 'CLOSED';
    incident.closedAt = now;
    this.append(id, 'CLOSED', actor, null, now);
    return incident;
  }

  /** Dias úteis restantes até o prazo de comunicação (negativo = vencido). */
  businessDaysRemaining(id: string, now = new Date()): number {
    const incident = this.get(id);
    return businessDaysBetween(now, incident.communicationDueAt);
  }

  /** Incidentes com comunicação à ANPD vencida (e não feita) ou complementação vencida. */
  listOverdue(now = new Date()): SecurityIncident[] {
    return [...this.incidents.values()]
      .filter((i) => {
        if (i.status === 'CLOSED') return false;
        if (i.relevantRisk && !i.anpdNotifiedAt && now > i.communicationDueAt) return true;
        if (i.anpdNotifiedAt && !i.supplementSentAt && now > i.supplementDueAt) return true;
        return false;
      })
      .sort((a, b) => a.communicationDueAt.getTime() - b.communicationDueAt.getTime());
  }

  listForSchool(schoolId: string): SecurityIncident[] {
    return [...this.incidents.values()]
      .filter((i) => i.schoolId === schoolId)
      .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  }

  listEvents(incidentId: string): IncidentEvent[] {
    this.get(incidentId);
    return [...(this.events.get(incidentId) ?? [])];
  }

  /** Verifica a cadeia de hashes do log de um incidente (auditoria imutável). */
  verifyChain(incidentId: string): boolean {
    const events = this.events.get(incidentId);
    if (!events) throw new NotFoundException('Incidente não encontrado.');
    let prev: string | null = null;
    for (const e of events) {
      const { hash, ...rest } = e;
      if (SecurityIncidentService.chainHash(prev, rest) !== hash) return false;
      prev = hash;
    }
    return true;
  }

  private maybeCommunicated(incident: SecurityIncident): void {
    if (incident.status !== 'OPEN' && incident.status !== 'CONTAINED') return;
    if (!incident.relevantRisk) return;
    if (incident.anpdNotifiedAt && incident.subjectsNotifiedAt) {
      incident.status = 'COMMUNICATED';
    }
  }

  private append(
    incidentId: string,
    type: IncidentEventType,
    actor: string,
    note: string | null,
    at: Date,
  ): IncidentEvent {
    const log = this.events.get(incidentId)!;
    const prevHash = log.length ? log[log.length - 1].hash : null;
    const base = { id: `incident-event-${++seq}`, incidentId, type, actor, note, at, prevHash };
    const hash = SecurityIncidentService.chainHash(prevHash, base);
    const event: IncidentEvent = { ...base, hash };
    log.push(event);
    return event;
  }
}
