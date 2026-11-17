import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';

// Tag/cartão impresso p/ delegado sem smartphone — ver docs/product/IDEAS.md,
// frente a, ciclos 22 e 28: PikMyKid entrega car tags (nome do aluno, professor,
// dismissal ID + QR no para-brisa; quem não tem smartphone anuncia a chegada
// pela tag — pikmykid.com/parent-support) e o PickUp Patrol gera e imprime as
// tags na plataforma (pickuppatrol.net). Nossa versão: o responsável (ou a
// secretaria) emite a tag p/ o delegado; a tag carrega um código de 6 dígitos
// + QR com o mesmo código — o QR só codifica o código
// (`TUTORPASS-TAG:<schoolId>:<código>`) — e a portaria digita ou escaneia,
// com a mesma validação nos dois casos. Sem selfie: a conferência na portaria
// é pelo documento do delegado, que a tag carrega impresso.
// Regras de produto:
// - Validade padrão 1 dia (o dia da retirada), máx. 30 dias; uso único por
//   padrão; multiuso só dentro da janela (ex.: avó busca a semana toda).
// - Código de 6 dígitos aleatório (crypto.randomInt), único entre as tags
//   ativas da escola — sem código repetido na mesma escola ao mesmo tempo.
// - Brute-force: 5 tentativas erradas p/ um código na escola em 15 min
//   travam a validação daquele código por 15 min (a portaria usa o documento
//   p/ desbloquear: confere, recusa a tag e emite outra).
// - Recusa na portaria (documento não confere): a tag é invalidada (REFUSED)
//   e o retorno traz o evento p/ avisar o responsável (NotificationService,
//   Step 2 — o controller dispara a notificação).
// - Sem sobreposição: mesmo delegado + mesmo aluno não pode ter 2 tags ativas.
// - Expiração via refresh()/refreshAll() (job diário, junto ao expurgo LGPD
//   e ao refresh de planos/autorizações).
// Integração Step 2: trocar o store in-memory por Prisma (PrintedTag, já no
// schema) e guardar só o hash do código (como os recovery codes do 2FA) —
// em memória, o código fica em claro no serviço, como os demais stores do
// Step 1. A emissão pela secretaria dispensa selfie; a retirada exige o
// documento impresso na tag.

export type PrintedTagStatus = 'ACTIVE' | 'USED' | 'REVOKED' | 'REFUSED' | 'EXPIRED';

export const PRINTED_TAG_QR_PREFIX = 'TUTORPASS-TAG';

const DAY_MS = 86_400_000;
const MAX_VALIDITY_DAYS = 30;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60_000;

export interface PrintedTag {
  id: string;
  schoolId: string;
  tutorId: string;
  delegateName: string;
  delegateDocument: string;
  studentIds: string[];
  /** Código de 6 dígitos impresso na tag (e codificado no QR). */
  code: string;
  /** `TUTORPASS-TAG:<schoolId>:<code>` — o que vai no QR impresso. */
  qrPayload: string;
  singleUse: boolean;
  expiresAt: Date;
  status: PrintedTagStatus;
  refusedAt: Date | null;
  refusedReason: string | null;
  revokedAt: Date | null;
  usedAt: Date | null;
  useCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IssueTagInput {
  schoolId: string;
  tutorId: string;
  delegateName: string;
  delegateDocument: string;
  studentIds: string[];
  /** Dias de validade (padrão 1, máx. 30). */
  validityDays?: number;
  /** Uso único (padrão true); false = multiuso dentro da janela. */
  singleUse?: boolean;
}

export interface TagCheck {
  allowed: boolean;
  reason?: string;
  tag?: PrintedTag;
}

export interface TagRefusal {
  tag: PrintedTag;
  /** Quem avisar: o responsável que emitiu a tag. */
  notifyTutorId: string;
  reason: string;
}

let seq = 0;

@Injectable()
export class PrintedTagService {
  private tags: PrintedTag[] = [];
  /** Tentativas erradas por `${schoolId}:${code}` — { count, firstAt }. */
  private failedAttempts = new Map<string, { count: number; firstAt: number }>();

  /**
   * Emite a tag. A janela é [agora, agora + validityDays) — expira no instante
   * de expiresAt. O código é sorteado até não colidir com outra tag ativa da
   * mesma escola (1M de combinações; 10 tentativas bastam na prática).
   */
  issue(input: IssueTagInput, now: Date = new Date()): PrintedTag {
    if (!input.delegateName?.trim()) {
      throw new BadRequestException('Nome do delegado é obrigatório');
    }
    if (!input.delegateDocument?.trim()) {
      throw new BadRequestException('Documento do delegado é obrigatório (conferência na portaria)');
    }
    if (!input.studentIds?.length) {
      throw new BadRequestException('Autorize ao menos 1 aluno');
    }
    const validityDays = input.validityDays ?? 1;
    if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > MAX_VALIDITY_DAYS) {
      throw new BadRequestException(`Validade inválida — use de 1 a ${MAX_VALIDITY_DAYS} dias`);
    }
    const singleUse = input.singleUse ?? true;
    const expiresAt = new Date(now.getTime() + validityDays * DAY_MS);

