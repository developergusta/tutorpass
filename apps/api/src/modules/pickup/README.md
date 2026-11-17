# Fila de retirada — PickupService

O núcleo da saída: a portaria vê a fila, chama o aluno, valida o QR do tutor
e libera — tudo registrado no PickupLog com hash encadeado (auditoria imutável).
Sem verificação não há liberação: é o que separa o TutorPass de uma lista de
chamada em papel.

## Fluxo

```
QUEUED → CALLED → VALIDATED → RELEASED
QUEUED → VALIDATED → RELEASED   (tutor chega direto no portão, sem chamar)
QUEUED / CALLED → CANCELLED
QUEUED / CALLED → BLOCKED       (bloqueio da secretaria vence a fila)
QUEUED / CALLED → EXPIRED       (dia anterior — job diário via expireStale())
```

## Regras

- **Uma entrada ativa por aluno por escola**: sem duplicata — geofence, manual
  e QR do portão convergem p/ a mesma fila, e o segundo `join` é recusado.
- **Release exige VALIDATED**: `release` de aluno só chamado (sem QR) é recusado.
  O QR é o do tutor da entrada, na escola da entrada — QR de outro tutor ou de
  outra escola vira `QR_REJECTED` no log e a tentativa deixa rastro.
- **QR de uso único**: o nonce é consumido no primeiro `validate` (QrTokenService);
  reutilizar o mesmo QR dá 401 e registra outra tentativa rejeitada.
- **Bloqueio vence fila**: `block` com motivo tira a entrada ativa da fila
  (vira `BLOCKED`) e impede novo `join` até o `unblock` explícito — o bloqueio
  nunca some sozinho.
- **PickupLog append-only**: cada evento carrega `prevHash`/`hash` (SHA-256) e
  `verifyChain` revalida a cadeia — adulterar um evento quebra os seguintes.
  `waitSeconds` é o tempo total na fila (joinedAt → releasedAt); o log de
  `RELEASED` carrega `calledAt`/`validatedAt` p/ o relatório calcular também
  chamada → liberação.
- **Expiração diária**: `expireStale()` expira entradas de dias anteriores —
  a fila de ontem não contamina a de hoje (job junto ao expurgo LGPD).
- **Múltiplos portões**: a entrada carrega `gate` (nome livre, ex. "Portão A",
  "Fundos", "Car Loop"; vazio = fila única). `GET queue?gate=` filtra a fila
  de UM portão — cada portaria vê só a sua fila — e `GET gates` devolve os
  portões com fila ativa + contagem, p/ o painel montar as colunas por
  portão e a visão "toda a escola". Nome com no máx. 40 caracteres (aparece
  no painel e no telão); o `gate` fica registrado no log de `QUEUE_JOINED`.
  Na persistência, o campo é `PickupQueueEntry.gate` no schema (o
  `pickupPointId` segue como vínculo estruturado se a escola cadastrar
  portões).

## Integração Step 2

- Trocar os stores in-memory por Prisma (`PickupQueueEntry` e `PickupLog`,
  já no schema).
- Ligar os eventos ao `EventLogService`/realtime (o painel da portaria e da
  sala lê a fila daqui) e às notificações dual-path (chamada → tutor).
- ✅ Controller REST `/api/pickup/schools/:schoolId/*` implementado em
  17/11/2026 (`pickup.controller.ts` + DTOs + spec, 12 testes — o 12º é o
  filtro por portão): guards
  JwtAuthGuard → TenantGuard → RolesGuard em toda a rota; `join` p/ TUTOR
  ou staff da portaria, `call`/`validate-qr`/`release` só staff,
  `cancel` p/ tutor ou staff, `queue` p/ staff + TEACHER (com `?gate=`),
  `gates` p/ staff + TEACHER, `logs`/
  `verify-chain`/`block`/`unblock` só ADMIN/COORDINATOR. Pendência:
  o vínculo usuário ↔ entidade Tutor ainda não existe — o TUTOR passa o
  `tutorId` no body e o guard só confere o papel; quando a persistência
  entrar, resolver o `tutorId` a partir de `user.sub` e recusar tutorId
  alheio (ver comentário no controller).

## Endpoints REST (`/api/pickup/schools/:schoolId/...`)

| Método | Rota | Papéis | O que faz |
| --- | --- | --- | --- |
| POST | `queue/join` | TUTOR, GATE_AGENT, COORDINATOR, ADMIN | Entra na fila (`studentId`, `tutorId`, `authorizationId?`, `source?`, `gate?`) |
| POST | `queue/:entryId/call` | GATE_AGENT, COORDINATOR, ADMIN | Chama o aluno (sala avisada) |
| POST | `queue/:entryId/validate-qr` | GATE_AGENT, COORDINATOR, ADMIN | Valida o QR dinâmico do tutor (`{ token }`) |
| POST | `queue/:entryId/release` | GATE_AGENT, COORDINATOR, ADMIN | Libera o aluno validado |
| POST | `queue/:entryId/cancel` | TUTOR, GATE_AGENT, COORDINATOR, ADMIN | Cancela a entrada na fila |
| GET | `queue` | GATE_AGENT, COORDINATOR, ADMIN, TEACHER | Fila ativa da escola (FIFO); `?gate=` filtra um portão |
| GET | `gates` | GATE_AGENT, COORDINATOR, ADMIN, TEACHER | Portões com fila ativa + contagem (`[{ gate, count }]`) |
| GET | `students/:studentId/queue` | TUTOR, GATE_AGENT, COORDINATOR, ADMIN, TEACHER | Histórico de entradas do aluno |
| GET | `logs` | ADMIN, COORDINATOR | Trilha de auditoria da escola |
| GET | `logs/verify-chain` | ADMIN, COORDINATOR | Revalida a cadeia de hashes (`{ valid, firstBadIndex }`) |
| POST | `students/:studentId/block` | ADMIN, COORDINATOR | Bloqueia a retirada (`{ reason }`) |
| POST | `students/:studentId/unblock` | ADMIN, COORDINATOR | Desbloqueia a retirada |
