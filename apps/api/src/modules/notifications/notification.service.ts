import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';

// Notificação dual-path (push + registro durável in-app) — ver
// docs/product/IDEAS.md, frente f: ReadyBell (2026) — toda notificação tem dois
// caminhos (push e registro durável no app), então um push que falha nunca
// significa mensagem perdida; a interface distingue "na fila" de "enviado" de
// "falhou", em vez de prometer entrega. É o padrão certo p/ a decisão da saída
// antecipada (EarlyDismissalService) e p/ a chamada do aluno na fila.
// Frente e (LGPD, ciclo 9): o push só é tentado com consentimento
// PUSH_NOTIFICATIONS do tutor (ConsentService) e com token Expo válido; sem
// consentimento ou sem token, o push é pulado com motivo registrado — e a
// mensagem continua entregue no app. Transferência internacional de dados:
// o push passa por infra fora do BR (Expo) — mapear no relatório de
// conformidade (IDEAS.md, frente e) quando ele entrar.
// Regras de produto:
// - O registro in-app é criado PRIMEIRO e sempre: ele é a entrega garantida.
//   O push é o segundo caminho, best-effort, e nunca é a única cópia.
// - `delivery` resume o estado: DELIVERED (push enviado), IN_APP_ONLY (push
//   pulado por falta de consentimento/token — mensagem entregue no app),
//   PARTIAL (push falhou — mensagem entregue no app e com retry disponível).
// - Retry do push: até MAX_PUSH_ATTEMPTS (3) tentativas; depois disso a
//   notificação fica FAILED e só o app a entrega (sem retry infinito que
//   esgote cota do provedor de push).
// - Leitura: só o próprio destinatário marca como lida; outro tutor recebe
//   403 (isolamento por tutor, mesmo tenant).
// - Retenção: `purgeReadOlderThan` apaga só notificações JÁ LIDAS e antigas
//   (padrão 90 dias); não lida nunca é expurgada — apagar mensagem não lida
//   seria perder a entrega garantida.
// Integração Step 2: trocar o store in-memory por Prisma (Notification, já no
// schema); injetar o PushSender real (Expo) no módulo; os serviços de origem
// (EarlyDismissalService, PickupService, DismissalPlanService) chamam
// `create` com o evento correspondente; o app mobile lista via
// `listUnread`/`listForRecipient` e marca lida ao abrir.

export type NotificationKind =
  | 'EARLY_DISMISSAL_DECISION'
  | 'STUDENT_CALLED'
  | 'PLAN_CHANGED'
  | 'AUTHORIZATION_CREATED'
  | 'PICKUP_COMPLETED'
  | 'PET_ARRIVED';

export type PushStatus =
  | 'QUEUED'
  | 'SENT'
  | 'FAILED'
  | 'SKIPPED_NO_CONSENT'
  | 'SKIPPED_NO_TOKEN'
  | 'NOT_CONFIGURED';

export type DeliveryStatus = 'DELIVERED' | 'IN_APP_ONLY' | 'PARTIAL';

/** Tentativas máximas de envio do push por notificação. */
export const MAX_PUSH_ATTEMPTS = 3;

/** Retenção padrão de notificações já lidas (dias) antes do expurgo. */
export const NOTIFICATION_RETENTION_DAYS = 90;

/** Porta de envio de push — no Step 2, implementada com Expo Push API. */
export interface PushSender {
  send(pushToken: string, title: string, body: string): Promise<void>;
}

export interface AppNotification {
  id: string;
  schoolId: string;
  recipientId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Referência opaca ao objeto de origem (ex.: id do pedido de saída antecipada). */
  refId: string | null;
  pushStatus: PushStatus;
  pushAttempts: number;
  pushLastError: string | null;
  delivery: DeliveryStatus;
  readAt: Date | null;
  createdAt: Date;
}

export interface CreateNotificationInput {
  schoolId: string;
  recipientId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  refId?: string;
  /** Token Expo do dispositivo do tutor; sem ele, o push é pulado. */
  pushToken?: string | null;
  /** Consentimento PUSH_NOTIFICATIONS do tutor (ConsentService). Sem ele, o push é pulado. */
  pushConsentGranted?: boolean;
}

function deliveryFor(pushStatus: PushStatus): DeliveryStatus {
  if (pushStatus === 'SENT') return 'DELIVERED';
  if (pushStatus === 'FAILED') return 'PARTIAL';
  return 'IN_APP_ONLY';
}

@Injectable()
export class NotificationService {
  private readonly notifications = new Map<string, AppNotification>();
  private seq = 0;

