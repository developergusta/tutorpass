import {
  NotificationService,
  MAX_PUSH_ATTEMPTS,
  type PushSender,
} from './notification.service';

describe('NotificationService — notificação dual-path (push + registro durável in-app)', () => {
  const now = new Date('2026-11-17T03:30:00-03:00');
  const base = {
    schoolId: 'school-1',
    recipientId: 'tutor-1',
    kind: 'EARLY_DISMISSAL_DECISION' as const,
    title: 'Saída antecipada aprovada',
    body: 'O pedido de saída antecipada de Ana às 15h foi aprovado.',
    refId: 'early-1',
  };

  function failingSender(message = 'Expo indisponível'): PushSender {
    return { send: jest.fn().mockRejectedValue(new Error(message)) };
  }

  function succeedingSender(): PushSender & { send: jest.Mock } {
    return { send: jest.fn().mockResolvedValue(undefined) };
  }

  it('cria o registro in-app mesmo quando o push falha — a mensagem nunca se perde', async () => {
    const service = new NotificationService(failingSender());
    const n = await service.create(
      { ...base, pushToken: 'ExponentPushToken[abc]', pushConsentGranted: true },
      now,
    );
    expect(n.pushStatus).toBe('FAILED');
    expect(n.delivery).toBe('PARTIAL');
    expect(n.pushAttempts).toBe(1);
    expect(n.pushLastError).toMatch(/Expo indisponível/);
    expect(n.readAt).toBeNull();
    expect(service.listUnread('tutor-1')).toHaveLength(1);
    expect(service.unreadCount('tutor-1')).toBe(1);
  });

  it('push enviado com sucesso: delivery DELIVERED', async () => {
    const sender = succeedingSender();
    const service = new NotificationService(sender);
    const n = await service.create(
      { ...base, pushToken: 'ExponentPushToken[abc]', pushConsentGranted: true },
      now,
    );
    expect(n.pushStatus).toBe('SENT');
    expect(n.delivery).toBe('DELIVERED');
    expect(sender.send).toHaveBeenCalledWith(
      'ExponentPushToken[abc]',
      base.title,
      base.body,
    );
  });

  it('sem consentimento de push (LGPD): push pulado com motivo, mensagem entregue no app', async () => {
    const sender = succeedingSender();
    const service = new NotificationService(sender);
    const n = await service.create(
      { ...base, pushToken: 'ExponentPushToken[abc]', pushConsentGranted: false },
      now,
    );
    expect(n.pushStatus).toBe('SKIPPED_NO_CONSENT');
    expect(n.delivery).toBe('IN_APP_ONLY');
    expect(n.pushAttempts).toBe(0);
    expect(sender.send).not.toHaveBeenCalled();
    expect(service.listUnread('tutor-1')).toHaveLength(1);
  });

  it('sem token Expo: push pulado, mensagem entregue no app', async () => {
    const sender = succeedingSender();
    const service = new NotificationService(sender);
    const n = await service.create({ ...base, pushConsentGranted: true }, now);
    expect(n.pushStatus).toBe('SKIPPED_NO_TOKEN');
    expect(n.delivery).toBe('IN_APP_ONLY');
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('sem PushSender configurado (antes do app mobile): NOT_CONFIGURED, sem erro', async () => {
    const service = new NotificationService();
    const n = await service.create(
      { ...base, pushToken: 'ExponentPushToken[abc]', pushConsentGranted: true },
      now,
    );
    expect(n.pushStatus).toBe('NOT_CONFIGURED');
    expect(n.delivery).toBe('IN_APP_ONLY');
    expect(service.listUnread('tutor-1')).toHaveLength(1);
  });

  it('retryPush: após falha, nova tentativa bem-sucedida vira SENT/DELIVERED', async () => {
    let fail = true;
    const sender: PushSender = {
      send: jest.fn().mockImplementation(async () => {
        if (fail) throw new Error('timeout');
      }),
    };
    const service = new NotificationService(sender);
    const n = await service.create(
      { ...base, pushToken: 'ExponentPushToken[abc]', pushConsentGranted: true },
      now,
    );
    expect(n.pushStatus).toBe('FAILED');
    fail = false;
    const retried = await service.retryPush(n.id, 'ExponentPushToken[abc]', now);
    expect(retried.pushStatus).toBe('SENT');
    expect(retried.delivery).toBe('DELIVERED');
    expect(retried.pushAttempts).toBe(2);
  });

  it('retryPush: limite de 3 tentativas — depois disso, só o app entrega', async () => {
    const service = new NotificationService(failingSender());
    const n = await service.create(
      { ...base, pushToken: 'ExponentPushToken[abc]', pushConsentGranted: true },
      now,
    );
    await service.retryPush(n.id, 'ExponentPushToken[abc]', now);
    await service.retryPush(n.id, 'ExponentPushToken[abc]', now);
    expect(n.pushAttempts).toBe(MAX_PUSH_ATTEMPTS);
    await expect(service.retryPush(n.id, 'ExponentPushToken[abc]', now)).rejects.toThrow(
      /Limite de 3 tentativas/,
    );
  });

  it('retryPush: só vale para push FAILED (não para SENT ou SKIPPED)', async () => {
    const service = new NotificationService(succeedingSender());
    const sent = await service.create(
      { ...base, pushToken: 'ExponentPushToken[abc]', pushConsentGranted: true },
      now,
    );
    await expect(service.retryPush(sent.id, 'ExponentPushToken[abc]', now)).rejects.toThrow(
      /Só é possível re-tentar push com status FAILED/,
    );
    const skipped = await service.create({ ...base, pushConsentGranted: false }, now);
    await expect(service.retryPush(skipped.id, 'ExponentPushToken[abc]', now)).rejects.toThrow(
      /Só é possível re-tentar push com status FAILED/,
    );
  });

  it('markRead: só o próprio destinatário marca como lida (outro tutor leva 403)', async () => {
    const service = new NotificationService();
    const n = await service.create(base, now);
    expect(() => service.markRead(n.id, 'tutor-2', now)).toThrow(/outro destinatário/);
    const read = service.markRead(n.id, 'tutor-1', now);
    expect(read.readAt).toEqual(now);
    expect(service.unreadCount('tutor-1')).toBe(0);
  });

  it('markRead é idempotente (não muda readAt na 2ª chamada)', async () => {
    const service = new NotificationService();
    const n = await service.create(base, now);
    service.markRead(n.id, 'tutor-1', now);
    const later = new Date(now.getTime() + 60_000);
    expect(service.markRead(n.id, 'tutor-1', later).readAt).toEqual(now);
  });

  it('markAllRead marca só as do destinatário e devolve a contagem', async () => {
    const service = new NotificationService();
    await service.create(base, now);
    await service.create({ ...base, kind: 'STUDENT_CALLED' }, now);
    await service.create({ ...base, recipientId: 'tutor-2' }, now);
    expect(service.markAllRead('tutor-1', now)).toBe(2);
    expect(service.unreadCount('tutor-1')).toBe(0);
    expect(service.unreadCount('tutor-2')).toBe(1);
  });

  it('listForRecipient: só as do destinatário, da mais recente p/ a mais antiga', async () => {
    const service = new NotificationService();
    const old = await service.create(base, now);
    const newer = await service.create(
      { ...base, kind: 'PLAN_CHANGED' },
      new Date(now.getTime() + 60_000),
    );
    await service.create({ ...base, recipientId: 'tutor-2' }, now);
    const list = service.listForRecipient('tutor-1');
    expect(list.map((n) => n.id)).toEqual([newer.id, old.id]);
  });

  it('create rejeita título ou corpo vazios', async () => {
    const service = new NotificationService();
    await expect(service.create({ ...base, title: '  ' }, now)).rejects.toThrow(
      /obrigatórios/,
    );
    await expect(service.create({ ...base, body: '' }, now)).rejects.toThrow(/obrigatórios/);
  });

  it('retryPush/markRead de notificação inexistente: 404', async () => {
    const service = new NotificationService();
    await expect(service.retryPush('notif-99', 'tok', now)).rejects.toThrow(
      /não encontrada/,
    );
    expect(() => service.markRead('notif-99', 'tutor-1', now)).toThrow(/não encontrada/);
  });

  it('purgeReadOlderThan: apaga só lidas e antigas; não lida nunca é expurgada', async () => {
    const service = new NotificationService();
    const oldRead = await service.create(base, now);
    service.markRead(oldRead.id, 'tutor-1', now);
    const oldUnread = await service.create({ ...base, kind: 'STUDENT_CALLED' }, now);
    const recentRead = await service.create(
      { ...base, kind: 'PLAN_CHANGED' },
      new Date(now.getTime() + 100 * 86_400_000),
    );
    service.markRead(recentRead.id, 'tutor-1', new Date(now.getTime() + 100 * 86_400_000));

    const purgeNow = new Date(now.getTime() + 100 * 86_400_000);
    expect(service.purgeReadOlderThan(90, purgeNow)).toBe(1);
    expect(service.listForRecipient('tutor-1').map((n) => n.id).sort()).toEqual(
      [oldUnread.id, recentRead.id].sort(),
    );
  });
});
