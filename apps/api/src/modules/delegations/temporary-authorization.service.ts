import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';

// Autorização temporária com prazo determinado (1 dia / 1 semana / 1 mês) — ver
// docs/product/IDEAS.md, frente (b): School Guardian (Eleva/Colégio São Francisco)
// vende isso; nossa delegação com selfie já existia no schema (PickupAuthorization),
// faltava o prazo determinado e a validação na hora da retirada.
// Regras de produto:
// - ONE_DAY (1 dia): uso único — depois da 1ª retirada vira USED (padrão PikMyKid:
//   delegação por um dia com verificação por foto/documento na portaria).
// - ONE_WEEK / ONE_MONTH: multiuso dentro da janela (ex.: avó busca a semana toda).
// - PENDING antes de startsAt (autorização criada p/ começar amanhã); EXPIRED após
//   expiresAt (via refresh(), job diário junto ao expurgo LGPD e ao refresh de planos).
// - Revogação a qualquer momento pelo tutor que delegou (revokedAt registrado).
// - Sobreposição: mesmo delegado + mesmo aluno não pode ter 2 autorizações ativas com
//   janelas que se cruzam — a portaria não saberia qual conferir.
// Integração Step 2: trocar o store in-memory por Prisma (PickupAuthorization, já no
// schema) e, no controller, chamar ConsentService.requireConsent(tutorId,
// 'DELEGATION_SELFIE') ANTES de create — selfie é dado biométrico e exige
// consentimento explícito do responsável (LGPD art. 14). Na portaria, o staff confere
// a selfie + documento do delegado antes de liberar (verificação visual, frente a).

export type AuthorizationDuration = 'ONE_DAY' | 'ONE_WEEK' | 'ONE_MONTH';

export type AuthorizationStatus = 'PENDING' | 'ACTIVE' | 'USED' | 'REVOKED' | 'EXPIRED';

export const AUTHORIZATION_DURATIONS: Record<
  AuthorizationDuration,
  { days: number; label: string; singleUse: boolean }
> = {
  ONE_DAY: { days: 1, label: '1 dia', singleUse: true },
  ONE_WEEK: { days: 7, label: '1 semana', singleUse: false },
  ONE_MONTH: { days: 30, label: '1 mês', singleUse: false },
};

const DAY_MS = 86_400_000;

export interface TemporaryAuthorization {
  id: string;
  schoolId: string;
  tutorId: string;
  delegateName: string;
  delegateDocument: string;
  delegateSelfieUrl: string;
  delegatePhotoUrl: string | null;
  studentIds: string[];
  duration: AuthorizationDuration;
  singleUse: boolean;
  startsAt: Date;
  expiresAt: Date;
  status: AuthorizationStatus;
  revokedAt: Date | null;
  usedAt: Date | null;
  useCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAuthorizationInput {
  schoolId: string;
  tutorId: string;
  delegateName: string;
  delegateDocument: string;
  delegateSelfieUrl: string;
  delegatePhotoUrl?: string;
  studentIds: string[];
  duration: AuthorizationDuration;
  /** Início da janela (padrão: agora). Permite criar hoje p/ começar amanhã. */
  startsAt?: Date;
}

export interface PickupCheck {
  allowed: boolean;
  reason?: string;
}

let seq = 0;

@Injectable()
export class TemporaryAuthorizationService {
  private authorizations: TemporaryAuthorization[] = [];

