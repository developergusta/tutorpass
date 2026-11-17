# 03 — Realtime e Geofencing (o coração do produto)

## Socket.io — topologia
- Namespace único: `/pickup`
- Rooms (o cliente entra só nas suas, validadas no handshake pelo JWT):
  - `school:{schoolId}:gate` — portaria da escola
  - `school:{schoolId}:classroom:{classroomId}` — professor (só a sua sala)
  - `school:{schoolId}:admin` — coordenação
  - `tutor:{tutorId}` — confirmações para o tutor
- Adapter Redis obrigatório desde o dia 1: permite 2+ instâncias da API sem quebrar rooms.

## Eventos (contrato em `packages/types/src/events.ts`)
Servidor → cliente (sempre *diff*, nunca a fila inteira):
`queue.entry.created` · `queue.entry.called` · `queue.entry.status_changed` ·
`student.called` (destaque silencioso na sala) · `pickup.validated` ·
`pickup.completed` · `pickup.blocked`
Cliente → servidor: `tutor.location.update` (único evento frequente; o resto é REST, auditável)

**Anti-sobrecarga:**
1. Ao conectar, cliente recebe 1 `queue.snapshot` da sua room — depois, só diffs.
2. Nenhum broadcast global: emissão sempre para a room da escola/sala afetada.
3. Localização NÃO é retransmitida: o servidor consome o GPS e só emite na **transição de zona**.
4. Payload mínimo: ids + status + nome de exibição. Foto vem por URL assinada, sob demanda no scan.
5. Backpressure simples: cliente lento é desconectado e se reconecta pegando snapshot novo.

## Catch-up após reconexão (eventos com ID)
Socket.io é at-most-once: o que a portaria perde numa queda de conexão some. Por isso
toda emissão passa pelo `EventLogService` (`apps/api/src/realtime/event-log.service.ts`):
- Cada evento recebe um `seq` monotônico **por room** (começa em 1) e é emitido como
  envelope `{ seq, data }` — o cliente guarda o último seq visto por room.
- Ao reconectar, o cliente envia `events.catch_up` com `{ room, lastSeenSeq }` e recebe
  só os eventos com seq maior, mais `oldestRetainedSeq`/`latestSeq`.
- O log é um ring buffer de 500 eventos por room: se o pedido for mais antigo que o
  retido, a resposta vem com `hasGap: true` e o cliente pede `queue.snapshot` completo
  em vez de aplicar os eventos (nunca aplicar catch-up parcial).
- O gateway só responde catch-up de rooms que o próprio socket entrou (`client.rooms`).
- Step 2: trocar o store in-memory por Redis Streams e ligar ao Connection State Recovery
  do Socket.io 4.6+ (o adapter Redis clássico não o suporta).

## Geofencing — máquina de estados no servidor (não confie no cliente)
Zonas por `PickupPoint` (configurável por escola): `APPROACH ≤ 800m`, `ARRIVAL ≤ 250m` (raio padrão).

```
IDLE --(entra APPROACH)--> APPROACHING --(entra ARRIVAL, 2 pings)--> QUEUED
QUEUED --(portaria chama)--> CALLED --(scan QR ok)--> VALIDATED --(entrega)--> RELEASED
qualquer --(expira/sem comparecer)--> EXPIRED / NO_SHOW / CANCELLED
```

Regras anti-flapping e anti-fraude:
- **Histerese**: sair da zona exige `raio + 40m`; entrar exige 2 pings consecutivos dentro.
- **Throttle de ingestão**: app envia a cada 5s **ou** 25m de deslocamento, só com "modo retirada" ativo. Servidor descarta ping com accuracy > 65m ou velocidade impossível (>140 km/h entre pings).
- **Estado efêmero no Redis**: `geo:{schoolId}:{tutorId}` com zona atual + último ping (TTL 10 min). Postgres só recebe a transição (evento), nunca a trilha.
- **Fila 1x**: `QUEUED` cria `PickupQueueEntry` com unique parcial por (tutor, aluno, dia, status ativo) — reentrar no raio não duplica.
- **Fallback manual**: sem GPS/permissão, tutor entra na fila por botão/QR na portaria — mesmo fluxo daí em diante.

## QR dinâmico (30s)
Token = `base64url({schoolId, tutorId, iat, exp, nonce}) + "." + HMAC-SHA256(payload, secret)`.
Validação: assinatura, janela atual ou anterior (grace), `nonce` com `SET NX` no Redis (uso único, TTL 90s).
Print/replay de QR antigo = inválido. O scan (REST `POST /pickup/validate-qr`) responde com
foto do tutor, foto do aluno, status de liberação/bloqueio e delegação vigente — e grava o evento.
