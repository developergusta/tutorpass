# Módulo auth — JWT + refresh rotativo com detecção de reuso

Núcleo de autenticação do Step 2 (ver `docs/01-arquitetura.md`: `auth` — login,
refresh, RBAC; `tenancy` — o `schoolId` vem do JWT, nunca do body).

## O que o AuthService faz

- **Registro/login** com senha em scrypt (salt aleatório, N=16384/r=8/p=1) — nunca
  senha em claro. Senha mínima de 8 caracteres + bloqueio das mais comuns
  (NIST SP 800-63B rev. 2025: sem complexidade forçada nem troca periódica).
- **Access token JWT HS256 de 15 min** (`JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL=15m`
  no `.env.example`): `iss=tutorpass`, `aud=tutorpass-api`, `alg` fixo em HS256
  (nunca `none`), `jti` único. Payload: `sub`, `email`, `name`, `schoolId` e
  `roles` da escola da sessão.
- **Refresh token opaco de uso único, com rotação** (OAuth 2.1 / RFC 9700): a cada
  `refresh()` o token usado morre e nasce um sucessor na mesma família; o teto
  absoluto da família é 30 dias (`JWT_REFRESH_TTL_DAYS`). Só o hash SHA-256 do
  refresh é guardado — vazar o store não entrega sessões.
- **Detecção de reuso**: se um refresh já rotacionado reaparecer fora da janela
  de graça de 10 s (retry de rede), a família inteira é revogada e a detecção
  fica em `listReuseDetections()` — gancho p/ o `SecurityIncidentService`
  (Step 2: virar incidente de segurança). Revogação legítima (logout, troca de
  senha, expiração) NÃO dispara o alarme.
- **Lockout**: 5 senhas erradas travam a conta por 15 min (padrão dos SIS
  escolares, ex.: Infotech).
- **Tenant + RBAC**: `authorize(payload, schoolId, roles?)` confere o tenant do
  token e o papel (`ADMIN`, `COORDINATOR`, `GATE_AGENT`, `TEACHER`, `TUTOR`);
  `requireAuthorize` lança 403. O guard do Step 2 usa isso — o controller nunca
  confia em `schoolId` do body.
- **Sessões**: `listSessions` (p/ "minhas sessões" no app), `logout` (uma sessão),
  `revokeAllForUser` (todas — usado na troca de senha e na desativação).

## Guards + controller REST + seed (ciclo 16, 17/11/2026)

- **JwtAuthGuard** (`jwt-auth.guard.ts`): Bearer → `verifyAccessToken` → `request.user`
  (401 sem token/inválido/expirado). Rotas `@Public()` passam direto; o resto é
  autenticado por padrão. Roda sempre antes dos guards de autorização.
- **RolesGuard** (`roles.guard.ts` + `@Roles(...papéis)`): 403 quando o papel falta;
  delega a `authorize` (tenant = `:schoolId` da rota ou escola da sessão).
- **TenantGuard** (`tenant.guard.ts`): isola rotas com `:schoolId` — sessão de
  outra escola dá 403. Rotas sem `:schoolId` passam direto.
- **@CurrentUser()**: acesso tipado ao payload em `request.user`.
- **AuthController** (`POST /auth/register|login|refresh|logout`,
  `GET /auth/me|sessions`, `POST /auth/change-password|revoke-all-sessions`):
  o refresh sai em cookie httpOnly + Secure (só produção) + SameSite=strict,
  path `/api/auth/refresh`, e NUNCA no corpo da resposta; o access vai no corpo.
  Sem cookie-parser: o cookie de entrada é lido do header `cookie`.
- **Seed demo** (`prisma/seed.ts`, `pnpm seed`): escola demo TRIAL 30 dias, 2 salas,
  4 alunos, 6 usuários nos 5 papéis — idempotente (upsert), recusa produção.
  `hashPassword` é exportado do AuthService p/ o seed usar o mesmo formato.
- **DI**: o segredo chega por `@Optional() @Inject('JWT_ACCESS_SECRET')`
  (provider no AuthModule) — parâmetro `string` cru no construtor quebrava o
  boot do AppModule; o mesmo valia p/ `NotificationService` (`@Optional()
  @Inject('PUSH_SENDER')`) e p/ o `PickupGateway` (RealtimeModule agora importa
  o GeofencingModule). `app.module.spec.ts` compila o AppModule e resolve os
  serviços — a rede contra esse tipo de bug.

## O que NÃO faz (próximos ciclos)

- **2FA TOTP p/ staff** (ADMIN sempre — padrão Realsmart/FACTS SIS 2026): o
  `AuthService` já isola o login num só lugar, então o segundo fator entra
  como passo extra do `login`, sem reescrever os serviços.
- **Login de tutor por código SMS** (Infotech: tutores nunca usam 2FA, entram
  por código no celular) — alternativa ao login por senha p/ pais.

## Contrato do Step 2 (persistência)

- `User` + `SchoolMember` já existem no schema. `RefreshToken` também:
  `jti`, `userId`, `familyId`, `tokenHash` (único), `expiresAt`,
  `familyExpiresAt`, `revokedAt`, `replacedByJti`, `replacedAt` — o service
  in-memory é trocado por Prisma sobre esse modelo.
- **Janela de graça de 10 s**: nesta versão in-memory o segredo bruto do
  sucessor vive no registro (só em memória de processo). No Step 2 o segredo
  bruto NUNCA é persistido — guardar o token sucessor num cache curto no Redis
  (TTL 10 s) ou abrir mão da graça e tratar o retry como reuso.
- **Lockout entre instâncias**: o contador de falhas vai p/ o Redis no Step 2
  (hoje é in-memory, por instância).
- **Cookie do refresh**: httpOnly + Secure + SameSite, path `/auth/refresh`
  (nunca localStorage) — no controller do Step 2.
- **Rotação de segredo**: `JWT_ACCESS_SECRET` com ao menos 32 caracteres;
  trocar o segredo invalida todos os access tokens (15 min de janela) — o
  refresh continua válido e emite access novo com o segredo novo.
