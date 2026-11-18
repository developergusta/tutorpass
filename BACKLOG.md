# Backlog priorizado — melhoria contínua

## Lacunas críticas — varredura geral de 17/11/2026 (pedido do usuário)

Auditoria completa web + API depois do conserto do login. O padrão é o
mesmo do login: **o motor existe e é testado; falta a camada de uso**.

- [x] **CRÍTICO — A escola não consegue operar: não há cadastro de
  alunos/turmas/tutores em lugar nenhum.** RosterService/Students/
  Classrooms/Tutors têm lógica + testes, mas NENHUM controller HTTP;
  o web não tem área da escola. Sem alunos cadastrados, a fila nunca
  tem dado real e o produto não funciona ponta a ponta. FEITO em 17/11/2026: RosterController + /escola (ver CHANGELOG-DEV).
- [x] **CRÍTICO — Portaria é só um painel de leitura.** A API tem
  call/validate-qr/release/cancel/block (13 rotas no PickupController),
  mas o web não chama nenhuma: a portaria não consegue chamar o aluno,
  validar o QR nem confirmar a retirada pela tela (1 botão na página =
  "tentar de novo" da conexão).
- [x] **CRÍTICO — Não existe "esqueci minha senha".** Nenhuma rota de
  reset na API e nenhum link no web: admin que esquecer a senha perde
  a conta (só outro admin ou acesso ao banco resolve). Precisa: fluxo
  de reset com token de uso único (e-mail quando houver provedor; por
  ora, geração por admin/log + tela de redefinição).
- [x] **IMPORTANTE — 2FA sem tela de configuração.** A API tem
  setup/confirm/status, o web não tem tela de Segurança: quem é
  obrigado a usar 2FA (ADMIN) cai no aviso da tela de login apontando
  p/ uma tela que não existe. FEITO no ciclo UI 11, 17/11/2026: página
  /seguranca (2FA em 3 passos — QR gerado no navegador + confirmação
  com código + códigos de recuperação exibidos uma vez com confirmação
  de guarda; desativar/regenerar pedem o código atual; trocar senha;
  sessões ativas com encerrar-todas; link na topbar quando logado;
  avisos do login/cadastro agora apontam p/ /seguranca). Fase 2
  (falta na API): nomear aparelhos e mostrar IP/último acesso por
  sessão p/ facilitar a revogação.
- [x] **IMPORTANTE — Equipe sem tela no web.** A API ganhou
  GET/POST /schools/members em 17/11/2026 (admin vincula conta
  existente a um papel; lista a equipe), mas a /escola ainda não
  tinha a aba Equipe usando essas rotas — hoje o vínculo é só por
  API. FEITO no ciclo UI 10, 17/11/2026: aba Equipe na /escola
  (listar + vincular por e-mail/papel; ver CHANGELOG-DEV). Fase 2
  (falta rota na API): mudar papel de quem já está na equipe,
  remover/desativar membro e reenviar convite.
- [ ] **IMPORTANTE — Persistência parcial (Step 2 aberto).** User/
  School/SchoolMember persistem desde o cadastro completo; o ROSTER
  inteiro (turmas, alunos, tutores e vínculos) passou a persistir em
  17/11/2026 (hidratação + write-through, migration
  20261117214500_roster_persistence). Seguem em memória: a FILA de
  retirada e os logs de pickup, planos de saída, refresh tokens,
  lockout e 2FA — restart da API ainda apaga os dados operacionais
  da fila (a fila do dia é efêmera por natureza; o cadastro, não).
  (A prova ao vivo do cadastro segue pendente de aval.)
- [ ] **MENOR — Sem página 404 e sem favicon** no web (link errado cai
  na tela padrão do Next; aba do navegador sem ícone da marca).
- [ ] **MENOR — Mobile é esqueleto:** apps/mobile existe sem telas —
  o app nativo do tutor ainda não existe. Desde 17/11/2026 o tutor
  tem a área web (/responsavel: entrar na fila, status ao vivo, QR
  dinâmico), então o app Expo virou melhoria, não pré-requisito.

