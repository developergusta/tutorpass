import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { CONSENT_PURPOSE_META, type ConsentPurpose } from '../consent/consent.service';
// Expurgo automático por retenção (LGPD art. 15/16 — término do tratamento).
// Regras, derivadas de CONSENT_PURPOSE_META (ConsentService):
// - DELEGATION_SELFIE (biométrico): 30 dias após a retirada — depois disso o arquivo some.
// - STUDENT_PHOTO: enquanto durar a matrícula; ao fim dela, expurga.
// - GUARDIAN_GEOLOCATION: retenção 0 dias — a posição NUNCA é persistida; se um ping
//   for registrado por engano, o próximo ciclo o expurga (rede de segurança da minimização).
// - PUSH_NOTIFICATIONS: token some quando o consentimento é revogado.
// - Qualquer dado cujo consentimento foi revogado é expurgado imediatamente
//   (revogação vale mais que o prazo cheio).
// O expurgo em si é auditado: cada item apagado gera um PurgeEvent append-only com hash
// encadeado (mesmo padrão do PickupLog/ConsentRecord) — mas o evento guarda SÓ a
// referência opaca ao dado (ex.: chave S3), nunca o conteúdo pessoal.
// Os registros de auditoria (ConsentEvent, PickupLog, PurgeEvent) NÃO são expurgados:
// são a prova de conformidade (accountability, art. 37) e não contêm dado pessoal.
// Step 2: trocar o store in-memory por Prisma (tabela RetainedItem + PurgeLog) e
// agendar purgeExpired() com @nestjs/schedule (cron diário, ex.: 03:00).

export type PurgeRule = 'RETENTION_EXPIRED' | 'ENROLLMENT_ENDED' | 'CONSENT_REVOKED' | 'ZERO_RETENTION';

export interface RetainedItem {
  id: string;
  schoolId: string;
  subjectId: string; // aluno (foto) ou tutor (selfie/token/ping)
  purpose: ConsentPurpose; // finalidade que cobre o dado
  dataRef: string; // referência opaca ao dado (ex.: 's3://tutorpass/selfies/abc.jpg') — nunca o conteúdo
  createdAt: Date;
  enrollmentEndsAt?: Date | null; // p/ STUDENT_PHOTO: fim da matrícula
  consentRevokedAt?: Date | null; // revogação do consentimento que cobre o dado
}

export interface PurgeEvent {
  id: string;
  schoolId: string;
  subjectId: string;
  purpose: ConsentPurpose;
  itemId: string;
  dataRef: string; // só a referência, nunca o conteúdo
  rule: PurgeRule;
  purgedAt: Date;
  prevHash: string | null;
  hash: string;
}

export interface PurgeReport {
  at: Date;
  purged: PurgeEvent[];
  remaining: number;
}

let seq = 0;

@Injectable()
export class RetentionService {
  private items: RetainedItem[] = [];
  private log: PurgeEvent[] = [];

  static chainHash(prevHash: string | null, payload: unknown) {
    return createHash('sha256').update(`${prevHash ?? 'GENESIS'}:${JSON.stringify(payload)}`).digest('hex');
  }

  register(item: Omit<RetainedItem, 'id'>): RetainedItem {
    const full: RetainedItem = { id: `retained-${++seq}-${Date.now()}`, ...item };
    this.items.push(full);
    return full;
  }

  /** Prazo de retenção do dado (null = enquanto durar o vínculo/matrícula). */
  retentionDeadlineFor(item: RetainedItem): Date | null {
    if (item.purpose === 'STUDENT_PHOTO' && item.enrollmentEndsAt) return item.enrollmentEndsAt;
    const days = CONSENT_PURPOSE_META[item.purpose].retentionDays;
    if (days === null) return null;
    return new Date(item.createdAt.getTime() + days * 86_400_000);
  }

  /** Regra que expurga o item agora (null = ainda dentro do prazo). Prioridade: revogação > matrícula > prazo. */
  purgeRuleFor(item: RetainedItem, now: Date): PurgeRule | null {
    if (item.consentRevokedAt && now >= item.consentRevokedAt) return 'CONSENT_REVOKED';
    if (item.purpose === 'STUDENT_PHOTO' && item.enrollmentEndsAt && now >= item.enrollmentEndsAt)
      return 'ENROLLMENT_ENDED';
    const days = CONSENT_PURPOSE_META[item.purpose].retentionDays;
    if (days === 0) return 'ZERO_RETENTION'; // ping registrado por engano: some no próximo ciclo
    const deadline = this.retentionDeadlineFor(item);
    if (deadline && now >= deadline) return 'RETENTION_EXPIRED';
    return null;
  }

  /** Prévia do que seria expurgado — não remove nada nem escreve no log. */
  dryRun(now: Date = new Date()): { item: RetainedItem; rule: PurgeRule }[] {
    return this.items
      .map((item) => ({ item, rule: this.purgeRuleFor(item, now) }))
      .filter((d): d is { item: RetainedItem; rule: PurgeRule } => d.rule !== null);
  }

  /** Expurga tudo vencido e registra cada item no log de auditoria. Idempotente. */
  purgeExpired(now: Date = new Date()): PurgeReport {
    const due = this.dryRun(now);
    const dueIds = new Set(due.map((d) => d.item.id));
    this.items = this.items.filter((i) => !dueIds.has(i.id));
    const purged = due.map((d) =>
      this.append({
        schoolId: d.item.schoolId,
        subjectId: d.item.subjectId,
        purpose: d.item.purpose,
        itemId: d.item.id,
        dataRef: d.item.dataRef,
        rule: d.rule,
        purgedAt: now,
      }),
    );
    return { at: now, purged, remaining: this.items.length };
  }

  list(): RetainedItem[] {
    return [...this.items];
  }

  purgeLog(): PurgeEvent[] {
    return [...this.log];
  }

  /** Verifica a cadeia de hashes do log de expurgo (auditoria imutável). */
  verifyChain(): boolean {
    let prev: string | null = null;
    for (const e of this.log) {
      const { hash, ...rest } = e;
      if (RetentionService.chainHash(prev, rest) !== hash) return false;
      prev = hash;
    }
    return true;
  }

  private append(input: Omit<PurgeEvent, 'id' | 'prevHash' | 'hash'>): PurgeEvent {
    const prevHash = this.log.length ? this.log[this.log.length - 1].hash : null;
    const base = { id: `purge-${++seq}-${Date.now()}`, prevHash, ...input };
    const hash = RetentionService.chainHash(prevHash, base);
    const event: PurgeEvent = { ...base, hash };
    this.log.push(event);
    return event;
  }
}
