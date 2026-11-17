# Notificações dual-path (push + registro durável in-app)

## O que é

Toda notificação do TutorPass tem **dois caminhos** (ReadyBell, 2026 — frente f):
1. **Registro durável in-app** — criado primeiro e sempre; é a entrega garantida.
2. **Push (Expo)** — segundo caminho, best-effort; nunca é a única cópia.

Um push que falha **nunca significa mensagem perdida**: a notificação continua
na caixa de entrada do tutor, com o status do push visível (`FAILED` + motivo)
e retry manual até 3 tentativas.

## Estados

| `pushStatus` | Significado |
|---|---|
| `SENT` | Push entregue ao provedor |
| `FAILED` | Push tentado e falhou (com `pushLastError`); retry disponível |
| `SKIPPED_NO_CONSENT` | Tutor sem consentimento `PUSH_NOTIFICATIONS` (LGPD) — push nem tentado |
| `SKIPPED_NO_TOKEN` | Tutor sem token Expo registrado |
| `NOT_CONFIGURED` | Nenhum `PushSender` injetado (antes do app mobile) |
| `QUEUED` | Transitório, antes da tentativa |

`delivery` resume: `DELIVERED` (push enviado), `IN_APP_ONLY` (push pulado —
mensagem entregue no app), `PARTIAL` (push falhou — entregue no app, retry
disponível).

## Tipos de notificação (`NotificationKind`)

- `EARLY_DISMISSAL_DECISION` — decisão da secretaria sobre saída antecipada
  (aprovar/recusar). É o caso nº 1: o tutor precisa saber a resposta no app.
- `STUDENT_CALLED` — aluno chamado na fila (portaria/sala).
- `PLAN_CHANGED` — plano de saída padrão ou exceção do dia alterado.
- `AUTHORIZATION_CREATED` — nova autorização temporária criada.
- `PICKUP_COMPLETED` — retirada concluída na portaria.

## Regras

- Título e corpo obrigatórios; `refId` liga à origem (ex.: id do pedido de
  saída antecipada).
- Push só com consentimento `PUSH_NOTIFICATIONS` + token Expo; sem um dos
  dois, o push é pulado com o motivo registrado (nunca erro silencioso).
- Retry do push: até 3 tentativas por notificação; depois disso, só o app
  entrega (sem retry infinito que esgote a cota do provedor).
- Leitura isolada por tutor: `markRead` de outro destinatário dá 403.
- Retenção: `purgeReadOlderThan(90)` apaga só notificações **já lidas** e
  antigas; não lida nunca é expurgada.

## Integração (Step 2)

- Trocar o store in-memory por Prisma (`Notification`, já no schema).
- Injetar o `PushSender` real (Expo Push API) no `NotificationsModule`.
- Serviços de origem chamam `create` no evento: `EarlyDismissalService`
  (decisão), `PickupService` (chamada/entrega), `DismissalPlanService`
  (mudança de plano), `TemporaryAuthorizationService` (autorização criada).
- O app mobile lista via `listUnread`/`listForRecipient` e marca lida ao abrir.
- LGPD: o push passa por infra fora do BR (Expo) — mapear a transferência
  internacional (art. 33, Resolução ANPD 19/2024) no relatório de
  conformidade da escola quando ele entrar (ver `docs/product/IDEAS.md`, frente e).
