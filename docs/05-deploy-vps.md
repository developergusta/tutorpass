# Deploy em VPS (caminho escolhido em 17/11/2026)

Decisão do usuário: subir tudo num VPS único (Hostinger KVM 1 recomendado:
1 vCPU, 4 GB RAM, 50 GB NVMe, DC no Brasil), em vez do caminho gratuito
Render + Neon + Upstash + Vercel descrito em `04-deploy.md`. Motivo: uma
máquina só, sem cold start na hora da saída, custo fixo em reais.

## Arquitetura no VPS

Tudo sobe com `docker-compose.prod.yml` (5 serviços):

- **caddy** — única porta pública (80/443). Roteia `/api/*` e
  `/socket.io/*` p/ a API e o resto p/ o web (ver `Caddyfile`). HTTPS
  automático quando há domínio.
- **web** — Next.js standalone (`apps/web/Dockerfile`), porta interna 3000.
- **api** — NestJS (`apps/api/Dockerfile`), porta interna 3333; o CMD do
  container roda `prisma migrate deploy` antes de subir.
- **postgres** 16 e **redis** 7 — só na rede interna, com senha, volumes
  persistentes (`pgdata`, `redisdata`).

## Passo a passo (executar no VPS, Ubuntu 24.04)

1. Instalar Docker:
   `curl -fsSL https://get.docker.com | sh`
2. Clonar o repositório privado (deploy key ou login do GitHub):
   `git clone https://github.com/developergusta/tutorpass.git && cd tutorpass`
3. Criar o ambiente:
   `cp .env.production.example .env.production` e preencher os 4 segredos
   (`openssl rand -hex 32` p/ cada um) + `SITE_ADDRESS`/`PUBLIC_ORIGIN`
   (IP puro no primeiro boot; domínio depois).
4. Subir: `docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build`
   (o `--env-file` é obrigatório: sem ele o compose lê `.env`, não
   `.env.production`, e falha com "required variable ... is missing")
5. Primeira escola: crie pelo fluxo normal do app (registro) — o seed de
   demonstração se recusa a rodar com `NODE_ENV=production`, de propósito.
   Só p/ um teste rápido no primeiro boot (dados demo, senhas conhecidas —
   nunca numa instância que vá receber escola real):
   `docker compose --env-file .env.production -f docker-compose.prod.yml exec -e NODE_ENV=development api npx prisma db seed`
6. Conferir: `curl http://127.0.0.1:3333/api/health` (dentro do VPS, via
   rede do compose use `docker compose exec api wget -qO- http://127.0.0.1:3333/api/health`)
   e abrir `http://IP-DO-VPS` no navegador.

## Domínio e HTTPS (quando houver)

1. Apontar o DNS (registro A) do domínio/subdomínio p/ o IP do VPS.
2. No `.env.production`: `SITE_ADDRESS=tutorpass.seudominio.com.br` e
   `PUBLIC_ORIGIN=https://tutorpass.seudominio.com.br`.
3. Recriar web (a origem pública é embutida no build) e reiniciar o Caddy:
   `docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build web caddy`
4. O Caddy emite o certificado Let's Encrypt sozinho no primeiro acesso.

## Operação

- Logs: `docker compose --env-file .env.production -f docker-compose.prod.yml logs -f api`
- Atualização é AUTOMÁTICA (desde 17/11/2026): o timer systemd
  `tutorpass-deploy.timer` roda `/usr/local/bin/tutorpass-deploy.sh` a cada
  ~3 min; havendo commit novo na `main`, ele faz `git reset --hard origin/main`
  e `docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build`.
  O VPS lê o repositório com uma deploy key SOMENTE LEITURA
  (`/root/.ssh/github_deploy`, cadastrada em Settings → Deploy keys do repo).
  Log dos deploys: `/var/log/tutorpass-deploy.log`. O comando manual continua
  valendo p/ forçar: `git pull && docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build`
- Backup do banco (mínimo):
  `docker compose --env-file .env.production -f docker-compose.prod.yml exec postgres pg_dump -U tutorpass tutorpass | gzip > backup-$(date +%F).sql.gz`
  e copiar o arquivo p/ fora do VPS. Automatizar é item de backlog.

## Segurança mínima

- Postgres/Redis/API/web NÃO publicam portas — só o Caddy (80/443).
- Segredos só no `.env.production` (fora do git; confira o `.gitignore`).
- Manter o Ubuntu atualizado (`apt update && apt upgrade`) e, depois do
  piloto, trocar o login SSH de senha por chave e desligar o root remoto.
