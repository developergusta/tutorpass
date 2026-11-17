# Disputes — sinalizar saída não reconhecida

Fecha o loop da notificação dual-path: a família é avisada de que o aluno
saiu e, se não reconhecer a saída, contesta na hora — sem travar a fila da
portaria (a contestação corre em paralelo; NIS Dismissal, IDEAS.md frente c
ciclo 30). Inspiração direta: Elo Saída (out/2026) — o tutor sinaliza a
saída NÃO reconhecida na notificação.

## Fluxo

1. O tutor recebe a notificação "seu filho saiu" (hora, portão, quem
   retirou) e marca "não reconheço esta saída" no app.
2. `POST /api/disputes/schools/:schoolId/release-disputes` (TUTOR) contesta
   um evento RELEASED do PickupLog, em até 24 h após a liberação.
3. A contestação ABRE um incidente de segurança (`UNAUTHORIZED_ACCESS`,
   risco relevante — o relógio ANPD de 3 dias úteis começa) e entra na fila
   da secretaria/DPO (`GET release-disputes/open`).
4. A escola apura (`POST release-disputes/:id/resolve`, ADMIN/COORDINATOR):
   `LEGITIMATE` (engano — era autorizado, o tutor não lembrava) ou
   `UNRECOGNIZED` (confirmado — a contestação escala e o incidente segue
   aberto p/ o DPO). A nota da apuração é obrigatória e vai p/ o incidente.

## Regras

- A contestação mira um evento RELEASED (id do log), da mesma escola e do
  mesmo aluno — contestar "a saída das 17:12", não "o aluno".
- Janela de 24 h após a liberação (`DISPUTE_WINDOW_HOURS`); depois disso,
  a contestação vira incidente manual pelo DPO.
- 1 contestação por liberação, para sempre — resolvida ou não, não se
  re-contesta o mesmo evento; o caminho depois é o incidente (que já
  existe) ou um pedido ao DPO.
- O registro guarda um snapshot da liberação (quem retirou, hora, portão)
  — mesmo que o PickupLog seja expurgado depois, a contestação continua
  legível. Só ids e hora, nunca nome/foto.
- A contestação NÃO trava a fila nem reverte a liberação: o aluno já saiu;
  reverter saída é decisão humana, fora do sistema.
- Log append-only com hash encadeado por contestação (REPORTED / NOTE /
  RESOLVED_LEGITIMATE / ESCALATED) — a apuração é prova auditável.

## Endpoints (`disputes/schools/:schoolId/*`, JwtAuthGuard + TenantGuard + RolesGuard)

| Método | Rota | Papéis |
| --- | --- | --- |
| POST | `release-disputes` | TUTOR |
| GET | `release-disputes/open` | ADMIN, COORDINATOR |
| GET | `students/:studentId/release-disputes` | TUTOR, GATE_AGENT, COORDINATOR, ADMIN |
| GET | `release-disputes/:id` | ADMIN, COORDINATOR |
| POST | `release-disputes/:id/resolve` | ADMIN, COORDINATOR |
| POST | `release-disputes/:id/notes` | ADMIN, COORDINATOR |
| GET | `release-disputes/:id/events` | ADMIN, COORDINATOR |
| GET | `release-disputes/:id/verify-chain` | ADMIN, COORDINATOR |

## Pendências (Step 2)

- Resolver o `tutorId` do contestante a partir de `user.sub` (mesma
  pendência do PickupController — hoje o TUTOR passa o tutorId no body).
- Notificar ADMIN/COORDINATOR em dual-path quando uma contestação abrir
  (hoje o NotificationService só notifica tutores).
- Badge "CONTESTADA" no painel da portaria e no telão (DisplayBoardService).
- Persistência Prisma (`ReleaseDispute` + `ReleaseDisputeEvent`, já no schema).