    // Sem sobreposição: mesmo delegado + mesmo aluno com tag ativa.
    const overlap = this.tags.find(
      (t) =>
        t.schoolId === input.schoolId &&
        t.delegateDocument === input.delegateDocument &&
        t.status === 'ACTIVE' &&
        t.studentIds.some((s) => input.studentIds.includes(s)),
    );
    if (overlap) {
      throw new BadRequestException(
        `Delegado já tem tag ativa p/ este aluno até ${overlap.expiresAt.toISOString()} — revogue-a antes de emitir outra`,
      );
    }

    const code = this.drawUniqueCode(input.schoolId, now);
    const tag: PrintedTag = {
      id: `tag-${++seq}-${Date.now()}`,
      schoolId: input.schoolId,
      tutorId: input.tutorId,
      delegateName: input.delegateName.trim(),
      delegateDocument: input.delegateDocument.trim(),
      studentIds: [...input.studentIds],
      code,
      qrPayload: `${PRINTED_TAG_QR_PREFIX}:${input.schoolId}:${code}`,
      singleUse,
      expiresAt,
      status: 'ACTIVE',
      refusedAt: null,
      refusedReason: null,
      revokedAt: null,
      usedAt: null,
      useCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.tags.push(tag);
    return tag;
  }

  /** Sorteia um código de 6 dígitos sem colidir com tag ativa da escola. */
  private drawUniqueCode(schoolId: string, now: Date): string {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = String(randomInt(100_000, 1_000_000));
      const clash = this.tags.some(
        (t) =>
          t.schoolId === schoolId &&
          t.code === code &&
          t.status === 'ACTIVE' &&
          now < t.expiresAt,
      );
      if (!clash) return code;
    }
    throw new BadRequestException('Não foi possível gerar um código único — tente novamente');
  }

  /** Status que vale agora: EXPIRED após expiresAt. */
  effectiveStatus(tag: PrintedTag, now: Date = new Date()): PrintedTagStatus {
    if (tag.status === 'REVOKED' || tag.status === 'USED' || tag.status === 'REFUSED') {
      return tag.status;
    }
    if (now >= tag.expiresAt) return 'EXPIRED';
    return 'ACTIVE';
  }

  private lockKey(schoolId: string, code: string): string {
    return `${schoolId}:${code}`;
  }

  private isLocked(schoolId: string, code: string, now: Date): boolean {
    const entry = this.failedAttempts.get(this.lockKey(schoolId, code));
    if (!entry) return false;
    if (now.getTime() - entry.firstAt >= LOCKOUT_WINDOW_MS) {
      this.failedAttempts.delete(this.lockKey(schoolId, code));
      return false;
    }
    return entry.count >= MAX_FAILED_ATTEMPTS;
  }

  private recordFailure(schoolId: string, code: string, now: Date): void {
    const key = this.lockKey(schoolId, code);
    const entry = this.failedAttempts.get(key);
    if (!entry || now.getTime() - entry.firstAt >= LOCKOUT_WINDOW_MS) {
      this.failedAttempts.set(key, { count: 1, firstAt: now.getTime() });
      return;
    }
    entry.count += 1;
  }

  /**
   * A tag vale p/ retirar este aluno agora? Não lança: devolve o motivo, p/ a
   * portaria exibir. Tentativa com código inexistente conta p/ o bloqueio
   * anti-brute-force; tentativa com código certo mas tag inválida, não.
   */
  check(schoolId: string, code: string, studentId: string, now: Date = new Date()): TagCheck {
    if (!/^\d{6}$/.test(code)) {
      return { allowed: false, reason: 'Código inválido — use os 6 dígitos da tag' };
    }
    if (this.isLocked(schoolId, code, now)) {
      return {
        allowed: false,
        reason: 'Código bloqueado após tentativas erradas — confira o documento e emita outra tag',
      };
    }
    const tag = this.tags.find((t) => t.schoolId === schoolId && t.code === code);
    if (!tag) {
      this.recordFailure(schoolId, code, now);
      return { allowed: false, reason: 'Código não encontrado nesta escola' };
    }
    if (tag.status === 'REVOKED') return { allowed: false, reason: 'Tag revogada pelo responsável', tag };
    if (tag.status === 'REFUSED') {
      return { allowed: false, reason: `Tag recusada na portaria: ${tag.refusedReason ?? 'documento não conferiu'}`, tag };
    }
    if (tag.status === 'USED') return { allowed: false, reason: 'Tag de uso único já utilizada', tag };
    if (!tag.studentIds.includes(studentId)) {
      return { allowed: false, reason: 'Aluno não coberto por esta tag', tag };
    }
    if (now >= tag.expiresAt) {
      return { allowed: false, reason: `Tag vencida em ${tag.expiresAt.toISOString()}`, tag };
    }
    return { allowed: true, tag };
  }

