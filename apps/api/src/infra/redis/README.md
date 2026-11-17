# Redis — estado efêmero compartilhado + adapter Socket.io

O TutorPass guardava 3 estados só na memória da instância: o nonce
anti-replay do QR, o estado do geofence por tutor e as rooms do
Socket.io. Com 2 instâncias, um QR validado na instância A passava de
novo na B, o geofence recomeçava do zero a cada ping em outra instância
e o broadcast não chegava a quem estava conectado na outra. Este módulo
resolve os 3 — e degrada p/ memória quando o Redis cai, sem quebrar nada.

## O que existe

| Peça | Arquivo | Papel |
| --- | --- | --- |
| `EphemeralStore` | `ephemeral-store.ts` | Contrato mínimo (`get`/`set`/`setNx`/`del` com TTL). `setNx` atômico é o que torna o anti-replay válido entre instâncias. |
| `MemoryEphemeralStore` | `memory-ephemeral-store.ts` | Backend em memória (1 instância), expiração preguiçosa, sem timer. |
| `RedisEphemeralStore` | `redis-ephemeral-store.ts` | Backend Redis via ioredis (`SET NX EX` atômico). |
| `ResilientEphemeralStore` | `resilient-ephemeral-store.ts` | Tenta o primário (Redis); se falhar, usa o fallback (memória). |
| `RedisService` | `redis.service.ts` | Lê `REDIS_URL`, conecta no `onModuleInit` com timeout de 2 s e fail-fast (sem retry infinito). Modos: `disabled` (sem URL) / `memory` (URL sem Redis) / `redis` (conectado). `getStore()` resolve o store a cada chamada — o `onModuleInit` roda depois dos construtores. `getClient()` expõe o cliente conectado p/ quem precisa de comandos além do `EphemeralStore` (o log em Streams). |
| `RedisIoAdapter` | `realtime/redis-io.adapter.ts` | Adapter Socket.io (`@socket.io/redis-streams-adapter`, 1 cliente ioredis) ligado no `main.ts` quando `REDIS_URL` existe e conecta — com connection state recovery de 2 min. Sem Redis, segue o adapter em memória. |

## Quem usa

- `QrTokenService.validate` — nonce via `setNx(qr:nonce:*, 90 s)`.
  Antes: `Set` em memória + `setTimeout`; agora o replay é barrado em
  qualquer instância. `validate` virou `async` (não tinha chamador
  fora do spec — o REST de pickup ainda não existe).
- `GeofencingService.ingest` — estado em `geo:{schoolId}:{tutorId}`
  (JSON, TTL 10 min). O valor guarda SÓ a zona derivada
  (`zone`/`insideCount`/`confirmed`/`lastTs`) — nunca lat/lng. A
  posição do tutor continua sem ser persistida (RoPA: 0 dias).
- `main.ts` — `RedisIoAdapter` quando o Redis conecta; senão, aviso no
  log e adapter em memória.
- `GET /api/health` — devolve `redis: disabled | memory | redis`.
- `EventLogService` — log de eventos por room em Streams (`tutorpass:events:{room}`,
  `MAXLEN ~ 500`) quando o Redis conecta; ring buffer em memória quando não.
  Degrada p/ memória de vez se a Stream falhar (ver `realtime/event-log.service.ts`).

## Multi-instância: o que ainda falta

O adapter de Streams move o broadcast entre instâncias **e** suporta connection
state recovery (2 min, JWT revalidado) — mas não move o resto do estado da
aplicação por si só (nonce do QR e geofence já vivem no `RedisService`, e o log
de eventos agora vive em Streams). O balanceador ainda precisa de **sessões
fixas (sticky sessions)** ou de transporte só-websocket no cliente: sem isso o
handshake do Socket.io (polling) pode cair em instâncias diferentes e dar
HTTP 400 — a verificar no deploy multi-instância (hoje é 1 instância, então
não bloqueia). Falta também o expurgo de rooms antigas das Streams (job
diário, Step 2).

## Local

- `docker-compose.yml` já sobe `redis:7-alpine` (appendonly) na 6379;
  `REDIS_URL=redis://localhost:6379` no `.env`.
- Produção: Upstash (`rediss://...`) via `render.yaml` (já declarado).
- Sem Redis local, tudo funciona em memória — os testes não precisam
  de Redis de verdade (usam stores falsos/in-memory).
