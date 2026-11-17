# TutorPass

SaaS multitenant de check-in/check-out e liberação segura de alunos em escolas particulares.
Elimina fila de drive-thru com fila virtual por geofencing, QR dinâmico de 30s e auditoria imutável.

## Decisões (Step 1 — fundação)

| Camada | Escolha | Por quê |
|---|---|---|
| Backend | **NestJS + TypeScript** | Módulos, DI, Guards, Gateways WebSocket nativos. Express exigiria montar tudo na mão. |
| Web | **Next.js (App Router)** | Painéis Portaria/Professor/Admin, SSR leve, deploy Vercel |
| Mobile pais | **React Native + Expo** (PWA como fallback web) | GPS em background e câmera/QR exigem nativo. PWA não faz geofencing confiável em background no iOS. |
| Banco | **PostgreSQL (Supabase ou Neon) + Prisma** | Relacional (aluno↔tutor↔turma), RLS, realtime não acoplado ao vendor |
| Cache/Fila efêmera | **Redis** | Estado de geofence, presença, nonce anti-replay do QR, adapter Socket.io p/ escalar |
| Realtime | **Socket.io** (namespace `/pickup`) | Rooms por escola/turma/portaria, fallback polling, Redis Adapter |
| Monorepo | **pnpm + Turborepo** | Compartilha `@tutorpass/types` e `@tutorpass/config` entre API, web e mobile |
| Deploy | **Docker (API) + Vercel (web) + Render/Fly/VPS+PM2 (API)** | API precisa de WebSocket persistente — não use serverless para a API |

> Regra de ouro: **a API NÃO vai na Vercel.** WebSocket + job de expiração de fila precisam de processo vivo. Vercel só para o Next.js.

## Quickstart local

```bash
cp .env.example .env
docker compose up -d postgres redis   # sobe banco + redis
pnpm install
pnpm --filter @tutorpass/api prisma:generate
pnpm --filter @tutorpass/api prisma:migrate   # cria tabelas
pnpm dev                               # API :3333, Web :3000
# ou tudo em container:
docker compose up --build api
curl http://localhost:3333/health
```

## Estrutura

```
apps/api        NestJS — REST + WebSocket Gateway + Prisma
apps/web        Next.js — Admin, Portaria, Professor
apps/mobile     Expo — App do Tutor (GPS, QR dinâmico, delegação)
packages/types  Tipos e contratos de eventos compartilhados
packages/config tsconfig/eslint base
docs/           Arquitetura, banco, realtime, deploy
```

Documentação: `docs/01-arquitetura.md` · `docs/02-banco-de-dados.md` · `docs/03-realtime-geofencing.md` · `docs/04-deploy.md`

## Fluxo de retirada (resumo)

```
Tutor liga "Estou indo buscar" → GPS a cada 5s/25m
  → servidor detecta ENTER (raio da escola, com histerese)
  → cria PickupQueueEntry (1x) → emite p/ Portaria + Sala do aluno
  → Professor vê nome destacado (silencioso) e prepara o aluno
  → Portaria escaneia QR dinâmico (30s, anti-replay)
  → valida foto tutor+aluno, bloqueio/delegação
  → Professor confirma saída da sala → Portaria confirma entrega
  → PickupLog imutável com hash encadeado é gravado
```