## Bugs descobertos (topo)
- [x] **CRÍTICO — A fila em tempo real nunca recebe entradas (API).**
  CORRIGIDO em 17/11/2026 ("funcionamento completo", pedido do
  usuário): `PickupModule` importa `RealtimeModule`/`RosterModule`,
  o `PickupService` injeta o `RealtimeService` e emite created/status
  em todas as transições, com nome/turma no payload; a room
  `tutor:{id}` também recebe. Testes de emissão no
  pickup.service.spec; prova ao vivo com socket real no VPS junto da
  entrega.
  Descoberto no ciclo UI 12, 17/11/2026, por inspeção de código:
  `RealtimeService.entryCreated`/`entryStatus` (que emitem
  `queue.entry.created` / `queue.entry.status_changed`) NÃO têm nenhum
  chamador em todo o repo; `PickupModule` nem importa o
  `RealtimeModule` e `PickupService` nunca injeta o `RealtimeService`.
  Consequência: a portaria e o telão conectam o socket ("Tempo real
  conectado") mas nenhuma entrada jamais chega — a fila fica vazia p/
  sempre, e as ações (chamar/validar/liberar) rodam por REST sem a tela
  refletir. A verificação ao vivo de 17/11/2026 ("0 na fila") não
  provou o fluxo com entradas reais — só o transporte. Correção é de
  API (fora do escopo da rotina UI): ligar as emissões no join/call/
  validate/release/cancel do PickupService (ou do controller) e cobrir
  com teste de integração socket. Agravante (mitigado no web no ciclo
  UI 14, 17/11/2026): o payload da entrada não traz nome do aluno nem
  turma — o hook da fila agora resolve nome + turma no roster da escola
  (GET /roster/students + /roster/classrooms), então as linhas mostram
  o nome real quando os eventos passarem a sair; sem o roster (TEACHER/
  TUTOR recebem 403) o fallback "Aluno" continua.
- [x] **Falta na API — TEACHER não lê o roster (bloqueia a visão de
  sala).** CORRIGIDO em 17/11/2026: TEACHER entrou nos GETs de turmas
  e alunos do RosterController (só leitura, própria escola) e a tela
  /sala foi entregue no mesmo dia.
- [x] **Falta na API — app do tutor sem porta de entrada.** CORRIGIDO
  em 17/11/2026: vínculo usuário ↔ Tutor (Tutor.userId +
  link-user/unlink-user na secretaria), `TutorMeController` com
  me/join/cancel/qr-token resolvidos da sessão, join/cancel do
  PickupController ignorando o tutorId do body p/ papel TUTOR, e a
  tela web /responsavel entregue. Falta só o app Expo (ver MENOR —
  Mobile é esqueleto).
- [x] QR: assinatura truncada/adulterada virava 500 (`RangeError` no `timingSafeEqual`) em vez de 401 — corrigido em 16/11/2026, com teste de regressão.
- [x] Geofencing: regra "ARRIVAL exige 2 pings" nunca valia — 1º ping já emitia `ENTER_ARRIVAL` — corrigido em 16/11/2026 com flag `confirmed`, com testes.
- [x] Prisma: `schema.prisma` inteiro inválido (campos separados por `;` na mesma linha + enums de uma linha) — `prisma validate` dava 110 erros e `prisma generate` nunca tinha rodado. Corrigido em 16/11/2026 (reformatado + `prisma format`); schema válido e Prisma Client gerado.
- [x] Consentimento LGPD por finalidade (Impacto 5, Esforço 2) — implementado em 16/11/2026: ConsentService + ConsentRecord (ver IDEAS.md, frente e).

## Step 2 — MVP funcional
- [x] Auth JWT + refresh rotativo + authorize tenant/RBAC (núcleo) — implementado em 17/11/2026: AuthService (access JWT HS256 15 min, refresh opaco com rotação + detecção de reuso + graça 10 s, lockout 5/15 min, senha scrypt + blocklist NIST, `authorize`/`requireAuthorize` por tenant e papel, sessões e revogação; modelo RefreshToken no schema; ver docs/product/IDEAS.md, frente e — OAuth 2.1/RFC 9700). Faltam o Guard + controller + seed (item abaixo).
- [x] Guard de tenant/RBAC (JwtAuthGuard + @Roles + TenantGuard), controller REST /auth/* e seed de escola demo — implementado em 17/11/2026: JwtAuthGuard (401, @Public, anexa payload), RolesGuard (403, delega a AuthService.authorize, tenant = :schoolId ou sessão), TenantGuard (isola :schoolId), @CurrentUser, AuthController (register/login/refresh/logout/me/sessions/change-password/revoke-all-sessions; refresh em cookie httpOnly + Secure + SameSite path /api/auth/refresh, nunca no corpo), DTOs com class-validator, seed idempotente `prisma/seed.ts` (escola demo TRIAL 30 dias, 2 salas, 4 alunos, 6 usuários nos 5 papéis; recusa produção; `pnpm seed`); corrigidos 3 bugs de DI que impediam o AppModule de subir (AuthService `secret?: string` → @Optional @Inject JWT_ACCESS_SECRET; NotificationService `pushSender?` → @Optional @Inject PUSH_SENDER; RealtimeModule sem importar GeofencingModule p/ o PickupGateway) + specs de regressão (auth.module, notifications.module, app.module). Fecha o Auth do Step 2 — falta só login de tutor por SMS (2FA TOTP implementado em 17/11/2026, ver item abaixo).
- [x] 2FA TOTP p/ staff (Impacto 5, Esforço 3) — implementado em 17/11/2026: TwoFactorService + TwoFactorModule (TOTP RFC 6238 puro com node:crypto — HMAC-SHA1, 6 dígitos, 30 s, janela ±1, validado contra os vetores do RFC 4226 Apêndice D e RFC 6238 Apêndice B; anti-replay por passo, lockout 5/15 min, 10 códigos de recuperação de 8 dígitos como look-up secrets NIST SP 800-63B-4 — hash scrypt com salt, uso único, regeneração invalida o lote; desafio de login opaco de uso único de 5 min; política ADMIN sempre obrigado, escola só amplia; login em 2 passos — AuthService.loginStep1 + issueSession — com flag twoFactorSetupRequired p/ quem é obrigado mas não cadastrou; endpoints /auth/2fa/setup, /confirm, /verify, /status, /disable, /recovery-codes; auditoria de eventos de 2FA sem segredo nem código; modelo TwoFactorEnrollment no schema — segredo a cifrar em repouso no Step 2; ver docs/product/IDEAS.md, frente e — RFC 6238/NIST SP 800-63B-4). Próxima candidata: **preço publicado por aluno/mês** (Impacto 4, Esforço 1).
- [x] CRUD escolas/turmas/alunos/tutores + importação CSV de alunos — implementado em 17/11/2026: RosterService + RosterModule (escola com slug imutável + CNPJ, turma única por escola+ano, aluno com matrícula única/escola + bloqueio de retirada com motivo + transferência/status sem apagar, tutor por telefone único/escola + bloqueio + vínculo com 1 primário, import CSV com delimitador auto (`;`/`,`), dryRun de prévia, re-importação que atualiza por matrícula, duplicata por nome+turma pulada, turma criada na importação, tutor criado/vinculado pela linha, erro por linha sem abortar, teto do plano via setStudentLimit, template + export CSV; ver docs/product/IDEAS.md, frente a — PickupRoster/"pickup."/DismissPro/QManager). Próxima candidata: **preço publicado por aluno/mês** (Impacto 4, Esforço 1).
- [x] Redis: estado de geofence, nonce QR, Socket.io adapter — implementado em 17/11/2026: RedisService + EphemeralStore (Memory/Redis/Resilient) com modos disabled/memory/redis e fail-fast, nonce QR via SET NX (TTL 90 s, `validate` virou async), estado de geofence em `geo:*` (TTL 10 min, só zona derivada — nunca lat/lng), RedisIoAdapter (Streams, 1 cliente, com connection state recovery — ver item abaixo) ligado no `main.ts` quando o Redis conecta, `/api/health` com o modo do Redis e README do módulo; 363/363 testes (17 novos/alterados incl. replay entre instâncias com store compartilhado); ver docs/product/IDEAS.md, frente f — sticky sessions a verificar no deploy multi-instância. Próxima candidata: **login de tutor por SMS** (Impacto 4, Esforço 3) ou **tag/cartão impresso p/ delegado sem smartphone** (Impacto 3, Esforço 2).
- [x] EventLog em Redis Streams + connection state recovery (fase 2 do item Redis) — implementado em 17/11/2026: `@socket.io/redis-streams-adapter@0.3.1` instalado (o clássico `@socket.io/redis-adapter` removido), `RedisIoAdapter` com 1 cliente ioredis + CSR de 2 min (`skipMiddlewares: false`, JWT revalidado no recovery); `EventLogService` agora async com `RedisStreamsEventLogStore` (Stream `tutorpass:events:{room}`, `MAXLEN ~ 500`, seq por contador via Lua INCR+XADD) + `MemoryEventLogStore` como fallback, com degradação definitiva p/ memória se a Stream falhar; `RealtimeService`/`PickupGateway` atualizados p/ o contrato async; 424/424 testes. Ver docs/product/IDEAS.md, frente f, ciclo 27. Falta: expurgo de rooms antigas das Streams (job diário, Step 2) e verificação das sticky sessions no deploy multi-instância.
- [x] REST pickup: join manual, call, validate-qr, release, cancel + PickupLog encadeado — implementado em 17/11/2026: PickupService + PickupModule (join MANUAL/GEOFENCE/QR_GATE, call, validateQr com QrTokenService, release, cancel, block/unblock, expireStale; 1 entrada ativa/aluno/escola, bloqueio vence fila com motivo, QR de outro tutor/escola vira QR_REJECTED no log, nonce de uso único, waitSeconds na liberação, PickupLog append-only com chainHash + verifyChain; 20 testes, 379/379 na suíte; ver docs/product/IDEAS.md, frente a — PikMyKid/CENTEGIX 2026). Falta o controller REST /api/pickup/* com guards (próximo passo) e a migração p/ Prisma (modelos já no schema).
- [x] Controller REST /api/pickup/* (join, call, validate-qr, release, cancel, block, fila ativa) com JwtAuthGuard + TenantGuard + @Roles — implementado em 17/11/2026: PickupController (`pickup/schools/:schoolId/*`, 11 rotas) + 3 DTOs com class-validator + spec com 11 testes (fluxo completo, QR de outro tutor → 401 + QR_REJECTED, release sem validar → 400, bloqueio vencendo a fila, FIFO, cadeia adulterada → verify-chain false); PickupModule importa o AuthModule (guards exportados); pendência documentada: vínculo usuário ↔ Tutor p/ o TUTOR não passar tutorId alheio no join (resolver por user.sub quando a persistência entrar). 390/390 testes na suíte. Ver docs/product/IDEAS.md, frente b, ciclo 23.
- [x] Múltiplos portões na fila (Impacto 3, Esforço 2 — promovido da pesquisa, frente b ciclo 23) — implementado em 17/11/2026: campo `gate` na entrada (nome livre, ex. "Portão A"/"Fundos"/"Car Loop", máx. 40 caracteres, vazio = fila única), `GET queue?gate=` filtra a fila de um portão, `GET gates` devolve portões com fila ativa + contagem p/ o painel montar as colunas por portão e a visão "toda a escola"; `gate` registrado no log de QUEUE_JOINED; campo `gate` no schema Prisma (PickupQueueEntry); 6 testes novos (396/396 na suíte). Ver docs/product/IDEAS.md, frente c, ciclo 24 — NIS/RapidDismiss/SDM/AuthExit/Trellisgo.
- [x] Sinalizar irmãos em portões diferentes no painel (Impacto 3, Esforço 2 — promovido da pesquisa, frente c ciclo 24) — implementado em 17/11/2026: `PickupService.listSiblingGateConflicts` (tutor com entradas ativas em 2+ portões distintos; a fila única conta como portão — um filho sem portão e outro no "Portão A" também é divisão; cancelado/liberado não conta; ordenado por tutorId) + `GET /pickup/schools/:schoolId/sibling-gate-conflicts` (staff + TEACHER, 13ª rota); 6 testes novos (403/403 na suíte). Ver docs/product/IDEAS.md, frente c, ciclo 24 — AuthExit. Fase 2: badge no painel/telão da portaria.
- [x] Checklist de implantação em 1 dia + escola demo que zera (Impacto 4, Esforço 2 — promovido da pesquisa, frente d ciclo 25) — implementado em 17/11/2026: OnboardingService + OnboardingModule (4 passos na ordem conta → roster (CSV) → convite do staff → primeira saída, com tempos 3/15/5/30 min = 53 min; progresso %, próximo passo, minutos restantes; marcar idempotente, reabrir explícito, rastro de eventos só com ids; escola demo marcada e zerada por resetDemo, que recusa escola não-demo) + controller REST /api/onboarding/schools/:schoolId/* (5 rotas com JwtAuthGuard + TenantGuard + @Roles; demo/mark e demo/reset só ADMIN) + runbook docs/product/ONBOARDING-1-DIA.md (dia 1 hora a hora, o que pode dar errado, demo que zera às 06:00 no Step 2, o que NÃO está no dia 1); ver docs/product/IDEAS.md, frente d, ciclo 25. Integração automática (Step 2): RosterService.importStudents → ROSTER_IMPORTED, AuthService.register de staff → STAFF_INVITED, PickupService.release → FIRST_DISMISSAL_DONE, job diário 06:00 → resetDemo, persistência no schema.
- [x] Exercício de direitos do titular (art. 18 LGPD) pelo painel do admin (Impacto 4, Esforço 3 — promovido da pesquisa, frente e ciclo 26) — implementado em 17/11/2026: DataSubjectRequestService + DataSubjectRequestsModule (8 tipos de pedido — ACCESS, CORRECTION, ANONYMIZATION, BLOCKING, ERASURE, PORTABILITY, SHARING_INFO, CONSENT_REVOCATION; dois prazos do art. 19 — acesso simplificado imediato via provideSimplifiedAccess + declaração completa em 15 dias corridos; identidade verificada antes de entregar dado; ERASURE/ANONYMIZATION só PARTIAL com retainedByLegalObligation do art. 16 — PickupLog, logs de auditoria, consentimentos e incidentes nunca apagados; 1 pedido ativo por titular+tipo; log append-only com hash encadeado; filas do DPO listOverdue + listSimplifiedAccessPending) + controller REST /api/data-subject-requests/schools/:schoolId/* (12 rotas, só ADMIN/COORDINATOR) + 5 DTOs + modelos DataSubjectRequest + DataSubjectRequestEvent no schema; 27 testes novos (467/467 na suíte); ver docs/product/IDEAS.md, frente e ciclo 26 e frente b ciclo 29. Próxima candidata: **login de tutor por SMS** (Impacto 4, Esforço 3) ou **alerta de guarda/restrição na portaria** (Impacto 4, Esforço 3 — novo, ciclo 30) ou **código de conexão do responsável por QR** (Impacto 3, Esforço 2).
- [x] Sinalizar saída não reconhecida (Impacto 4, Esforço 2 — promovido da pesquisa, frente b ciclo 29) — implementado em 17/11/2026: UnrecognizedReleaseService + DisputesModule (tutor contesta um evento RELEASED do PickupLog em até 24 h após a liberação, com snapshot de quem retirou/hora/portão; contestar ABRE um incidente UNAUTHORIZED_ACCESS com risco relevante — relógio ANPD de 3 dias úteis; 1 contestação por liberação; apuração LEGITIMATE/UNRECOGNIZED com nota obrigatória que vai p/ o incidente; log append-only com hash encadeado por contestação; a contestação NÃO trava a fila nem reverte a liberação) + controller REST /api/disputes/schools/:schoolId/* (8 rotas, só ADMIN/COORDINATOR apura) + 3 DTOs + modelos ReleaseDispute + ReleaseDisputeEvent no schema; 22 testes novos (489/489 na suíte); ver docs/product/IDEAS.md, frente c ciclo 30 — NIS: exceção não trava a fila. Próxima candidata: **alerta de guarda/restrição na portaria** (Impacto 4, Esforço 3 — novo, ciclo 30) ou **login de tutor por SMS** (Impacto 4, Esforço 3) ou **código de conexão do responsável por QR** (Impacto 3, Esforço 2).
- [x] Tag/cartão impresso p/ delegado sem smartphone (Impacto 3, Esforço 2 — promovido da pesquisa, frente a ciclo 22; refinado na frente b ciclo 23 e validado na frente a ciclo 28) — implementado em 17/11/2026: PrintedTagService + DelegationsModule (código de 6 dígitos + QR `TUTORPASS-TAG:<schoolId>:<código>` com a mesma validação nos dois casos; validade 1–30 dias, uso único por padrão ou multiuso na janela; código único entre tags ativas da escola; sem sobreposição p/ mesmo delegado + aluno; anti-brute-force — 5 tentativas erradas travam o código por 15 min; recusa na portaria invalida a tag (REFUSED, com motivo) e devolve `notifyTutorId` p/ avisar o responsável; revogação; `refresh()`/`refreshAll()` p/ EXPIRED; modelos PrintedTag + PrintedTagStudent + enum PrintedTagStatus no schema, validado com `prisma validate`; 16 testes novos, 440/440 na suíte; ver docs/product/IDEAS.md, frente a ciclo 28 — PikMyKid car tags / PickUp Patrol). Próxima candidata: **login de tutor por SMS** (Impacto 4, Esforço 3) ou **exercício de direitos do titular (art. 18 LGPD)** (Impacto 4, Esforço 3 — implementado no ciclo 29) ou **alerta de guarda/restrição na portaria** (Impacto 4, Esforço 3 — novo, ciclo 30).
- [ ] Web: portaria (fila realtime + scanner), sala (destaque), admin (logs/relatórios)
- [ ] Mobile: modo retirada, QR dinâmico, delegação com selfie (upload S3)
## Step 3 — refinamento
- [x] Relatórios: tempo médio de espera, pico, export CSV — implementado em 17/11/2026: DismissalReportService (média/mediana/p95/máxima, fração ≤ 5 min, janela de pico de 15 min, score 0–100, resumo de período com série diária, export CSV; ver BACKLOG, item promovido).
- [x] Push notification (Expo) ao chamar aluno / confirmar entrega — **dual-path** (push + registro durável in-app) — implementado em 17/11/2026 (NotificationService: registro in-app sempre primeiro, push best-effort com consentimento + retry 3x; ver item promovido). Item duplicado do Step 3 fechado em 17/11/2026 após confirmação por inspeção do serviço.
- [ ] **Web Push pros pais no navegador (PWA)** — pedido do usuário em 17/11/2026, p/ a produção: o pai/mãe recebe o aviso no navegador do celular ("permitir notificações?") sem instalar app — aluno chamado, retirada concluída, pedido de autorização. **Pré-requisito: domínio próprio com HTTPS** (sem HTTPS o navegador nem oferece a permissão) — fazer junto/quando o domínio entrar. Escopo: web vira PWA (manifest + service worker + "adicionar à tela de início"); API guarda a PushSubscription por usuário/aparelho e o NotificationService ganha um sender Web Push (VAPID) ao lado do caminho Expo; iOS exige abrir pelo ícone da tela de início (16.4+) — prever a instrução na interface. O ntfy segue como canal da portaria/equipe; Web Push é o canal dos pais.
- [ ] Design system próprio TutorPass (layout único, não-template) nos 3 clientes
- [x] Testes: unit (geofence/qr) — 25 testes em 16/11/2026 (geofencing, QR, chainHash); falta e2e do fluxo completo de retirada
- [ ] Observabilidade: logs estruturados, métricas de fila, alerta de fila > N

## Fila UI/UX (rotina de 30 min — ordem: login → portaria → telão → planos → estados vazios/erro → mobile)
- [ ] **Caixa de ferramentas anti-genérica — skills indicadas pelo usuário (17/11/2026)** — ele mandou uma tabela de skills "para não ficar com cara de IA" e pediu o registro aqui. Avaliar/instalar as que faltam e usar nas passadas anti-genéricas da rotina (hoje o método é a `unslop` + apoio da `frontend-design`, já instalada, e do checklist `anti-generic-ui`):
  - **Impeccable** — mapeia 64 padrões de IA genérica e oferece 23 comandos (`/impeccable init`, `shape`, `polish`, `typeset`); audita e refina UIs existentes ou novas; compatível com Claude Code, Cursor, Codex e Copilot. *Candidata mais completa — avaliar primeiro.*
  - **Hallmark** — aplica 50 temas distintos, usa fotografias reais e faz checagem visual do próprio resultado; bom p/ sair do branco/cinza padrão com estética editorial.
  - **Taste Skill** — injeta direção de arte, imagens de referência e checagem em browser real; pacote complementar taste-skill-classics (brutalist, minimalist, soft).
  - **UI/UX Pro Max** — banco pesquisável de estilos de UI, paletas, pares de fontes e tipos de gráficos; ajuda a escolher combinações coerentes por nicho (SaaS, dashboard etc.).
  - **Oil UI** — checklist de subtração p/ remover excessos decorativos e cara de template; foco em limpeza visual e ativos de produção.
  - **Design Slop** — audita visual, acessibilidade, responsividade e confiança da interface; ideal p/ revisar páginas prontas e eliminar defeitos de layout.
  - **No Slop UI** — conjunto de regras que barra abuso de gradientes, glassmorphism e dashboards pouco usáveis; leve e direto p/ colocar nas regras do projeto.
  - ~~frontend-design~~ — já instalada (oficial da Anthropic, planejamento de tokens e revisão em duas passadas).
- [x] **Desbloqueio da fila UI (17/11/2026, "funcionamento completo")** — os dois itens que os ciclos apontavam como "bloqueados na API" foram entregues FORA da rotina, a pedido do usuário: **tela de sala do professor** (/sala: escolhe a turma, vê chamados e fila dela; API liberou a leitura do roster p/ TEACHER) e **área do responsável** (/responsavel: "Estou chegando", status ao vivo, QR dinâmico; API ganhou vínculo conta ↔ Tutor e o TutorMeController). Junto: tempo real ligado de verdade e roster persistente no Postgres (ver "Bugs descobertos" e o item de persistência). A rotina NÃO precisa mais tratar esses dois como bloqueados; candidatas seguintes: Segurança fase 2 e Equipe fase 2 (dependem de rotas novas na API), join em grupo e a mesma contagem de alunos na aba Responsáveis.
- [x] **A turma mostra o tamanho (ciclo UI 17, 17/11/2026)** — a aba
  Turmas da /escola listava nome, série, ano e sala, mas não quantos
  alunos havia em cada uma — a secretaria abria turma por turma p/
  conferir onde cabia matricular. Agora cada linha mostra "· N
  alunos" (só ativos; a vazia lê "0 alunos") e um resumo quieto acima
  da lista ("N turmas · M alunos ativos", com `role="status"`); uma só
  leitura do cadastro p/ a aba inteira, recarregada ao criar/desativar
  e ao trocar de aba. Se a leitura falhar, a contagem some em silêncio
  e a lista segue. `next build` OK (16 rotas; /escola 9,92 kB).
  Auditoria unslop do ciclo: sem sinal novo — 1 gradiente e 1 caixa
  alta, ambos intencionais; zero emoji. Próximo da fila UI: **tela de
  sala p/ o professor**, bloqueada na API (TEACHER recebe 403 no
  roster); **app do tutor** segue bloqueado na API (sem rota p/ emitir
  o QR dinâmico nem vínculo usuário ↔ Tutor). Candidatas só de web: a
  mesma contagem na aba Responsáveis e o sinal de "aluno sem
  responsável" na aba Alunos. Ver docs/product/IDEAS.md, frente b,
  ciclo UI 17.
- [x] **Teclado + leitor de tela na operação (ciclo UI 16, 17/11/2026)** —
  a portaria mudava sozinha e o leitor de tela não sabia; as abas da
  /escola só andavam de mouse; e não havia como pular a topbar de
  teclado. Agora: (1) link de salto "Pular para o conteúdo" como
  primeiro foco de toda página (WCAG 2.4.1, nível A — invisível até o
  teclado chegar, cai no `<main id="conteudo">` de todas as 12 telas,
  com `tabIndex={-1}` p/ o foco ir junto); (2) o resumo da portaria
  ("N na fila · N prontos · N a caminho") é região viva
  `aria-live="polite"` + `aria-atomic="true"` (WCAG 4.1.3 — anuncia o
  resumo inteiro quando a fila muda, sem interromper; as listas não
  são live, quem opera navega até elas); (3) abas da /escola no padrão
  WAI-ARIA tabs — setas andam, Home/End saltam, roving tabindex (só a
  ativa é parada de Tab) e `role="tabpanel"` com `aria-labelledby` (sem
  `aria-controls`, porque os painéis inativos não estão no DOM). O
  telão fica fora das live regions de propósito (painel público,
  assistido, não operado). `next build` OK (16 rotas; /escola 9,72 kB,
  /portaria 2,47 kB). Auditoria unslop do ciclo: sem sinal novo — 1
  gradiente (painel "Pode retirar agora") e 1 caixa alta ("AGORA"),
  ambos intencionais; zero emoji. Falta: teste com leitor de tela real
  (NVDA/VoiceOver) na portaria com fila ao vivo.
  Próximo da fila UI: **tela de sala p/ o professor**, bloqueada na API
  (TEACHER recebe 403 no roster — confirmado no controller: GET
  students/classrooms é só ADMIN/COORDINATOR/GATE_AGENT); **app do
  tutor** segue bloqueado na API (sem rota p/ emitir o QR dinâmico nem
  vínculo usuário ↔ Tutor). Ver docs/product/IDEAS.md, frente c,
  ciclo UI 16.
- [x] **Implantação em 1 dia (ciclo UI 15, 17/11/2026)** — a home promete
  "Implantação em 1 dia" e o web não tinha nenhuma tela p/ acompanhar: a
  API já tinha GET /onboarding/schools/:schoolId/checklist e POST
  steps/:step/complete|reopen (4 passos do runbook, 53 min). Agora a
  /escola tem a aba Implantação: barra de progresso ("2 de 4 passos ·
  ~35 min restantes", `role="progressbar"`), próximo passo destacado,
  atalhos p/ importar o CSV, vincular a equipe e abrir a portaria, e
  "Marcar como feito"/"Reabrir" só p/ ADMIN/COORDINATOR (a marcação ainda
  é manual — a automática é Step 2 da API); GATE_AGENT/TEACHER veem, TUTOR
  vê 1 frase. Falha some sem quebrar a página (carregando/erro com
  retry). Escala de espaçamento `--space-*` (4/8/12/16/24/32/48/64) no
  `:root`, já usada no CSS novo. Unslop: `.plan-badge` "Recomendado" em
  sentence case (era caixa alta com tracking) e o pulso em loop saiu do
  selo "Agora" do hero (demonstração, sem dado vivo — o pop-in da linha
  já marca o momento). `next build` OK (16 rotas; /escola 9,4 kB).
  Próximo da fila UI: **tela de sala p/ o professor**, bloqueada na API
  (TEACHER recebe 403 no roster); **app do tutor** segue bloqueado na API
  (sem rota p/ emitir o QR dinâmico nem vínculo usuário ↔ Tutor). Ver
  docs/product/IDEAS.md, frente d, ciclo UI 15.
- [x] **Nomes da fila resolvidos no roster (ciclo UI 14, 17/11/2026)** —
  o payload do evento não traz nome nem turma e as linhas liam "Aluno"
  (agravante do bug crítico do realtime). Agora o hook da fila
  (`lib/use-pickup-queue.ts`) carrega o cadastro da escola uma vez por
  montagem (GET /roster/students + /roster/classrooms, já existentes) e
  resolve nome + turma pelo studentId — na chegada do evento e, se o
  cadastro chegar depois, nos itens já na fila; o "Tentar de novo"
  recarrega o cadastro junto. Vale p/ portaria e telão (mesmo hook) e
  o alerta de irmãos passa a mostrar os nomes quando resolve. Sem
  permissão (TEACHER/TUTOR, 403) ou fora do ar, some em silêncio e a
  fila segue com o que o evento trouxe. `next build` OK (16 rotas).
  Próximo da fila UI: **tela de sala p/ o professor** (quem foi chamado
  + p/ qual portão mandar — padrão Cadence/RapidDismiss), bloqueada na
  API: TEACHER recebe 403 no roster; **app do tutor** segue bloqueado
  na API (sem rota p/ emitir o QR dinâmico nem vínculo usuário ↔
  Tutor). Ver docs/product/IDEAS.md, frente a, ciclo UI 14.
- [x] **Irmãos em portões diferentes (ciclo UI 12, 17/11/2026): alerta na
  portaria** — a API já tinha GET sibling-gate-conflicts e o web não
  mostrava (fase 2 registrada no ciclo 24). Agora a portaria lê por REST
  (a cada 30 s e quando a fila muda) e mostra um cartão em tom de aviso
  entre o selo de conexão e o resumo da fila, só quando há conflito:
  "N responsáveis com filhos em portões diferentes", a orientação
  ("Combine um só portão com o responsável antes de liberar") e, por
  responsável, os portões com os nomes dos alunos — ou a contagem ("2
  alunos") quando o nome não resolve; nunca nome inventado (a API só
  devolve ids e o "Aluno" do hook é placeholder, não nome). Sem
  permissão (TUTOR, 403) ou fora do ar, o alerta some em silêncio e a
  fila segue. `next build` OK (16 rotas). Fase 2 do telão FEITA no ciclo
  UI 13 (17/11/2026): faixa compacta no telão — só a contagem ("1 família
  com filhos em portões diferentes — combine um só portão na portaria"),
  sem nomes nem portões, porque o telão é público; componente
  compartilhado `components/SiblingGateAlert.tsx` (variante `compact`),
  mesma leitura por REST a cada 30 s, some em silêncio sem permissão ou
  fora do ar; estilo `.telao-gate-notice` em âmbar fixo (~8:1) com
  triângulo + texto (não depende só da cor). Resta o join em grupo (1
  pedido p/ os irmãos — falta na API). Ver docs/product/IDEAS.md, frente
  c, ciclo UI 13.
- [x] **Segurança/2FA (ciclo UI 11, 17/11/2026): página /seguranca** —
  2FA em 3 passos (QR gerado no navegador do otpauthUrl + chave manual
  copiável, confirmação com código de 6 dígitos, códigos de recuperação
  exibidos uma única vez em grade monoespaciada com "Copiar todos" e
  checkbox de guarda que destrava o "Concluir"); quando ativo, selo
  "Ativa" + último uso + códigos restantes, "Gerar novos códigos" e
  "Desativar" pedindo o código atual (a API recusa p/ quem é obrigado);
  trocar senha (mostrar/ocultar, mínimo 8) e sessões ativas (início e
  validade; "Encerrar todas" em dois toques, volta ao login); link
  "Segurança" na topbar quando logado; avisos de 2FA do login/cadastro
  agora levam a /seguranca em vez de apontar p/ uma tela inexistente.
  `qrcode` 1.5.4 via pnpm (package.json + pnpm-lock.yaml; ver nota do
  ciclo no CHANGELOG sobre o EPERM do `pnpm install` neste sandbox).
  `next build` OK (16 rotas, /seguranca 16,2 kB). Fase 2 (falta na API):
  nomear aparelhos e mostrar IP/último acesso por sessão. Ver
  docs/product/IDEAS.md, frente b/c, ciclo UI 11.
- [x] **Equipe (ciclo UI 10, 17/11/2026): aba Equipe na /escola** — lista
  da equipe (avatar com inicial + nome + e-mail + selo do papel em verde
  da marca, `Inativo` em `.badge.off`) e formulário de vínculo em um passo
  (e-mail + papel, com a frase de uma linha que descreve o papel e muda com
  o seletor; padrão GATE_AGENT); só ADMIN vê o formulário e só
  ADMIN/COORDINATOR veem a lista — os demais papéis veem 1 frase explicando
  (o papel vem da sessão, a tela nem tenta carregar); erros 404/409 da API
  já chegam com a orientação em pt-BR e são mostrados; vazio com o próximo
  passo; `next build` OK (15 páginas). Fase 2 (falta rota na API): mudar
  papel, remover/desativar membro, reenviar convite. Ver docs/product/IDEAS.md,
  frente a, ciclo UI 10.
- [x] Login (ciclo UI 2, 17/11/2026): layout centrado com marca (`.auth-*` reutilizável em `globals.css`), botão mostrar/ocultar senha com SVG próprio, alvo 44 px, `aria-pressed` + rótulo dinâmico, senha reocultada ao enviar (WCAG 3.3.8), código 2FA com espaçamento e dica de recuperação, estado de sucesso com ícone de confirmação e ações centralizadas; lógica de login/2FA intacta; `next build` OK (7 rotas). Ver docs/product/IDEAS.md, frente c, ciclo UI 2.
- [x] Portaria (ciclo UI 3, 17/11/2026): resumo em 3 contadores no topo (na fila / prontos p/ retirada / a caminho, com numerais tabulares), selo de conexão com texto + cor (ao vivo/conectando/fora do ar, `role="status"`), seção "Pronto para retirada" com destaque verde e badge de contagem, linhas numeradas com nome maior e chips de turma/portão/ETA, estados vazios por seção, botão "Ver no telão" centralizado; `.btn` com `min-height: 48px` em todo o site (alvos ≥ 44 px) e foco visível já global; hook expõe o `gate` da entrada p/ o chip de portão; lógica da fila intacta; `next build` OK (7 rotas). Padrão `.auth-*` aplicado ao /cadastro no mesmo ciclo (marca, mostrar/ocultar senha, sucesso com ícone). Ver docs/product/IDEAS.md, frente a, ciclo UI 3.
- [x] Planos/calculadora (ciclo UI 4, 17/11/2026): selo "Recomendado" visível no cartão do teste de 30 dias (antes só a borda verde o distinguia), cartão elevado (sombra + scale 1.02 no desktop) com CTA primário, recomendado em 1º na pilha mobile (`order: -1` abaixo de 640 px), faixas do PRO como lista faixa ↔ preço com numerais tabulares (mesmos valores da API: 89/199/349) e resultado da calculadora com `aria-live="polite"`; `next build` OK (7 rotas). Ver docs/product/IDEAS.md, frente d, ciclo UI 4.
- [x] Estados vazios/erro/carregando (ciclo UI 5, 17/11/2026): padrão visual único `.state` em `globals.css` (ícone + título em display + 1 linha + no máximo 1 ação; variante `.state-error` em tom de aviso) aplicado à portaria e ao telão; bug corrigido — vazio era indistinguível de carregando (a fila nasce vazia e `apiOnline === null` caía no ramo do vazio); carregando virou skeleton no formato real (linhas da fila / nomes do telão), contadores "–", `role="status"` e pulso desligado em `prefers-reduced-motion`; erro com retry — hook ganhou `retry()` (re-verifica a API e reconecta o socket) e a portaria mostra "A fila não está atualizando" + "Tentar de novo" quando a API cai com a fila vazia (com itens, os dados ficam visíveis e só o selo avisa); `next build` OK (7 rotas). Ver docs/product/IDEAS.md, frente a/c, ciclo UI 5. Incidente: o ciclo paralelo "Login completo" commitou às 16:31 (`fc90ddd`) varrendo estes arquivos junto — o código foi conferido dentro do `fc90ddd` e o registro vai em commit próprio.
- [x] Revisão mobile geral (ciclo UI 6, 17/11/2026): auditoria de todas as telas contra o checklist mobile 2026 — trava de rolagem lateral (`overflow-x: clip` em `html, body`, que não quebra o sticky da topbar), `.btn.small` de 40 → 44 px (ações da portaria, da escola e o Sair), links da topbar e do rodapé com 44 px de altura mínima (antes texto puro de ~20 px), `viewportFit: 'cover'` no `layout.tsx` com respiro de `env(safe-area-inset-*)` na topbar, no telão, no rodapé e no `.container`, nome do usuário oculto abaixo de 480 px (fica só avatar + Sair), linhas do hero e nomes do telão com `min-width: 0` + quebra p/ o selo `nowrap` não estourar a tela; verificado que inputs já têm 1rem (sem zoom automático do iOS) e que não há `maximum-scale`/`user-scalable=no` (zoom de pinça livre); `next build` OK (10 rotas). Ver docs/product/IDEAS.md, frente c, ciclo UI 6. Pendente: teste em aparelho real (sem aparelho no sandbox).
- [x] **Passada anti-genérica (método: skill `unslop`, instalada de github.com/heydamir/unslop; apoio: `frontend-design` da Anthropic e checklist `anti-generic-ui`)** — pedido do usuário em 17/11/2026 ("não quero essa cara genérica"). Auditoria inicial de 17/11/2026 achou 3 sinais no web: (1) **tipografia** — Inter em tudo, títulos sem fonte de display (sinal nº 1 da skill); (2) **home** — grade de 6 recursos com icon-chip + cartões clones (sinal nº 3); (3) **gradientes** — hero, telão, faixa CTA e cartão de destaque usam gradiente (sinal nº 2; são verdes da marca, não o clichê roxo, mas são lugares demais). Corrigidos nos ciclos próprios, nesta ordem: fonte de display nos títulos (Sora em h1/h2 + logo, commit 8b1b709, tarde de 17/11/2026) → quebrar a grade da home (recursos viraram lista editorial `.feature-list`, mesmo commit) → gradiente só num momento (ciclo UI 7, 17/11/2026: telão era o último com gradientes — fundo chapado #050d0a, marca sólida #0b6e4f sem brilho, linha AGORA em degrau sólido; o único gradiente restante no produto é a variação de tom do painel "Pode retirar agora"). Critério de pronto da skill: sem o logo, a interface tem dono reconhecível. Os 3 sinais da auditoria inicial foram todos corrigidos; o 4º candidato (rótulos em caixa alta com tracking largo no telão) foi corrigido no **ciclo UI 8, 17/11/2026** (sentence case em Sora nos títulos "Pode retirar agora"/"A caminho" e no "Painel de saída", com tamanho maior p/ compensar a altura de caixa; "AGORA" ficou em caps por ser palavra única de ação — exceção FHWA p/ mensagens de ação; ver IDEAS.md, frente b, ciclo UI 8). Próximo da fila UI: **404 + favicon feitos no ciclo UI 9, 17/11/2026** (trio `app/icon.svg` + `app/favicon.ico` 16/32/48 + `app/apple-icon.png` 180×180, glifo da marca sobre verde chapado; `not-found.tsx` no padrão `.state` com duas saídas — início e portaria; ver IDEAS.md, frente d, ciclo UI 9). Depois: **app do tutor** (quando existir o esqueleto mobile — hoje só há o web); candidatas da varredura geral: tela de Segurança/2FA e persistência Prisma do restante.

## Banco de ideias (pesquisa contínua)
Ver `docs/product/IDEAS.md` — ideias com fonte, impacto e esforço, promovidas ao backlog
conforme a tese (ser o melhor só em saída). Próxima candidata: **login de
tutor por SMS** (Impacto 4, Esforço 3 — tutores entram por código, sem senha;
falta o provedor de SMS no Step 2) ou **alerta de guarda/restrição na
portaria** (Impacto 4, Esforço 3 — bloqueio por pessoa + sinal na validação
do QR quando alguém com restrição tenta retirar; Positive Proof, ciclo 30)
ou **código de conexão do responsável
por QR** (Impacto 3, Esforço 2 — QR impresso na matrícula p/ vincular o
responsável ao aluno sem digitação).

## Ideias promovidas da pesquisa (16/11/2026) — ver docs/product/IDEAS.md
- [x] Plano de saída padrão por aluno + exceção do dia com cutoff — implementado em 17/11/2026: DismissalPlanService + DismissalPlansModule (plano padrão por dia da semana só pela secretaria, "copiar segunda", exceção do dia com cutoff 13:30 configurável por escola, 1 exceção ativa/aluno/dia, resolve EXCEPTION > DEFAULT > NONE, log de mudanças p/ auditoria; modelos DismissalDefaultPlan + DismissalException no schema; ver docs/product/IDEAS.md, frentes a/d — PickUp Patrol/SDM).
- [x] Saída antecipada pelo app com aprovação da secretaria — implementado em 17/11/2026: EarlyDismissalService + EarlyPickupModule (motivo obrigatório, cutoff 30 min, 1 pedido ativo/aluno/dia, recusa com motivo, cancelamento só pelo tutor, expiração via refresh, `isApprovedForPickup` p/ a portaria; modelo EarlyDismissalRequest + enum no schema, validado; ver docs/product/IDEAS.md, frentes f/a — dismissal.ai/School Tag).
- [x] Notificação dual-path (push + registro durável in-app) — implementado em 17/11/2026: NotificationService + NotificationsModule (registro in-app sempre primeiro, push best-effort só com consentimento PUSH_NOTIFICATIONS + token Expo, retry até 3 tentativas, leitura isolada por tutor, expurgo só de lidas antigas; modelo Notification + enums no schema; ver docs/product/IDEAS.md, frentes f/e — ReadyBell).
- [x] Registro de incidentes de segurança com prazo de comunicação ANPD (3 dias úteis) — implementado em 17/11/2026: SecurityIncidentService + IncidentsModule (categorias de dados sem conteúdo, relógio de 3/20 dias úteis, checklist contenção/comunicação, `listOverdue` p/ o DPO, log append-only com hash encadeado; modelo SecurityIncident no schema; ver IDEAS.md, frentes a/e — CENTEGIX Dismissal, brecha Frontline Education ago/2026).
- [x] ETA ao vivo do tutor no painel + fila ordenada por proximidade — implementado em 17/11/2026: EtaService + EtaModule (faixas HERE/NOW/SOON/LATER/FAR/STALE com cores por urgência, ETA por distância/velocidade, botão "Estou aqui", histerese +40 m, STALE após 60 s, expurgo após 5 min; ver docs/product/IDEAS.md, frente c — ReadyBell/Technothera/PickupFlow/SafePickApp).
- [x] Modo telão/TV (portaria e sala) — implementado em 17/11/2026: DisplayBoardService + DisplayBoardModule (duas colunas "Pronto p/ retirada" vs "A caminho" sem rolagem, paginação com rotação automática de 15 s, modos GATE/CLASSROOM/HALLWAY, pop-up de chamada de 20 s com contagem regressiva, nome mascarado + sem foto no corredor, expurgo de telas sem consulta há 10 min; feature TV_MODE já existia no PRO; ver docs/product/IDEAS.md, frentes c/d — PickupRoster/Schoolhouse Driveline/Dismissal Magic/Time To Dismiss).
- [x] Módulo van/fretado (motorista retira vários alunos) — implementado em 17/11/2026: VanRouteService + VanRoutesModule (rota com paradas ordenadas, "criança da vez", embarcou/entregue/não estava no ponto/não vai hoje, a rota NÃO fecha com criança a bordo nem sem registro, alerta de rota vencida com criança a bordo, correção com motivo sem apagar o original, log append-only com hash encadeado; modelos VanRoute + VanRouteStop no schema; ver docs/product/IDEAS.md, frente b — Escolar/Vanep/Clickvan/Cadê a Van?).
- [x] Relatório de tempo de saída p/ diretoria ("escola amiga do trânsito") — implementado em 17/11/2026: DismissalReportService + ReportsModule (espera chamada→liberação com média/mediana/p95/máxima, fração ≤ 5 min, janela de pico de 15 min, quebra por modo e por sala, score 0–100 com rótulo EXCELENTE/BOA/ATENCAO/CRITICA, resumo de período com melhor/pior dia e série diária, export CSV; sem dado, estatísticas null — nunca número inventado; ver docs/product/IDEAS.md, frente d — PikMyKid "33% menos tempo na fila", Placa.ai "One-Lane Pilot" de 30 dias).
- [x] Preço publicado por aluno/mês (Impacto 4, Esforço 1) — implementado em 17/11/2026: página pública `/planos` no web (3 cartões Grátis/Teste 30 dias/PRO R$ 2,90/aluno/mês + calculadora interativa nº de alunos → mensalidade com a fórmula à mostra + FAQ só com regras do PlanService; link no topbar e na home) e `docs/product/PRECOS.md` (política, benchmark e pendências: piso p/ escolas pequenas, desconto anual e meios de pagamento — nada disso prometido na página). Valores espelham `PLAN_DEFINITIONS` (fonte única de verdade). Ressalva: o preço é proposta de lançamento — confirmar com o usuário antes do deploy público. **Atualização 17/11/2026 (fora deste ciclo): o usuário decidiu migrar p/ faixas fixas mensais e CONFIRMOU os valores: Grátis até 30 alunos; R$ 89/mês até 50; R$ 199/mês de 51 a 200; R$ 349/mês acima de 200 (acima de 1.000, sob consulta). Atualizado em 17/11/2026 pelo fio de deploy: `PlanService` (faixas `PRO_PRICE_BANDS_BRL` + `proMonthlyPriceBRL`), página `/planos`, calculadora (seletor de faixa) e `PRECOS.md` migrados p/ as faixas confirmadas.**
- [x] Expurgo automático por retenção LGPD (selfie 30 dias, foto ao fim da matrícula) — implementado em 17/11/2026: RetentionService + PurgeLog com hash encadeado (ver IDEAS.md, frente e).
- [x] Minimização de dados: posição do tutor nunca persistida — verificado em 17/11/2026 por inspeção de código: nenhum `prisma`/`.create()`/`.save()` em `realtime/` nem `modules/geofencing/`; rede de segurança: RetentionService expurga ping registrado por engano (regra ZERO_RETENTION). Atenção: revalidar quando a persistência do Step 2 entrar.
- [x] Eventos realtime com ID + catch-up após reconexão (Impacto 5, Esforço 3) — implementado em 17/11/2026: EventLogService (seq monotônico por room, ring buffer 500/room, hasGap), envelope `{ seq, data }` no RealtimeService e handler `events.catch_up` no gateway (só rooms do próprio socket) — ver docs/03.
- [x] Tier gratuito limitado + trial sem cartão (Impacto 5, Esforço 2) — implementado em 17/11/2026: PlanService + SchoolPlan (FREE 30 alunos/5 staff, TRIAL 30 dias sem cartão, PRO R$ 2,90/aluno/mês; trial 1 por escola, downgrade automático p/ FREE; ver IDEAS.md, frente b — benchmark Skolar R$ 179–379/mês, 30 dias sem cartão).
- [x] Autorização temporária com prazo determinado (1 dia / 1 semana / 1 mês) (Impacto 4, Esforço 2) — implementado em 17/11/2026: TemporaryAuthorizationService + DelegationsModule (ONE_DAY uso único, ONE_WEEK/ONE_MONTH multiuso, selfie obrigatória, sem sobreposição de janelas, revogação, refresh p/ EXPIRED; ver IDEAS.md, frente c — School Guardian vende isso; PikMyKid delega por 1 dia com verificação por foto/documento). Próxima candidata: saída antecipada com aprovação da secretaria (Impacto 5, Esforço 2).
- [x] Relatório de conformidade LGPD p/ a escola (DPA-ready) — implementado em 17/11/2026: ComplianceReportService + ComplianceModule (RoPA com 8 atividades — finalidade, base legal, retenção, suboperadores, transferência internacional —, consentimentos ativos/revogados por finalidade, retenção/expurgo, incidentes com comunicação vencida, checklist OK/ATENCAO/PENDENTE com gaps e `toMarkdown` DPA-ready sem dado pessoal; ver docs/product/IDEAS.md, frente e — RoPA art. 37, RIPD art. 5º XVII, Res. CD/ANPD nº 2/2022).
- [ ] Login de tutor por SMS (Impacto 4, Esforço 3 — tutores nunca usam 2FA; falta o provedor de SMS no Step 2)