  // @Optional() @Inject('PUSH_SENDER'): sem ele, o DI tentava resolver o
  // parâmetro `PushSender` (interface → Object) como provider e o módulo nem
  // subia. Sem sender vinculado, o push fica NOT_CONFIGURED (dual-path: o
  // registro in-app continua entregando). No Step 2, o sender Expo é vinculado
  // ao token 'PUSH_SENDER' no módulo.
  constructor(
    @Optional() @Inject('PUSH_SENDER') private readonly pushSender?: PushSender,
  ) {}

  async create(input: CreateNotificationInput, now = new Date()): Promise<AppNotification> {
    if (!input.title.trim() || !input.body.trim()) {
      throw new BadRequestException('Título e corpo da notificação são obrigatórios.');
    }

    const id = `notif-${++this.seq}`;
    const notification: AppNotification = {
      id,
      schoolId: input.schoolId,
      recipientId: input.recipientId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      refId: input.refId ?? null,
      pushStatus: 'QUEUED',
      pushAttempts: 0,
      pushLastError: null,
      delivery: 'IN_APP_ONLY',
      readAt: null,
      createdAt: now,
    };
    // 1º caminho (garantido): o registro durável in-app existe antes de
    // qualquer tentativa de push — se o push falhar, nada se perde.
    this.notifications.set(id, notification);

    // 2º caminho (best-effort): push, só com consentimento + token + sender.
    if (!input.pushConsentGranted) {
      notification.pushStatus = 'SKIPPED_NO_CONSENT';
    } else if (!input.pushToken) {
      notification.pushStatus = 'SKIPPED_NO_TOKEN';
    } else if (!this.pushSender) {
      notification.pushStatus = 'NOT_CONFIGURED';
    } else {
      await this.attemptPush(notification, input.pushToken);
    }
    notification.delivery = deliveryFor(notification.pushStatus);
    return notification;
  }

  /** Re-tenta o push de uma notificação cujo push falhou (até 3 tentativas). */
  async retryPush(
    id: string,
    pushToken: string,
    now = new Date(),
  ): Promise<AppNotification> {
    const notification = this.notifications.get(id);
    if (!notification) throw new NotFoundException('Notificação não encontrada.');
    if (notification.pushStatus !== 'FAILED') {
      throw new BadRequestException(
        `Só é possível re-tentar push com status FAILED (atual: ${notification.pushStatus}).`,
      );
    }
    if (notification.pushAttempts >= MAX_PUSH_ATTEMPTS) {
      throw new BadRequestException(
        `Limite de ${MAX_PUSH_ATTEMPTS} tentativas de push atingido — a mensagem segue entregue no app.`,
      );
    }
    await this.attemptPush(notification, pushToken, now);
    notification.delivery = deliveryFor(notification.pushStatus);
    return notification;
  }

  markRead(id: string, recipientId: string, now = new Date()): AppNotification {
    const notification = this.notifications.get(id);
    if (!notification) throw new NotFoundException('Notificação não encontrada.');
    if (notification.recipientId !== recipientId) {
      throw new ForbiddenException('Notificação de outro destinatário.');
    }
    if (!notification.readAt) notification.readAt = now;
    return notification;
  }

  markAllRead(recipientId: string, now = new Date()): number {
    let count = 0;
    for (const n of this.notifications.values()) {
      if (n.recipientId === recipientId && !n.readAt) {
        n.readAt = now;
        count++;
      }
    }
    return count;
  }

  listUnread(recipientId: string): AppNotification[] {
    return this.listForRecipient(recipientId).filter((n) => !n.readAt);
  }

  unreadCount(recipientId: string): number {
    return this.listUnread(recipientId).length;
  }

  listForRecipient(recipientId: string): AppNotification[] {
    return [...this.notifications.values()]
      .filter((n) => n.recipientId === recipientId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /** Expurga notificações já lidas e mais antigas que `days` (padrão 90). Não lida nunca é expurgada. */
  purgeReadOlderThan(days = NOTIFICATION_RETENTION_DAYS, now = new Date()): number {
    const cutoff = now.getTime() - days * 86_400_000;
    let purged = 0;
    for (const [id, n] of this.notifications) {
      if (n.readAt && n.readAt.getTime() < cutoff) {
        this.notifications.delete(id);
        purged++;
      }
    }
    return purged;
  }

  private async attemptPush(
    notification: AppNotification,
    pushToken: string,
    _now = new Date(),
  ): Promise<void> {
    notification.pushAttempts += 1;
    try {
      await this.pushSender!.send(pushToken, notification.title, notification.body);
      notification.pushStatus = 'SENT';
      notification.pushLastError = null;
    } catch (err) {
      notification.pushStatus = 'FAILED';
      notification.pushLastError =
        err instanceof Error ? err.message : 'Falha desconhecida no envio do push.';
    }
  }
}
