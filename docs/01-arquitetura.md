# 01 — Arquitetura

## Monorepo, não repos separados
Um produto, três clientes (API/Web/Mobile) que mudam juntos: o contrato do evento
`student.called` muda na API, no painel do professor e no app no mesmo PR.
Repos separados gerariam versionamento de contrato sem ganho — time pequeno, deploy independente
continua possível (Turbo filtra por app, Docker só da API, Vercel só do web).

## Módulos NestJS (apps/api/src/modules)
- `auth` — login, refresh, RBAC (ADMIN, COORDINATOR, GATE_AGENT, TEACHER, TUTOR)
- `tenancy` — resolve `schoolId` do JWT/subdomínio, injeta no request, nunca aceita do body
- `schools` — tenant, campi, pontos de retirada, configuração de raio/tempos
- `students` / `classrooms` — alunos, turmas, matrícula do ano
- `tutors` — tutores, vínculo tutor↔aluno, veículos
- `delegations` — autorização temporária de terceiro (selfie, documento, janela de validade) e tag/cartão impresso p/ delegado sem smartphone (código de 6 dígitos + QR)
- `data-subject-requests` — exercício de direitos do titular (LGPD arts. 18/19): acesso simplificado imediato + declaração completa em 15 dias, identidade verificada antes de entregar dado, retenção do art. 16 na eliminação
- `pickup` — máquina de estados da fila e da retirada (núcleo)
- `qr` — emissão/validação do token dinâmico de 30s
- `geofencing` — ingestão de localização, haversine, histerese, transição de zona
- `realtime` — Gateway Socket.io, rooms, snapshot, adapter Redis Streams
- `audit` — PickupLog/AuditLog append-only com hash encadeado
- `reports` — tempo de espera, retiradas/dia, exportação

## Regras que não são negociáveis
1. **Toda tabela de negócio tem `schoolId`** e toda query passa pelo tenant scope.
2. **PickupLog é append-only**: sem UPDATE/DELETE (revogado no banco + bloqueado no Prisma).
3. **QR nunca carrega dado do aluno** — só `tutorId + schoolId + exp + nonce`, assinado (HMAC).
4. **Localização bruta não é persistida** — só a transição de zona vira evento. GPS é efêmero (Redis, TTL 10 min). Privacidade/LGPD.
5. **Bloqueio vence fila**: aluno bloqueado (decisão judicial, tutor suspenso) nunca é liberado só porque chegou na fila.