  /** Mesmo check, a partir do QR escaneado (`TUTORPASS-TAG:<schoolId>:<code>`). */
  checkQrPayload(payload: string, studentId: string, now: Date = new Date()): TagCheck {
    const parts = payload?.split(':');
    if (parts?.length !== 3 || parts[0] !== PRINTED_TAG_QR_PREFIX) {
      return { allowed: false, reason: 'QR da tag inválido' };
    }
    return this.check(parts[1], parts[2], studentId, now);
  }

  /**
   * Registra a retirada com a tag. Lança 403 com o motivo quando não pode
   * retirar. Uso único vira USED na 1ª retirada; multiuso segue válida até
   * expiresAt. O sucesso limpa as tentativas erradas daquele código.
   */
  use(tag: PrintedTag, studentId: string, now: Date = new Date()): PrintedTag {
    const check = this.check(tag.schoolId, tag.code, studentId, now);
    if (!check.allowed) throw new ForbiddenException(check.reason);
    tag.usedAt = now;
    tag.useCount += 1;
    if (tag.singleUse) tag.status = 'USED';
    tag.updatedAt = now;
    this.failedAttempts.delete(this.lockKey(tag.schoolId, tag.code));
    return tag;
  }

  /**
   * Recusa na portaria (documento não confere com o impresso na tag): a tag
   * é invalidada de vez e o retorno traz quem avisar. Idempotente p/ tag já
   * recusada; tag encerrada (usada/vencida/revogada) não pode ser recusada.
   */
  refuse(tag: PrintedTag, reason: string, now: Date = new Date()): TagRefusal {
    if (tag.status === 'REFUSED') {
      return { tag, notifyTutorId: tag.tutorId, reason: tag.refusedReason ?? reason };
    }
    if (tag.status !== 'ACTIVE' || this.effectiveStatus(tag, now) !== 'ACTIVE') {
      throw new BadRequestException('Tag já encerrada (usada, vencida ou revogada) — não pode ser recusada');
    }
    if (!reason?.trim()) {
      throw new BadRequestException('Motivo da recusa é obrigatório (fica no registro de auditoria)');
    }
    tag.status = 'REFUSED';
    tag.refusedAt = now;
    tag.refusedReason = reason.trim();
    tag.updatedAt = now;
    return { tag, notifyTutorId: tag.tutorId, reason: tag.refusedReason };
  }

  /** Revoga a tag (só o tutor que emitiu, no controller). Idempotente. */
  revoke(tag: PrintedTag, now: Date = new Date()): PrintedTag {
    if (tag.status === 'REVOKED') return tag;
    if (tag.status !== 'ACTIVE' || this.effectiveStatus(tag, now) !== 'ACTIVE') {
      throw new BadRequestException('Tag já encerrada (usada, vencida ou recusada) — não pode ser revogada');
    }
    tag.status = 'REVOKED';
    tag.revokedAt = now;
    tag.updatedAt = now;
    return tag;
  }

  /**
   * Marca EXPIRED quando a janela passou. Idempotente — devolve true só quando mudou.
   * No Step 2 vira job diário (@nestjs/schedule, junto ao expurgo LGPD e ao
   * refresh de planos/autorizações).
   */
  refresh(tag: PrintedTag, now: Date = new Date()): boolean {
    if (tag.status === 'ACTIVE' && this.effectiveStatus(tag, now) === 'EXPIRED') {
      tag.status = 'EXPIRED';
      tag.updatedAt = now;
      return true;
    }
    return false;
  }

  /** Expira todas as vencidas; devolve só as que mudaram. */
  refreshAll(now: Date = new Date()): PrintedTag[] {
    return this.tags.filter((t) => this.refresh(t, now));
  }

  /** Tags válidas agora p/ este aluno (o que a portaria vê ao digitar o código). */
  listActiveForStudent(schoolId: string, studentId: string, now: Date = new Date()): PrintedTag[] {
    return this.tags.filter(
      (t) =>
        t.schoolId === schoolId &&
        t.studentIds.includes(studentId) &&
        this.check(t.schoolId, t.code, studentId, now).allowed,
    );
  }

  get(id: string): PrintedTag | undefined {
    return this.tags.find((t) => t.id === id);
  }

  list(): PrintedTag[] {
    return [...this.tags];
  }
}
