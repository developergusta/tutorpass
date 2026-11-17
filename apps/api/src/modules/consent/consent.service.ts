import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
// Consentimento LGPD (art. 14) por finalidade — registro append-only com hash encadeado,
// no mesmo padrão do PickupLog. Step 2: persistir em ConsentRecord (Prisma).
// Regras:
// - Criança < 12 anos: consentimento SÓ pelo responsável legal, específico e em destaque
//   (explicit=true) e com a versão do aviso de privacidade exibido (consentimento informado).
// - Dado sensível (selfie de delegação = biométrico): exige consentimento explícito.
// - Revogação é um evento novo (nunca apaga o histórico) e vale imediatamente:
//   geolocalização/selfie sem consentimento ativo são bloqueadas por requireConsent.
// - Geolocalização do tutor: consentimento cobre o uso em tempo real; a posição em si
//   NÃO é persistida (retenção 0 dias) — só o registro de consentimento fica no log.
export type ConsentPurpose =
  | 'GUARDIAN_GEOLOCATION' // localização do tutor p/ ETA/fila (dado de localização)
  | 'DELEGATION_SELFIE' // selfie de quem retira (dado biométrico — sensível)
  | 'STUDENT_PHOTO' // foto do aluno no painel da sala/portaria (imagem de menor)
  | 'PUSH_NOTIFICATIONS'; // notificações de chamada/entrega

export type ConsentEventType = 'GRANT' | 'REVOKE';

export interface ConsentEvent {
  id: string;
  schoolId: string;
  subjectId: string; // aluno (foto) ou tutor (geolocalização/selfie/push)
  purpose: ConsentPurpose;
  type: ConsentEventType;
  grantedByUserId: string;
  grantedByRole: 'GUARDIAN' | 'SELF';
  explicit: boolean; // consentimento específico e em destaque (obrigatório p/ <12 e p/ sensível)
  noticeVersion: string; // versão do aviso de privacidade exibido no ato
  subjectUnder12: boolean;
  createdAt: Date;
  prevHash: string | null;
  hash: string;
}

export const CONSENT_PURPOSE_META: Record<
  ConsentPurpose,
  { sensitive: boolean; retentionDays: number | null; label: string }
> = {
  GUARDIAN_GEOLOCATION: { sensitive: false, retentionDays: 0, label: 'Localização do tutor (tempo real, sem persistir posição)' },
  DELEGATION_SELFIE: { sensitive: true, retentionDays: 30, label: 'Selfie de delegação (biométrico)' },
  STUDENT_PHOTO: { sensitive: false, retentionDays: null, label: 'Foto do aluno (enquanto matriculado)' },
  PUSH_NOTIFICATIONS: { sensitive: false, retentionDays: null, label: 'Notificações push' },
};

let seq = 0;

@Injectable()
export class ConsentService {
  private events: ConsentEvent[] = [];

  static chainHash(prevHash: string | null, payload: unknown) {
    return createHash('sha256').update(`${prevHash ?? 'GENESIS'}:${JSON.stringify(payload)}`).digest('hex');
  }

  /** Menor de 12 anos na data de referência (LGPD art. 14: criança). */
  static isUnder12(birthDate: Date, at: Date = new Date()): boolean {
    // Idade é conceito de calendário, não de instante: comparar ano/mês/dia
    // em UTC. A versão anterior somava 12 anos com setFullYear (hora local)
    // e errava a borda em 1 h quando o nascimento caía em horário de verão
    // e o aniversário não (bug achado em 17/11/2026: nascido em 16/11/2014
    // era dado como <12 anos no dia do 12º aniversário).
    const twelveYear = birthDate.getUTCFullYear() + 12;
    const atYear = at.getUTCFullYear();
    if (atYear !== twelveYear) return atYear < twelveYear;
    const birthMonth = birthDate.getUTCMonth();
    const atMonth = at.getUTCMonth();
    if (atMonth !== birthMonth) return atMonth < birthMonth;
    return at.getUTCDate() < birthDate.getUTCDate();
  }

