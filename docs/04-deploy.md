# 04 — Deploy

## Opção A — VPS/VM com PM2 (mais barata, controle total)
```bash
pnpm install && pnpm --filter @tutorpass/api build
pm2 start apps/api/ecosystem.config.js --env production
pm2 save && pm2 startup
```
Nginx na frente: `proxy_pass` para :3333 + `Upgrade`/`Connection` para WebSocket, TLS via Certbot.

## Opção B — PaaS (caminho escolhido p/ o 1º deploy, 17/11/2026)
- **API**: Render / Fly.io / Railway (serviço *web* persistente, não serverless), usando `apps/api/Dockerfile`. Healthcheck: `GET /api/health` (a API usa o prefixo global `api` — ver `main.ts`; o Dockerfile já foi corrigido p/ essa rota).
- **Banco**: Neon ou Supabase Postgres → `DATABASE_URL`. Redis: Upstash/Render Redis → `REDIS_URL`.
- **Web**: Vercel (root `apps/web`, variável `NEXT_PUBLIC_API_URL` apontando para a API).
- **Mobile**: EAS Build (Expo) → lojas; preview interno via EAS Update.

## Checklist de produção
- [ ] Segredos trocados (`JWT_*`, `QR_TOKEN_SECRET`), `.env` fora do git
- [ ] `prisma migrate deploy` no release (nunca `db push` em prod)
- [ ] Aplicar `prisma/rls.sql` e o REVOKE de PickupLog
- [ ] CORS restrito ao domínio da escola/plataforma
- [ ] Backup automático do Postgres + teste de restore
- [ ] Rate limit no login e no endpoint de localização

---

## Passo a passo do 1º deploy (executar no navegador, nesta ordem)

Pré-requisitos locais — **já prontos em 17/11/2026**:
- Web mínimo construído em `apps/web` (build passando: `/`, `/login`, `/portaria`, `/telao`).
- Migration inicial gerada em `apps/api/prisma/migrations/20261117090000_init/` (via `prisma migrate diff`, sem precisar de banco) + `migration_lock.toml`. Sem ela, o `prisma migrate deploy` do Dockerfile não tinha o que aplicar.
- `apps/api/.env.example` e `apps/web/.env.example` com todas as variáveis (sem valores reais).
- `render.yaml` na raiz (blueprint da API no Render). No Railway, usar os mesmos valores criando o serviço a partir do Dockerfile de `apps/api`.

> ⚠️ **Bloqueio conhecido**: o projeto ainda **não está num repositório Git remoto**. Render/Railway/Vercel importam a partir do GitHub — antes do passo 3, é preciso criar o repo (ex.: `developergusta/tutorpass`, privado) e subir o código de `~/workspace/tutorpass`. Sem isso, a alternativa é o deploy manual por CLI/upload, que não é o fluxo destes painéis.

### 1. Banco — Neon Postgres (login: conta Neon, via GitHub/Google)
1. Criar conta/projeto em neon.tech (região mais próxima: AWS São Paulo, se disponível).
2. Criar o banco `tutorpass` e copiar a connection string (pooled) — é o `DATABASE_URL` (manter `?schema=public` no fim, se a string não trouxer).
3. Não rodar nada no SQL Editor ainda: quem cria as tabelas é o `prisma migrate deploy` na subida da API (passo 3). Depois da API no ar, aplicar `apps/api/prisma/rls.sql` no SQL Editor do Neon e conferir o REVOKE de `PickupLog`.

### 2. Redis — Upstash (login: conta Upstash, via GitHub/Google)
1. Criar conta em upstash.com e um database Redis (região São Paulo, se disponível; plano free serve p/ validar).
2. Copiar a URL `rediss://...` — é o `REDIS_URL` da API.

### 3. API — Render (login: conta Render, via GitHub) ou Railway
**Render (blueprint pronto):**
1. "New + → Blueprint", selecionar o repo do TutorPass — o `render.yaml` da raiz cria o serviço `tutorpass-api` (Docker, contexto `apps/api`, healthcheck `/api/health`).
2. Preencher as variáveis marcadas como `sync: false` no painel: `DATABASE_URL` (passo 1), `REDIS_URL` (passo 2), `JWT_ACCESS_SECRET` e `QR_TOKEN_SECRET` (gerar segredos novos e longos — ex.: gerador de senhas; **não** reutilizar os de desenvolvimento), `CORS_ORIGINS` (pode começar com `http://localhost:3000` e é atualizado no passo 5).
3. Deploy. Acompanhar os logs: o `CMD` do Dockerfile roda `npx prisma migrate deploy` (aplica a migration inicial no Neon) e sobe `node dist/main.js`.
4. Testar: abrir `https://<serviço>.onrender.com/api/health` → deve responder `{"status":"ok",...}`.

**Railway (equivalente):** "New Project → Deploy from GitHub repo", serviço com Root Directory/`dockerfilePath` em `apps/api/Dockerfile`, mesmas variáveis, healthcheck `/api/health`, domínio público gerado em Settings → Networking.

### 4. Seed da escola demo (uma vez, depois da API no ar)
1. Rodar o seed contra o banco de produção a partir de uma máquina com o repo (esta VM serve), **sem** gravar a URL do banco em arquivo versionado:
   ```bash
   cd apps/api
   DATABASE_URL="<connection string do Neon>" npm run seed
   ```
   O seed é idempotente e cria a escola demo (slug `escola-demo`), 2 salas, 4 alunos e 6 usuários (ADMIN, secretaria, portaria, professora e 2 tutores) — e-mails `*@demo.tutorpass.app` definidos em `apps/api/prisma/seed.ts`, com a senha demo que está **só** nesse arquivo (`DEMO_PASSWORD`).
2. ⚠️ A senha demo é conhecida de quem lê o código: usar o seed **só para a primeira validação**, trocar as senhas em seguida (ou apagar os usuários demo) antes de divulgar o link. ADMIN demo tem 2FA obrigatório por política — no primeiro login, o web avisa que a configuração do 2FA está pendente.
3. Alternativa futura: rodar o seed como "release command"/job único no próprio provedor, em vez da máquina local.

### 5. Web — Vercel (login: conta Vercel já usada nos outros projetos)
1. Importar o repo em vercel.com/new.
2. **Root Directory: `apps/web`** (framework Next.js; `apps/web/vercel.json` já declara `framework: nextjs`).
3. Antes de clicar em Deploy, cadastrar a variável `NEXT_PUBLIC_API_URL` = URL pública da API do passo 3 (só a origem, sem `/api` no fim). Variável `NEXT_PUBLIC_*` entra no build: se mudar depois, precisa de novo deploy.
4. Deploy e abrir a URL gerada: conferir `/`, `/login` (entrar com um usuário demo do passo 4), `/portaria` e `/telao`.
5. Voltar à API (passo 3) e atualizar `CORS_ORIGINS` para a URL final do web (ex.: `https://tutorpass-web.vercel.app`), reiniciando o serviço. Se o domínio mudar depois, repetir este ajuste.

### 6. Conferência final
- [ ] `GET /api/health` respondendo na URL pública da API
- [ ] Login demo funcionando no web publicado (incl. aviso de 2FA do ADMIN)
- [ ] `/portaria` e `/telao` abrindo, com estado vazio amigável e indicador "API no ar"
- [ ] `prisma/rls.sql` aplicado no Neon + REVOKE de `PickupLog` conferido
- [ ] Senhas dos usuários demo trocadas/removidas antes de divulgar o link
- [ ] Backup automático do Neon ligado