  /**
   * Cria a autorização temporária. A janela é [startsAt, expiresAt) — expira no
   * instante de expiresAt (ex.: ONE_DAY criada 17/11 08:00 vale até 18/11 08:00).
   */
  create(input: CreateAuthorizationInput, now: Date = new Date()): TemporaryAuthorization {
    if (!input.delegateName?.trim()) {
      throw new BadRequestException('Nome do delegado é obrigatório');
    }
    if (!input.delegateDocument?.trim()) {
      throw new BadRequestException('Documento do delegado é obrigatório (conferência na portaria)');
    }
    if (!input.delegateSelfieUrl?.trim()) {
      throw new BadRequestException('Selfie do delegado é obrigatória (verificação visual na portaria)');
    }
    if (!input.studentIds?.length) {
      throw new BadRequestException('Autorize ao menos 1 aluno');
    }
    const def = AUTHORIZATION_DURATIONS[input.duration];
    if (!def) {
      throw new BadRequestException('Duração inválida — use ONE_DAY, ONE_WEEK ou ONE_MONTH');
    }
    const startsAt = input.startsAt ?? now;
    const expiresAt = new Date(startsAt.getTime() + def.days * DAY_MS);
    if (expiresAt <= now) {
      throw new BadRequestException('Janela de autorização já encerrada (startsAt + duração no passado)');
    }

    // Sem sobreposição: mesmo delegado + mesmo aluno com janela que cruza a nova.
    const overlap = this.authorizations.find(
      (a) =>
        a.schoolId === input.schoolId &&
        a.delegateDocument === input.delegateDocument &&
        (a.status === 'ACTIVE' || a.status === 'PENDING') &&
        a.studentIds.some((s) => input.studentIds.includes(s)) &&
        startsAt < a.expiresAt &&
        expiresAt > a.startsAt,
    );
    if (overlap) {
      throw new BadRequestException(
        `Delegado já tem autorização ativa p/ este aluno até ${overlap.expiresAt.toISOString()} — revogue-a antes de criar outra`,
      );
    }

    const auth: TemporaryAuthorization = {
      id: `auth-${++seq}-${Date.now()}`,
      schoolId: input.schoolId,
      tutorId: input.tutorId,
      delegateName: input.delegateName.trim(),
      delegateDocument: input.delegateDocument.trim(),
      delegateSelfieUrl: input.delegateSelfieUrl,
      delegatePhotoUrl: input.delegatePhotoUrl ?? null,
      studentIds: [...input.studentIds],
      duration: input.duration,
      singleUse: def.singleUse,
      startsAt,
      expiresAt,
      status: startsAt > now ? 'PENDING' : 'ACTIVE',
      revokedAt: null,
      usedAt: null,
      useCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.authorizations.push(auth);
    return auth;
  }

  /** Status que vale agora: PENDING antes da janela, EXPIRED após expiresAt. */
  effectiveStatus(auth: TemporaryAuthorization, now: Date = new Date()): AuthorizationStatus {
    if (auth.status === 'REVOKED' || auth.status === 'USED') return auth.status;
    if (now >= auth.expiresAt) return 'EXPIRED';
    if (now < auth.startsAt) return 'PENDING';
    return 'ACTIVE';
  }

  /** O delegado pode retirar este aluno agora? (usado pela portaria / validate-qr). */
  canPickup(auth: TemporaryAuthorization, studentId: string, now: Date = new Date()): PickupCheck {
    if (auth.status === 'REVOKED') return { allowed: false, reason: 'Autorização revogada pelo responsável' };
    if (auth.status === 'USED') return { allowed: false, reason: 'Autorização de 1 dia já utilizada' };
    if (!auth.studentIds.includes(studentId)) {
      return { allowed: false, reason: 'Aluno não coberto por esta autorização' };
    }
    if (now < auth.startsAt) {
      return { allowed: false, reason: `Autorização só vale a partir de ${auth.startsAt.toISOString()}` };
    }
    if (now >= auth.expiresAt) {
      return { allowed: false, reason: `Autorização vencida em ${auth.expiresAt.toISOString()}` };
    }
    return { allowed: true };
  }

  /**
   * Registra a retirada pelo delegado. Lança 403 com o motivo quando não pode retirar.
   * ONE_DAY vira USED na 1ª retirada; ONE_WEEK/ONE_MONTH seguem válidas até expiresAt.
   */
  use(auth: TemporaryAuthorization, studentId: string, now: Date = new Date()): TemporaryAuthorization {
    const check = this.canPickup(auth, studentId, now);
    if (!check.allowed) throw new ForbiddenException(check.reason);
    auth.usedAt = now;
    auth.useCount += 1;
    if (auth.singleUse) auth.status = 'USED';
    auth.updatedAt = now;
    return auth;
  }

  /** Revoga a autorização (só o tutor que delegou, no controller). Idempotente. */
  revoke(auth: TemporaryAuthorization, now: Date = new Date()): TemporaryAuthorization {
    if (auth.status === 'REVOKED') return auth;
    if (auth.status === 'USED' || auth.status === 'EXPIRED' || this.effectiveStatus(auth, now) === 'EXPIRED') {
      throw new BadRequestException('Autorização já encerrada (usada ou vencida) — não pode ser revogada');
    }
    auth.status = 'REVOKED';
    auth.revokedAt = now;
    auth.updatedAt = now;
    return auth;
  }

  /**
   * Marca EXPIRED quando a janela passou. Idempotente — devolve true só quando mudou.
   * No Step 2 vira job diário (@nestjs/schedule, junto ao expurgo LGPD e ao refresh de planos).
   */
  refresh(auth: TemporaryAuthorization, now: Date = new Date()): boolean {
    if (
      (auth.status === 'ACTIVE' || auth.status === 'PENDING') &&
      this.effectiveStatus(auth, now) === 'EXPIRED'
    ) {
      auth.status = 'EXPIRED';
      auth.updatedAt = now;
      return true;
    }
    return false;
  }

  /** Expira todas as vencidas; devolve só as que mudaram. */
  refreshAll(now: Date = new Date()): TemporaryAuthorization[] {
    return this.authorizations.filter((a) => this.refresh(a, now));
  }

  /** Autorizações válidas agora p/ este aluno (o que a portaria vê ao escanear o QR). */
  listActiveForStudent(schoolId: string, studentId: string, now: Date = new Date()): TemporaryAuthorization[] {
    return this.authorizations.filter(
      (a) =>
        a.schoolId === schoolId &&
        a.studentIds.includes(studentId) &&
        this.canPickup(a, studentId, now).allowed,
    );
  }

  get(id: string): TemporaryAuthorization | undefined {
    return this.authorizations.find((a) => a.id === id);
  }

  list(): TemporaryAuthorization[] {
    return [...this.authorizations];
  }
}