  grant(input: {
    schoolId: string;
    subjectId: string;
    purpose: ConsentPurpose;
    grantedByUserId: string;
    grantedByRole: 'GUARDIAN' | 'SELF';
    explicit: boolean;
    noticeVersion: string;
    subjectUnder12: boolean;
  }): ConsentEvent {
    const meta = CONSENT_PURPOSE_META[input.purpose];
    if (meta.sensitive && !input.explicit)
      throw new BadRequestException(`Consentimento para ${input.purpose} precisa ser explícito (dado sensível)`);
    if (input.subjectUnder12 && (input.grantedByRole !== 'GUARDIAN' || !input.explicit))
      throw new ForbiddenException('Consentimento de criança (< 12 anos) exige responsável legal e consentimento explícito');
    if (!input.noticeVersion.trim())
      throw new BadRequestException('Versão do aviso de privacidade é obrigatória (consentimento informado)');
    return this.append({ ...input, type: 'GRANT' as const });
  }

  revoke(input: {
    schoolId: string;
    subjectId: string;
    purpose: ConsentPurpose;
    revokedByUserId: string;
  }): ConsentEvent {
    // Revogar sem consentimento ativo também é registrado (auditoria do pedido).
    return this.append({
      ...input,
      grantedByUserId: input.revokedByUserId,
      grantedByRole: 'GUARDIAN',
      explicit: true,
      noticeVersion: '',
      subjectUnder12: false,
      type: 'REVOKE' as const,
    });
  }

  /** Último evento decide: consentimento ativo só se o evento mais recente for GRANT. */
  isConsented(schoolId: string, subjectId: string, purpose: ConsentPurpose): boolean {
    const last = [...this.events]
      .reverse()
      .find((e) => e.schoolId === schoolId && e.subjectId === subjectId && e.purpose === purpose);
    return last?.type === 'GRANT';
  }

  /** Guarda de uso: lance 403 antes de processar geolocalização/selfie sem consentimento. */
  requireConsent(schoolId: string, subjectId: string, purpose: ConsentPurpose): void {
    if (!this.isConsented(schoolId, subjectId, purpose))
      throw new ForbiddenException(`Sem consentimento ativo para ${purpose} (LGPD art. 14)`);
  }

  /** Prazo de retenção do DADO coberto pelo consentimento (não do registro de auditoria). */
  retentionDeadline(event: ConsentEvent): Date | null {
    const days = CONSENT_PURPOSE_META[event.purpose].retentionDays;
    if (days === null) return null; // enquanto durar o vínculo/matrícula
    return new Date(event.createdAt.getTime() + days * 86_400_000);
  }

  /** Exportação p/ exercício de direitos do titular (LGPD art. 18): todo o histórico do sujeito. */
  exportSubjectEvents(schoolId: string, subjectId: string): ConsentEvent[] {
    return this.events.filter((e) => e.schoolId === schoolId && e.subjectId === subjectId);
  }

  /** Todos os eventos de consentimento da escola (p/ o relatório de conformidade). */
  listEvents(schoolId: string): ConsentEvent[] {
    return this.events.filter((e) => e.schoolId === schoolId);
  }

  /** Verifica a cadeia de hashes dos eventos (auditoria imutável). */
  verifyChain(): boolean {
    let prev: string | null = null;
    for (const e of this.events) {
      const { hash, ...rest } = e;
      const expected = ConsentService.chainHash(prev, rest);
      if (expected !== hash) return false;
      prev = hash;
    }
    return true;
  }

  private append(input: Omit<ConsentEvent, 'id' | 'createdAt' | 'prevHash' | 'hash'>): ConsentEvent {
    const prevHash = this.events.length ? this.events[this.events.length - 1].hash : null;
    const base = { id: `consent-${++seq}-${Date.now()}`, createdAt: new Date(), prevHash, ...input };
    const hash = ConsentService.chainHash(prevHash, base);
    const event: ConsentEvent = { ...base, hash };
    this.events.push(event);
    return event;
  }
}
