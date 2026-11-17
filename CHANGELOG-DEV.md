## 2026-11-17 16:54–16:59 — Ciclo UI 6: revisão mobile geral de todas as telas

**Pesquisa do ciclo (frente c — acessibilidade e mobile)**
- **Nunca bloquear o zoom p/ consertar o zoom do iOS** (web-developpeur,
  out/2026; acuityscan, 20/10/2026): `maximum-scale=1` /
  `user-scalable=no` impede quem tem baixa visão de ampliar, e o iOS
  ignora o bloqueio no pinça desde o iOS 10 — o conserto é o input com
  ≥ 16 px, que é o gatilho do zoom automático do Safari.
- **Alvo de toque 44–48 px com ~8 px entre vizinhos** (Apple 44 pt,
  Material 48 dp, WCAG 2.2 AA 24 px / AAA 44 px): o conserto é área de
  toque maior, não ícone maior — `min-height` + padding.
- **Rolagem lateral vem de UM elemento mais largo que a tela**
  (acuityscan; pwd, 2026): corrigir o elemento, não esconder o overflow
  no body — e `overflow-x: hidden` em `html`/`body` quebra o `position:
  sticky`; `overflow-x: clip` corta sem criar scroll container.
- **Safe-area com `viewport-fit=cover`** (web-developpeur; cheatgrid,
  29/04/2026): sem `cover` a página nem chega ao notch; com `cover`, o
  CSS precisa de `env(safe-area-inset-*)` na topbar, no rodapé e nas
  telas cheias; ações primárias no terço inferior, ao alcance do
  polegar.
- Achados registrados em `docs/product/IDEAS.md` (frente c, ciclo UI 6);
  o item implementado era o da fila UI: **revisão mobile geral**
  (Impacto 3, Esforço 1).

**O que foi feito**
- **Trava de rolagem lateral** (`globals.css`): `overflow-x: clip` +
  `max-width: 100%` em `html, body` — o guarda global que faltava; o
  sticky da topbar continua funcionando (clip não cria scroll
  container, diferente de hidden).
- **Alvos de toque em 44 px** (o defeito real da auditoria): `.btn.small`
  era 40 px — subiu p/ 44 px (botão Sair da topbar, ações
  Chamar/Validar/Liberar/Cancelar da portaria e ações das linhas da
  /escola); os links da topbar (Planos/Portaria/Telão/Escola/Criar
  conta/Entrar) e do rodapé eram texto puro de ~20 px de altura —
  ganharam `min-height: 44px` com padding, sem mudar o visual.
- **Safe-area / notch** (`layout.tsx` + `globals.css`): `viewportFit:
  'cover'` no export `viewport` do Next; respiro de
  `env(safe-area-inset-*)` na topbar, no telão (tela cheia fixa, que
  também abre no celular), no rodapé e no `.container`. Sem
  `maximum-scale` nem `user-scalable=no` — o zoom de pinça continua
  livre.
- **Topbar logada cabe em 320 px**: abaixo de 480 px o nome do usuário
  some e ficam só avatar + Sair (4 links + avatar + nome + Sair não
  cabiam sem apertar os alvos); a identidade continua visível pelo
  avatar.
- **Fim do estouro por `nowrap`**: as linhas do painel do hero
  (`.hb-row`) ganharam `flex-wrap: wrap` e `.hb-name` `min-width: 0`;
  os nomes do telão (`.telao-name`) ganharam `min-width: 0` +
  `overflow-wrap: break-word` — nome comprido + selo AGORA/ETA não
  empurram mais o conteúdo p/ fora da tela.
- **Verificado sem mudança**: todos os inputs/selects/textarea já têm
  1rem (16 px) — o zoom automático do iOS ao focar o campo não
  acontece; o resumo da fila (3 colunas) cabe em 320 px. Nenhuma regra
  de negócio, preço ou API tocada.

**Arquivos alterados**
- `apps/web/app/globals.css` (overflow-x clip, `.btn.small` 44 px,
  alvos da topbar/rodapé, safe-area, nome oculto ≤ 480 px, wrap do hero
  e do telão)
- `apps/web/app/layout.tsx` (export `viewport` com `viewportFit:
  'cover'`)
- `docs/product/IDEAS.md` (frente c, ciclo UI 6), `BACKLOG.md` (fila UI/UX)

**Verificação** — `next build` em apps/web: **OK** (tipos válidos, 10
rotas: /, /cadastro, /escola, /esqueci-senha, /login, /planos,
/portaria, /redefinir-senha, /telao, /_not-found). Limitação: sem
aparelho real neste sandbox — a checagem foi por inspeção de CSS +
build; o teste em iPhone/Android de verdade fica p/ a verificação ao
vivo (registrado no IDEAS.md).

**Próximo (fila UI)** — passada anti-genérica (skill `unslop`) nas
telas restantes (login, portaria, telão, planos, escola): corrigir os
3 maiores sinais por ciclo; depois o app do tutor quando existir.

## 2026-11-17 16:24–16:40 — Ciclo UI 5: estados vazios/erro/carregando (padrão único)

**Pesquisa do ciclo (frente a/c — estados de tela: vazio, erro, carregamento)**
- **Cinco estados, não um** (syntaqx, 03/11/2026): toda tela que carrega
  dado precisa dos estados desenhados junto com o caminho feliz —
  carregando (algo acontece, sem salto de layout), vazio (por que não há
  nada + próximo passo), erro (o que houve, o que fazer + retry). O
  conserto é barato no início e caro quando vira bug reportado.
- **Skeleton no formato do conteúdo, nunca "sem registros" enquanto
  carrega** (NN/g via syntaqx/medium, 2026): um "Nenhum registro" exibido
  por segundos antes da lista aparecer é o erro clássico — o vazio só
  pode aparecer depois que o carregamento terminou sem nada. Skeleton
  p/ cargas de até ~10 s; abaixo de 1 s, nada.
- **Vazio ensina o próximo passo** (NN/g; Carbon/IBM): ícone + título
  curto + 1 linha de texto + no máximo 1 ação; um vazio de primeira
  execução é a tela mais vista do produto e deve ensinar o recurso.
- **Erro com linguagem de ação** (medium, 13/11/2026; davis-company,
  2026): sem código interno; dizer que os dados estão seguros, o que
  fazer e dar o botão de retry — e dar ao erro uma linguagem visual
  distinta do vazio (tom de aviso, não ilustração amigável), senão o
  usuário culpa o produto pelos dois.
- Achados registrados em `docs/product/IDEAS.md` (frente a/c, ciclo UI 5);
  o item implementado era o da fila UI: **estados vazios/erro/carregando**
  (Impacto 3, Esforço 2).

**O que foi feito**
- **O bug real: vazio indistinguível de carregando** — a fila nasce vazia
  nesta sessão (só eventos ao vivo a preenchem) e `apiOnline === null`
  (ainda verificando) caía no mesmo ramo do "vazio": a portaria e o telão
  afirmavam "nenhuma saída" antes mesmo de saber. Agora são 3 estados
  distintos, nas duas telas.
- **Padrão único `.state`** (`globals.css`): ícone 52 px + título em
  display + 1 linha de texto + no máximo 1 ação; variante `.state-error`
  com fundo e borda em tom de aviso; o `.empty` solto (só um parágrafo
  cinza) saiu.
- **Carregando = skeleton no formato real** (`.skeleton-list` /
  `.skeleton-row` na portaria, `.telao-skeleton` no telão): linhas com
  círculo + 2 barras, pulso suave, sem salto de layout; contadores e
  rodapé mostram "–" enquanto conectam; `role="status"` + texto só p/
  leitor de tela. Pulso desligado em `prefers-reduced-motion`.
- **Erro com retry** (`use-pickup-queue.ts` + portaria): quando a API não
  responde e a fila está vazia, cartão `.state-error` com ícone de aviso,
  "A fila não está atualizando", "Nada foi perdido — tente de novo ou
  aguarde: a página verifica sozinha a cada 30 segundos" e botão
  "Tentar de novo" — o hook ganhou `retry()`, que re-verifica a saúde da
  API e reconecta o socket (ele desiste sozinho após 5 tentativas). Com
  itens na fila, os dados (mesmo desatualizados) continuam visíveis e só
  o selo de conexão avisa — estado parcial, não tela de erro.
- **Vazios com título** (portaria): "Nenhuma saída em andamento" com a
  ação "Ver no telão"; por seção, "Ninguém pronto por enquanto" /
  "Ninguém a caminho por enquanto" com a explicação do que aparece ali.
  Textos em pt-BR, lógica da fila e da API intactas.

**Arquivos alterados**
- `apps/web/app/globals.css` (+ `.state`, `.state-error`, `.skeleton-*`,
  `.telao-skeleton`, `.sr-only`; removido `.empty`)
- `apps/web/app/portaria/page.tsx` (3 estados, skeleton, erro com retry)
- `apps/web/app/telao/page.tsx` (skeleton de carregamento, contadores "–")
- `apps/web/lib/use-pickup-queue.ts` (+ `retry()`)
- `docs/product/IDEAS.md` (frente a/c, ciclo UI 5), `BACKLOG.md` (fila UI/UX)

**Verificação** — `next build` em apps/web: **OK** (tipos válidos, 7
rotas: /, /cadastro, /login, /planos, /portaria, /telao, /_not-found).

**Incidente no meio do ciclo (registrado, sem dano)**: um segundo ciclo
("Login completo", AuthNav + RequireAuth + refresh) rodou em paralelo
neste mesmo checkout e commitou às 16:31 (`fc90ddd`) com `git add -A` —
o commit varreu também os arquivos deste ciclo, que estavam sem commit
naquele momento. A 1ª tentativa de `next build` deste ciclo (16:29)
falhou em TODAS as páginas com `ReferenceError: AuthNav is not defined`
porque o outro ciclo estava no meio da edição (layout importando
`AuthNav` antes do arquivo existir no disco). Após o commit do outro
ciclo, o rebuild limpo (`rm -rf .next && next build`) passou. O código
deste ciclo foi conferido dentro do `fc90ddd` (skeleton, `.state`,
`retry()` intactos, mesclados com a guarda `RequireAuth` do outro ciclo)
e o registro deste ciclo vai num commit próprio a seguir. Lição p/ os
próximos ciclos: dois ciclos no mesmo checkout precisam se alternar no
commit — ou o segundo espera o `git status` limpo do primeiro.

**Próximo (fila UI)** — revisão mobile geral de todas as telas; depois a
passada anti-genérica (skill `unslop`) nas telas restantes e o app do
tutor quando existir.

## 2026-11-17 15:54–16:00 — Ciclo UI 4: planos/calculadora (recomendado em destaque + hierarquia)

**Pesquisa do ciclo (frente d — design systems / páginas de preço SaaS)**
- **Destaque exatamente UM plano recomendado** (insaim.design, 2026;
  orbix.studio, 31/10/2026; wisernotify, 2026): selo "Most Popular" /
  "Recomendado" + borda + cartão levemente maior/elevado + CTA mais
  forte — um único sinal dá ao indeciso um ponto de partida sem obrigá-lo
  a comparar tudo; sem rótulo, só a borda não comunica por que aquele
  cartão é o ponto de partida.
- **Mobile: o recomendado vem primeiro na pilha** (insaim.design, 2026):
  no celular os planos empilham e o recomendado não pode ficar enterrado
  no meio nem no fim de uma rolagem horizontal.
- **Mesma ordem dentro de cada cartão** (nome → para quem é → preço →
  CTA → recursos) e **preço em texto claro** (vezadigital, 2026): o olho
  compara sem reler; o visitante não deve precisar ligar p/ saber o valor.
- Achados registrados em `docs/product/IDEAS.md` (frente d, ciclo UI 4);
  o item implementado era o da fila UI: **planos/calculadora**
  (Impacto 3, Esforço 1).

**O que foi feito**
- **Selo "Recomendado"** (`planos/page.tsx` + `.plan-badge` em
  `globals.css`): pill verde da marca, maiúscula, no topo do cartão do
  teste de 30 dias — antes só a borda verde o distinguia, sem dizer o
  porquê.
- **Cartão recomendado elevado**: sombra `--shadow-md` e, no desktop,
  `scale(1.02)` — destaque discreto, sem quebrar o grid; os outros dois
  cartões mantêm o CTA secundário e o recomendado o primário.
- **Mobile: recomendado em 1º** — `order: -1` no recomendado abaixo de
  640 px (a pilha era Grátis → Teste → PRO; agora Teste → Grátis → PRO).
- **Faixas do PRO como lista** (`.plan-bands`): 3 linhas faixa ↔ preço
  com numerais tabulares, em vez do parágrafo corrido — mesmos valores
  da API (R$ 89 até 50 · R$ 199 de 51 a 200 · R$ 349 acima de 200), sem
  mudar preço, faixa ou regra.
- **Calculadora acessível**: a região do resultado ganhou
  `aria-live="polite"` — o leitor de tela anuncia o novo valor sem o
  usuário sair do campo. Lógica de faixas e valores intacta.

**Arquivos alterados**
- `apps/web/app/planos/page.tsx` (selo, lista de faixas do PRO)
- `apps/web/app/planos/calculadora.tsx` (`aria-live` no resultado)
- `apps/web/app/globals.css` (+ `.plan-badge`, `.plan-bands`, elevação e
  ordem mobile do `.plan.recommended`)
- `docs/product/IDEAS.md` (frente d, ciclo UI 4), `BACKLOG.md` (fila UI/UX)

**Verificação** — `next build` em apps/web: **OK** (tipos válidos, 7
rotas: /, /cadastro, /login, /planos, /portaria, /telao, /_not-found).

**Próximo (fila UI)** — estados vazios/erro/carregando: padrão visual
único p/ telas sem dados, falhas de API e carregamento; depois revisão
mobile geral e app do tutor quando existir.

## 2026-11-17 16:55 — BUG: tempo real nunca conectava no web (reportado pelo usuário)

**Sintoma** — telão preso em "Conectando" e portaria em "API no ar ·
tempo real conectando…", para sempre.

**Causa (duas, somadas)**
1. O `PickupGateway` exige `schoolId` no handshake do socket e
   desconecta quem não manda; o web mandava SÓ o token. O transporte
   subia (handshake HTTP ok via Caddy), o servidor derrubava em
   seguida — por isso a API aparecia "no ar" (REST/health respondia)
   mas o tempo real nunca conectava.
2. Mesmo com schoolId, as rooms são por papel e `queue.entry.created`
   só vai p/ a room do portão (GATE_AGENT/COORDINATOR); o ADMIN — quem
   opera a portaria em escola pequena — entrava só na room admin e
   nunca veria as entradas novas.

**Correção**
- Web (`use-pickup-queue`): handshake passa a mandar token + schoolId
  + role da sessão, na forma de função (relê a sessão a cada
  reconexão — token renovado entra sozinho).
- API (`pickup.gateway`): ADMIN também entra na room do portão.

**Verificação** — jest realtime + app.module (17 testes) e `next
build` OK; prova ao vivo com cliente socket.io de verdade (login →
conecta → join na fila → recebe `queue.entry.created`) após o deploy,
registrada na entrada seguinte.

## 2026-11-17 16:48 — Provas ao vivo dos 3 itens (deploy b6d8806)

Script de fumaça contra http://187.53.122.5 com a conta de teste —
**tudo passou**:
- **Roster**: login → POST /schools criou "Escola Teste da Varredura"
  (a35fa897-2b69-4b9a-a0ac-83b19cec6600) → login com escola → turma
  "3º B", aluna "Alice Varredura" e responsável "Maria Varredura"
  criados pelas rotas novas → vínculo 201 → GET responsáveis do aluno
  = 1.
- **Reset**: forgot-password → token apareceu em GET
  /auth/password-resets (admin) → reset 201 → login com a senha velha
  = 401, com a nova (TesteLogin#2027) = 201.
- **Portaria**: join na fila (pq_1) → call = CALLED → release sem
  validar = **400** (a regra "só sai validado" vale ao vivo) → cancel
  = CANCELLED.
Artefatos de teste ficam em produção (escola de teste + 1 turma/aluna/
responsável + entrada cancelada) — inofensivos e úteis p/ demonstração.

## 2026-11-17 16:38 — Varredura: os 3 itens críticos corrigidos (ordem aprovada pelo usuário)

**Item 1 — a escola consegue se cadastrar (roster com HTTP + telas)**
- API: `RosterController` (novo, módulo RosterApiModule) — turmas
  (listar/criar/renomear/desativar), alunos (listar/criar/editar/status/
  responsáveis), tutores (listar/criar/vincular/desvincular) e
  POST /roster/import (CSV com dryRun). schoolId SEMPRE da sessão;
  recurso de outra escola responde 404; escrita só ADMIN/COORDINATOR,
  leitura também GATE_AGENT. Spec nova com o serviço real (isolamento
  de tenant incluído).
- Web: página **/escola** (guardada por login) com abas Turmas / Alunos
  / Responsáveis / Importar CSV — formulários, listas, vínculo de
  responsável por aluno com parentesco, prévia de importação com erros
  por linha. Link "Escola" na topbar quando logado. Cliente ganhou
  `authedJson` (Bearer + refresh automático em 401).

**Item 2 — portaria operável**
- A fila agora expõe o `status` bruto; VALIDATED cai no grupo "pronto"
  e RELEASED sai da lista (faltava no REMOVED_HINTS).
- Cada entrada na portaria ganhou as ações da máquina de estados:
  Chamar (QUEUED), Validar QR com campo p/ o código (QUEUED/CALLED),
  Confirmar retirada (só VALIDATED — a API exige), Cancelar. Erros da
  API aparecem na própria linha.

**Item 3 — esqueci minha senha**
- API: `PasswordResetService` — token de uso único (hash SHA-256,
  1 h, pedido novo invalida o anterior); POST /auth/forgot-password
  (resposta sempre ok, sem vazar contas), POST /auth/reset-password
  (troca + revoga TODAS as sessões), GET /auth/password-resets (só
  ADMIN da própria escola). AuthService ganhou findUserByEmail e
  resetPasswordWithToken (mesma política da troca de senha + persiste).
- Entrega v1 honesta: sem provedor de e-mail, o link fica na Área da
  escola ("Redefinições de senha pendentes", com Copiar link) p/ o
  admin passar à pessoa; o token cru vive só em memória.
- Web: /esqueci-senha (explica o fluxo), /redefinir-senha?token=...,
  link "Esqueci minha senha" no login e o cartão de pendentes na /escola.

**Verificação** — jest completo: **509/509 (43 suítes)**; `next build`
OK (12 páginas). Provas ao vivo (roster + reset + ações da portaria)
registradas na entrada seguinte, após o deploy.

## 2026-11-17 16:35 — Prova ao vivo do login (deploy fc90ddd) + varredura geral

**Login provado em produção** (usuário descartável
teste.login@tutorpass.com.br, via curl contra http://187.53.122.5):
register 201 → login 201 com Set-Cookie de refresh → GET /auth/me 200
→ POST /auth/refresh 201 (rotação ok) → POST /auth/logout 201 →
refresh de novo: **401** (sessão revogada de verdade). O ciclo que
estava quebrado pela flag Secure em HTTP agora fecha inteiro.

**Varredura geral** (mesmo pedido): o padrão do login se repete — motor
pronto e testado sem a camada de uso. Lacunas registradas no topo do
BACKLOG.md ("Lacunas críticas — varredura geral de 17/11/2026"):
roster sem controller HTTP nem telas (a escola não cadastra alunos),
portaria só de leitura (API tem call/validate-qr/release; o web não
chama), sem fluxo de "esqueci minha senha", 2FA sem tela de Segurança,
persistência ainda parcial, sem 404/favicon, mobile esqueleto.

## 2026-11-17 16:27 — Sistema de login completo e funcional (pedido do usuário)

**Auditoria (o que o usuário desconfiou, confirmado no código)**
- A API já era completa: register, login + 2FA, refresh com rotação
  (cookie httpOnly), logout com revogação, /auth/me, sessões, troca de
  senha. O buraco era todo no web:
- Topbar 100% estática: depois do login, NADA na tela dizia que você
  estava logado — "Entrar/Criar conta" continuavam aparecendo.
- O único botão "Sair" era o da tela de sucesso do login, e ele só
  apagava o sessionStorage: o cookie de refresh continuava válido (a
  sessão NÃO era encerrada no servidor).
- O web não tinha refresh ligado: access token (15 min) vencia e a
  portaria/telão degradavam em silêncio; fechar a aba matava a sessão
  visual mesmo com o cookie válido por dias.
- /portaria e /telao abriam sem sessão nenhuma, mostrando fila vazia
  e confusa em vez de pedir login.
- BUG de produção: o cookie de refresh saía com `Secure` sempre que
  NODE_ENV=production — mas o site roda em HTTP (era do IP), então o
  navegador recusava o cookie e o refresh NUNCA funcionou no ar.

**Correções**
- API: `refreshCookieOptions` deriva `secure` do protocolo da origem
  pública (CORS_ORIGINS): https → Secure; http → sem Secure. Vira
  sozinho quando o domínio com HTTPS entrar.
- Web `lib/api.ts`: `refreshSession()` (renova e salva; falha limpa) e
  `logout()` de verdade (POST /auth/logout + limpa local); save/clear
  disparam o evento `tutorpass:session` p/ a interface reagir na hora.
- Novo `components/AuthNav.tsx` na topbar (todas as páginas): logado
  mostra avatar com inicial + primeiro nome + **Sair**; deslogado,
  Entrar/Criar conta; ao montar sem sessão local, tenta o refresh —
  a sessão volta sozinha ao reabrir o navegador.
- Novo `components/RequireAuth.tsx` guardando /portaria e /telao:
  sem sessão, cartão "Você precisa entrar" com botão p/ o login; com
  sessão, renova o token a cada 10 min (essas telas ficam abertas a
  tarde inteira).
- Login: o "Sair" da tela de sucesso agora chama o logout da API.

**Verificação** — jest da API + `next build` antes do push; prova ao
vivo do ciclo completo (register → login → me → refresh → logout →
refresh recusado) contra a API em produção, registrada na entrada
seguinte.

## 2026-11-17 16:21 — Unslop na prática: passada anti-genérica na home (pedido do usuário)

**Método** — skill `unslop` (github.com/heydamir/unslop, instalada em
~/workspace/custom-skills) aplicada à tela inicial. O usuário pediu p/
ver na prática e já tinha dito "pode aplicar" — a espera de direção do
método foi pulada por instrução dele.

**Direção (das 5 linhas da unslop)**
- Produto: organizar a saída de alunos de escolas particulares — tutor
  entra na fila, portaria chama, retirada fica registrada.
- Caráter: calmo, exato, um pouco acolhedor (confiança de escola).
- Mundo: o portão às 17h — telão verde da TV, fila de carros, tag
  impressa no crachá.
- Momentos: (1) o painel da saída de verdade no hero; (2) os preços
  reais na faixa final.
- Assinatura: o ponto "ao vivo" + o selo "Agora" do painel da saída.

**Auditoria (sinais achados na home)**
1. Hero empilhado sem nenhum visual do produto, com pill de selo.
2. Grade 3×2 de recursos com icon-chip e cartões clones — e uma segunda
   grade idêntica ("Acesso rápido") logo abaixo.
3. Passos 1-2-3 em cartões clones com número em bolinha.
4. Gradiente de matiz no hero e na faixa CTA (cor decorativa espalhada).
5. Inter em tudo; títulos com peso 800, sem fonte de display.
6. Título "com segurança de verdade" (vago) e "Por que as escolas
   escolhem o TutorPass" (frase de template).

**Passadas aplicadas**
- **Tipo**: Sora (500/600) como fonte de display em h1/h2 e na marca;
  títulos com peso 600; Inter fica no texto e na interface.
- **Layout/visual**: hero vira split assimétrico — texto à esquerda e o
  painel da saída à direita (HTML/CSS, nomes plausíveis, selo "Agora",
  ETAs tabulares), como o telão mostra.
- **Cor**: hero em verde profundo chapado (#07382a, sem gradiente) e
  faixa CTA chapada; o momento rico é o painel, não o fundo.
- **Estrutura**: recursos viram lista editorial com divisores finos e
  ícone discreto (sem bolinha); "Acesso rápido" vira lista de links com
  seta; passos viram editorial com numeral grande em display.
- **Texto**: h1 "A saída da escola sem fila, com cada retirada
  registrada"; subtítulo enxuto; seção de recursos vira "Feito para a
  hora da saída". Fatos e preços intactos.

**Verificação** — `next build` antes do push (ver entrada do commit);
demais telas seguem o sistema anterior e entram nas próximas passadas
da fila (a passada anti-genérica do BACKLOG continua aberta p/ elas).

## 2026-11-17 15:52 — Uptime Kuma: tag 1 → 2 (linha 1.x descontinuada)

O usuário abriu o Kuma e viu o aviso do próprio projeto: a v1.23.17
(tag `1`/`latest`) não é mais mantida e não recebe correções de
segurança. Compose trocado para `louislam/uptime-kuma:2` (tag
recomendada); o volume `kuma_data` é o mesmo e a base migra sozinha na
primeira subida da v2 — conta e monitores criados na v1 se mantêm.

## 2026-11-17 15:24–15:35 — Ciclo UI 3: portaria redesenhada (hierarquia da fila + cadastro no padrão auth)

**Pesquisa do ciclo (frente a — referências de design de SaaS e painéis)**
- **O loop do operador, não o modelo de dados** (hiperfusion, 13/07/2026):
  encontrar → avaliar → agir → confirmar → próximo; as 5 ações mais
  frequentes num trilho consistente; estado é contrato — texto + ícone,
  nunca só cor.
- **3 a 5 métricas no máximo numa visão operacional** (Contact Centre
  Summit, atual. 20/07/2026; RocketScreens, 2026): mais dado vira ruído;
  contadores grandes com limiares verde/âmbar/vermelho comunicam urgência
  sem interpretar número; no telão/TV, legível a distância em até 2 s.
- **Numerais tabulares em contagens ao vivo** (designhq, 2026): dígitos de
  largura fixa não dançam quando o valor muda.
- **Mobile é um olhar com uma mão** (fuselabcreative, 2026): a primeira
  posição vertical responde à pergunta única da tela; 3–5 pontos primários.
- Achados registrados em `docs/product/IDEAS.md` (frente a, ciclo UI 3);
  o item implementado era o da fila UI: **portaria** (Impacto 3, Esforço 2).

**O que foi feito**
- **Resumo da fila** (`portaria/page.tsx`): 3 contadores no topo — na fila
  agora / prontos p/ retirada / a caminho — com numerais tabulares; o de
  "prontos" em verde, p/ o operador ver o estado num olhar.
- **Selo de conexão** (`conn-pill`, `role="status"`): texto + cor, nunca só
  cor — "Tempo real conectado" (verde), "API no ar · tempo real
  conectando…" (âmbar) e "API fora do ar…" (vermelho), com `min-height`
  44 px.
- **Hierarquia das seções**: "Pronto para retirada" primeiro, com borda
  verde e badge de contagem verde; "A caminho" calma; cada seção com
  badge de contagem e estado vazio próprio.
- **Linhas numeradas**: posição em círculo, nome maior (1.08rem) e chips
  de turma, portão e ETA (`~N min`, tabular) — o hook
  (`use-pickup-queue.ts`) passou a expor o `gate` da entrada, que já
  vinha no evento.
- **Alvos de toque**: `.btn` com `min-height: 48px` em todo o site; foco
  visível já era global. Botão "Ver no telão" centralizado em
  `.queue-actions`.
- **Cadastro no padrão `.auth-*`** (pendência do ciclo UI 2): layout
  centrado com marca (escudo), campos em `.field`, mostrar/ocultar senha
  com o mesmo botão olho do login (44 px, `aria-pressed`, senha
  reocultada ao enviar) e sucesso com ícone de confirmação + ações
  centralizadas. Lógica de cadastro/login/criação de escola intacta.
- Lógica da fila (hook, eventos, grupos) intacta — só apresentação.
  Nenhuma regra de negócio, preço ou API tocada.

**Arquivos alterados**
- `apps/web/app/portaria/page.tsx` (resumo, selo, seções, linhas, ações)
- `apps/web/lib/use-pickup-queue.ts` (+ `gate` no `QueueItem`)
- `apps/web/app/globals.css` (+ `.conn-pill`, `.queue-summary`,
  `.queue-stat`, `.queue-section`, `.count-badge`, `.queue-pos`,
  `.queue-chips`, `.chip`, `.queue-actions`; `.btn` com `min-height: 48px`)
- `apps/web/app/cadastro/page.tsx` (padrão `.auth-*`, mostrar senha, sucesso)
- `docs/product/IDEAS.md` (frente a, ciclo UI 3), `BACKLOG.md` (fila UI/UX)

**Verificação** — `next build` em apps/web: **OK** (tipos válidos, 7
rotas: /, /cadastro, /login, /planos, /portaria, /telao, /_not-found).

**Próximo (fila UI)** — planos/calculadora: destaque do plano recomendado
e hierarquia dos cartões; depois estados vazios/erro/carregando e revisão
mobile geral.

## 2026-11-17 15:13–15:17 — Ciclo UI 2: login redesenhado (acessibilidade + mobile)

**Pesquisa do ciclo (frente c — acessibilidade e mobile)**
- **Mostrar/ocultar senha é expectativa, não luxo (WCAG 3.3.8, 2026)**:
  esconder a senha não aumenta a segurança e derruba a usabilidade — até
  ~20% das falhas de login vêm de erro de digitação; o toggle reduz o
  abandono em mobile. Regras: botão real (não ícone decorativo), nome
  acessível que muda com o estado, `aria-pressed`, operável por teclado,
  alvo ≥ 44×44 px e a senha volta a ficar oculta ao enviar.
- **Login é onde os testes de acessibilidade mais falham** (a11yfix,
  21/06/2026): campos sem rótulo visível conectado, olho sem nome
  acessível, alvos minúsculos e zoom do iOS com input < 16 px. O nosso
  login já tinha rótulos, `autocomplete` correto e fonte 1rem — faltavam
  o toggle e o layout centrado com marca.
- Achados registrados em `docs/product/IDEAS.md` (frente c, ciclo UI 2);
  promovido ao BACKLOG (fila UI/UX): **portaria — alvos de toque ≥ 44 px
  + foco visível + hierarquia da fila** (Impacto 3, Esforço 2), e aplicar
  o padrão `.auth-*` ao /cadastro.

**O que foi feito**
- **Layout de autenticação** (`globals.css`, `.auth-*` reutilizável):
  `.auth-wrap` centralizado, `.auth-card` de 440 px, `.auth-brand` com a
  marca (escudo 52 px) + título + subtítulo, botões com altura mínima de
  48 px, `.field` com espaçamento consistente.
- **Mostrar/ocultar senha** (`login/page.tsx`): botão olho com SVG
  próprio (traço 2, cantos arredondados), 44×44 px dentro do campo,
  `aria-pressed` + `aria-label` que muda ("Mostrar senha" ↔ "Ocultar
  senha"), e a senha volta a ficar oculta no submit (o navegador não
  guarda o valor visível no autocompletar).
- **2FA**: campo do código com espaçamento de dígitos, centralizado e em
  negrito, com dica de que aceita código de recuperação; botão "Voltar"
  mantido.
- **Sucesso**: estado "Login feito" redesenhado — ícone de confirmação em
  círculo verde, saudação e ações centralizadas (Portaria / Telão / Sair).
- Lógica de login/2FA/sessão intacta — só apresentação. Nenhuma regra de
  negócio, preço ou API tocada.

**Arquivos alterados**
- `apps/web/app/login/page.tsx` (layout, toggle de senha, 2FA, sucesso)
- `apps/web/app/globals.css` (+ `.auth-*`, `.input-wrap`, `.input-toggle`, `.code-input`)
- `docs/product/IDEAS.md` (frente c, ciclo UI 2), `BACKLOG.md` (fila UI/UX)

**Verificação** — `next build` em apps/web: **OK** (tipos válidos, 7
rotas: /, /cadastro, /login, /planos, /portaria, /telao, /_not-found).

**Próximo (fila UI)** — portaria: alvos de toque ≥ 44 px, foco visível e
hierarquia da fila/status/ações; depois telão (já redesenhado), planos,
estados vazios/erro e revisão mobile geral.

## 2026-11-17 15:01–15:20 — Kit essencial open-source no VPS + alerta da portaria via ntfy

**Contexto** — o usuário pediu serviços open-source via Docker p/ dar um
gás na aplicação e aprovou o "kit essencial". No meio, perguntou se o
ntfy poderia avisar o celular de quem fica na portaria quando o tutor vem
buscar — virou feature no mesmo pacote.

**Infra (docker-compose.prod.yml, 10 containers no total)**
- **Uptime Kuma** (:3001, login próprio) — monitoramento do site/API.
- **Umami** (:3002, banco `umami` no Postgres atual) — analytics sem
  cookies; senha do admin trocada da padrão e site "TutorPass"
  cadastrado; script de medição entrou no `layout.tsx` do web.
- **ntfy** (:2586) — push self-hosted com `auth-default-access: deny-all`,
  upstream p/ iOS ligado; usuários `gustavo` (admin) e `api` (publicador,
  ACL write-only em `tutorpass-*`, token no `.env.production` do
  servidor); publicação de teste no tópico `tutorpass-alertas` OK.
  Credenciais geradas ficam em `/root/.kit-credentials` (600) no VPS.
- **Dozzle** — logs ao vivo SEM porta pública: rota `/dozzle` no Caddy
  atrás de basic_auth (bcrypt gerado no servidor). Pegadinha registrada:
  o Caddy não recarrega o Caddyfile quando o compose só sobe serviços
  novos — precisou de restart do container.
- **Backup do Postgres** (`postgres-backup-local`, diário, retenção
  7d/4sem/6m) — pegadinha registrada: a imagem atual (v0.0.11) grava em
  `/backups`, não em `/db/data/backups`; o volume foi corrigido e um
  backup manual de prova foi gerado com sucesso.

**Produto — GateAlertService (`modules/gate-alerts`, novo)**
- A API publica no ttfy ao `PickupService.join`: tópico
  `tutorpass-<schoolId>-portaria`, título "Portaria — tutor chegou",
  corpo enxuto SEM nomes (LGPD: "Tutor entrou na fila de retirada ·
  <portão>") — o detalhe fica nas telas internas. Publicação
  fire-and-forget que nunca lança nem atrasa a fila; sem `NTFY_BASE_URL`,
  o serviço nasce desligado. Compose da API ganhou `NTFY_BASE_URL`/
  `NTFY_TOKEN`. O celular da portaria assina o tópico da escola no app
  ntfy (Android pleno; iOS via relay).

**Verificação** — Jest **499/499** (41 suítes, +4 do gate-alert) e
`next build` OK antes do push; deploys de `6e64cde` (kit) e `387a0ba`
(gate-alert + analytics + volume) concluídos pelo auto-deploy. Ao vivo:
site/cadastro/telão 200, script do Umami presente na home, Dozzle
401 sem senha e 200 com, backup `tutorpass-20261117.sql.gz` gravado no
volume, publicação ntfy OK, stack inteira (10 containers) em ~600 MB de
RAM dos 4 GB. Prova ao vivo do join → ntfy depende de uma escola real na
API (junto do teste do cadastro, pendente de aprovação do usuário).

## 2026-11-17 14:22–14:40 — Cadastro completo (pedido do usuário) + telão com design único

**Contexto** — o usuário perguntou como alguém se cadastra e a checagem
confirmou um furo: não existia página de cadastro, o botão "Criar conta
grátis" dos planos caía no login, não havia rota de criar escola e os
dados viviam só em memória (um cadastro se perderia a cada deploy). Ele
mandou fazer o cadastro completo na hora; a rotina de UI foi pausada
durante o trabalho p/ não escrever no mesmo diretório.

**Implementado**
- **Persistência da espinha de identidade (Step 2 parcial)** — `User` e
  `SchoolMember` (AuthService) e `School` (RosterService) agora persistem
  no Postgres: hidratação no boot (`onModuleInit`) + write-through de cada
  mutação pela fila serial nova `PrismaService.enqueueWrite` (falha de
  escrita é logada, nunca derruba o pedido). Injeção do Prisma é
  `@Optional` — os testes unitários seguem 100% em memória. Refresh
  tokens, lockout, 2FA e as demais entidades (turmas/alunos/tutores,
  pickup etc.) seguem em memória: um restart pede login novo, mas conta
  e escola sobrevivem. `RosterService.createSchool` passou a gerar UUID
  (o `School.id` do schema é uuid); `SchoolMember.classroomId` persiste
  null nesta etapa (o FK exige a sala persistida — ela ainda é memória).
- **POST /api/schools** (`modules/schools`, novo) — com o access token da
  sessão "sem escola", cria a escola e vincula o criador como ADMIN. Só
  JwtAuthGuard (a rota CRIA o tenant; TenantGuard não se aplica). O
  cliente refaz o login com o schoolId p/ a sessão nascer completa pelo
  fluxo normal (cookie de refresh incluso).
- **Página /cadastro** — formulário (escola, nome, e-mail, senha) que faz
  register → login → criar escola → login com a escola, salva a sessão e
  mostra a tela de sucesso. Erros da API aparecem no formulário; e-mail
  duplicado oferece o caminho do login. CTAs corrigidos: os 3 botões de
  planos, o CTA fantasma do hero, a topbar/rodapé ("Criar conta") e o
  rodapé do login apontam p/ /cadastro.
- **Telão com design único** (pedido do usuário no meio do trabalho) —
  deixou de ser "página do admin em modo escuro": palco em tela cheia
  (cobre topbar/rodapé), gradiente verde-profundo próprio, marca + relógio
  ao vivo com data, selo de status (Ao vivo/Conectando/Sem conexão),
  painel "Pode retirar agora" em verde aceso com o item mais recente
  destacado (selo AGORA pulsante), painel "A caminho" calmo com chip de
  ETA, contadores por painel, estados vazios serenos e rodapé com
  orientação à família. Só apresentação: o hook da fila não mudou.

**Verificação** — Jest **495/495** (40 suítes; +3 arquivos novos:
schools.controller, auth-persistence e roster-persistence provando o
fluxo de cadastro e a sobrevivência a "restart" via hidratação), `tsc`
limpo e `next build` OK (6 rotas, /cadastro nova). Teste ao vivo pós-
deploy registrado abaixo nesta entrada quando concluído.

**Próximo** — rotina de UI retoma (fila: login → portaria → planos →
estados vazios/erro → mobile). Step 2 restante: persistir roster
completo, pickup, refresh tokens e 2FA.

## 2026-11-17 13:54–14:29 — Sinalizar saída não reconhecida (ciclo 30)

**Pesquisa do ciclo (frente c — UX/design de painéis e apps de fila)**
- **NIS Dismissal (Dubai, 2024, 784 alunos, 3 zonas)**: "uma exceção trava
  a fila inteira" era o problema — um veículo não cadastrado parava todas
  as famílias atrás dele; a correção foi o registro paralelo (a fila
  continua enquanto a exceção é resolvida à parte). É o princípio aplicado
  na implementação: contestar uma saída NUNCA trava a portaria nem reverte
  a liberação — corre em paralelo, via incidente + fila do DPO.
- **Technothera Smart Dismissal (2026)**: 4 interfaces sincronizadas, selo
  ARRIVED que pulsa em todas as telas e contagem regressiva por pedido —
  o refinamento é o mesmo padrão p/ a contestação (badge "CONTESTADA"
  pulsante no painel e no telão, fase 2 deste item).
- **Positive Proof — alerta de guarda/restrição (2026)**: os tribunais NÃO
  avisam a escola quando a guarda muda; a lista de quem pode buscar fica
  desatualizada mais rápido que o papel acompanha, e houve condenação por
  liberar p/ pessoa não autorizada. A resposta é o alerta no ponto de
  contato, antes da liberação — o nosso bloqueio é por aluno, não por
  pessoa: promovido ao BACKLOG como próxima candidata (Impacto 4, Esforço 3).
- **School'sOut (pesquisa UX)**: o responsável compartilha o código com um
  familiar p/ autorizar a retirada — valida a nossa autorização temporária
  + tag impressa.
- Achados novos registrados em `docs/product/IDEAS.md` (seção frente c,
  ciclo 30); promovido ao BACKLOG: **alerta de guarda/restrição na
  portaria** (Impacto 4, Esforço 3). A ideia implementada foi a do BACKLOG:
  **sinalizar saída não reconhecida** (Impacto 4, Esforço 2 — Elo Saída,
  ciclo 29).

**O que foi feito**
- **UnrecognizedReleaseService** (`apps/api/src/modules/disputes/release-dispute.service.ts`,
  novo): o tutor contesta um evento RELEASED do PickupLog em até 24 h após
  a liberação (`DISPUTE_WINDOW_HOURS`), com snapshot da saída (quem
  retirou, hora, portão — só ids e hora, nunca nome/foto). Contestar ABRE
  um incidente de segurança (`UNAUTHORIZED_ACCESS`, risco relevante, 1
  titular afetado — o relógio ANPD de 3 dias úteis começa). 1 contestação
  por liberação, para sempre (409 na segunda). Apuração pela escola
  (`resolve`): LEGITIMATE (engano — era autorizado) ou UNRECOGNIZED
  (confirmado — a contestação escala e o incidente segue aberto p/ o DPO),
  com nota obrigatória que vai p/ o incidente. `listOpenForSchool` é a
  fila da secretaria/DPO; `addNote` p/ o andamento; log append-only com
  hash encadeado por contestação + `verifyChain`. A contestação NÃO trava
  a fila nem reverte a liberação. `DisputesModule` exporta o serviço;
  README do módulo e `docs/01-arquitetura.md` atualizados.
- **Controller REST** (`disputes.controller.ts`, novo):
  `/api/disputes/schools/:schoolId/*` com JwtAuthGuard + TenantGuard +
  @Roles — 8 rotas: report (TUTOR), open, get, notes, events e
  verify-chain (ADMIN/COORDINATOR), students/:studentId/release-disputes
  (TUTOR + staff); 3 DTOs com class-validator.
- **Schema Prisma** (`apps/api/prisma/schema.prisma`): enum
  `ReleaseDisputeStatus` + modelos `ReleaseDispute` (com
  `releaseLogId @unique` — 1 contestação por liberação) e
  `ReleaseDisputeEvent`, com os campos opostos em `School`/`Student`;
  `prisma validate`: **schema válido**.

**Arquivos alterados**
- `apps/api/src/modules/disputes/release-dispute.service.ts` (novo)
- `apps/api/src/modules/disputes/release-dispute.service.spec.ts` (novo, 16 testes)
- `apps/api/src/modules/disputes/disputes.controller.ts` (novo)
- `apps/api/src/modules/disputes/disputes.controller.spec.ts` (novo, 6 testes)
- `apps/api/src/modules/disputes/dto/*.dto.ts` (novos, 3 DTOs)
- `apps/api/src/modules/disputes/disputes.module.ts` (novo)
- `apps/api/src/modules/disputes/README.md` (novo)
- `apps/api/src/app.module.ts` (+ DisputesModule)
- `apps/api/src/app.module.spec.ts` (+ resolve UnrecognizedReleaseService)
- `apps/api/prisma/schema.prisma` (+ `ReleaseDispute`, `ReleaseDisputeEvent`, enum, campos opostos)
- `docs/01-arquitetura.md` (linha do módulo disputes)
- `docs/product/IDEAS.md` (seção frente c, ciclo 30), `BACKLOG.md`

**Verificação**
- `node node_modules/jest/bin/jest.js --config jest.config.js` na API:
  **37 suítes, 489/489 testes passando** (467 anteriores + 22 novos:
  contestação com snapshot + incidente, log não-RELEASED, log
  desconhecido/outro aluno, janela de 24 h (dentro e fora), duplicata
  409, motivo > 500, resolve LEGITIMATE/UNRECOGNIZED, apuração de
  contestação fechada, nota vazia, resultado inválido, anotações, fila
  da secretaria, cadeia adulterada → verify-chain false; controller:
  fluxo completo, 404, 409, resolve com resolvedBy do token, notas).
  Sem regressão.
- `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`:
  **exit 0, sem erros**.
- **Reverificação após a mescla com o fio principal (14:31)**: o trabalho
  "Cadastro completo" (SchoolsModule, POST /schools) entrou na árvore
  depois da 1ª verificação — suíte rodada de novo sobre a árvore mesclada:
  **40 suítes, 495/495 testes passando** (489 + 6 novos do outro fio),
  `tsc --noEmit` limpo. Nenhum conflito com o DisputesModule (os dois
  módulos coexistem no AppModule).
- `prisma validate` (via `pnpm dlx prisma@5.22.0`, com `DATABASE_URL`
  fictício só p/ a validação): **schema válido**. A 1ª validação achou 1
  erro real meu — faltava o campo oposto `releaseDisputes` em `Student`
  — corrigido antes de fechar o ciclo.
- Limitação: sem Postgres nem Redis ao vivo neste sandbox (sem docker),
  então não houve boot real da API nem migração — a persistência Prisma
  (troca do store in-memory) continua sendo Step 2.

**Observação — ciclo UI paralelo**: enquanto este ciclo rodava, outro
processo executou o "Ciclo UI 1" (14:07–14:15, pedido do usuário,
redesign da home + base visual em `apps/web` apenas) e atualizou o cron
p/ os próximos ciclos seguirem a linha de UI/UX. Este ciclo seguiu o
procedimento padrão do corpo da tarefa (a candidata do BACKLOG), e o
trabalho de UI não tocou a API — a verificação acima continua válida.

**Próximo item sugerido**: **alerta de guarda/restrição na portaria**
(Impacto 4, Esforço 3 — novo, ciclo 30: bloqueio por pessoa + sinal na
validação do QR quando alguém com restrição tenta retirar) ou **login de
tutor por SMS** (Impacto 4, Esforço 3) ou **código de conexão do
responsável por QR** (Impacto 3, Esforço 2) — ressalva: o cron foi
redirecionado p/ UI/UX no Ciclo UI 1; se a linha de UI continuar, o
próximo ciclo é o da fila UI (login, portaria, telão, planos).

---

## 2026-11-17 14:07–14:15 — Ciclo UI 1 (pedido do usuário): redesign da home + base visual

**Contexto** — o usuário redirecionou a rotina de melhoria contínua (30 min)
para UI/UX: sistema "muito mais caprichado", com base em boas práticas de
front-end. Este é o primeiro ciclo do novo foco, executado na hora a pedido
dele; o cron foi atualizado para os próximos ciclos seguirem a mesma linha.

**Implementado**
- **Home nova** (`apps/web/app/page.tsx`): hero com gradiente da marca,
  badge, headline, 2 CTAs e linha de provas (QR dinâmico · implantação em
  1 dia · grátis até 30 alunos); seção "Como funciona" em 3 passos;
  grade de 6 recursos com ícones SVG próprios (QR anti-fraude, geofencing,
  auditoria imutável, fila em tempo real, LGPD, telão/tag impressa);
  "Acesso rápido" (Entrar/Portaria/Telão) com ícones; faixa final de
  preços com os valores confirmados (89/199/349). Saiu o texto "versão web
  mínima" e a grade 4-em-3 que quebrava torta.
- **Base visual** (`globals.css` + `layout.tsx`): fonte Inter
  (next/font), tokens novos (sombras, raio, tinta da marca), topbar fixa
  com blur e logotipo com marca SVG (escudo), rodapé com navegação,
  botões com transição/hover/foco visível, inputs com foco em anel da
  marca, cards com sombra suave e hover nos recursos. Login, portaria,
  telão e planos herdam a base automaticamente.

**Verificação** — `next build` OK (tipos válidos, 5 rotas geradas).
Deploy: push à main → auto-deploy do VPS (timer systemd).

**Próximo (fila UI)** — login (layout centralizado com marca e estados),
portaria (hierarquia da fila, status e ações), telão (tipografia TV),
planos (cards com destaque e calculadora), micro-interações e revisão
mobile de todas as telas.

## 2026-11-17 13:24–13:45 — Exercício de direitos do titular (art. 18/19 LGPD)

**Pesquisa do ciclo (frente b — concorrentes Brasil)**
- **Elo Saída é concorrente novo (out/2026, elosaida.com.br)**: sistema só
  de saída em 3 passos — Autorizar (quem busca, por quanto tempo, com foto
  → QR pass), Verificar (portão confere rosto, documento e placa) e
  Notificar (alerta instantâneo "Pedro saiu" com hora, portão e pessoa — e
  o tutor pode sinalizar uma saída NÃO reconhecida). Extras: vans com QR
  pass, aluno que sai sozinho com permissão agendada, alertas de restrição
  e offline. Piloto grátis de 30 dias, sem hardware, sem biometria facial
  obrigatória. É o concorrente mais próximo da nossa tese — e o passo
  "sinalizar saída não reconhecida" é o refinamento que nos falta.
- **Inoutchi (atual. 04/11/2026) valida a nossa tag impressa**: token de uso
  único ou por período, QR ou código de 6 dígitos; recusa invalida o token
  e avisa o responsável — exatamente PrintedTagService +
  TemporaryAuthorizationService. O roteiro de implantação deles é de 72 h;
  o nosso é de 1 dia — velocidade de implantação é o argumento de venda.
- **GoHome é hardware-pesado** (tags veiculares, RFID, biometria, facial,
  totem + tela smart; 456.122 alunos controlados): o nosso "sem hardware
  obrigatório" é o contraponto p/ a escola pequena — frase de venda, não
  código.
- **School Guardian virou suíte** (facial, IA p/ brigas, botão de pânico,
  GPS de ônibus, LPR; usado por Escola Eleva, Colégio Arcádia e Sanfra) —
  reforça a tese: ser o melhor SÓ em saída. **Agenda Edu adicionou "Saída
  Inteligente"** (Instituto Dom Barreto, out/2026): o incumbente que já
  está dentro da escola adiciona a saída como módulo raso — a defesa é
  profundidade (QR dinâmico, auditoria imutável, fila por proximidade).
- Achados novos registrados em `docs/product/IDEAS.md` (seção frente b,
  ciclo 29), incl. a ideia nova **sinalizar saída não reconhecida**
  (Impacto 4, Esforço 2 — próxima candidata). A ideia implementada foi a
  do BACKLOG: **exercício de direitos do titular (art. 18)** (Impacto 4,
  Esforço 3).

**O que foi feito**
- **DataSubjectRequestService** (`apps/api/src/modules/data-subject-requests/data-subject-request.service.ts`,
  novo): exercício dos direitos do art. 18 pelo painel do admin — 8 tipos
  (ACCESS, CORRECTION, ANONYMIZATION, BLOCKING, ERASURE, PORTABILITY,
  SHARING_INFO, CONSENT_REVOCATION); dois prazos do art. 19 — acesso
  simplificado IMEDIATO (`provideSimplifiedAccess`, só p/ ACCESS e só
  depois da identidade verificada; sem ele o ACCESS não pode ser atendido)
  e declaração completa em 15 dias corridos (`dueAt`); identidade
  verificada antes de qualquer entrega (OPEN → IDENTITY_VERIFIED →
  IN_PROGRESS — pedido sem verificação não anda); ERASURE/ANONYMIZATION
  só aceitam PARTIAL e carregam `retainedByLegalObligation` com as
  categorias do art. 16 (PickupLog, logs de auditoria, consentimentos e
  incidentes — nunca apagados); 1 pedido ativo por titular + tipo; nota
  de atendimento obrigatória (é a resposta ao titular); negação com
  motivo; cancelamento e anotações; `listOverdue` (fila do DPO) +
  `listSimplifiedAccessPending` (o "imediato" pendente); log append-only
  com hash encadeado e `verifyChain`. `DataSubjectRequestsModule` exporta
  o serviço; README do módulo e `docs/01-arquitetura.md` atualizados.
- **Controller REST** (`data-subject-request.controller.ts`, novo):
  `/api/data-subject-requests/schools/:schoolId/*` com JwtAuthGuard +
  TenantGuard + @Roles — 12 rotas, só ADMIN/COORDINATOR (a escola é a
  controladora; a portaria não abre nem atende pedidos de direitos), 5
  DTOs com class-validator.
- **Schema Prisma** (`apps/api/prisma/schema.prisma`): enums
  `DataSubjectRequestType` / `DataSubjectType` /
  `DataSubjectRequestStatus` + modelos `DataSubjectRequest` e
  `DataSubjectRequestEvent`, com o campo oposto `dataSubjectRequests` em
  `School`; `prisma validate`: **schema válido**.

**Arquivos alterados**
- `apps/api/src/modules/data-subject-requests/data-subject-request.service.ts` (novo)
- `apps/api/src/modules/data-subject-requests/data-subject-request.service.spec.ts` (novo, 21 testes)
- `apps/api/src/modules/data-subject-requests/data-subject-request.controller.ts` (novo)
- `apps/api/src/modules/data-subject-requests/data-subject-request.controller.spec.ts` (novo, 6 testes)
- `apps/api/src/modules/data-subject-requests/data-subject-request.module.ts` (novo)
- `apps/api/src/modules/data-subject-requests/dto/*.dto.ts` (novos, 5 DTOs)
- `apps/api/src/modules/data-subject-requests/README.md` (novo)
- `apps/api/src/app.module.ts` (+ DataSubjectRequestsModule)
- `apps/api/prisma/schema.prisma` (+ `DataSubjectRequest`, `DataSubjectRequestEvent`, enums, campo oposto)
- `docs/01-arquitetura.md` (linha do módulo data-subject-requests)
- `docs/product/IDEAS.md` (seção frente b, ciclo 29; art. 18 marcado como implementado), `BACKLOG.md`

**Verificação**
- `node node_modules/jest/bin/jest.js --config jest.config.js` na API:
  **35 suítes, 467/467 testes passando** (440 anteriores + 27 novos:
  abertura, prazo de 15 dias, duplicata, verificação de identidade,
  acesso simplificado, atendimento, retenção do art. 16, negação,
  cancelamento, filas do DPO, cadeia de hash; controller: fluxo completo,
  ERASURE PARTIAL, filas, negação, log).
- `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`:
  **exit 0, sem erros**.
- `prisma validate` (binário do store pnpm, `prisma@5.22.0` — o `pnpm`
  não está no PATH deste sandbox e o `npx` não resolve o pacote):
  **schema válido**. A 1ª rodada de testes achou 1 erro real meu — o
  controller usa JwtAuthGuard e o módulo não importava o AuthModule —
  corrigido antes de fechar o ciclo (padrão dos módulos pickup/onboarding).
- Limitação: sem Postgres nem Redis ao vivo neste sandbox (sem docker),
  então não houve boot real da API nem migração — a persistência Prisma
  (troca do store in-memory) continua sendo Step 2.

**Próximo item sugerido**: **login de tutor por SMS** (Impacto 4, Esforço 3
— tutores entram por código no celular, sem senha; falta o provedor de
SMS no Step 2) ou **sinalizar saída não reconhecida** (Impacto 4, Esforço 2
— novo, ciclo 29: o tutor contesta a saída na notificação e abre um
incidente) ou **código de conexão do responsável por QR** (Impacto 3,
Esforço 2 — novo, ciclo 28).

---

## 2026-11-17 12:55–13:03 — Tag/cartão impresso p/ delegado sem smartphone

**Pesquisa do ciclo (frente a — concorrentes internacionais: car tags + LPR)**
- A car tag é a resposta oficial do PikMyKid p/ quem não tem smartphone
  (pikmykid.com/parent-support, 2026): "The school will provide you with a
  car tag... The car tag will have the student's name, teacher, and school
  dismissal ID" — vai no para-brisa, o staff lê o QR e o delegado anuncia
  a chegada sem app. Escolas chegam a exigir a tag de todos os motoristas
  ("IT IS THE SAFEST WAY FOR OUR DISMISSAL TO HAPPEN" — Peck Place,
  ago/2026). O PickUp Patrol gera e imprime car line tags e bus passes
  direto na plataforma (pickuppatrol.net).
- CENTEGIX ampliou a plataforma em 07/10/2026 (wisevoter.com): PikMyKid
  integrada como "CENTEGIX Dismissal" junto a visitantes, hall passes,
  alertas vestíveis e reunificação — 18 mi de pessoas, 18 mil locais.
  Valida a tese: o mercado vai p/ suite de segurança; o TutorPass vence
  sendo o melhor SÓ em saída.
- LPR / leitura de placa (PLACA.AI LineCam, placa.ai, out/2026): câmera
  solar lê a placa, casa com o roster e enfileira o aluno antes do carro
  chegar — US$ 99/mês por câmera + US$ 949 de hardware; PikMyKid
  (US$ 3.750/ano) é só software e "não tira o gargalo". No Brasil, o
  equivalente sem hardware é a nossa tag com código + QR — LPR segue fase 2.
- Achados novos registrados em `docs/product/IDEAS.md` (seção frente a,
  ciclo 28), incl. duas ideias novas: **código de conexão do responsável
  por QR** (Impacto 3, Esforço 2 — próxima candidata) e **reset anual do
  plano de saída** (Impacto 2, Esforço 1 — detalhe p/ o DismissalPlanService).
  A ideia implementada foi a do BACKLOG: **tag/cartão impresso**
  (Impacto 3, Esforço 2).

**O que foi feito**
- **PrintedTagService** (`apps/api/src/modules/delegations/printed-tag.service.ts`,
  novo): emissão da tag p/ o delegado — código de 6 dígitos
  (`crypto.randomInt`) + QR com o mesmo código
  (`TUTORPASS-TAG:<schoolId>:<código>`); a portaria digita ou escaneia,
  com a mesma validação nos dois casos (`check` / `checkQrPayload`).
  Validade padrão 1 dia, máx. 30; uso único por padrão, multiuso dentro
  da janela; código único entre as tags ativas da escola (sorteio com
  retry); sem sobreposição p/ mesmo delegado + aluno; anti-brute-force —
  5 tentativas erradas travam o código por 15 min; recusa na portaria
  (documento não confere) invalida a tag de vez (REFUSED, com motivo
  obrigatório) e devolve `notifyTutorId` p/ avisar o responsável (o
  controller dispara a notificação no Step 2); revogação idempotente;
  `refresh()`/`refreshAll()` marcam EXPIRED (job diário, junto ao expurgo
  LGPD); `listActiveForStudent` p/ a portaria. `DelegationsModule` exporta
  o serviço; README do módulo e `docs/01-arquitetura.md` atualizados.
- **Schema Prisma** (`apps/api/prisma/schema.prisma`): modelos `PrintedTag`
  + `PrintedTagStudent` + enum `PrintedTagStatus` (ACTIVE/USED/REVOKED/
  REFUSED/EXPIRED), com os campos opostos em `School`/`Tutor`/`Student`
  (`printedTags`); `code` documentado p/ virar hash no Step 2 (como os
  recovery codes do 2FA).

**Arquivos alterados**
- `apps/api/src/modules/delegations/printed-tag.service.ts` (novo)
- `apps/api/src/modules/delegations/printed-tag.service.spec.ts` (novo, 16 testes)
- `apps/api/src/modules/delegations/delegations.module.ts` (+ provider/export)
- `apps/api/src/modules/delegations/README.md` (seção da tag)
- `apps/api/prisma/schema.prisma` (+ `PrintedTag`, `PrintedTagStudent`, `PrintedTagStatus`, campos opostos)
- `docs/01-arquitetura.md` (linha do módulo delegations)
- `docs/product/IDEAS.md` (seção frente a, ciclo 28), `BACKLOG.md`

**Verificação**
- `node node_modules/jest/bin/jest.js --config jest.config.js` na API:
  **33 suítes, 440/440 testes passando** (424 anteriores + 16 novos: emissão,
  validação, sobreposição, unicidade do código, uso único/multiuso, QR,
  recusa, revogação, expiração, brute-force, lista por aluno).
- `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`:
  **exit 0, sem erros**.
- `prisma validate` (via `pnpm dlx prisma@5.22.0`, com `DATABASE_URL` fictício
  só p/ a validação): **schema válido**. A 1ª validação achou 3 erros reais
  meus — faltavam os campos opostos `printedTags` em `School`/`Tutor`/
  `Student` — corrigidos antes de fechar o ciclo. O `npx prisma` direto não
  executa neste sandbox ("prisma: not found"); o `pnpm dlx` funciona.
- Limitação: sem Postgres nem Redis ao vivo neste sandbox (sem docker),
  então não houve boot real da API nem migração — a persistência Prisma
  (troca do store in-memory) continua sendo Step 2.

**Próximo item sugerido**: **login de tutor por SMS** (Impacto 4, Esforço 3
— tutores entram por código no celular, sem senha; falta o provedor de
SMS no Step 2) ou **exercício de direitos do titular (art. 18)** (Impacto 4,
Esforço 3 — promovido no ciclo 26) ou **código de conexão do responsável
por QR** (Impacto 3, Esforço 2 — novo, ciclo 28).

---

## 2026-11-17 12:24–12:44 — EventLog em Redis Streams + connection state recovery

**Pesquisa do ciclo (frente f — tecnologia: Redis Streams + recovery)**
- O recovery é opt-in e nem sempre funciona (socket.io docs, 2026): o servidor
  habilita explicitamente (`connectionStateRecovery: { maxDisconnectionDuration }`,
  default 2 min — nada de `Infinity`); na volta, `socket.recovered` diz se deu
  certo; passou da janela, o cliente precisa sincronizar por outro caminho —
  no nosso caso, o catch-up manual (`events.catch_up` + snapshot) continua
  existindo como fallback, não é substituído pelo recovery.
- O adapter de Streams guarda sessão + pacotes no Redis (deepwiki, 2026):
  sessões em `sio:session:{pid}` (MessagePack, TTL = `maxDisconnectionDuration`),
  replay por `XRANGE` (limite de 100 chamadas); o offset vai anexado a cada
  pacote — o cliente precisa ter recebido ao menos 1 evento p/ inicializá-lo.
- `maxLen` do stream do adapter precisa cobrir a janela da sessão (deepwiki/
  Troubleshooting): se o offset for trimado antes da sessão expirar, o restore
  falha com "session or offset not found". ioredis >= 5.3.2 suportado (problemas
  de `GETDEL`/`SET` corrigidos na 0.2.1); usamos a 0.3.1 (latest no npm).
- Cliente 4.6+ recupera sozinho: nosso web usa socket.io-client 4.7.5 e o
  servidor 4.8.4 — ok, sem mudança no cliente.
- Achados registrados em `docs/product/IDEAS.md` (seção frente f, ciclo 27);
  a ideia implementada foi a do BACKLOG: **EventLog em Redis Streams +
  connection state recovery** (Impacto 4, Esforço 3 — fase 2 do item Redis).

**O que foi feito**
- **Adapter trocado** (`apps/api/src/realtime/redis-io.adapter.ts`):
  `@socket.io/redis-streams-adapter@0.3.1` no lugar do clássico
  `@socket.io/redis-adapter` (removido das dependências); 1 cliente ioredis
  em vez de pub+sub (`duplicate()` não é mais necessário); `createIOServer`
  liga `connectionStateRecovery: { maxDisconnectionDuration: 2 min,
  skipMiddlewares: false }` quando o Redis conecta — o JWT é revalidado no
  recovery. Sem Redis, segue o adapter em memória, sem recovery, como antes.
- **EventLog em Streams** (`event-log.store.ts` novo + `redis-streams-event-log.store.ts` novo):
  `EventLogStore` com 2 backends — `MemoryEventLogStore` (o ring buffer de 500,
  extraído sem mudança de comportamento) e `RedisStreamsEventLogStore`
  (Stream `tutorpass:events:{room}` com `MAXLEN ~ 500`, seq por contador
  `tutorpass:events:{room}:seq` via script Lua INCR+XADD atômico, p/ duas
  instâncias não repetirem nem trocarem o seq). `EventLogService` virou async
  (o `await` antes do emit garante que o seq do envelope é o mesmo que ficou
  gravado) e resolve o backend na 1ª chamada: com Redis, Streams; sem, memória.
  Se a Stream falhar, degrada p/ memória **de vez** (nunca mistura os dois
  backends no mesmo processo — senão o seq dividiria e o catch-up perderia
  eventos); o Redis voltando só vale no próximo boot. `RedisService.getClient()`
  novo; `RealtimeModule` importa o `RedisModule`; `RealtimeService` e
  `PickupGateway.onCatchUp` atualizados p/ o contrato async. Docs: `docs/03`,
  `docs/01`, README do Redis e `main.ts`.
- **`pnpm-lock.yaml` gerado**: o projeto não tinha lockfile. O `pnpm install`
  ligou os pacotes mas o EPERM do `chown` abortou antes de gravar o lockfile;
  ele foi gerado depois com `pnpm install --lockfile-only` (420 KB, com o
  adapter 0.3.1 travado e zero referência ao adapter clássico).

**Incidente no meio do ciclo (registrado, sem dano permanente)**: a 1ª tentativa
de instalar o adapter foi com `npm install` em `apps/api` — o npm não entende
o layout pnpm do workspace e **apagou arquivos dentro do store** (o `ts-jest`
perdeu o `dist/` e a suíte parou de rodar: "Preset ts-jest not found"). Lição:
**nunca usar npm dentro deste workspace — só pnpm**. Recuperação: `pnpm install
--force` (via `npx -y pnpm@9.12.0`) re-baixou os pacotes danificados e a suíte
voltou a 418/418 antes de qualquer mudança de código; o `pnpm-lock.yaml` agora
existe e trava as versões. O `pnpm install` termina com um EPERM num `chown`
de `jscodeshift` (sempre no mesmo arquivo, depois do "done") — cosmético, não
impede a instalação nem os testes.

**Arquivos alterados**
- `apps/api/package.json` (+ `@socket.io/redis-streams-adapter@0.3.1`, − `@socket.io/redis-adapter`)
- `pnpm-lock.yaml` (novo, gerado)
- `apps/api/src/realtime/redis-io.adapter.ts` (reescrito: Streams + CSR)
- `apps/api/src/realtime/redis-io.adapter.spec.ts` (+ janela de 2 min, sem CSR sem Redis)
- `apps/api/src/realtime/event-log.store.ts` (novo: interface + `MemoryEventLogStore`)
- `apps/api/src/realtime/redis-streams-event-log.store.ts` (novo)
- `apps/api/src/realtime/event-log.service.ts` (reescrito: async + backend + degradação)
- `apps/api/src/realtime/event-log.service.spec.ts` (async + 5 testes novos de Streams/degradação)
- `apps/api/src/realtime/realtime.service.ts` (emit async)
- `apps/api/src/realtime/realtime.service.spec.ts` (async)
- `apps/api/src/realtime/pickup.gateway.ts` (`await` no catch-up)
- `apps/api/src/realtime/realtime.module.ts` (+ `RedisModule`)
- `apps/api/src/infra/redis/redis.service.ts` (+ `getClient()`)
- `apps/api/src/infra/redis/README.md` (adapter + EventLog + o que falta)
- `apps/api/src/main.ts` (comentário), `docs/01-arquitetura.md`, `docs/03-realtime-geofencing.md`
- `docs/product/IDEAS.md` (seção frente f, ciclo 27), `BACKLOG.md`

**Verificação**
- `node node_modules/jest/bin/jest.js --config jest.config.js` na API:
  **32 suítes, 424/424 testes passando** (418 anteriores + 6 novos:
  catch-up entre 2 instâncias com store compartilhado, seq que continua na
  2ª instância, trim com gap na Stream, degradação p/ memória sem quebrar a
  emissão, janela de recovery 2 min; 1ª rodada: 1 suíte falhou por erro de
  tipo no adapter — spread de `ServerOptions | undefined` alarga as props;
  corrigido com cast no objeto já tipado). Sem regressão.
- `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`:
  **exit 0, sem erros**.
- Smoke: `createAdapter` do pacote novo aceita o cliente ioredis 5.11.1
  (adaptador criado sem erro; o `Connection is closed` no fim do script é o
  `disconnect()` do cliente de teste, esperado).
- Limitação: sem Postgres nem Redis ao vivo neste sandbox (sem docker), então
  não houve boot real da API nem teste contra Redis de verdade — os testes
  usam cliente falso; o recovery fim-a-fim (cliente cai 30 s e volta com os
  pacotes) só se prova com Redis + 2 instâncias no deploy.

**Próximo item sugerido**: **login de tutor por SMS** (Impacto 4, Esforço 3
— tutores entram por código no celular, sem senha; falta o provedor de
SMS no Step 2) ou **tag/cartão impresso p/ delegado sem smartphone**
(Impacto 3, Esforço 2 — com código de 6 dígitos + QR) ou **exercício de
direitos do titular (art. 18)** (Impacto 4, Esforço 3 — promovido no ciclo 26).

---

## 2026-11-17 11:59–12:08 — Kit de deploy em VPS pronto (fio de deploy)

**Contexto**: usuário escolheu o caminho VPS (Hostinger KVM 1) em vez do
grátis (Render/Neon/Upstash/Vercel). Preparado tudo p/ o deploy ser um
único `docker compose up` quando o VPS existir.

**O que foi feito**
- `docker-compose.prod.yml`: postgres + redis (só rede interna, com
  senha) + api + web + **caddy** como única porta pública (80/443),
  roteando `/api/*` e `/socket.io/*` p/ a API (ver `Caddyfile`).
- `apps/web/Dockerfile` (novo) + `output: 'standalone'` no
  `next.config.mjs`; `NEXT_PUBLIC_API_URL` entra como build ARG (a
  origem pública é embutida no bundle).
- `.env.production.example` (4 segredos + SITE_ADDRESS/PUBLIC_ORIGIN;
  IP puro no 1º boot, domínio liga o HTTPS automático do Caddy) e
  `.env.production` adicionado ao `.gitignore`.
- `docs/05-deploy-vps.md`: runbook completo (instalar Docker, clonar,
  subir, criar a 1ª escola pelo registro — o seed demo recusa
  NODE_ENV=production —, domínio/HTTPS, backup e segurança mínima).

**Verificação**: `next build` OK com standalone gerado
(`.next/standalone/server.js`); YAML dos dois compose válido. Sem Docker
neste sandbox — o build das imagens só se prova no VPS.

**Pendente**: enviar este lote + o ciclo 25 ao GitHub (aguardar o fim do
ciclo 26 p/ não capturar arquivo em edição); deploy em si aguarda o
usuário contratar o VPS e passar o acesso.

---

## 2026-11-17 11:55–12:15 — Checklist de implantação em 1 dia + escola demo que zera

**Pesquisa do ciclo (frente e — segurança/LGPD: direitos do titular, art. 18/19)**
- Dois prazos, não um (art. 19, fontes nov/2026): confirmação da existência
  do tratamento + acesso em formato simplificado são IMEDIATOS; a
  declaração completa (origem, critérios, finalidade) tem até 15 dias. O
  pedido é gratuito (art. 18, §5º).
- Pedido de acesso é vetor de ataque: as fontes repetem que a empresa pode
  (e deve) confirmar a identidade do requerente antes de entregar — um
  pedido atendido sem verificação vira vazamento com protocolo.
- Eliminação nem sempre é possível (art. 16): dado guardado por obrigação
  legal não se apaga — e o nosso PickupLog/auditoria com hash encadeado é
  exatamente esse caso; a resposta precisa dizer O QUE foi apagado e O QUE
  foi mantido, com o fundamento.
- Escola é controladora, TutorPass é operadora (art. 5º, VI e VII): o
  padrão das plataformas escolares (NedEducação, 30/10/2026) é o titular
  exercer o direito com a escola OU com a plataforma, que encaminha à
  escola — o TutorPass nunca decide sozinho sobre dado de aluno.
- Achados registrados em `docs/product/IDEAS.md` (seção frente e, ciclo
  26); promovido ao BACKLOG: **exercício de direitos do titular (art. 18)
  pelo painel do admin** (Impacto 4, Esforço 3). A ideia implementada foi
  a do BACKLOG: **checklist de implantação em 1 dia + escola demo que
  zera** (promovida no ciclo 25).

**O que foi feito**
- `OnboardingService` + `OnboardingModule` (`apps/api/src/modules/onboarding/`):
  4 passos na ordem do runbook — conta (3 min) → roster CSV (15 min) →
  convite do staff (5 min) → primeira saída (30 min), total 53 min;
  `getChecklist` devolve progresso %, próximo passo (primeiro aberto, na
  ordem), minutos restantes e `isComplete`; marcar é idempotente (re-marcar
  não duplica o evento), reabrir é explícito e fica registrado; cada ação
  guarda quem fez (`actorId` = `user.sub`) e quando; `listEvents` é o
  rastro só com ids, sem dado pessoal.
- Escola demo que zera: `markAsDemo` + `resetDemo` — o reset recusa
  qualquer escola que não esteja marcada como demo (400), p/ nunca apagar
  o progresso real de implantação de um cliente; o job diário das 06:00
  (Step 2) chama o reset na demo.
- `OnboardingController` (`onboarding/schools/:schoolId/*`, 5 rotas) com
  JwtAuthGuard + TenantGuard + @Roles: `GET checklist` (gestão + portaria
  + sala), `POST steps/:step/complete` e `reopen` (ADMIN/COORDINATOR),
  `POST demo/mark` e `demo/reset` (só ADMIN); passo desconhecido vira 400
  com a lista de passos válidos.
- `docs/product/ONBOARDING-1-DIA.md` (novo): runbook do dia 1 hora a hora,
  o que pode dar errado (CSV, duplicata, 2FA, saída manual), a demo (seed)
  como antídoto da tela em branco e o que NÃO está no dia 1 (SIS, billing,
  app mobile).
- `BACKLOG.md` (checklist concluído; art. 18 promovido como próxima
  candidata); `IDEAS.md` (seção frente e, ciclo 26).

**Arquivos alterados**
- `apps/api/src/modules/onboarding/onboarding.service.ts` (novo)
- `apps/api/src/modules/onboarding/onboarding.service.spec.ts` (novo, 10 testes)
- `apps/api/src/modules/onboarding/onboarding.module.ts` (novo)
- `apps/api/src/modules/onboarding/onboarding.controller.ts` (novo)
- `apps/api/src/modules/onboarding/onboarding.controller.spec.ts` (novo, 5 testes)
- `apps/api/src/modules/onboarding/README.md` (novo)
- `apps/api/src/app.module.ts` (+ OnboardingModule)
- `apps/api/src/app.module.spec.ts` (+ resolve OnboardingService)
- `docs/product/ONBOARDING-1-DIA.md` (novo)
- `docs/product/IDEAS.md` (seção frente e, ciclo 26), `BACKLOG.md`

**Verificação**
- `node node_modules/jest/bin/jest.js --config jest.config.js` na API:
  **32 suítes, 418/418 testes passando** (403 anteriores + 15 novos:
  checklist 0/4 e 53 min, 4/4 = 100% sem próximo passo, marcar fora de
  ordem, idempotência sem duplicar evento, passo desconhecido → 400,
  reabrir, reset recusado em não-demo, demo marca/completa/zera mantendo
  isDemo, eventos isolados por escola; controller: checklist, complete com
  actorId do token, 400 propagado, reopen, demo/reset). Sem regressão.
- `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`:
  **exit 0, sem erros**.

**Próximo item sugerido**: **login de tutor por SMS** (Impacto 4, Esforço 3
— tutores entram por código no celular, sem senha; falta o provedor de
SMS no Step 2) ou **tag/cartão impresso p/ delegado sem smartphone**
(Impacto 3, Esforço 2 — com código de 6 dígitos + QR) ou **EventLog em
Redis Streams + connection state recovery** (Impacto 4, Esforço 3) ou
**exercício de direitos do titular (art. 18)** (Impacto 4, Esforço 3 —
promovido neste ciclo).

## 2026-11-17 11:25–11:45 — Irmãos em portões diferentes sinalizados na fila

**Pesquisa do ciclo (frente d — modelo de negócio/preço/onboarding de SaaS escolar)**
- DismissPro (2026): começar em 4 passos — cadastro em ~1 min, subir a
  planilha (template CSV), compartilhar School ID + senha do staff, abrir
  no navegador sem instalar nada; demo pública que zera toda manhã.
- YESS (2026): "Abra sua escola em 24 horas" em 5 passos testados com
  escolas reais — cadastro em 3 min com o tenant já todo ligado, staff com
  credencial impressa, alunos por formulário/admissão (com busca de irmãos)
  e o painel mostrando os módulos ligados antes de qualquer dado; admite o
  que falta ("o importador em massa ainda não foi construído").
- Beanstack (2026): implantação guiada — a equipe importa o roster
  (Clever/ClassLink/Google ou CSV) e um gerente de sucesso acompanha do dia
  1; escola pequena não tem TI p/ SIS — o CSV bem feito É a integração dela.
- Attendzy (05/11/2026): "guided setup that gets out of the way" — checklist
  de 4 itens (nomear turma, importar roster, escolher check-in, convidar
  alunos) que some quando acaba; SchoolDay: Onboarding Wizard como padrão.
- Foundation Roster (20/10/2026): "a pior parte do software novo são os
  primeiros 5 minutos" — tela em branco mata a adoção; checklist "Getting
  Started" sempre visível + "nós movemos por você, grátis".
- Achados registrados em `docs/product/IDEAS.md` (seção frente d, ciclo
  25); promovido ao BACKLOG: **checklist de implantação em 1 dia + escola
  demo que zera** (Impacto 4, Esforço 2). A ideia implementada foi a do
  BACKLOG: **sinalizar irmãos em portões diferentes** (promovida no ciclo 24).

**O que foi feito**
- `PickupService.listSiblingGateConflicts(schoolId)`: agrupa as entradas
  ativas por tutor e devolve os tutores com filhos em 2+ portões distintos
  — `{ tutorId, studentIds, gates: [{ gate, studentIds }] }`, ordenado por
  tutorId. A fila única (`gate: null`) conta como um portão: um filho sem
  portão e outro no "Portão A" também é divisão — senão o filho da fila
  única esperaria sem ninguém saber. Cancelado/liberado/bloqueado não
  conta; 2 filhos no mesmo portão não é conflito; outra escola não contamina.
- `GET /pickup/schools/:schoolId/sibling-gate-conflicts` (13ª rota do
  controller; GATE_AGENT/COORDINATOR/ADMIN/TEACHER — a sala também precisa
  saber p/ qual portão mandar cada irmão); `README.md` do módulo com a rota.

**Arquivos alterados**
- `apps/api/src/modules/pickup/pickup.service.ts` (+ `SiblingGateConflict`, `listSiblingGateConflicts`)
- `apps/api/src/modules/pickup/pickup.service.spec.ts` (+ 5 testes)
- `apps/api/src/modules/pickup/pickup.controller.ts` (+ rota, 13ª)
- `apps/api/src/modules/pickup/pickup.controller.spec.ts` (+ 1 teste)
- `apps/api/src/modules/pickup/README.md` (tabela de endpoints)
- `docs/product/IDEAS.md` (seção frente d, ciclo 25), `BACKLOG.md`

**Verificação**
- `node node_modules/jest/bin/jest.js --config jest.config.js` na API:
  **30 suítes, 403/403 testes passando** (397 anteriores + 6 novos:
  conflito com 2 portões, mesmo portão/outro tutor sem conflito, fila
  única + portão nomeado, cancelado some o conflito, outra escola fora +
  ordem por tutorId; controller: rota devolve o conflito). Sem regressão.
  1ª rodada: 2 suítes falharam por erro de sintaxe no spec (uma edição
  tinha engolido o teste de `listGates` e o fecho do describe) — testes
  restaurados, nada mascarado.
- `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`:
  **exit 0, sem erros**.

**Próximo item sugerido**: **checklist de implantação em 1 dia + escola
demo que zera** (Impacto 4, Esforço 2 — promovido neste ciclo) ou
**login de tutor por SMS** (Impacto 4, Esforço 3) ou **tag/cartão
impresso p/ delegado sem smartphone** (Impacto 3, Esforço 2 — com código
de 6 dígitos + QR) ou **EventLog em Redis Streams + connection state
recovery** (Impacto 4, Esforço 3).

## 2026-11-17 11:04–11:16 — Preço por faixas CONFIRMADO + bug isUnder12 (fio de deploy)

**Decisão do usuário (17/11/2026)**: o PRO deixa de ser por aluno
(R$ 2,90/aluno/mês, proposta) e vira mensalidade FIXA por faixa de
alunos — até 50: R$ 89/mês; 51–200: R$ 199/mês; acima de 200: R$ 349/mês
(acima de 1.000, sob consulta). Grátis até 30 alunos mantido.

**O que foi feito**
- `PlanService`: `PRO_PRICE_PER_STUDENT_MONTH_BRL` removido; novas
  `PRO_PRICE_BANDS_BRL` + `proMonthlyPriceBRL(n)`; `monthlyPriceBRL`
  devolve 0 p/ FREE/TRIAL e o valor da faixa p/ PRO; `PlanDefinition`
  sem campo de preço por aluno. Spec: fronteiras das 3 faixas (50/51,
  200/201) + FREE/TRIAL = 0.
- Web: `/planos` (cartão PRO, FAQ e metadados), calculadora (faixa pelo
  nº de alunos, anual = mensal × 12 sem desconto inventado), home e
  `docs/product/PRECOS.md` atualizados; menção no README de van-routes.
- **Bug corrigido (não era desta mudança)**: `ConsentService.isUnder12`
  somava 12 anos com `setFullYear` em hora local e errava a borda em
  1 h por causa do horário de verão (nascido em 16/11/2014, época de
  DST, era dado como <12 no dia do 12º aniversário). Agora compara
  ano/mês/dia em UTC — idade é calendário, não instante. O teste de
  borda existia e estava falhando na suíte.

**Verificação**: suíte completa 397/397, `tsc --noEmit` limpo,
`next build` OK (/, /login, /planos, /portaria, /telao).

---

## 2026-11-17 10:54–11:03 — Múltiplos portões na fila (gate + filtro + contagem)

**Pesquisa do ciclo (frente c — UX/design de painéis e apps de fila)**
- NIS Dismissal (Dubai, 2024, 784 alunos, 3 zonas): portão (traffic
  manager escaneia QR/placa), pátio (loader alinha por prioridade), telão
  com fila numerada legível a 20+ m; estados Queuing → Ready → Dismissed
  são sinais de coordenação, não rótulos — um toque atualiza 4 interfaces.
- RapidDismiss (2026): estação escolhe a área ('Car Loop' vs 'Gate'),
  digita o nº da tag; sala recebe "aluno — Spot 5 — Tag 196 — Car Loop";
  visão "All School" com o local de espera de cada área.
- AuthExit (2026): "Pickup Lanes" — nomear cada faixa como o
  estacionamento funciona; irmãos divididos entre faixas são sinalizados
  no painel; cartões QR gerados em lote p/ a escola inteira.
- SDM/NYOS (2026): cada método de retirada tem seu próprio QR — Driveline,
  Back Walk-Up (portão dos fundos) e Side Walk-Up (portão da frente); o QR
  já diz de qual portão o tutor veio.
- Trellisgo (2026): dashboard por faixa (Lane 1 — Zone A … Lane 4 — Zone
  D) com contagens ao vivo e ETA por família; Technothera/Afaq: selo
  "ARRIVED" pulsa em todas as telas quando o responsável chega.
- Achados registrados em `docs/product/IDEAS.md` (seção frente c, ciclo
  24); promovido ao BACKLOG: **sinalizar irmãos em portões diferentes no
  painel** (Impacto 3, Esforço 2). Fase 2: telão por portão, estação com
  portão fixo, QR do portão com `gate` no token, relatório por portão,
  badge ARRIVED pulsante. A ideia implementada foi a do BACKLOG (Step 2):
  **múltiplos portões na fila** — o item promovido no ciclo 23.

**O que foi feito**
- `PickupService`: entrada ganhou `gate: string | null` (nome livre, como
  a escola chama — "Portão A", "Fundos", "Car Loop"; vazio = fila única);
  `join` normaliza (apara espaços, em branco vira null, > 40 caracteres
  vira 400) e registra o `gate` no log de `QUEUE_JOINED`;
  `listActiveForSchool(schoolId, gate?)` filtra a fila de UM portão;
  `listGates(schoolId)` devolve os portões com fila ativa + contagem, do
  maior p/ o menor (só entradas ativas, só portões nomeados).
- `JoinQueueDto` ganhou `gate?` (`@MaxLength(40)`); controller: `join`
  repassa o `gate`, `GET queue` aceita `?gate=`, novo `GET gates` (staff +
  TEACHER) — 12ª rota do controller.
- Schema Prisma: campo `gate String?` em `PickupQueueEntry` (o
  `pickupPointId` segue como vínculo estruturado se a escola cadastrar
  portões); `README.md` do módulo atualizado (regra + tabela de endpoints).

**Arquivos alterados**
- `apps/api/src/modules/pickup/pickup.service.ts` (+ `gate`, `listGates`)
- `apps/api/src/modules/pickup/pickup.service.spec.ts` (+ 5 testes de portão)
- `apps/api/src/modules/pickup/pickup.controller.ts` (+ `?gate=`, `GET gates`)
- `apps/api/src/modules/pickup/pickup.controller.spec.ts` (+ 1 teste)
- `apps/api/src/modules/pickup/dto/join-queue.dto.ts` (+ `gate?`)
- `apps/api/src/modules/pickup/README.md`
- `apps/api/prisma/schema.prisma` (+ `gate String?`)
- `docs/product/IDEAS.md` (seção frente c, ciclo 24), `BACKLOG.md`

**Verificação**
- `node node_modules/jest/bin/jest.js --config jest.config.js` na API:
  **30 suítes, 396/396 testes passando** (390 anteriores + 6 novos:
  gate guardado/logado, aparo e branco→null, > 40 caracteres → 400,
  filtro por portão, contagem por portão excluindo cancelado; controller:
  join com gate + queue?gate= + gates). Sem regressão.
- `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`:
  **exit 0, sem erros**.
- `prisma validate` (com `DATABASE_URL` dummy só p/ validar — o .env real
  não foi tocado; sem ele o CLI falha em `getConfig`, pré-existente):
  **"The schema is valid"**.

**Observação fora do ciclo (MEMORY.md atualizado por outro processo
durante este ciclo, 17/11/2026)**: o usuário decidiu trocar o preço por
aluno (R$ 2,90) por faixas fixas mensais e **CONFIRMOU os valores**: Grátis
até 30 alunos; R$ 89/mês até 50 alunos; R$ 199/mês de 51 a 200 alunos;
R$ 349/mês acima de 200 alunos (acima de 1.000, sob consulta). Também
criou o repositório GitHub `developergusta/tutorpass` (privado, vazio na
conferência). A página `/planos`, `docs/product/PRECOS.md` e
`PLAN_DEFINITIONS` ainda mostram R$ 2,90/aluno/mês — **não foram
alterados neste ciclo** porque a confirmação chegou enquanto o ciclo já
estava na implementação dos portões e o fio de deploy/preço está ativo no
chat principal; atualizar os três com as faixas confirmadas é o próximo
item prioritário (ou já está sendo feito lá — não duplicar sem checar).

**Próximo item sugerido**: **atualizar o preço p/ as faixas confirmadas**
(Grátis até 30; R$ 89 até 50; R$ 199 de 51–200; R$ 349 acima de 200;
acima de 1.000 sob consulta) em `/planos`, `PRECOS.md` e
`PLAN_DEFINITIONS` — checar antes se o chat principal já fez isso. Depois:
**sinalizar irmãos em portões diferentes no painel** (Impacto 3, Esforço
2 — promovido neste ciclo) ou **login de tutor por SMS** (Impacto 4,
Esforço 3) ou **tag/cartão impresso p/ delegado sem smartphone** (Impacto
3, Esforço 2 — com código de 6 dígitos + QR) ou **EventLog em Redis
Streams + connection state recovery** (Impacto 4, Esforço 3).

## 2026-11-17 10:24–10:40 — Controller REST /api/pickup/* com guards de tenant/RBAC

**Pesquisa do ciclo (frente b — concorrentes Brasil)**
- Cheguei (ClassApp, 2026): app só p/ funcionários, filtro por portaria
  (mais de um portão), responsável só chama o aluno vinculado a ele, aba
  "Entregues" por 2 h e depois só no histórico do admin — nossa fila é por
  escola, sem portão: o filtro por portão é o próximo refinamento.
- Inoutchi (novo, out/2026): entrada + saída com token de uso único ou por
  período, QR **ou código de 6 dígitos** digitado na portaria, recusa que
  invalida o token e avisa o responsável, implantação em até 72 h, sem
  hardware — o código de 6 dígitos refina nossa tag impressa (mais simples
  de imprimir/digitar que QR) e os 72 h reforçam que nosso "1 dia" precisa
  ser verdade no piloto.
- School Guardian (2026): "Estou indo" + a pé/carro, QR pessoal
  intransferível, autorizações permanentes/temporárias com prazo, saída
  antecipada só pelo app em horários fixos, white-label por escola — nosso
  plano de saída + autorização temporária + saída antecipada já cobrem o
  mesmo, com cutoff por escola, não fixo. Crítica na Play Store: exige
  localização sempre ligada — nosso diferencial é geofence só na janela
  da saída, só zona derivada, nunca lat/lng (RoPA 0 dias).
- 18H (2026): botão só libera perto da escola ("ninguém avisa de casa"),
  fila FIFO com foto/turma/ordem de chegada; GoHome: "é só chegar que ele
  é avisado"; ClipEscola: suite ampla (valida a tese por contraste);
  Escola Ágil: facial p/ entrada/saída (biometria sensível + hardware —
  nossa resposta é a tag com código, sem biometria).
- Achados registrados em `docs/product/IDEAS.md` (seção frente b, ciclo
  23); promovida ao BACKLOG: **múltiplos portões na fila** (Impacto 3,
  Esforço 2); a tag impressa ganhou o refinamento do código de 6 dígitos.
  A ideia implementada foi a do BACKLOG (Step 2): **controller REST
  /api/pickup/*** — a superfície HTTP do serviço pronto no ciclo 22.

**O que foi feito**
- `PickupController` (`pickup/schools/:schoolId/*`, 11 rotas) com
  `@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)` na classe (ordem:
  401 → tenant → 403): `join` (TUTOR ou staff da portaria),
  `call`/`validate-qr`/`release` (só staff — ninguém se auto-valida nem
  se auto-libera), `cancel` (tutor ou staff), `queue` (staff + TEACHER),
  `students/:studentId/queue` (tutor + staff + TEACHER), `logs` e
  `logs/verify-chain` (ADMIN/COORDINATOR), `students/:studentId/block` e
  `unblock` (ADMIN/COORDINATOR). O `schoolId` é o `:schoolId` da rota,
  nunca do body; o `staffId` de cada ação é o `user.sub` do token.
- 3 DTOs com class-validator (`JoinQueueDto` com `source` em enum,
  `ValidateQrDto`, `BlockStudentDto` com motivo obrigatório).
- `PickupModule` importa o `AuthModule` (guards exportados) e registra o
  controller; `README.md` do módulo com a tabela de endpoints e a
  pendência documentada: o vínculo usuário ↔ entidade Tutor ainda não
  existe — o TUTOR passa o `tutorId` no body e o guard só confere o
  papel; quando a persistência entrar, resolver o `tutorId` por
  `user.sub` e recusar tutorId alheio (anotado no controller e no README).
- **Limpeza de backlog (observação do ciclo 21, confirmada)**: o item do
  Step 3 "Push notification — refinar p/ dual-path" era duplicado — a
  notificação dual-path já está implementada (NotificationService:
  registro in-app primeiro, push best-effort com retry 3x); item marcado
  como concluído.

**Arquivos alterados**
- `apps/api/src/modules/pickup/pickup.controller.ts` (novo)
- `apps/api/src/modules/pickup/pickup.controller.spec.ts` (novo, 11 testes)
- `apps/api/src/modules/pickup/dto/join-queue.dto.ts` (novo)
- `apps/api/src/modules/pickup/dto/validate-qr.dto.ts` (novo)
- `apps/api/src/modules/pickup/dto/block-student.dto.ts` (novo)
- `apps/api/src/modules/pickup/pickup.module.ts` (+ AuthModule, controller)
- `apps/api/src/modules/pickup/README.md` (endpoints + pendência)
- `docs/product/IDEAS.md` (seção frente b, ciclo 23), `BACKLOG.md`

**Verificação**
- `node node_modules/jest/bin/jest.js --config jest.config.js` na API:
  **30 suítes, 390/390 testes passando** (379 anteriores + 11 novos:
  fluxo completo join→call→validate-qr→release, QR de outro tutor → 401
  + QR_REJECTED, release sem validar → 400, cancel, bloqueio vencendo a
  fila + unblock, FIFO, histórico do aluno, logs + cadeia adulterada →
  verify-chain false; 1ª rodada: 2 erros de tipo — `QrTokenService.issue`
  devolve `{ token, expiresIn }`, não string; corrigido no spec).
  Sem regressão; o AppModule continua subindo com o PickupModule
  importando o AuthModule (sem ciclo de DI).
- `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`:
  **exit 0, sem erros**.

**Próximo item sugerido**: **login de tutor por SMS** (Impacto 4, Esforço 3
— tutores entram por código no celular, sem senha; falta o provedor de
SMS no Step 2) ou **tag/cartão impresso p/ delegado sem smartphone**
(Impacto 3, Esforço 2 — agora com o código de 6 dígitos como formato da
tag) ou **EventLog em Redis Streams + connection state recovery**
(Impacto 4, Esforço 3 — fase 2 do item Redis).

## 2026-11-17 09:55–10:04 — REST pickup: fila, QR, release + PickupLog encadeado

**Pesquisa do ciclo (frente a — concorrentes internacionais)**
- CENTEGIX comprou a PikMyKid (abr/2026) e a absorveu como "CENTEGIX
  Dismissal" (out/2026): saída dentro de plataforma de segurança
  (visitantes, hall passes, alertas vestíveis, reunificação) — valida a
  tese TutorPass por contraste: ser o melhor SÓ em saída, não virar suite.
- Pulse AI (PikMyKid, 2026): analytics da saída estendido aos pais
  ("chegue às Y, seu filho espera X min") — fase 2 do nosso relatório.
- PickupRoster: drills com 12 templates, roll ao vivo, relatório
  pós-ação e replay; trial sem cartão é padrão (30–60 dias); preços
  publicados US$ 299–4.800/ano — nosso PRO (R$ 2,90/aluno/mês) segue
  ordens abaixo de todos. Carta de escola PikMyKid 2026-2027: car tags
  impressas p/ delegado sem smartphone + cutoff real de mudança de plano
  (14h dia cheio / 11h saída antecipada — valida nosso 13:30).
- Achados registrados em `docs/product/IDEAS.md` (seção frente a, ciclo
  22); promovida ao BACKLOG: **tag/cartão impresso p/ delegado sem
  smartphone** (Impacto 3, Esforço 2). A ideia implementada foi a do
  BACKLOG (Step 2): **REST pickup** — o núcleo da fila, que era stub.

**O que foi feito**
- `PickupService` completo (`apps/api/src/modules/pickup/pickup.service.ts`,
  era só o `chainHash`): `join` (MANUAL/GEOFENCE/QR_GATE, 1 entrada ativa
  por aluno/escola), `call` (QUEUED → CALLED), `validateQr` (async, via
  QrTokenService — checa o estado ANTES de validar p/ não consumir o
  nonce à toa; QR de outra escola/outro tutor, expirado ou reutilizado
  vira `QR_REJECTED` no log e 401), `release` (só VALIDATED, com
  `waitSeconds` = joinedAt → releasedAt e calledAt/validatedAt no log
  p/ o relatório), `cancel` (só QUEUED/CALLED), `block`/`unblock`
  (bloqueio com motivo obrigatório vence a fila: tira a entrada ativa e
  impede novo `join` até o desbloqueio explícito), `expireStale` (job
  diário: entradas de dias anteriores viram EXPIRED), `listActiveForSchool`
  (FIFO), `listForStudent`, `listLogs` e `verifyChain` (revalida a cadeia
  de hashes — adulterar um evento quebra os seguintes).
- `PickupModule` agora importa o `QrModule` (QrTokenService exportado);
  `pickup.service.spec.ts` reescrito: 20 testes (4 de chainHash + 16 de
  fluxo, incl. fluxo completo com waitSeconds 300 s, QR de outro tutor,
  QR reutilizado, bloqueio vencendo a fila, expiração e adulteração da
  cadeia). `README.md` do módulo com fluxo, regras e integração Step 2.
- `BACKLOG.md` (item concluído; controller REST e tag impressa como
  próximos); `IDEAS.md` (seção frente a, ciclo 22).

**Arquivos alterados**
- `apps/api/src/modules/pickup/pickup.service.ts` (núcleo, era stub)
- `apps/api/src/modules/pickup/pickup.service.spec.ts` (4 → 20 testes)
- `apps/api/src/modules/pickup/pickup.module.ts` (+ QrModule)
- `apps/api/src/modules/pickup/README.md` (novo)
- `docs/product/IDEAS.md` (seção frente a, ciclo 22), `BACKLOG.md`

**Verificação**
- `node node_modules/jest/bin/jest.js --config jest.config.js` na API:
  **29 suítes, 379/379 testes passando** (363 anteriores + 16 novos).
  Sem regressão; o AppModule continua subindo com o PickupModule
  importando o QrModule (sem ciclo de DI).

**Próximo item sugerido**: controller REST `/api/pickup/*` com
JwtAuthGuard + TenantGuard + @Roles (Impacto 4, Esforço 2 — superfície
HTTP do serviço pronto neste ciclo) ou login de tutor por SMS
(Impacto 4, Esforço 3).

## 2026-11-17 09:25–09:35 — Redis: estado de geofence, nonce QR, Socket.io adapter (multi-instância)

**Pesquisa do ciclo (frente f — tecnologia: Redis p/ multi-instância)**
- O adapter move o broadcast, não o estado (dev.to/matthewswong, 2025–2026):
  com 2 instâncias a room vive só na memória de cada uma; nonce de QR,
  geofence e log de eventos precisam sair da memória junto com o adapter.
- Dois clientes Redis são obrigatórios (todas as fontes): conexão em modo
  subscribe não aceita comando — `pubClient` + `subClient.duplicate()`,
  conectados antes do app escutar.
- Sticky sessions continuam obrigatórias (docs NestJS via dev.to, 2026):
  sem afinidade no balanceador (ou transporte só-websocket), o handshake
  (polling) cai em instâncias diferentes e dá HTTP 400.
- Adapter clássico não suporta connection state recovery; o de Redis
  Streams (`@socket.io/redis-streams-adapter`) sim (socket.io docs, 2026):
  retoma o stream sem perder pacote quando o Redis cai. Pub/Sub é
  at-most-once, sem histórico; Streams é log com replay — o que não pode
  se perder não vai p/ Pub/Sub.
- Achados registrados em `docs/product/IDEAS.md` (seção frente f, ciclo
  21); a ideia implementada foi a do BACKLOG (Step 2): **Redis — estado
  de geofence, nonce QR, Socket.io adapter** (Impacto 5, Esforço 3).

**O que foi feito**
- Novo módulo `RedisService` + `RedisModule` (`apps/api/src/infra/redis/`,
  com README): lê `REDIS_URL`, conecta no `onModuleInit` com timeout de
  2 s e fail-fast (sem retry infinito); modos `disabled` (sem URL) /
  `memory` (URL sem Redis — degradação graciosa) / `redis` (conectado).
  `EphemeralStore` (`get`/`set`/`setNx`/`del` com TTL) com 3 backends —
  `MemoryEphemeralStore` (expiração preguiçosa, sem timer),
  `RedisEphemeralStore` (`SET NX EX` atômico) e `ResilientEphemeralStore`
  (tenta o Redis, cai p/ memória sem quebrar a requisição; durante a
  queda o estado volta a ser por instância — nunca pior que antes).
- `QrTokenService.validate` virou `async`: nonce via `setNx(qr:nonce:*,
  90 s)` — o replay agora é barrado em qualquer instância (antes, só
  dentro de 1 instância; o REST de pickup ainda não existe, então nenhum
  chamador precisou mudar).
- `GeofencingService.ingest`: estado em `geo:{schoolId}:{tutorId}` (JSON,
  TTL 10 min) — guarda SÓ a zona derivada (`zone`/`insideCount`/
  `confirmed`/`lastTs`), nunca lat/lng; a posição do tutor continua sem
  ser persistida (RoPA: 0 dias, sem mudança no texto).
- `RedisIoAdapter extends IoAdapter` (pub/sub, `duplicate()`), ligado no
  `main.ts` quando o Redis conecta; senão, aviso no log e adapter em
  memória — o boot nunca quebra por falta de Redis.
- `GET /api/health` devolve `redis: disabled | memory | redis`; RoPA do
  QR atualizada (nonce em Redis TTL 90 s quando configurado); comentário
  do `EventLogService` atualizado (adapter clássico ligado; Streams é o
  próximo passo). `docker-compose.yml` (redis:7-alpine) e `render.yaml`
  (`REDIS_URL`, Upstash) já existiam — nenhum ajuste de infra.
- `BACKLOG.md` (item concluído; próxima candidata atualizada);
  `IDEAS.md` (seção frente f, ciclo 21).

**Arquivos alterados**
- `apps/api/src/infra/redis/ephemeral-store.ts` (novo)
- `apps/api/src/infra/redis/memory-ephemeral-store.ts` (novo)
- `apps/api/src/infra/redis/redis-ephemeral-store.ts` (novo)
- `apps/api/src/infra/redis/resilient-ephemeral-store.ts` (novo)
- `apps/api/src/infra/redis/redis.service.ts` (novo)
- `apps/api/src/infra/redis/redis.service.spec.ts` (novo, 12 testes)
- `apps/api/src/infra/redis/redis.module.ts` (novo)
- `apps/api/src/infra/redis/README.md` (novo)
- `apps/api/src/realtime/redis-io.adapter.ts` (novo)
- `apps/api/src/realtime/redis-io.adapter.spec.ts` (novo, 3 testes)
- `apps/api/src/modules/qr/qr-token.service.ts` (+ Redis, `validate` async)
- `apps/api/src/modules/qr/qr-token.service.spec.ts` (async + teste de replay entre instâncias)
- `apps/api/src/modules/qr/qr.module.ts` (+ RedisModule)
- `apps/api/src/modules/geofencing/geofencing.service.ts` (+ Redis)
- `apps/api/src/modules/geofencing/geofencing.service.spec.ts` (+ teste de estado compartilhado entre instâncias)
- `apps/api/src/modules/geofencing/geofencing.module.ts` (+ RedisModule)
- `apps/api/src/app.module.ts` (+ RedisModule), `apps/api/src/main.ts` (+ adapter),
  `apps/api/src/health.controller.ts` (+ modo do Redis)
- `apps/api/src/realtime/event-log.service.ts` (comentário), `apps/api/src/modules/compliance/compliance-report.service.ts` (retenção do QR), `apps/api/src/app.module.spec.ts` (+ RedisService)
- `docs/product/IDEAS.md` (seção frente f, ciclo 21), `BACKLOG.md`

**Verificação**
- `node node_modules/jest/bin/jest.js --config jest.config.js` na API
  (`npx jest`/`pnpm` não existem neste sandbox; `.bin` ausente):
  **29 suítes, 363/363 testes passando** (346 anteriores + 17 novos/
  alterados; 1ª rodada com 1 erro de tipo no spec do adapter, corrigido).
  Novos: replay de QR barrado na 2ª instância com store compartilhado;
  ENTER_ARRIVAL confirmado com o 1º ping numa instância e o 2º noutra;
  Redis inalcançável degrada p/ `memory` sem lançar; adapter com URL
  inválida devolve false.
- `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`:
  **exit 0, sem erros**.
- Limitação: sem Postgres nem Redis ao vivo neste sandbox (sem docker),
  então não houve boot real da API nem teste contra Redis de verdade —
  os testes usam store em memória e cliente falso; o fail-fast do
  ioredis contra porta fechada foi provado com script avulso.

**Próximo item sugerido**
- **Login de tutor por SMS** (Impacto 4, Esforço 3 — tutores entram por
  código no celular, sem senha; falta o provedor de SMS no Step 2) ou
  **EventLog em Redis Streams + connection state recovery** (Impacto 4,
  Esforço 3 — fase 2 deste item; `@socket.io/redis-streams-adapter`
  ainda não instalado).
- Observação p/ o próximo ciclo: o Step 3 do BACKLOG ainda lista "Push
  notification (Expo) — refinar p/ dual-path" como aberto, mas a lista
  de promovidas já marca a notificação dual-path como implementada em
  17/11/2026 — vale confirmar e fechar o item duplicado.

## 2026-11-17 08:55–09:10 — Relatório de conformidade LGPD p/ a escola (DPA-ready)

**Pesquisa do ciclo (frente e — segurança/LGPD: relatório de conformidade)**
- RoPA é a primeira evidência (lgpdcloud, 2026): o Registro das Operações
  de Tratamento (art. 37) lista por atividade finalidade, categorias de
  titulares e dados, dados sensíveis, base legal + justificativa,
  sistemas/fornecedores, localização/transferências, retenção e
  responsáveis; a base legal não pode ser só uma coluna sem explicação —
  pesa mais com dado sensível, criança ou combinação de finalidades.
- RIPD (cassiusmarques/getprivacy/sincera, 2026, com a FAQ da ANPD de
  set/2026): a LGPD não manda ter um RIPD pronto, mas a ANPD pode pedi-lo
  a qualquer momento (arts. 5º XVII, 10 §3º, 32 e 38) — e recomenda
  elaborá-lo sempre que houver alto risco, de preferência antes de
  começar; o critério (Res. CD/ANPD nº 2/2022, art. 4º) é larga escala +
  dado sensível/criança — o caso de toda escola.
- O relatório não pode conter dado pessoal (lgpdcloud/sistematoth, 2026):
  evidência de qualidade mostra o que foi analisado, quem decidiu e
  quando — sem virar um segundo vazamento; contratos/fornecedores
  (Expo = transferência internacional, art. 33) são evidência.
- Achados registrados em `docs/product/IDEAS.md` (seção frente e, ciclo
  20); a ideia implementada foi a promovida do BACKLOG: **relatório de
  conformidade LGPD p/ a escola** (Impacto 4, Esforço 2 — último item
  aberto do Step 3).

**O que foi feito**
- Novo módulo `ComplianceReportService` + `ComplianceModule` (ligado no
  `AppModule`): gera o relatório DPA-ready da escola a partir do estado
  real dos serviços — nunca preenchido à mão, sem número inventado.
  - **RoPA** (`TREATMENT_ACTIVITIES`, fonte única de verdade): 8
    atividades — cadastro, PickupLog, QR dinâmico, geolocalização (0
    dias, nunca persiste), selfie biométrica (art. 11, 30 dias), foto do
    aluno, push via Expo (única transferência internacional, art. 33) e
    incidentes — cada uma com finalidade, categorias, base legal,
    retenção, suboperadores e transferência internacional.
  - **Consentimentos** por finalidade: ativos vs revogados pelo último
    evento, com as versões do aviso em uso (novo `ConsentService.
    listEvents(schoolId)`).
  - **Retenção/expurgo**: itens com retenção vencida aguardando expurgo
    (`dryRun`) + expurgos registrados + integridade das cadeias de hash.
  - **Incidentes**: total, abertos e com comunicação vencida (3 dias
    úteis, Res. 15/2024), com os ids no gap.
  - **Checklist** OK/ATENCAO/PENDENTE (DPO, aviso de privacidade,
    expurgo, incidentes, auditoria, transferência internacional, RIPD) +
    `gaps` acionáveis + resumo; o RIPD fica PENDENTE permanente — o
    relatório é o inventário-base, a avaliação de risco é da escola/DPO.
  - **`toMarkdown`**: documento p/ pais e ANPD — sem dado pessoal (só
    contagens, categorias e ids opacos; testado: nenhum `subjectId` no
    documento). DPO é a única exceção (contato do próprio relatório).
- `README.md` do módulo; `BACKLOG.md` (item concluído; "próxima
  candidata" atualizada — o preço publicado já estava feito desde o
  ciclo 19); `IDEAS.md` (seção frente e, ciclo 20).

**Arquivos alterados**
- `apps/api/src/modules/compliance/compliance-report.service.ts` (novo)
- `apps/api/src/modules/compliance/compliance-report.service.spec.ts` (novo, 9 testes)
- `apps/api/src/modules/compliance/compliance.module.ts` (novo)
- `apps/api/src/modules/compliance/README.md` (novo)
- `apps/api/src/modules/consent/consent.service.ts` (+ `listEvents(schoolId)`)
- `apps/api/src/app.module.ts` (+ ComplianceModule)
- `docs/product/IDEAS.md` (seção frente e, ciclo 20), `BACKLOG.md`

**Verificação**
- `jest --config jest.config.js`: 27 suítes, **346/346 testes passando**
  (337 anteriores + 9 novos; 1ª rodada já verde).
- `tsc --noEmit -p tsconfig.json` na API (binário do store pnpm, pois o
  `npx tsc` não encontra o compilador neste sandbox): **exit 0, sem erros**.

**Próximo item sugerido**
- **Login de tutor por SMS** (Impacto 4, Esforço 3 — tutores entram por
  código no celular, sem senha; falta o provedor de SMS no Step 2) ou
  **Redis: estado de geofence, nonce QR, Socket.io adapter** (Step 2,
  base p/ multi-instância e p/ o adapter Redis Streams da frente f).

## 2026-11-17 08:24–08:26 — Preço publicado por aluno/mês (página `/planos` + calculadora)

**Pesquisa do ciclo (frente d — modelo de negócio/preço: como publicar preço)**
- PickupRoster "Best School Dismissal Software (2026)" (atual. out/2026):
  o comparativo lista "published price" como critério e pergunta "per
  campus, per student, or by quote? Is there a free trial, and does it need
  a credit card?". Quem publica vira referência; PikMyKid/CENTEGIX (a
  partir de US$ 3.750/ano), Ruvna e PickUp Patrol escondem atrás de "quote".
  Carline.app cobra US$ 0,15/aluno/mês com **mínimo de 50 alunos** —
  reforça o piso p/ escolas pequenas, ainda em aberto.
- Frontier Templates "SaaS pricing page anatomy" (05/10/2026): a página boa
  responde em ordem — qual plano é p/ mim, quanto vou pagar de fato, o que
  acontece se eu errar — com cartões, calculadora quando o preço depende de
  volume, FAQ de objeções reais, rota p/ compradores grandes e confiança
  junto aos botões. "Uma calculadora que lisonjeia é pior que nenhuma":
  mostrar a fórmula, nunca pré-preencher o melhor caso.
- Bayleaf (2026): transparência de preço é decisiva p/ 86% dos compradores
  B2B (LinkedIn) e 60% dos visitantes checam o preço antes de pedir demo;
  esconder o preço atrás de cadastro aumenta o bounce em 30–40%.
  MyKidReports (2026): "No quote call. The price is on the page" — grátis
  até 5 crianças, US$ 0,99/criança/mês.
- Achados registrados em `docs/product/IDEAS.md` (seção frente d, ciclo 19);
  a ideia implementada foi a promovida do BACKLOG: **preço publicado por
  aluno/mês** (Impacto 4, Esforço 1).

**O que foi feito**
- **Página pública `/planos`** (`apps/web/app/planos/page.tsx` + `calculadora.tsx`):
  3 cartões — Grátis (R$ 0 p/ sempre, até 30 alunos, 5 staff), Teste de 30
  dias (R$ 0, todas as funções do PRO, sem cartão, 1 por escola, volta
  sozinho p/ o Grátis) e PRO (R$ 2,90/aluno/mês, até 2.000 alunos, 50
  staff, as 9 funções); **calculadora interativa** (nº de alunos →
  mensalidade, com a fórmula n × R$ 2,90 à mostra e o anual como mensal ×
  12, sem desconto inventado; ≤ 30 alunos mostra R$ 0 — o Grátis cobre;
  > 2.000 mostra "plano sob consulta"); FAQ só com regras que existem no
  `PlanService` (trial sem cartão, Grátis sem expiração, mensalidade =
  2,90 × alunos, teto de 2.000). Nada na página promete meio de pagamento,
  desconto anual ou taxa — esses itens seguem indefinidos e estão listados
  como pendência em `docs/product/PRECOS.md`. Valores espelham
  `PLAN_DEFINITIONS` (fonte única de verdade).
- **Navegação**: link "Planos" no topbar (`layout.tsx`) e cartão "Planos"
  na home (`page.tsx`); estilos `.pricing-grid`/`.plan`/`.calculator` em
  `globals.css`, seguindo os tokens de design já existentes (verde
  #0b6e4f, cartões brancos, raio 12px).
- **`docs/product/PRECOS.md`** (novo): política de preços publicada,
  regras do `PlanService`, benchmark e itens em aberto (piso p/ escolas
  pequenas, desconto anual, meios de pagamento).
- **BACKLOG.md**: item marcado como concluído; removida a linha duplicada
  do mesmo item (havia duas); corrigido no ato um edit que tinha apagado
  a linha do Expurgo LGPD — restaurada e conferida por grep.

**Verificação**
- `node node_modules/next/dist/bin/next build` em `apps/web` — **passou**:
  compilou, checagem de tipos ok, 6 rotas geradas, `/planos` estática
  (903 B, 96,9 kB first load). API não tocada neste ciclo.
- Matemática da calculadora conferida em Node com a mesma regra do
  `monthlyPriceBRL` (arredondamento p/ centavos): 31 alunos → R$ 89,90/mês;
  150 → R$ 435,00/mês (R$ 5.220,00/ano); 2.000 → R$ 5.800,00/mês.

**Ressalva**
- O preço (R$ 2,90/aluno/mês) é proposta de lançamento — o `PlanService`
  já trazia "a validar com o usuário antes de publicar no site". A página
  existe só no repositório (nenhum deploy neste ciclo); **confirmar com o
  usuário antes do deploy público**.

**Próximo item sugerido**
- **Login de tutor por SMS** (Impacto 4, Esforço 3 — tutores nunca usam 2FA;
  falta o provedor de SMS no Step 2) ou **relatório de conformidade LGPD
  p/ a escola** (Impacto 4, Esforço 2 — último item aberto do Step 3).

# CHANGELOG-DEV — melhoria contínua (agente autônomo)

Formato por entrada: data/hora (America/Sao_Paulo), item, arquivos, verificação, próximo item.

## 2026-11-17 08:20–08:35 — Web mínimo + preparação do deploy (deploy autorizado pelo usuário)

**Contexto**
- O usuário autorizou o deploy completo (opção 1) neste chat em 17/11/2026. Esta entrada é **só trabalho local**: nenhum deploy externo, push ou criação de conta foi feito aqui — a publicação será executada depois pela agente principal, pelo navegador, seguindo `docs/04-deploy.md`. O escopo do cron de melhoria contínua não foi alterado.

**O que foi feito**
- **Web mínimo** (`apps/web`, Next.js 14 App Router + TypeScript, sem nenhuma biblioteca de UI nova; tipos `@types/react`, `@types/react-dom`, `@types/node` adicionados a `devDependencies` porque o esqueleto não tinha nenhum e o build de tipos falhava sem eles):
  - `app/page.tsx` — `/`: apresentação do TutorPass + links p/ login, portaria e telão.
  - `app/login/page.tsx` — `/login`: formulário e-mail/senha chamando `POST /api/auth/login` (a API usa o prefixo global `api` em `main.ts` — a rota real é `/api/auth/login`, não `/auth/login`); guarda o access token em `sessionStorage` (o refresh segue só no cookie httpOnly da API); quando a API devolve `requires2fa` + `twoFactorToken`, mostra o campo de código e chama `POST /api/auth/2fa/verify`; exibe o aviso de `twoFactorSetupRequired`; API fora do ar vira mensagem de erro clara, sem travar a página.
  - `app/portaria/page.tsx` — `/portaria`: fila de saída via Socket.io no namespace `/pickup` (eventos `queue.entry.created`, `queue.entry.status_changed`, `student.called`), indicador de conexão (healthcheck + socket) e estado vazio amigável. Não há endpoint REST de fila no Step 2 — a fila é montada dos eventos da sessão.
  - `app/telao/page.tsx` — `/telao`: telão/TV com as colunas "Pronto para retirada" e "A caminho", letras grandes, mesmos dados da portaria.
  - `lib/api.ts` (cliente da API; `NEXT_PUBLIC_API_URL` é a origem, default `http://localhost:3333`) e `lib/use-pickup-queue.ts` (hook do socket, normaliza o envelope `{seq, data}` do RealtimeService).
- **Preparação do deploy**:
  - Migration inicial gerada **sem banco** via `prisma migrate diff --from-empty --to-schema-datamodel` → `apps/api/prisma/migrations/20261117090000_init/migration.sql` (722 linhas) + `migration_lock.toml` — o repo não tinha nenhuma migration e o `prisma migrate deploy` do Dockerfile não teria o que aplicar.
  - `apps/api/.env.example` e `apps/web/.env.example` só com placeholders (o `.env.example` da raiz já existia e foi mantido).
  - `render.yaml` na raiz (blueprint da API: Docker em `apps/api`, healthcheck `/api/health`) e `apps/web/vercel.json` (`framework: nextjs`).
  - **Correção no `apps/api/Dockerfile`**: o HEALTHCHECK apontava p/ `/health`, mas com o prefixo global a rota real é `/api/health` — corrigido.
  - `docs/04-deploy.md` reescrito com o passo a passo externo na ordem certa (Neon → Upstash → Render/Railway → seed da escola demo → Vercel → ajuste de CORS), incluindo o bloqueio conhecido: **o projeto ainda não tem repositório Git remoto**, e os painéis importam do GitHub.
  - `apps/web/README.md` atualizado (telas, como rodar, deploy na Vercel com root `apps/web`).

**Verificação**
- Web: `node node_modules/next/dist/bin/next build` em `apps/web` (o pnpm não está instalado nesta VM; é o mesmo `next build` do script `build` do pacote) — **passou**: compilou, checagem de tipos ok, 4 rotas geradas (`/`, `/login`, `/portaria`, `/telao`, todas estáticas). Avisos não fatais de "lockfile missing swc dependencies" vêm da mistura npm/pnpm nos `node_modules` locais e não quebraram o build (exit 0).
- API: suíte Jest completa — **26 suítes, 337/337 testes passando** (nada quebrou); `tsc --noEmit` limpo.

**Próximo item sugerido**
- Execução externa do deploy (agente principal, via navegador): criar o repo Git, Neon, Upstash, Render/Railway, seed e Vercel, na ordem de `docs/04-deploy.md`.

## 2026-11-17 07:54–08:04 — 2FA TOTP p/ staff (TwoFactorService)

**Pesquisa do ciclo (frente e — segurança: implementação de TOTP + códigos de recuperação)**
- RFC 6238/4226 (ToolVault/toolninja, 2026): TOTP = HMAC-SHA1 do contador
  (tempo/30 s) + truncamento dinâmico, 6 dígitos; `otpauth://totp/Issuer:
  conta?secret=...&issuer=...&algorithm=SHA1&digits=6&period=30` é o
  contrato com o app autenticador (Google/Microsoft Authenticator, Authy);
  **janela de verificação ±1 passo** p/ tolerar relógio dessincronizado —
  só o passo exato falha na borda dos 30 s; HMAC-SHA1 segue seguro p/ TOTP
  (a segurança do HMAC depende de pré-imagem, não de colisão).
- NIST SP 800-63B-4 (jul/2025, via nhimg.org): códigos de recuperação são
  "look-up secrets" — ≥6 dígitos de gerador aleatório aprovado, **uso
  único, hash com salt** (obrigatório abaixo de 112 bits de entropia),
  rate limiting; Google emite 10 códigos de 8 dígitos, GitHub 16; gerar
  lote novo invalida o anterior. Passkeys (FIDO2) são o substituto superior
  do TOTP (à prova de phishing), mas o TOTP continua o mais suportado.
- Achados registrados em `docs/product/IDEAS.md` (seção frente e, ciclo 18);
  a ideia implementada neste ciclo foi a promovida do BACKLOG: **2FA
  obrigatório p/ ADMIN, opcional por escola p/ o resto do staff** (Impacto
  5, Esforço 3 — Realsmart/FACTS 2026, ciclo 15).

**O que foi feito**
- Novo `TwoFactorService` (lógica pura, in-memory como os demais serviços;
  persistência no Step 2 sobre o modelo `TwoFactorEnrollment`, já no
  schema): **TOTP puro com `node:crypto`, sem dependência externa**
  (Base32 RFC 4648, HOTP RFC 4226, TOTP RFC 6238, URL `otpauth://`);
  **setup em 2 passos** (`beginSetup` → segredo + URL p/ o QR; `confirmSetup`
  → só então ativa, e devolve os 10 códigos de recuperação em texto claro
  **uma única vez**); segredo pendente separado do ativo — re-cadastro
  mantém o antigo até confirmar o novo, e segredo não confirmado nunca
  autentica; **anti-replay** (`lastUsedStep` — cada passo de 30 s vale 1
  vez; o código do confirm não vale p/ o login seguinte); **lockout**
  5 códigos errados / 15 min (mesmo padrão da senha); **códigos de
  recuperação** (10 × 8 dígitos, hash scrypt com salt por código, uso único,
  regeneração invalida o lote); **desafio de login** opaco de uso único
  (5 min, só o hash SHA-256 guardado — mesmo padrão do refresh token;
  código errado não queima o desafio); **política** — ADMIN sempre
  obrigado, sem como desligar, a escola só amplia (`setSchoolPolicy`);
  **auditoria** de eventos de 2FA (setup, ativação, verificação, falha,
  bloqueio, desafio, regeneração) sem segredo nem código no registro.
- **Integração no login** (`AuthService` + `AuthController`, sem reescrever
  o Auth): `login()` dividido em `loginStep1` (senha + vínculo, sem tokens)
  e `issueSession` (emite access + refresh) — o controller cria o desafio
  entre os dois passos quando o 2FA está ativo e só emite a sessão no
  `POST /auth/2fa/verify`; quem é obrigado (ADMIN) mas não cadastrou o 2FA
  faz login normalmente com a flag `twoFactorSetupRequired: true`
  (período de carência — o cliente leva à tela de Segurança). Novos
  endpoints `/auth/2fa/setup`, `/confirm`, `/verify`, `/status`,
  `/disable` (403 p/ ADMIN — nunca desliga), `/recovery-codes`; DTOs com
  class-validator. `TwoFactorModule` importado pelo `AuthModule`.
- **Schema**: modelo `TwoFactorEnrollment` (`userId` único, `secretEncrypted`,
  hashes dos códigos, `lastUsedStep`, `lastUsedAt`) + relação no `User` —
  o segredo DEVE ser cifrado em repouso com chave do KMS no Step 2, nunca
  em claro (anotado no modelo e no README do módulo).

**Arquivos alterados**
- `apps/api/src/modules/two-factor/two-factor.service.ts` (novo)
- `apps/api/src/modules/two-factor/two-factor.service.spec.ts` (novo, 20 testes)
- `apps/api/src/modules/two-factor/two-factor.module.ts` (novo)
- `apps/api/src/modules/two-factor/README.md` (documentação da feature)
- `apps/api/src/modules/auth/auth.service.ts` (`loginStep1` + `issueSession` públicos + `getPublicUser`; `login()` delega — comportamento preservado)
- `apps/api/src/modules/auth/auth.controller.ts` (login em 2 passos + 6 endpoints `/auth/2fa/*`)
- `apps/api/src/modules/auth/auth.module.ts` (+ TwoFactorModule)
- `apps/api/src/modules/auth/dto/two-factor-code.dto.ts` (novo)
- `apps/api/src/modules/auth/dto/two-factor-verify.dto.ts` (novo)
- `apps/api/src/modules/auth/auth.controller.spec.ts` (+ 3 testes de fluxo 2FA)
- `apps/api/prisma/schema.prisma` (modelo `TwoFactorEnrollment` + relação em `User`)
- `docs/product/IDEAS.md` (seção frente e, ciclo 18 + ideia do ciclo 15 marcada como implementada), `BACKLOG.md` (2FA concluído; preço publicado como próxima candidata)

**Verificação**
- `node node_modules/jest/bin/jest.js --config jest.config.js`: 26 suítes, **337/337 testes passando** (314 anteriores + 23 novos: 20 do TwoFactorService + 3 do AuthController; TOTP validado contra os vetores do RFC 4226 Apêndice D e do RFC 6238 Apêndice B, conferidos de forma independente com um cálculo HMAC em Python — 1ª rodada: 19/20 — minha lembrança do vetor T=1111111111 estava errada (89005924 é o vetor de T=1234567890); corrigido o teste, não o serviço).
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`: **exit 0, sem erros** (1ª rodada: o `login` passou a devolver união de tipos e o spec acessava campos de só um ramo — corrigido com narrowing explícito no teste; `npx tsc` não achou o TypeScript local — usar o binário de `node_modules/typescript/bin/tsc`).
- `prisma validate`: **schema válido** (precisa de `DATABASE_URL` no ambiente p/ rodar — sem ela, P1012; validado com placeholder, sem tocar no `.env`).

**Próximo item sugerido**
- **Preço publicado por aluno/mês** (Impacto 4, Esforço 1 — benchmark 2026: US$ 4–12/aluno/ano; publicar preço simples em R$ é diferencial contra os "quote" gringos) ou **login de tutor por SMS** (Impacto 4, Esforço 3 — tutores nunca usam 2FA; falta o provedor de SMS no Step 2).

## 2026-11-17 07:24–07:45 — CRUD escolas/turmas/alunos/tutores + importação CSV de alunos (RosterService)

**Pesquisa do ciclo (frente a — concorrentes internacionais: roster/CSV)**
- PickupRoster (comparativo 2026, atual. out/2026): CSV/XLSX com guias por
  SIS (PowerSchool, Infinite Campus, Skyward, Blackbaud); **re-importar
  atualiza o aluno existente**; "Export your roster from your SIS as CSV or
  XLSX, then import it".
- "pickup." (2026, grátis p/ as 250 primeiras escolas, depois US$ 200/
  escola/ano): "Review matches and duplicates before saving" — a prévia de
  matches/duplicatas antes de salvar; setup guiado passo a passo
  (escola → importar alunos → grupos → tags QR → convidar o time).
- DismissPro (2026): "Download Roster Template (.CSV)" + "Upload and
  Override Roster" — e o aviso: **o upload substitui o roster inteiro**
  ("Uploading replaces your whole roster"), com "Download Master Roster"
  como backup; aluno com nº de carro vira car rider, só com nº de ônibus
  vira bus rider (modo inferido das colunas).
- QManager (2026): US$ 1.295/ano, setup de US$ 300 isento até 30/12/2026,
  trial 30 dias sem cartão; "Your account is set up within 24 hours. We
  import your family data from a spreadsheet or straight from your SIS, so
  there's no re-typing" — sync Veracross/Blackbaud/GG4L.
- SchoolPass 2.0 (Raptor, atual. 06/10/2026): staff app + parent app
  unificados num só app; cadastro de veículo com foto da placa (ML).
- Achados registrados em `docs/product/IDEAS.md` (seção frente a, ciclo 17);
  a ideia implementada neste ciclo foi a promovida do BACKLOG: **CRUD +
  importação CSV** (Impacto 5, Esforço 2 — abre o onboarding de 1 dia; o
  seed já provava o modelo, o CSV é o que falta p/ migrar uma escola real).

**O que foi feito**
- Novo `RosterService` (lógica pura, in-memory como os demais serviços;
  persistência no Step 2 sobre `School`/`Classroom`/`Student`/`Tutor`/
  `TutorStudent`, já no schema — sem mudança no schema neste ciclo):
  **escolas** — slug gerado do nome e imutável (é o subdomínio), CNPJ
  opcional, desativar/reativar (desativada bloqueia novos cadastros);
  **turmas** — nome único por escola + ano letivo (sem acento/maiúscula),
  renomear, desativar (não recebe novos alunos); **alunos** — matrícula
  única por escola, nascimento `DD/MM/AAAA` ou `AAAA-MM-DD` (nunca no
  futuro), transferência de turma, status sem apagar (ACTIVE/INACTIVE/
  TRANSFERRED), bloqueio de retirada com motivo obrigatório, busca por nome
  sem acento; **tutores** — telefone normalizado e único por escola,
  bloqueio com motivo, vínculo com parentesco + `isPrimary` (só 1 primário
  por aluno — o novo derruba o anterior) + `canPickup`; **limite do plano**
  via `setStudentLimit` (alimentado no Step 2 pelo
  `PlanService.canAddStudent`; FREE = 30 alunos), aplicado na criação e na
  importação.
- **Importação CSV** (`importStudents`): delimitador detectado sozinho
  (`;` ou `,`), aspas suportadas, cabeçalho pt-BR ou inglês; **re-importar
  atualiza por matrícula** (nunca apaga — o anti-padrão é o "Override" do
  DismissPro, que substitui o roster inteiro); sem matrícula, duplicata por
  nome + turma é **pulada e relatada** (2ª ocorrência no mesmo arquivo é
  duplicata; re-importação de outro arquivo é que atualiza — mesma matrícula
  com nome diferente no mesmo arquivo NÃO renomeia o aluno em silêncio);
  turma inexistente é **criada** (`createClassrooms: false` vira erro na
  linha); colunas de responsável criam o tutor (por telefone) e o vínculo
  (o 1º vira primário); **cada linha ruim vira erro com o nº da linha** e
  o resto do arquivo segue; o responsável é validado ANTES de criar o
  aluno (linha ruim não deixa aluno órfão); **`dryRun: true`** valida tudo
  sem gravar (a prévia de matches/duplicatas do PickupRoster/"pickup.");
  `rosterTemplateCsv()` (template p/ download) + `exportRosterCsv()`
  (backup no mesmo formato — o export re-importado atualiza, não duplica).
  `RosterModule` ligado no `AppModule`; os stubs `schools`/`classrooms`/
  `students`/`tutors` agora apontam p/ o `roster/`.

**Arquivos alterados**
- `apps/api/src/modules/roster/roster.service.ts` (novo)
- `apps/api/src/modules/roster/roster.service.spec.ts` (novo, 23 testes)
- `apps/api/src/modules/roster/roster.module.ts` (novo)
- `apps/api/src/modules/roster/README.md` (documentação da feature)
- `apps/api/src/app.module.ts` (+ RosterModule)
- `apps/api/src/modules/{schools,classrooms,students,tutors}/README.md` (stubs apontam p/ o roster)
- `docs/product/IDEAS.md` (seção frente a, ciclo 17 + ideia implementada), `BACKLOG.md` (CRUD + CSV concluído; preço publicado/2FA como próximas candidatas)

**Verificação**
- `node node_modules/jest/bin/jest.js --config jest.config.js`: 25 suítes, **314/314 testes passando** (291 anteriores + 23 novos; escolas/slug/CNPJ, turmas, alunos/matricula/nascimento/limite/bloqueio, tutor primário, CSV com/sem matrícula, re-importação, dryRun sem gravar, dryRun repetido, template/export, responsável incompleto, createClassrooms=false; 1ª rodada: 312/314 — 2 testes com expectativa errada (duplicata no mesmo arquivo conta como pulada, não atualizada; regex de mensagem em minúscula); corrigidos no serviço (duplicata no mesmo arquivo) e no teste (regex), não mascarados).
- `tsc --noEmit -p tsconfig.json` na API: **exit 0, sem erros**.
- Sem mudança no schema Prisma (modelos `School`/`Classroom`/`Student`/`Tutor`/`TutorStudent` já existiam) — por isso sem `prisma validate` neste ciclo.

**Próximo item sugerido**
- **Preço publicado por aluno/mês** (Impacto 4, Esforço 1 — benchmark 2026: US$ 4–12/aluno/ano; publicar preço simples em R$ é diferencial contra os "quote" gringos) ou **2FA TOTP p/ staff** (Impacto 5, Esforço 3 — ADMIN sempre, padrão Realsmart/FACTS 2026).

## 2026-11-17 06:54–07:12 — Guards de tenant/RBAC + controller REST /auth/* + seed de escola demo

**Pesquisa do ciclo (frente f — tecnologia: guards/RBAC NestJS + seed)**
- Ordem dos guards é o contrato (leonwijaya.id, 2026): JwtAuthGuard primeiro
  (401 sem token/inválido, anexa `request.user`), RolesGuard depois (403 sem o
  papel); guard de papel antes do de auth devolve 403 p/ quem nem logou.
  Guard fino (< 50 linhas), decisão delegada ao serviço (`authorize`); `@Roles`
  por metadata com `getAllAndOverride` (Nest 10: `SetMetadata`; Nest 11:
  `Reflector.createDecorator`); papéis no payload do JWT = barato por request,
  sem lookup — a revogação de vínculo no Step 2 precisa encurtar a sessão.
  Padrão "tudo autenticado por padrão" com `@Public()` só nas rotas de auth.
- Seed idempotente (theaienabledcoder/cedarjs, 2026): upsert por chave única,
  nunca `deleteMany`; dados demo só fora de produção (gate por `NODE_ENV`);
  `prisma db seed` roda no `migrate reset`.
- Achados registrados em `docs/product/IDEAS.md` (seção frente f, ciclo 16); a ideia
  implementada neste ciclo foi a promovida do BACKLOG: **Guard + controller +
  seed** (fecha o Auth do Step 2 sobre o AuthService).

**O que foi feito**
- Novos guards (`JwtAuthGuard`, `RolesGuard` + `@Roles()`, `TenantGuard`) +
  `@Public()` + `@CurrentUser()`: auth 401 antes de autorização 403; RolesGuard
  delega a `AuthService.authorize` (tenant = `:schoolId` da rota ou escola da
  sessão, nunca do body); TenantGuard isola rotas com `:schoolId`.
- Novo `AuthController` (`/auth/*`, prefixo global `api`): `register` (sem
  devolver hash), `login`/`refresh`/`logout` com refresh em cookie httpOnly +
  Secure (só produção) + SameSite=strict, path `/api/auth/refresh`, NUNCA no
  corpo; `refresh` aceita o token do cookie ou do body (fallback mobile);
  `me`, `sessions`, `change-password`, `revoke-all-sessions` sob JwtAuthGuard.
  Sem cookie-parser no projeto: o cookie de entrada é lido do header `cookie`.
  DTOs com class-validator (o ValidationPipe global já valida).
- Novo seed `prisma/seed.ts` (`pnpm seed` / `prisma db seed`): escola demo
  "Escola Demo — TutorPass" (slug `escola-demo`, TRIAL 30 dias), 2 salas
  (3º A/B), 4 alunos, 6 usuários nos 5 papéis (ADMIN, COORDINATOR, GATE_AGENT,
  TEACHER vinculada à 3º A, 2 tutores com vínculos) — idempotente (só upsert),
  recusa `NODE_ENV=production`; `hashPassword` exportado do AuthService p/ o
  seed usar o mesmo formato scrypt do login.
- **Bugs de DI corrigidos (o AppModule nem subia — achados pelo teste de fiação,
  nenhum teste unitário os pegava)**: (1) `AuthService(secret?: string)` — o DI
  tentava resolver `String` como provider → `@Optional() @Inject(
  'JWT_ACCESS_SECRET')` + provider no AuthModule; (2) `NotificationService(
  pushSender?: PushSender)` — tentava resolver `Object` → `@Optional() @Inject(
  'PUSH_SENDER')` (sem sender, push fica NOT_CONFIGURED; Step 2 vincula o Expo);
  (3) `PickupGateway` injeta `GeofencingService`, mas o RealtimeModule não
  importava o GeofencingModule → import adicionado. `app.module.spec.ts`
  (novo, permanente) compila o AppModule e resolve os serviços — a rede contra
  esse tipo de bug; specs de regressão também em auth.module e
  notifications.module.

**Arquivos alterados**
- `apps/api/src/modules/auth/jwt-auth.guard.ts`, `roles.guard.ts`, `tenant.guard.ts`, `roles.decorator.ts`, `public.decorator.ts`, `current-user.decorator.ts` (novos)
- `apps/api/src/modules/auth/dto/{register,login,refresh,change-password}.dto.ts` (novos)
- `apps/api/src/modules/auth/auth.controller.ts` (novo)
- `apps/api/src/modules/auth/guards.spec.ts` (novo, 17 testes), `auth.controller.spec.ts` (novo, 10 testes), `auth.module.spec.ts` (novo, 1 teste)
- `apps/api/src/modules/auth/auth.service.ts` (hashPassword exportado; construtor com @Optional @Inject JWT_ACCESS_SECRET)
- `apps/api/src/modules/auth/auth.module.ts` (controller + guards + provider JWT_ACCESS_SECRET)
- `apps/api/src/modules/auth/README.md` (guards/controller/seed documentados)
- `apps/api/src/modules/notifications/notification.service.ts` (construtor com @Optional @Inject PUSH_SENDER) + `notifications.module.spec.ts` (novo, 1 teste)
- `apps/api/src/realtime/realtime.module.ts` (importa GeofencingModule)
- `apps/api/src/app.module.spec.ts` (novo, 1 teste — compila o AppModule)
- `apps/api/prisma/seed.ts` (novo) + `prisma/seed.spec.ts` (novo, 5 testes)
- `apps/api/package.json` (`seed` + `prisma.seed`)
- `docs/product/IDEAS.md` (seção frente f, ciclo 16), `BACKLOG.md` (Auth do Step 2 concluído; CRUD + CSV como próxima candidata)

**Verificação**
- `node node_modules/jest/bin/jest.js --config jest.config.js`: 24 suítes, **291/291 testes passando** (256 anteriores + 35 novos: 17 guards, 10 controller, 5 seed, 1 auth.module, 1 notifications.module, 1 app.module — 1ª rodada: o spec do módulo falhou e revelou o bug de DI do AuthService; depois o DI-check do AppModule revelou os outros 2; corrigidos no serviço/módulo, não nos testes).
- `tsc --noEmit -p tsconfig.json` na API: **exit 0, sem erros**.
- `prisma validate`: **válido** (sem mudança no schema neste ciclo).
- Seed compilado (`tsc -p tsconfig.json` → `dist/prisma/seed.js`): `NODE_ENV=production node dist/prisma/seed.js` recusa e sai 0 — o gate anti-produção funciona. Sem DB real no sandbox, o seed contra banco NÃO foi executado (DATABASE_URL fictícia só p/ o validate) — a 1ª execução real é `pnpm seed` com o banco de dev no ar.

**Próximo item sugerido**
- **CRUD escolas/turmas/alunos/tutores + importação CSV de alunos** (abre o onboarding de 1 dia — o seed já prova o modelo; o CSV é o que falta p/ migrar uma escola real) ou **preço publicado por aluno/mês** (Impacto 4, Esforço 1) ou **2FA TOTP p/ staff** (Impacto 5, Esforço 3 — ADMIN sempre).

## 2026-11-17 06:24–06:35 — Núcleo de autenticação: JWT + refresh rotativo com detecção de reuso (AuthService)

**Pesquisa do ciclo (frente e — segurança/LGPD: autenticação em software escolar)**
- MFA p/ staff é o padrão em 2026: Realsmart — admins e owners SEMPRE usam 2FA, sem
  como desligar, 14 dias p/ configurar a partir do próximo login; Infotech — a escola
  escolhe "só admins" ou "todo o staff", e quem deve e não configurou só abre a página
  de Segurança; FACTS SIS (abr/2026) — MFA p/ staff e pais, alunos fora. CISA põe o
  MFA no topo dos investimentos de cibersegurança K-12.
- Refresh rotativo com detecção de reuso é obrigatório, não opcional (OAuth 2.1 / RFC 9700,
  jan/2025): access de 15 min, refresh de 7–30 dias com teto absoluto, rotação a cada uso,
  família revogada inteira quando um token já usado reaparece, janela de graça de ~10 s
  p/ retry de rede (devolver o mesmo sucessor, não tratar como roubo). Refresh opaco +
  só o hash guardado; cookie httpOnly + Secure + SameSite, nunca localStorage.
- Senha (NIST SP 800-63B rev. 2025): comprimento mínimo + bloqueio de senhas comuns/
  vazadas, sem complexidade forçada nem troca periódica; OWASP: Argon2id ou bcrypt ≥ 10
  (aqui scrypt da stdlib, sem dependência nova). Lockout: 5 tentativas erradas travam
  15 min (Infotech); todo login/falha/mudança de 2FA vai p/ o AuditLog.
- Tutor por código SMS, não por senha (Infotech) — pais não gerenciam senha p/ buscar
  o filho. MFA de aluno sem telefone é o erro dos SIS (Cornerstone, out/2026) — nossos
  alunos não têm login, registrado só p/ não copiar o erro.
- Achados registrados em `docs/product/IDEAS.md` (seção frente e, ciclo 15); a ideia
  implementada neste ciclo foi a promovida do BACKLOG: **núcleo do Auth** (Impacto 5,
  Esforço 2 — fecha a base do Step 2; 2FA TOTP p/ staff ficou como fase 2).

**O que foi feito**
- Novo `AuthService` (lógica pura, in-memory como os demais serviços; persistência no
  Step 2 via `User`/`SchoolMember` — já no schema — + `RefreshToken`, novo modelo):
  **registro/login** com senha em scrypt (salt aleatório, N=16384/r=8/p=1), mínimo de
  8 caracteres + blocklist das senhas mais comuns; **access token JWT HS256 de 15 min**
  (`JWT_ACCESS_SECRET` — já no `.env.example` — `iss=tutorpass`, `aud=tutorpass-api`,
  `alg` fixo, `jti` único; o payload carrega `schoolId` + `roles` da escola da sessão);
  **refresh opaco de uso único com rotação** — a cada uso o token morre e nasce um
  sucessor na mesma família, teto absoluto de 30 dias (`JWT_REFRESH_TTL_DAYS`); **detecção
  de reuso** — token rotacionado fora da graça de 10 s revoga a família inteira e fica
  em `listReuseDetections()` (gancho p/ o SecurityIncidentService); revogação legítima
  (logout, troca de senha, expiração) NÃO dispara o alarme — essa distinção foi
  corrigida durante os testes (a 1ª versão tratava toda reapresentação de token
  revogado como roubo); **lockout** de 5 tentativas/15 min por e-mail; **troca de senha**
  exige a atual e derruba todas as sessões; **`authorize`/`requireAuthorize`** por
  tenant + papel (`ADMIN`/`COORDINATOR`/`GATE_AGENT`/`TEACHER`/`TUTOR`) a partir do
  payload do token — o `schoolId` nunca vem do body; `listSessions` p/ "minhas sessões"
  sem expor token ou hash. `AuthModule` ligado no `AppModule`.
- Schema Prisma: novo modelo `RefreshToken` (`jti`, `userId`, `familyId`, `tokenHash`
  único, `expiresAt`, `familyExpiresAt`, `revokedAt`, `replacedByJti`, `replacedAt`)
  + back-relation em `User`.
- Documentado no README do módulo: o que o serviço faz, o que NÃO faz (guards, controller
  `/auth/*`, seed, 2FA TOTP, login de tutor por SMS) e o contrato do Step 2 (janela de
  graça via cache Redis de 10 s — o segredo bruto nunca é persistido; lockout no Redis;
  refresh em cookie httpOnly com path `/auth/refresh`).

**Arquivos alterados**
- `apps/api/src/modules/auth/auth.service.ts` (novo)
- `apps/api/src/modules/auth/auth.service.spec.ts` (novo, 28 testes)
- `apps/api/src/modules/auth/auth.module.ts` (novo)
- `apps/api/src/modules/auth/README.md` (stub substituído pela documentação da feature)
- `apps/api/src/app.module.ts` (+ AuthModule)
- `apps/api/prisma/schema.prisma` (modelo RefreshToken + back-relation em User)
- `docs/product/IDEAS.md` (seção frente e, ciclo 15 + ideia implementada), `BACKLOG.md` (núcleo do Auth concluído; Guard + controller + seed como próxima candidata)

**Verificação**
- `node node_modules/jest/bin/jest.js --config jest.config.js`: 18 suítes, **256/256 testes passando** (228 anteriores + 28 novos; registro/validação de senha, login com/sem escola, lockout 5/15 min e desbloqueio, payload JWT com iss/aud, expirado/adulterado/alg none, rotação, replay na graça devolvendo o mesmo sucessor, reuso fora da graça revogando a família + detecção, refresh expirado, logout idempotente sem alarme, revokeAll, troca de senha derrubando sessões, listSessions sem vazar token, authorize por tenant/papel; 1ª rodada: 247/256 — 9 testes chamavam `loginOk()` sem registrar o usuário antes; corrigido no teste, não no serviço).
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` na API: **exit 0, sem erros** (`npx tsc` indisponível no sandbox — usa o binário local, como nos ciclos anteriores).
- `prisma validate` + `prisma format` no schema: **válido**; `prisma generate`: **Prisma Client gerado** (inclui RefreshToken). Validação com `DATABASE_URL` fictícia só p/ o comando — sem DB real no sandbox; `.env` não tocado.

**Próximo item sugerido**
- **Guard de tenant/RBAC (JwtAuthGuard + @Roles + TenantGuard) + controller REST /auth/* + seed de escola demo** (fecha o Auth do Step 2 sobre o AuthService — o guard usa `verifyAccessToken` + `authorize`; o seed cria escola demo com ADMIN + GATE_AGENT + TEACHER + tutor) ou **preço publicado por aluno/mês** (Impacto 4, Esforço 1) ou **2FA TOTP p/ staff** (Impacto 5, Esforço 3 — ADMIN sempre).

## 2026-11-17 05:54–06:04 — Relatório de tempo de saída p/ diretoria (DismissalReportService)

**Pesquisa do ciclo (frente d — modelo de negócio/preço/onboarding: o relatório como argumento de venda)**
- PikMyKid/TechAhead: vende "33% menos tempo na fila" (mínimo), US$ 47 mil economizados
  por escola/ano e 75 min/semana devolvidos ao professor; Albion (PikMyKid) mede saída
  média de 15 min do início ao fim. O relatório é a prova de valor, não um acessório.
- Comparativo 2026 (eathealthy365): "Reporting & Analytics" é critério de compra — quanto
  o tempo de saída caiu, quais os dias mais cheios, p/ mostrar o valor ao conselho e à
  comunidade de pais; DismissalFlow é criticado por ter reporting "overkill" p/ escolas
  pequenas — o nosso fica no essencial (média, pico, score).
- Placa.ai (2026): 45+ min de saída média com coordenação manual; relatório diário +
  tendências de horário + gargalos; "One-Lane Pilot": configurar uma faixa, medir a
  redução do tempo de espera e o feedback dos pais depois de 30 dias — o piloto vira a
  prova de venda. Nosso resumo de período já compara dois intervalos; o comparador A vs B
  com delta fica p/ a fase 2.
- Achados registrados em `docs/product/IDEAS.md` (seção frente d, ciclo 14); a ideia
  implementada neste ciclo foi a promovida do BACKLOG: **relatório de tempo de saída p/
  diretoria ("escola amiga do trânsito")** (Impacto 4, Esforço 2 — GoHome já vende esse
  ângulo no BR; fecha também o item de relatórios do Step 3).

**O que foi feito**
- Novo `DismissalReportService` (lógica pura, in-memory como os demais serviços;
  persistência no Step 2 sobre `PickupQueueEntry` + `PickupLog`, já no schema — sem
  mudança no schema neste ciclo): **espera = chamada→liberação** e tempo na fila =
  entrada→chamada; **resumo diário** — total, média, mediana, p95, máxima, fração das
  esperas ≤ 5 min, janela de pico de 15 min (empate: a mais cedo vence), quebra por modo
  (CAR/WALK/BUS/VAN) e por sala; **score "escola amiga do trânsito" 0–100** com rótulo
  (EXCELENTE ≥ 80 / BOA ≥ 60 / ATENCAO ≥ 40 / CRITICA) — fórmula `50 × fração ≤ 5 min +
  50 × max(0, 1 − média/15 min)`; **resumo de período** com série diária p/ gráfico,
  melhor/pior dia e dia mais cheio (p/ o piloto de 30 dias: comparar antes/depois);
  **export CSV** (uma linha por dia, números ausentes vazios, nunca zero); **sem dado,
  as estatísticas são null** — nunca número inventado; ingestão idempotente por `eventId`;
  validação (releasedAt ≥ joinedAt, calledAt no intervalo, nunca no futuro, modo no enum);
  isolamento por escola; `purgeOlderThan(90)` p/ retenção. `ReportsModule` ligado no
  `AppModule` (o diretório `reports/` tinha só um stub).
- Documentado no README do módulo: o que mede, a fórmula do score (proposta de
  lançamento — validar os limites de 5 e 15 min com os primeiros pilotos), regras de
  privacidade (só contagens e médias, nunca nome de aluno/tutor) e fase 2 (comparador de
  piloto A vs B, relatório diário por e-mail).

**Arquivos alterados**
- `apps/api/src/modules/reports/dismissal-report.service.ts` (novo)
- `apps/api/src/modules/reports/dismissal-report.service.spec.ts` (novo, 20 testes)
- `apps/api/src/modules/reports/reports.module.ts` (novo)
- `apps/api/src/modules/reports/README.md` (stub substituído pela documentação da feature)
- `apps/api/src/app.module.ts` (+ ReportsModule)
- `docs/product/IDEAS.md` (seção frente d, ciclo 14 + ideia implementada), `BACKLOG.md` (relatório concluído; Auth JWT como próxima candidata)

**Verificação**
- `node node_modules/jest/bin/jest.js --config jest.config.js`: 17 suítes, **228/228 testes passando** (208 anteriores + 20 novos; espera/fila, validação, idempotência, média/mediana/p95, janela de pico e empate, quebras por modo/sala, score 93/57/0, isolamento por escola, período com melhor/pior dia, CSV com dias vazios, expurgo; 1ª rodada: 226/228 — 2 testes registravam eventos de 18/11 com `now` fixo em 17/11 e batiam na validação "releasedAt no futuro"; corrigido no teste, com `now` posterior, não no serviço).
- `tsc --noEmit -p tsconfig.json` na API: **exit 0, sem erros**.
- Sem mudança no schema Prisma (fonte `PickupQueueEntry`/`PickupLog` já existe) — por isso sem `prisma validate` neste ciclo.

**Próximo item sugerido**
- **Auth JWT + refresh + Guard de tenant/RBAC + seed de escola demo** (fechando a base do Step 2 — schema válido e 14 módulos de lógica pura prontos) ou **preço publicado por aluno/mês** (Impacto 4, Esforço 1 — benchmark 2026: US$ 4–12/aluno/ano; publicar preço simples em R$ é diferencial contra os "quote" gringos).

## 2026-11-17 05:24–05:45 — Módulo van/fretado (VanRouteService)

**Pesquisa do ciclo (frente b — concorrentes Brasil: transporte escolar/van)**
- Escolar (lp.escolar.app.br, 2026): "a rota não fecha com criança a bordo
  nem com criança sem registro" — se a rota passa do tempo com criança a
  bordo, alerta a cada 5 min por até 2 h (no dobro do tempo, a família é
  avisada); no fim, o motorista confirma que foi até o último banco e que
  o veículo está vazio; cada criança tem 3 toques ("Embarcou", "Entregue",
  "Não estava no ponto"); "Corrigir pede um motivo e guarda o registro
  original — nada é apagado: a hora de um embarque é prova"; o responsável
  avisa que o aluno não vai e o motorista já fica sabendo; preço a partir
  de R$ 47/mês por transportador.
- Vanep (2026): 4 avisos por dia (embarcou em casa, chegou na escola,
  embarcou na volta, chegou em casa); "não vai hoje" com um toque; avisa o
  motorista antes de qualquer documento vencer — com documento vencido, não
  recebe novos alunos; 1º mês grátis.
- Clickvan: motorista inicia o roteiro, registra embarque/ausência/
  desembarque/não desembarque; responsáveis recebem notificação no início
  e na aproximação da van; localização compartilhada durante a viagem.
- Cadê a Van? / Via Van: localização só visível enquanto a rota roda; aviso
  automático 5 min antes de chegar na casa do aluno; plano grátis R$ 0 e
  Individual R$ 29,90/mês. VanEscola: notificação de aproximação com um
  clique; pai avisa a ausência do aluno.
- Achados registrados em `docs/product/IDEAS.md` (seção frente b, ciclo 13);
  a ideia implementada neste ciclo foi a promovida do BACKLOG: **módulo
  van/fretado** (Impacto 5, Esforço 3 — realidade BR que os gringos ignoram;
  nosso VAN_MODULE já existia como feature do PRO no PlanService).

**O que foi feito**
- Novo `VanRouteService` (lógica pura, in-memory como os demais serviços;
  persistência no Step 2 via `VanRoute` + `VanRouteStop`, já no schema):
  **rota com paradas ordenadas** (ida `TO_SCHOOL` / volta `TO_HOME`, dia
  letivo `YYYY-MM-DD`, duração esperada default 90 min); **1 rota ativa
  por motorista**; **3 toques por criança** — `markBoarded` ("Embarcou"),
  `markDelivered` ("Entregue"), `markAbsent` ("Não estava no ponto", com
  observação) — mais `markWillNotRide` ("não vai hoje", avisado pelo
  responsável antes ou durante a rota, enquanto WAITING); **`nextStop`** —
  a "criança da vez" (primeira parada ainda WAITING na ordem);
  **a rota NÃO fecha com criança a bordo nem sem registro** — `finishRoute`
  e `cancelRoute` bloqueados listando quem está a bordo e quem está sem
  registro; **`listOverdueRoutes`** — rotas além da duração esperada com
  criança a bordo, com minutos de atraso, p/ o alerta periódico do Step 2;
  **correção com motivo** (`correctStop` — motivo ≥ 3 caracteres, só entre
  estados registrados, o evento original fica no log); **log append-only
  com hash encadeado** por rota + `verifyChain` (a hora de um embarque é
  prova); só o motorista da rota registra embarques (403 p/ outro);
  `refresh()` cancela rotas planejadas de dias passados. `VanRoutesModule`
  ligado no `AppModule`.
- Schema Prisma: novos enums `VanDirection` + `VanRouteStatus` +
  `VanStopStatus` e modelos `VanRoute` + `VanRouteStop`, com back-relations
  em School e Student.
- Documentado no README do módulo: o aluno da van não passa pela fila da
  portaria; notificações via NotificationService em dual-path (kinds
  VAN_BOARDED/VAN_DELIVERED no Step 2); posição da van só durante a rota e
  nunca persistida; preço de referência dos apps de van vs PRO.

**Arquivos alterados**
- `apps/api/src/modules/van-routes/van-route.service.ts` (novo)
- `apps/api/src/modules/van-routes/van-route.service.spec.ts` (novo, 17 testes)
- `apps/api/src/modules/van-routes/van-routes.module.ts` (novo)
- `apps/api/src/modules/van-routes/README.md` (documentação da feature)
- `apps/api/src/app.module.ts` (+ VanRoutesModule)
- `apps/api/prisma/schema.prisma` (enums + 2 modelos + back-relations)
- `docs/product/IDEAS.md` (seção frente b, ciclo 13 + ideia implementada), `BACKLOG.md` (van concluída; Auth JWT como próxima candidata)

**Verificação**
- `node node_modules/jest/bin/jest.js --config jest.config.js`: 16 suítes, **208/208 testes passando** (191 anteriores + 17 novos; ordem das paradas, 1 rota ativa/motorista, fluxo embarcou→entregue, "não estava no ponto", "não vai hoje", criança da vez, fechamento bloqueado com criança a bordo e sem registro, cancelamento bloqueado, correção com motivo + log preservado, alerta de rota vencida, adulteração no log, refresh idempotente, isolamento por escola, só o motorista registra).
- `tsc --noEmit -p tsconfig.json` na API: **exit 0, sem erros**.
- `prisma validate` + `prisma format` no schema: **válido**; `prisma generate`: **Prisma Client gerado** (inclui VanRoute/VanRouteStop). Validação com `DATABASE_URL` fictícia só p/ o comando — sem DB real no sandbox; `.env` não tocado.

**Próximo item sugerido**
- **Auth JWT + refresh + Guard de tenant/RBAC + seed de escola demo** (fechando a base do Step 2 — schema válido e 13 módulos de lógica pura prontos) ou **relatório de tempo de saída p/ diretoria ("escola amiga do trânsito")** (Impacto 4, Esforço 2 — tempo médio de saída e redução de fila como material de venda).

## 2026-11-17 04:54–05:10 — Modo telão/TV (portaria e sala) (DisplayBoardService)

**Pesquisa do ciclo (frentes c/d — UX de painéis + modelo de negócio/preço)**
- O telão é o produto, não um acessório: PickupRoster (board ao vivo no navegador,
  cada sala/corredor/tela atualiza junto), Schoolhouse Driveline (nome + local de
  retirada por cor em smartboards/projetores/qualquer navegador, até 9 locais),
  Time To Dismiss (nomes grandes de alto contraste em TVs a partir de um link, sem
  instalar nada), Carline Hound (telão na área de embarque). O comparativo de 2026
  pergunta literalmente "quem vê o resultado: só o aparelho do staff, um board ao
  vivo p/ salas e corredores, ou as famílias também?".
- Dismissal Magic: quando a turma é chamada, um ônibus ocupa a tela inteira com um
  sino, p/ ninguém perder do fundo da sala; cada turma vê os ônibus chegando,
  esperando e saindo na ordem certa — o gesto do nosso `callStudent`.
- Preço por escola/ano é o modelo dos telões: Dismissal Magic US$ 149–249/escola/
  ano (telas ilimitadas, 1 mês grátis), PickupRoster US$ 150/mês (Car Line),
  Schoolhouse Driveline US$ 748 no 1º ano e US$ 935/ano por campus (sem taxa por
  aluno), Carline Hound US$ 33/mês ou US$ 299/ano — reforça a anotação da frente d
  (avaliar um piso p/ o PRO no billing) e o preço publicado em R$ como diferencial.
- Tela nova de 43–55" custa US$ 550–2.250 instalada (Pickcel, out/2026), mas a
  maioria das escolas já tem smart TVs — nosso telão roda em qualquer navegador,
  sem player dedicado, então o custo de hardware novo p/ a escola é zero.
- Achados registrados em `docs/product/IDEAS.md` (seção frentes c/d, ciclo 12);
  a ideia implementada neste ciclo foi a promovida do BACKLOG: **modo telão/TV**
  (Impacto 4, Esforço 2 — consome a fila do EtaService num board de duas colunas,
  sem rolagem; ReadyBell/Technothera já vendem esse board).

**O que foi feito**
- Novo `DisplayBoardService` (lógica pura, in-memory como os demais serviços;
  persistência no Step 2; sem mudança no schema Prisma — nada persistido nesta
  versão): **duas colunas sem rolagem** — "Pronto p/ retirada" vs "A caminho" —
  a partir da fila do EtaService (o controller do Step 2 mapeia tutor → alunos);
  **paginação com rotação automática** (default 8 cartões/coluna, máx. 12, vira a
  página sozinha a cada 15 s; `nextPage` p/ avanço manual); **3 modos de tela** —
  GATE (portaria, nome completo + foto), CLASSROOM (só os alunos da sala,
  `classroomId` obrigatório) e HALLWAY (corredor: 1º nome + inicial do sobrenome,
  **sem foto** — tela pública, LGPD); **chamada com pop-up** (`callStudent` —
  20 s em tela cheia com contagem regressiva, uma ativa por escola, a mais recente
  vence; o banner só aparece se o aluno ainda estiver na fila; `clearCall`
  cancela); **rótulos de ETA** ("ENCAMINHAR JÁ" p/ READY+RED, "chega em ~N min",
  "sem sinal" — nunca ETA inventado); **board vazio** mostra tela calma
  (`isEmpty`), nunca em branco; `refresh()` remove telas sem consulta há 10 min
  (TV desligada). `DisplayBoardModule` ligado no `AppModule`. Feature `TV_MODE`
  já existia no PRO (PlanService) — o controller do Step 2 só precisa conferir
  `hasFeature(plano, 'TV_MODE')` antes de registrar a tela.
- Documentado no README do módulo: pareamento da TV por link com `displayId`
  (sem login de staff), snapshot por poll ou push realtime, foto só com
  consentimento `STUDENT_PHOTO` (e nunca no corredor), fase 2 (sino/áudio na TV,
  destaque por zona de embarque 1–6).

**Arquivos alterados**
- `apps/api/src/modules/display-board/display-board.service.ts` (novo)
- `apps/api/src/modules/display-board/display-board.service.spec.ts` (novo, 16 testes)
- `apps/api/src/modules/display-board/display-board.module.ts` (novo)
- `apps/api/src/modules/display-board/README.md` (documentação da feature)
- `apps/api/src/app.module.ts` (+ DisplayBoardModule)
- `docs/product/IDEAS.md` (seção frentes c/d, ciclo 12 + ideia implementada), `BACKLOG.md` (telão concluído; módulo van/fretado como próxima candidata)

**Verificação**
- `node node_modules/jest/bin/jest.js --config jest.config.js`: 15 suítes, **191/191 testes passando** (175 anteriores + 16 novos; colunas, rótulos de ETA, paginação, rotação automática, máscara de nome/foto no corredor, filtro por sala, pop-up de chamada com expiração, chamada fora da fila, board vazio, isolamento por escola, expurgo de telas).
- `tsc --noEmit -p tsconfig.json` na API: **exit 0, sem erros**.
- Sem mudança no schema Prisma (nada persistido nesta versão) — por isso sem `prisma validate` neste ciclo.

**Próximo item sugerido**
- **Módulo van/fretado** (Impacto 5, Esforço 3 — o motorista retira vários alunos numa rota, realidade BR que os gringos ignoram; próxima candidata do BACKLOG) ou, fechando a base do Step 2, **Auth JWT + refresh + Guard de tenant/RBAC + seed de escola demo**.

## 2026-11-17 04:24–04:45 — ETA ao vivo do tutor + fila ordenada por proximidade (EtaService)

**Pesquisa do ciclo (frente c — UX/design de painéis e apps de fila)**
- ReadyBell (2026): ETA "traffic-aware" (MapKit, calculado 1× por pedido, não
  pollado), fila do professor ordenada por urgência, chip de ETA + contagem
  regressiva ao vivo e timeline de 5 passos visível p/ pai e professor ao
  mesmo tempo; board em paisagem (Pickup Lane) separa "Ready for Pickup" de
  "Getting Ready".
- Technothera Smart Dismissal (2026): contagem regressiva por pedido, selo
  ARRIVED pulsante em todas as telas, READY em verde, ordem automática
  Chegou → Pronto → Contagem regressiva.
- PickupFlow (2026): ETA em contagem regressiva por família, fila ao vivo por
  carro/a pé, botão "I'm Here" com checagem de localização; SafePickApp
  (2026): "4 minutes to gate", chip de ETA, fila ao vivo espelhada nos dois
  lados (pai e escola veem a mesma sessão).
- Cores no mundo real: escolas americanas usam cor da placa por série com
  horário de fila por cor, e cones coloridos no pátio (Swift Creek, ago/2026:
  6 primeiros alunos em ordem vermelho→roxo, cada um num cone da mesma cor)
  — a cor como identificador rápido vale mais que texto.
- Preço dos entrantes 2026: DismissPro grátis 12 meses e depois US$ 199/
  escola/ano; "pickup." grátis p/ as 250 primeiras escolas, depois US$ 200/
  escola/ano — o preço por escola/ano é o modelo dos entrantes; nosso PRO
  (R$ 2,90/aluno/mês) precisa do piso p/ escolas pequenas (já anotado na
  frente d) p/ não perder p/ esse modelo.
- Achados registrados em `docs/product/IDEAS.md` (seção frente c, ciclo 11);
  a ideia implementada neste ciclo foi a promovida do BACKLOG: **ETA ao vivo
  + fila ordenada por proximidade** (Impacto 5, Esforço 3 — Escola Ágil/
  Cheguei vendem exatamente isso; nosso geofencing já existe, faltava estimar
  o ETA e ordenar a fila).

**O que foi feito**
- Novo `EtaService` (lógica pura, in-memory como os demais serviços;
  persistência no Step 2 via Redis, mesma chave do geofence): **faixas de ETA**
  HERE (≤ 250 m ou botão "Estou aqui") / NOW (≤ 2 min) / SOON (≤ 5 min) /
  LATER (≤ 10 min) / FAR (> 10 min) / STALE (sem posição há > 60 s), com
  **cor de urgência** RED/ORANGE/YELLOW/BLUE/GRAY (ClipEscola: < 40 m =
  vermelho, "encaminhar já" — nosso HERE é RED); ETA = distância em linha
  reta (haversine, do GeofencingService) / velocidade, arredondado p/ cima
  ("cerca de N min", nunca horário exato); velocidade do GPS quando há,
  senão default **30 km/h carro / 5 km/h a pé** (velocidade ≤ 0 cai no default,
  nunca divide por zero; teto de 130 km/h contra GPS absurdo); **fila ordenada
  p/ chamar** — chegados primeiro (por ordem de chegada), depois ETA crescente
  (desempate: menor distância), STALE por último com `position` 1-based;
  **botão "Estou aqui"** (`markArrived` — RIS ONE/PickupFlow) como fallback
  manual p/ GPS falho, criando a entrada se preciso; **histerese de saída
  +40 m** (mesma do geofence) p/ o tutor chegado não "des-chegar" por jitter
  do GPS; **STALE não some da fila** — fica visível como "sem sinal" (ETA
  null), nunca com ETA inventado; `refresh()` tira da fila quem não atualiza
  há 5 min (idempotente, job junto aos demais). Posição nunca persistida
  (minimização LGPD). `EtaModule` ligado no `AppModule`. Sem mudança no
  schema Prisma (nada persistido nesta versão) — por isso sem `prisma
  validate` neste ciclo.
- Documentado no README do módulo: ETA com trânsito (rota real, MapKit/
  Google) é fase 2; até lá, linha reta + faixas de 2/5/10 min já resolve a
  dor da portaria ("quem eu preparo agora?").

**Arquivos alterados**
- `apps/api/src/modules/eta/eta.service.ts` (novo)
- `apps/api/src/modules/eta/eta.service.spec.ts` (novo, 15 testes)
- `apps/api/src/modules/eta/eta.module.ts` (novo)
- `apps/api/src/modules/eta/README.md` (documentação da feature)
- `apps/api/src/app.module.ts` (+ EtaModule)
- `docs/product/IDEAS.md` (seção frente c, ciclo 11 + ideia implementada), `BACKLOG.md` (ETA concluído; modo telão/TV como próxima candidata)

**Verificação**
- `node node_modules/jest/bin/jest.js --config jest.config.js`: 14 suítes, **175/175 testes passando** (160 anteriores + 15 novos; faixas de ETA, velocidade do GPS/default, ordenação da fila, desempate, STALE, refresh idempotente, botão "Estou aqui", histerese, reanimação por nova posição, isolamento por escola).
- `tsc --noEmit -p tsconfig.json` na API: **exit 0, sem erros**.

**Próximo item sugerido**
- **Modo telão/TV (portaria e sala)** (Impacto 4, Esforço 2 — consome a fila do EtaService num board de duas colunas "Pronto p/ retirada" vs "A caminho", sem rolagem; ReadyBell/Technothera já vendem esse board) ou, fechando a base do Step 2, **Auth JWT + refresh + Guard de tenant/RBAC + seed de escola demo**.

## 2026-11-17 03:54–04:10 — Registro de incidentes de segurança com prazo de comunicação ANPD (SecurityIncidentService)

**Pesquisa do ciclo (frente a — concorrentes internacionais de school dismissal)**
- CENTEGIX Dismissal (ex-PikMyKid, rebatizada out/2026): dismissal agora é parte
  de uma Safety Platform com resposta a emergências, reunificação pai/filho,
  gestão de visitantes, passes de corredor e alertas vestíveis — 18 mi de pessoas
  em 18 mil locais. As suites amplas seguem absorvendo os dismissal-only; nossa
  tese ("o melhor SÓ em saída") precisa de prova concreta a cada ciclo.
- Vazamentos em software escolar são reais e a comunicação é lenta: Frontline
  Education (ago/2026) — invasão por falha em software de terceiro, 1,3 mi+ de
  pessoas (SSNs, datas de nascimento, CNH/passaporte, Medicaid IDs e IDs de
  alunos), cartas aos afetados só a partir de 26/10/2026; Equipple, Irlanda do
  Norte (nov/2026) — acesso não autorizado à nuvem, ~50 mil usuários, contato
  de pais + nomes, datas de nascimento e turmas de alunos.
- Nenhum concorrente de dismissal publica um registro estruturado de incidentes
  — é o nosso diferencial de auditoria (tese: auditoria imutável) e a prova de
  que o relógio de 3 dias úteis da Res. CD/ANPD nº 15/2024 não pode depender
  de planilha e memória.
- Achados registrados em `docs/product/IDEAS.md` (seção frentes a/e, ciclo 10);
  a ideia implementada neste ciclo foi a promovida do BACKLOG: **registro de
  incidentes de segurança com prazo de comunicação ANPD** (Impacto 4, Esforço 2).

**O que foi feito**
- Novo `SecurityIncidentService` (lógica pura, in-memory como os demais serviços;
  persistência no Step 2 via `SecurityIncident`, já no schema): registro do
  incidente com **categorias de dados envolvidos, nunca o conteúdo vazado**
  (o registro não pode virar um segundo vazamento) e contagem de titulares;
  categorias típicas de escola (`WRONG_RECIPIENT`, `OPEN_SPREADSHEET`,
  `LOST_DEVICE`, `UNAUTHORIZED_ACCESS`, `RANSOMWARE`, `OTHER`); **`relevantRisk`**
  decide a obrigação — com risco relevante, ANPD + titulares têm de ser
  comunicados; sem ele, o incidente é registrado e contido e fecha sem
  comunicação obrigatória; **relógio em dias úteis** (`addBusinessDays`/
  `businessDaysBetween`, sáb/dom fora — feriados fora do escopo desta versão):
  `communicationDueAt` = detectedAt + 3 dias úteis, `supplementDueAt` = +20 dias
  úteis (complementação); fluxo **OPEN → CONTAINED → COMMUNICATED → CLOSED**
  (comunicação à ANPD e aos titulares a partir de OPEN ou CONTAINED; fechar
  exige contenção + comunicações obrigatórias); **`listOverdue`** — a lista que
  o DPO abre toda manhã (comunicação vencida e não feita, ou complementação
  vencida); `businessDaysRemaining` (negativo = vencido); **log append-only com
  hash encadeado** por incidente (`REPORTED/CONTAINED/ANPD_NOTIFIED/
  SUBJECTS_NOTIFIED/SUPPLEMENT_SENT/NOTE/CLOSED`) com `verifyChain` — a prova
  p/ a ANPD. `IncidentsModule` ligado no `AppModule`.
- Schema Prisma: novos enums `SecurityIncidentCategory` + `SecurityIncidentStatus`
  e modelo `SecurityIncident`, com back-relation em School.

**Arquivos alterados**
- `apps/api/src/modules/incidents/security-incident.service.ts` (novo)
- `apps/api/src/modules/incidents/security-incident.service.spec.ts` (novo, 20 testes)
- `apps/api/src/modules/incidents/incidents.module.ts` (novo)
- `apps/api/src/modules/incidents/README.md` (documentação da feature)
- `apps/api/src/app.module.ts` (+ IncidentsModule)
- `apps/api/prisma/schema.prisma` (enums + modelo SecurityIncident + back-relation)
- `docs/product/IDEAS.md` (seção frentes a/e, ciclo 10 + ideia implementada), `BACKLOG.md` (incidentes ANPD concluído; ETA ao vivo como próxima candidata)

**Verificação**
- `node node_modules/jest/bin/jest.js --config jest.config.js`: 13 suítes, **160/160 testes passando** (140 anteriores + 20 novos; prazos em dias úteis com fim de semana, fluxo OPEN→CLOSED, bloqueio de fechamento sem comunicação obrigatória, complementação, `listOverdue`, detecção de adulteração no log).
- `tsc --noEmit -p tsconfig.json` na API: **exit 0, sem erros**.
- `prisma validate` + `prisma format` no schema: **válido** (validação com `DATABASE_URL` fictícia só p/ o comando — sem DB real no sandbox; `.env` não tocado).

**Próximo item sugerido**
- **ETA ao vivo do tutor no painel + fila ordenada por proximidade** (Impacto 5, Esforço 3 — Escola Ágil/Cheguei vendem exatamente isso; nosso geofencing já existe, falta estimar o ETA e ordenar a fila) ou, fechando a base do Step 2, **Auth JWT + refresh + Guard de tenant/RBAC + seed de escola demo**.

## 2026-11-17 03:24–03:45 — Notificação dual-path (push + registro durável in-app)

**Pesquisa do ciclo (frente e — segurança, LGPD de menores e auditoria)**
- ECA Digital regulamentado pelo Decreto 12.880/2026, em vigor desde 17/03/2026:
  regras próprias p/ produtos/serviços de TI direcionados a crianças ou de acesso
  provável por esse público, fiscalizados pela ANPD (diarioescola.com.br, ago/2026).
- Incidente de segurança (Resolução CD/ANPD nº 15/2024): quando puder acarretar
  risco ou dano relevante, o controlador comunica a ANPD e os titulares afetados
  em **3 dias úteis** (complementação em até 20 dias úteis). A infração mais
  comum apurada pela ANPD não é o vazamento — é a **falha em comunicar no prazo**;
  arquivo enviado à família errada, planilha com permissão aberta e equipamento
  perdido também contam como incidente (ezeats.app.br, set/2026;
  educacaoeprofissao.com.br, atual. 23/10/2026).
- Transferência internacional de dados (art. 33 LGPD, Resolução ANPD 19/2024):
  só nos casos listados (cláusulas-padrão, consentimento específico) — nosso push
  passa por infra fora do BR (Expo), a mapear no relatório de conformidade
  (safeguardis.org, 19/10/2026).
- Dever de denunciar violência contra criança (Lei 14.344/2022 Henry Borel,
  Lei 13.431/2017, Lei 14.811/2024 bullying/cyberbullying crime): denúncia ao
  Conselho Tutelar / Disque 100 — fora da tese de saída, fase 2 com orientação
  jurídica.
- Achados registrados em `docs/product/IDEAS.md` (seção frente e, ciclo 9); a ideia
  implementada neste ciclo foi a promovida do BACKLOG: **notificação dual-path**
  (Impacto 4, Esforço 2, frente f — ReadyBell).

**O que foi feito**
- Novo `NotificationService` (lógica pura, in-memory como os demais serviços;
  persistência no Step 2 via `Notification`, já no schema): o **registro in-app
  é criado primeiro e sempre** (entrega garantida); o **push é o 2º caminho,
  best-effort** (porta `PushSender` injetável — no Step 2, Expo Push API), e
  nunca é a única cópia. Push só com **consentimento PUSH_NOTIFICATIONS +
  token Expo** — sem consentimento (`SKIPPED_NO_CONSENT`) ou sem token
  (`SKIPPED_NO_TOKEN`), o push é pulado com o motivo registrado, nunca erro
  silencioso; sem `PushSender` configurado, `NOT_CONFIGURED` (antes do app
  mobile). `delivery` resume: DELIVERED / IN_APP_ONLY / PARTIAL (push falhou,
  mensagem no app + retry). **Retry do push até 3 tentativas**; depois disso,
  só o app entrega. **Leitura isolada por tutor** (marcar lida de outro
  destinatário dá 403); `listUnread`/`unreadCount`/`markAllRead` p/ o app.
  **Retenção**: `purgeReadOlderThan(90)` apaga só notificações já lidas e
  antigas — não lida nunca é expurgada. Tipos: `EARLY_DISMISSAL_DECISION`
  (a decisão da saída antecipada chegando ao tutor), `STUDENT_CALLED`,
  `PLAN_CHANGED`, `AUTHORIZATION_CREATED`, `PICKUP_COMPLETED`.
  `NotificationsModule` ligado no `AppModule`.
- Schema Prisma: novos enums `NotificationKind` + `NotificationPushStatus` e
  modelo `Notification`, com back-relations em School/Tutor.

**Arquivos alterados**
- `apps/api/src/modules/notifications/notification.service.ts` (novo)
- `apps/api/src/modules/notifications/notification.service.spec.ts` (novo, 15 testes)
- `apps/api/src/modules/notifications/notifications.module.ts` (novo)
- `apps/api/src/modules/notifications/README.md` (documentação da feature)
- `apps/api/src/app.module.ts` (+ NotificationsModule)
- `apps/api/prisma/schema.prisma` (enums + modelo Notification + back-relations)
- `docs/product/IDEAS.md` (seção frente e, ciclo 9 + ideia implementada), `BACKLOG.md` (dual-path concluída; registro de incidentes ANPD como próxima candidata)

**Verificação**
- `node node_modules/jest/bin/jest.js --config jest.config.js`: 12 suítes, **140/140 testes passando** (125 anteriores + 15 novos; registro in-app garantido com push falho, pulos por falta de consentimento/token, retry até 3, isolamento de leitura por tutor, expurgo só de lidas antigas).
- `tsc --noEmit -p tsconfig.json` na API (via store pnpm): **exit 0, sem erros**.
- `prisma validate` + `prisma format` no schema: **válido** (validação com `DATABASE_URL` fictícia só p/ o comando — sem DB real no sandbox; `.env` não tocado).

**Próximo item sugerido**
- **Registro de incidentes de segurança com prazo de comunicação ANPD** (Impacto 4, Esforço 2, frente e — Resolução CD/ANPD nº 15/2024: log append-only do incidente + checklist de contenção/comunicação com relógio de 3 dias úteis) ou **ETA ao vivo do tutor no painel + fila ordenada por proximidade** (Impacto 5, Esforço 3).

## 2026-11-17 02:54–03:05 — Plano de saída padrão por aluno + exceção do dia com cutoff (DismissalPlanService)

**Pesquisa do ciclo (frente d — modelo de negócio/preço/onboarding + frente a, o modelo PickUp Patrol/SDM)**
- PickUp Patrol / School Dismissal Manager (guias de escolas, nov/2026): o default é o
  jeito normal de o aluno ir embora em cada dia da semana (ex.: ônibus 2ª/4ª/6ª, carro
  3ª/5ª) e a exceção é o desvio num dia específico, lançável com dias/semanas de
  antecedência; no mesmo dia, só até o cutoff — 13:30 (SDM), 14:00 (PickUp Patrol),
  13:20 (WCS); depois, só emergência por telefone. O default é da escola (só a
  secretaria muda; no PickUp Patrol nem entra pelo app, só no portal web); "COPY
  MONDAY" replica o plano de segunda p/ a semana; cada mudança gera confirmação e o
  professor é avisado; no SDM o relatório do dia sai sozinho às 13:30.
- Onboarding (2026): AiraNexus entra no ar em 7 dias úteis (migração + treino inclusos,
  CSV de qualquer sistema); osmic.co.in planeja 30 dias (setup, migração, treino,
  lançamento p/ os pais). Nossa tese de 1 dia é mais agressiva que todo o mercado — só
  se prova com CSV + onboarding assistido; o maior risco do lançamento é dado sujo
  (aluno duplicado, telefone errado).
- Preço (2026): suites de gestão cobram US$ 3,50–15/aluno/mês (ClassReach, Classter,
  Gradelink, Alma/PowerSchool); Índia ₹8–15/aluno/mês; Nigéria ₦500–2.500/aluno/termo.
  Nosso PRO (R$ 2,90/aluno/mês) fica bem abaixo de todas as faixas; quase todo
  fornecedor tem preço-mínimo (floor) p/ escolas pequenas — avaliar um piso p/ o PRO
  quando o billing entrar. Trial longo (1 termo grátis, MySchoolReg) é o padrão de
  aquisição; nosso FREE permanente (30 alunos) é o diferencial.
- Achados registrados em `docs/product/IDEAS.md` (seção frente d + ideia implementada);
  a ideia implementada neste ciclo foi a promovida do BACKLOG: **plano de saída padrão
  por aluno + exceção do dia com cutoff** (Impacto 5, Esforço 3 — dor nº 1 das secretarias).

**O que foi feito**
- Novo `DismissalPlanService` (lógica pura, in-memory como os demais serviços;
  persistência no Step 2 via `DismissalDefaultPlan` + `DismissalException`, já no
  schema): plano padrão **um modo por dia da semana** (CAR/WALK/BUS/AFTER_SCHOOL),
  **só pela secretaria** (tutor recebe 403 — o plano padrão é da escola, como no
  PickUp Patrol/SDM); CAR exige quem busca, BUS exige a linha; **`copyDefault`**
  ("copiar segunda") replica o plano de um dia p/ os demais — o atalho do cadastro em
  massa na implantação de 1 dia; **exceção do dia** criada pelo tutor ou staff, com
  antecedência livre e **cutoff 13:30 configurável por escola** (`setCutoff`) no mesmo
  dia — depois do cutoff, só emergência via secretaria; **1 exceção ativa por
  aluno/dia** (atualizar/cancelar também respeitam o cutoff; só quem criou cancela,
  staff pode cancelar qualquer uma); `resolvePlanForDate` devolve EXCEPTION >
  DEFAULT > **NONE** (sem plano, a secretaria precisa definir — nunca inventa um);
  **log append-only de mudanças** (`listChangeLog`, p/ AuditLog no Step 2);
  `refresh()` expira exceções de dias passados (job diário, junto aos demais
  refreshes). Saída antecipada NÃO é modo aqui — passa pelo EarlyDismissalService
  (motivo + aprovação). `DismissalPlansModule` ligado no `AppModule`. Contrato de
  fuso documentado: `now` chega no horário local da escola.
- Schema Prisma: novo enum `DismissalMode` + `DismissalExceptionStatus`, modelos
  `DismissalDefaultPlan` (unique por aluno+dia da semana) e `DismissalException`,
  com back-relations em School/Student.

**Arquivos alterados**
- `apps/api/src/modules/dismissal-plans/dismissal-plan.service.ts` (novo)
- `apps/api/src/modules/dismissal-plans/dismissal-plan.service.spec.ts` (novo, 23 testes)
- `apps/api/src/modules/dismissal-plans/dismissal-plans.module.ts` (novo)
- `apps/api/src/modules/dismissal-plans/README.md` (documentação da feature)
- `apps/api/src/app.module.ts` (+ DismissalPlansModule)
- `apps/api/prisma/schema.prisma` (enums + 2 modelos + back-relations)
- `docs/product/IDEAS.md` (seção frente d + ideia implementada), `BACKLOG.md` (plano padrão concluído; dual-path/ETA como próximas candidatas)

**Verificação**
- `node node_modules/jest/bin/jest.js --config jest.config.js`: 11 suítes, **125/125 testes passando** (102 anteriores + 23 novos; 1ª rodada: 123/125 — o `listChangeLog` ordenava duas mudanças do mesmo milissegundo na ordem de inserção; corrigido com desempate por ordem de inserção no serviço, não no teste).
- `tsc --noEmit -p tsconfig.json` na API (via store pnpm): **exit 0, sem erros**.
- `prisma validate` + `prisma format` no schema: **válido** (validação com `DATABASE_URL` fictícia só p/ o comando — sem DB real no sandbox; `.env` não tocado). Observação: o Prisma avisou que existe atualização major 5.22.0 → 8.0.0-rc.34 — upgrade fora do escopo deste ciclo, decisão do usuário.

**Próximo item sugerido**
- **Notificação dual-path** (Impacto 4, Esforço 2, frente f — push Expo + registro durável in-app, ReadyBell: a decisão da saída antecipada e a mudança de plano precisam chegar ao tutor mesmo se o push falhar) ou **ETA ao vivo do tutor no painel + fila ordenada por proximidade** (Impacto 5, Esforço 3).

## 2026-11-17 02:24–02:32 — Saída antecipada solicitada no app com aprovação da secretaria (EarlyDismissalService)

**Pesquisa do ciclo (frentes f/a — tecnologia/realtime + concorrentes internacionais)**
- dismissal.ai (2026, onboarding 2026–27): tutor pede saída antecipada com dia, hora e
  motivo; a secretaria aprova ou recusa e o tutor vê a resposta no app. Mudanças de plano
  do dia aplicam sozinhas; saída antecipada é o único pedido que exige aprovação.
- School Tag Parent (Google Play, atual. 25/07/2026): agenda "early releases" com
  data/hora/motivo e avisa a escola automaticamente; push em tempo real a cada scan.
- ReadyBell (2026): notificação **dual-path** (push + registro durável in-app — push que
  falha nunca significa mensagem perdida); um só fix de GPS por toque, sem rastreamento
  contínuo; fila por urgência com contagem regressiva; lockdown que bloqueia novos pedidos.
- Technothera Smart Dismissal / Greennounce: pré-aviso ~10 min antes da chegada, push
  silencioso p/ o professor deixar o aluno pronto; PWA sem download de app.
- Vámonos: cartão QR p/ avós e terceiros sem instalar o app, cancelável a qualquer momento.
- Achados registrados em `docs/product/IDEAS.md` (seção frentes f/a); a ideia implementada
  neste ciclo foi a promovida do BACKLOG: **saída antecipada com aprovação da secretaria**.

**O que foi feito**
- Novo `EarlyDismissalService` (lógica pura, in-memory como os demais serviços;
  persistência no Step 2 via `EarlyDismissalRequest`, já no schema): tutor pede com
  **motivo obrigatório** (≥ 3 caracteres), **quem busca** e dia/hora; **cutoff de 30 min**
  (pedido precisa chegar com ≥ 30 min de antecedência — pedido em cima da hora é recusado
  na origem); **1 pedido ativo por aluno por dia** (REQUESTED/APPROVED); fluxo
  REQUESTED → APPROVED/REJECTED (só staff; recusa exige motivo p/ o tutor) → USED (na
  retirada, pela portaria); REQUESTED → CANCELLED só pelo tutor que pediu; `refresh()`
  marca EXPIRED em REQUESTED/APPROVED com horário passado (job diário, junto ao expurgo
  LGPD e aos refreshes de planos/autorizações); `listPendingForSchool` (o que a secretaria
  vê, do horário mais cedo p/ o mais tarde) e `isApprovedForPickup` (o que a portaria
  consulta na retirada: APPROVED vale no dia pedido, a partir de 30 min antes do horário).
  `EarlyPickupModule` ligado no `AppModule`. Feature `EARLY_PICKUP` já existe no plano
  (FREE não tem; TRIAL/PRO têm — ver `PlanService`). Documentado no README do módulo:
  no Step 2, a decisão precisa notificar o tutor em dual-path (push Expo + registro
  durável) e o pedido aprovado alimenta a fila realtime.
- Schema Prisma: novo enum `EarlyDismissalStatus` + modelos `EarlyDismissalRequest` e
  `EarlyDismissalStudent`, com back-relations em School/Tutor/Student.

**Arquivos alterados**
- `apps/api/src/modules/early-pickup/early-dismissal.service.ts` (novo)
- `apps/api/src/modules/early-pickup/early-dismissal.service.spec.ts` (novo, 22 testes)
- `apps/api/src/modules/early-pickup/early-pickup.module.ts` (novo)
- `apps/api/src/modules/early-pickup/README.md` (documentação da feature)
- `apps/api/src/app.module.ts` (+ EarlyPickupModule)
- `apps/api/prisma/schema.prisma` (enum + 2 modelos + back-relations)
- `docs/product/IDEAS.md` (seção frentes f/a + ideia implementada), `BACKLOG.md` (saída antecipada concluída; dual-path promovida; próxima candidata atualizada)

**Verificação**
- `node node_modules/jest/bin/jest.js --config jest.config.js`: 10 suítes, **102/102 testes passando** (80 anteriores + 22 novos; cutoff, motivo, duplicata/dia, transições, cancelamento, refresh idempotente, validade na retirada).
- `tsc --noEmit -p tsconfig.json` na API (via store pnpm, `npx` indisponível no sandbox): **exit 0, sem erros**.
- `prisma validate` + `prisma format` no schema: **válido** (a validação precisou de `DATABASE_URL` fictícia só p/ o comando — sem DB real no sandbox; `.env` não tocado).

**Próximo item sugerido**
- **Plano de saída padrão por aluno + exceção do dia com cutoff** (Impacto 5, Esforço 3 — dor nº 1 das secretarias, próxima candidata do BACKLOG) ou **notificação dual-path** (Impacto 4, Esforço 2, frente f — push Expo + registro durável in-app).

## 2026-11-17 01:55–02:00 — Autorização temporária com prazo determinado (TemporaryAuthorizationService)

**Pesquisa do ciclo (frente c — UX/design de painéis e apps de fila)**
- "pickup." (2026, grátis p/ as 250 primeiras escolas, depois US$ 200/escola/ano): fila
  única compartilhada entre scanner, telão e admin; zonas de embarque 1–6; avanço em lote
  ou individual por controle do staff; scanner confirma os alunos do carro no ato.
- DismissalFlow (líder 2026): dashboard do staff com fotos grandes do aluno + color-coding;
  PikMyKid "funcional mas datado" — reconhecer o aluno pela foto em 1 s vale mais que texto.
- RIS ONE "Smart Dismissal" (mai/2026): botão "Estou aqui" no app do pai notifica a supervisão
  na hora — fallback manual p/ o nosso ARRIVAL por geofence quando o GPS falha.
- Pesquisa UX School'sOut (Baltimore, 16 semanas): placas escritas à mão no para-brisa,
  walkie-talkie e prancheta, sem prova de identidade na retirada — nosso QR dinâmico +
  selfie do delegado ataca exatamente essa dor; o painel precisa eliminar o grito e a
  prancheta, não digitalizá-los.
- Achados registrados em `docs/product/IDEAS.md` (seção UX/design, frente c); a ideia
  implementada neste ciclo foi a promovida da frente (b): **autorização temporária com prazo**.

**O que foi feito**
- Novo `TemporaryAuthorizationService` (lógica pura, in-memory como os demais serviços;
  persistência no Step 2 via `PickupAuthorization`, já no schema): prazos **ONE_DAY**
  (1 dia, uso único — vira USED na 1ª retirada, padrão PikMyKid), **ONE_WEEK** e
  **ONE_MONTH** (multiuso dentro da janela); janela `[startsAt, expiresAt)` com suporte a
  `startsAt` futuro (status PENDING até lá); selfie do delegado obrigatória (verificação
  visual na portaria); sem sobreposição de janelas p/ mesmo delegado + aluno (a portaria não
  saberia qual conferir); `canPickup` p/ a portaria/`validate-qr` (negado: revogada, usada,
  fora da janela, aluno não coberto — com motivo); `use` registra retirada (`usedAt`,
  `useCount`); `revoke` idempotente (não revoga USED/EXPIRED); `refresh`/`refreshAll`
  marcam EXPIRED (job diário, junto ao expurgo LGPD e ao refresh de planos);
  `listActiveForStudent` (o que a portaria vê ao escanear o QR).
  `DelegationsModule` ligado no `AppModule`. Integração documentada no código e no README do
  módulo: no controller do Step 2, exigir `ConsentService.requireConsent(tutorId,
  'DELEGATION_SELFIE')` antes de criar — selfie é biométrico, consentimento explícito (LGPD art. 14).

**Arquivos alterados**
- `apps/api/src/modules/delegations/temporary-authorization.service.ts` (novo)
- `apps/api/src/modules/delegations/temporary-authorization.service.spec.ts` (novo, 13 testes)
- `apps/api/src/modules/delegations/delegations.module.ts` (novo)
- `apps/api/src/modules/delegations/README.md` (documentação da feature)
- `apps/api/src/app.module.ts` (+ DelegationsModule)
- `docs/product/IDEAS.md` (seção UX/design, frente c + ideia implementada), `BACKLOG.md` (autorização temporária concluída; saída antecipada é a próxima candidata)

**Verificação**
- `node node_modules/jest/bin/jest.js --config jest.config.js`: 9 suítes, **80/80 testes passando** (67 anteriores + 13 novos; janela, uso único vs multiuso, PENDING, revogação, refresh idempotente, sobreposição, listActiveForStudent).
- `tsc --noEmit -p tsconfig.json` na API: **exit 0, sem erros**.

**Próximo item sugerido**
- **Saída antecipada solicitada no app com aprovação da secretaria** (Impacto 5, Esforço 2) — próxima candidata do BACKLOG (School Guardian exige só pelo app, em janelas fixas 15h/16h/17h); ou, fechando a base do Step 2, **Auth JWT + refresh + Guard de tenant/RBAC + seed de escola demo**.

## 2026-11-17 01:24–01:40 — Tier gratuito + trial sem cartão (PlanService)

**Pesquisa do ciclo (frente b — concorrentes Brasil)**
- Skolar (agenda escolar BR, nov/2026): publica Start R$ 179/mês (até 20 alunos), Plus R$ 279
  (até 100, recomendado) e Pro R$ 379 (até 200) — 30 dias grátis sem cartão, PIX, sem
  fidelidade. O Plus sai a R$ 2,79/aluno/mês: benchmark BR mais próximo do nosso PRO e prova
  de que escola BR compra plano publicado, sem "sob consulta".
- Escola Ágil/Cheguei: implantação em 3 dias (nossa tese de 1 dia é mais agressiva — precisa ser
  provada pelo onboarding + CSV, não só prometida), ETA "chega em 2, 5 ou 10 min", saída
  antecipada, QR + placas, 5.000+ alunos, 80% menos filas.
- School Guardian (Eleva, Colégio São Francisco, Arcádia, Anglo-CID): QR pessoal ESTÁTICO
  (pede p/ "não compartilhar ou printar" — depende de política, não de criptografia; nosso QR
  dinâmico de 30 s é diferencial explícito), saída antecipada só pelo app em janelas fixas
  (15h/16h/17h), autorizações temporárias com prazo (1 dia/1 semana/1 mês), tela de
  antecipação de chamado e painel com anúncio por microfone.
- GoHome: tag veicular/RFID com chamada automática, projetos personalizados, sem preço publicado.
- ClipEscola "Estou Chegando": FIFO por proximidade com cores por raio (< 40 m = vermelho,
  "encaminhar já") — inspiração de UX p/ o painel da portaria.
- Achados registrados em `docs/product/IDEAS.md` (seção concorrentes Brasil, frente b);
  melhor ideia promovida ao BACKLOG: **autorização temporária com prazo determinado**
  (Impacto 4, Esforço 2).

**O que foi feito**
- Novo `PlanService` (lógica pura, in-memory como os demais serviços; persistência no Step 2
  via `SchoolPlan`, já no schema): FREE R$ 0 p/ sempre (até 30 alunos, 5 staff, fila realtime +
  QR dinâmico + relatório diário), TRIAL de 30 dias sem cartão (limites e features do PRO,
  1 por escola — 2º trial rejeitado; escola PRO não volta p/ trial; trial ativo não estende
  o prazo), PRO R$ 2,90/aluno/mês (até 2.000 alunos, 50 staff, todas as features).
  `effectiveTier` faz trial vencido contar como FREE; `refresh`/`refreshAll` aplicam o
  downgrade (idempotente — vira job diário no Step 2, junto ao expurgo LGPD); `canAddStudent`/
  `canAddStaff` bloqueiam acima do limite com motivo de upgrade; `hasFeature` trava features
  por tier; `monthlyPriceBRL` calcula a mensalidade (FREE/TRIAL = 0).
- Novo modelo Prisma `SchoolPlan` (enum `PlanTier` FREE/TRIAL/PRO, `schoolId` único,
  `trialEndsAt`, `trialUsed`, relação 1:1 com `School`) + `PlanModule` ligado no `AppModule`.

**Arquivos alterados**
- `apps/api/src/modules/plans/plan.service.ts` (novo)
- `apps/api/src/modules/plans/plan.service.spec.ts` (novo, 12 testes)
- `apps/api/src/modules/plans/plan.module.ts` (novo)
- `apps/api/src/app.module.ts` (+ PlanModule)
- `apps/api/prisma/schema.prisma` (+ enum PlanTier, modelo SchoolPlan, relação em School)
- `docs/product/IDEAS.md` (seção concorrentes Brasil, frente b + ideia implementada), `BACKLOG.md` (tier gratuito concluído; autorização temporária promovida)

**Verificação**
- `jest --config jest.config.js`: 8 suítes, **67/67 testes passando** (55 anteriores + 12 novos;
  limites FREE, trial 30 dias, downgrade, 1 trial por escola, preço PRO).
- `tsc --noEmit -p tsconfig.json` na API: **exit 0, sem erros**.
- `prisma validate`: **schema válido**; `prisma generate`: **Prisma Client gerado** (inclui
  SchoolPlan). Validação com `DATABASE_URL` fictício só p/ o comando (sem DB real no sandbox;
  `.env` não tocado). Preço PRO (R$ 2,90/aluno/mês) é proposta de lançamento baseada no
  benchmark — validar com o usuário antes de publicar no site.

**Próximo item sugerido**
- **Autorização temporária com prazo determinado (1 dia / 1 semana / 1 mês)** (Impacto 4,
  Esforço 2, frente b) — estender a delegação com selfie (já existe) com prazo determinado,
  expirando sozinha; ou, fechando a base do Step 2, **Auth JWT + refresh + Guard de
  tenant/RBAC + seed de escola demo**.

## 2026-11-17 00:54–01:02 — Eventos realtime com ID + catch-up após reconexão

**Pesquisa do ciclo (frente a — concorrentes internacionais de school dismissal)**
- CENTEGIX comprou a PikMyKid (abr/2026) e a rebatizou CENTEGIX Dismissal (out/2026) — as
  suites amplas de segurança escolar estão absorvendo os dismissal-only; nossa tese ("o melhor
  SÓ em saída") vira posicionamento contra suites caras e lentas, mas exige preço publicado e
  implantação em 1 dia como prova.
- Preço 2026: mercado cobra US$ 4–12/aluno/ano (maioria US$ 6–8); PickupRoster publica
  US$ 150/mês ou US$ 1.440/ano (Car Line) e US$ 500/mês (Campus); Carline Hound US$ 33/mês ou
  US$ 299/ano; PikMyKid a partir de US$ 3.750/ano (GetApp) — o resto é "quote".
- Aquisição: PikMyKid tem tier Free Car Line (portal web, 5 staff, relatório diário por e-mail);
  PickupRoster/QManager 30 dias sem cartão; Schoolhouse Driveline 60 dias.
- PikMyKid: delegação por um dia com verificação por foto/documento na portaria; botão de pânico
  silencioso; PickupRoster: 12 templates de drill + after-action report com replay.
- Achados registrados em `docs/product/IDEAS.md` (seção concorrentes internacionais, frente a);
  melhor ideia promovida ao BACKLOG: **tier gratuito limitado + trial sem cartão**
  (Impacto 5, Esforço 2).

**O que foi feito**
- Novo `EventLogService` (lógica pura, in-memory como os demais serviços; persistência em
  Redis Streams no Step 2): log append-only por room com `seq` monotônico (começa em 1),
  `getSince(room, lastSeenSeq)` p/ catch-up e ring buffer de 500 eventos/room — pedido mais
  antigo que o retido responde `hasGap: true` (cliente pede snapshot completo, nunca aplica
  catch-up parcial).
- `RealtimeService` agora emite envelope `{ seq, data }` em toda emissão (único ponto de
  emissão; sem broadcast global) e `PickupGateway` ganhou o handler `events.catch_up` —
  responde só rooms que o próprio socket entrou (`client.rooms`), rejeitando o resto com
  `ROOM_NOT_JOINED`.
- Documentado em `docs/03-realtime-geofencing.md` (seção "Catch-up após reconexão").

**Arquivos alterados**
- `apps/api/src/realtime/event-log.service.ts` (novo)
- `apps/api/src/realtime/event-log.service.spec.ts` (novo, 5 testes)
- `apps/api/src/realtime/realtime.service.spec.ts` (novo, 2 testes)
- `apps/api/src/realtime/realtime.service.ts` (envelope com seq)
- `apps/api/src/realtime/pickup.gateway.ts` (handler `events.catch_up`)
- `apps/api/src/realtime/realtime.module.ts` (+ EventLogService)
- `docs/03-realtime-geofencing.md` (seção catch-up), `docs/product/IDEAS.md` (frente a + ideia implementada), `BACKLOG.md` (eventos realtime concluído; tier gratuito + preço publicado promovidos)

**Verificação**
- `jest --config jest.config.js`: 7 suítes, **55/55 testes passando** (48 anteriores + 7 novos;
  seq por room, catch-up, gap por overflow do buffer, envelope `{ seq, data }`).
- `tsc --noEmit -p tsconfig.json` na API: **exit 0, sem erros**.

**Próximo item sugerido**
- **Tier gratuito limitado + trial sem cartão** (Impacto 5, Esforço 2, frente a) — definir o
  escopo do plano free (ex.: 1 escola, N alunos, relatório diário) e o trial — ou, fechando a
  base do Step 2, **Auth JWT + refresh + Guard de tenant/RBAC + seed de escola demo**.

## 2026-11-17 00:24–00:45 — Expurgo automático por retenção LGPD + teste flaky corrigido

**Pesquisa do ciclo (frente f — tecnologia: geofencing, realtime, push)**
- Geofencing 2026: geofence por evento custa 1–20% de bateria/dia vs 30–40% do GPS contínuo; usar a
  precisão mais grossa que resolve o problema; raio recomendado 100–500 m (nosso APPROACH de 800 m
  está acima — reavaliar p/ 500 m com o ETA); iOS limita 20 geofences/app, Android 100; iOS 18 exige
  CLServiceSession p/ background; Android 16 mostra indicador de acesso à localização.
- Socket.io: 1 instância segura 10–30 mil conexões; adapter Redis clássico (já no projeto) NÃO suporta
  Connection State Recovery — só Redis Streams/MongoDB; entrega é at-most-once por padrão, o que a
  portaria perde numa queda some. CVE-2026-33151 (buffer de anexos binários): corrigido em 4.2.6+;
  verificado: projeto usa **4.8.1 — não vulnerável**.
- Achados registrados em `docs/product/IDEAS.md` (seção tecnologia, frente f); melhor ideia promovida
  ao BACKLOG: **eventos realtime com ID + catch-up após reconexão** (Impacto 5, Esforço 3).

**O que foi feito**
- Novo módulo `RetentionService` (lógica pura, in-memory como `ConsentService`/`QrTokenService`;
  persistência no Step 2): expurgo automático por retenção, com regras derivadas de
  `CONSENT_PURPOSE_META` — selfie de delegação some 30 dias após a retirada (`RETENTION_EXPIRED`),
  foto do aluno some ao fim da matrícula (`ENROLLMENT_ENDED`), token push some na revogação do
  consentimento (`CONSENT_REVOKED`, que antecipa qualquer prazo), e ping de geolocalização
  (retenção 0 dias) some no próximo ciclo se registrado por engano (`ZERO_RETENTION` — rede de
  segurança da minimização). `dryRun` prevê o expurgo sem remover nada; `purgeExpired` é idempotente
  e devolve relatório; cada item expurgado gera um `PurgeEvent` append-only com hash encadeado
  (mesmo padrão do PickupLog), guardando SÓ a referência opaca ao dado, nunca o conteúdo. Os
  registros de auditoria (ConsentEvent, PickupLog, PurgeEvent) nunca são expurgados (accountability,
  art. 37). `RetentionModule` ligado no `AppModule`.
- **Bug 4 (teste flaky pré-existente):** o teste de retenção do `ConsentService` comparava o prazo da
  selfie com o `createdAt` da geolocalização (outro evento, 1 ms antes) — falhava quando os dois
  `grant` caíam em milissegundos diferentes. Corrigido p/ comparar com o próprio `createdAt` da selfie.
- **Minimização de dados verificada:** inspeção de código em `realtime/` e `modules/geofencing/` não
  encontrou nenhum `prisma`/`.create()`/`.save()` — nenhum ping de posição é persistido hoje.
  Revalidar quando a persistência do Step 2 entrar.

**Arquivos alterados**
- `apps/api/src/modules/retention/retention.service.ts` (novo)
- `apps/api/src/modules/retention/retention.service.spec.ts` (novo, 11 testes)
- `apps/api/src/modules/retention/retention.module.ts` (novo)
- `apps/api/src/app.module.ts` (+ RetentionModule)
- `apps/api/src/modules/consent/consent.service.spec.ts` (correção do teste flaky)
- `docs/product/IDEAS.md` (seção tecnologia, frente f), `BACKLOG.md` (expurgo + minimização concluídos; ideia de eventos realtime promovida)

**Verificação**
- `jest --config jest.config.js`: 5 suítes, **48/48 testes passando** (37 anteriores + 11 novos;
  1ª rodada: 47/48 — o teste flaky do ConsentService falhou por 1 ms; após a correção, 48/48).
- `tsc --noEmit -p tsconfig.json` na API: **exit 0, sem erros**.
- Socket.io instalado: **4.8.1** (acima da versão corrigida da CVE-2026-33151).

**Próximo item sugerido**
- **Eventos realtime com ID + catch-up após reconexão** (Impacto 5, Esforço 3, frente f) — numerar
  eventos por escola/sala e reenviar o que o cliente perdeu desde o último ID visto; ou, fechando a
  base do Step 2, **Auth JWT + refresh + Guard de tenant/RBAC + seed de escola demo** (agora com
  schema válido, ConsentService e RetentionService prontos).

## 2026-11-16 23:54–00:15 — Consentimento LGPD por finalidade + schema Prisma inválido corrigido

**Pesquisa do ciclo (frente e — segurança/LGPD/auditoria)**
- LGPD art. 14: dado de criança (< 12) exige consentimento específico e em destaque do responsável
  legal, informado (o que é coletado, finalidade, retenção, compartilhamento); adolescente (12–17):
  sem consentimento expresso, mas melhor interesse guia e geolocalização/biometria exigem justificativa
  forte. ECA Digital (Lei 15.211/2025) em vigor desde mar/2026; ANPD virou agência reguladora
  (Lei 15.352/2026), 19 processos sancionadores só em jun/2026, multa até R$ 50 mi. Escola é
  controladora, plataforma é operadora; DPO obrigatório. Fontes: cassiusmarques.adv.br, ezeats.app.br.
- Achados registrados em `docs/product/IDEAS.md` (seção LGPD); melhor ideia promovida e implementada
  neste ciclo: consentimento por finalidade com registro em auditoria (Impacto 5, Esforço 2).

**O que foi feito**
- Novo módulo `ConsentService` (lógica pura, in-memory como o `QrTokenService`; persistência no
  Step 2): `grant`/`revoke` por finalidade (`GUARDIAN_GEOLOCATION`, `DELEGATION_SELFIE`,
  `STUDENT_PHOTO`, `PUSH_NOTIFICATIONS`), com regras — dado sensível (selfie = biométrico) exige
  `explicit=true`; criança < 12 só com `grantedByRole=GUARDIAN` + explícito; `noticeVersion`
  obrigatória (consentimento informado); revogação é evento novo (histórico nunca apagado) e vale
  imediatamente; `requireConsent` lança 403 p/ bloquear geolocalização/selfie sem consentimento;
  `retentionDeadline` por finalidade (geolocalização 0 dias — posição nunca persistida; selfie 30 dias;
  foto/push enquanto durar o vínculo); `exportSubjectEvents` (direito de acesso, art. 18);
  `verifyChain` p/ auditar a cadeia de hashes; `isUnder12` com borda dos 12 anos.
- Novo modelo Prisma `ConsentRecord` (append-only, hash encadeado, mesmo padrão do PickupLog) +
  relação `consentRecords` em `School`.
- **Bug 3 (fundação — schema inválido):** ao validar o schema p/ adicionar o modelo, `prisma validate`
  retornou 110 erros: o `schema.prisma` inteiro estava escrito em estilo compacto inválido (vários
  campos separados por `;` na mesma linha + enums de uma linha). Ou seja, `prisma generate`/`migrate`
  nunca tinham rodado — o Step 2 (Auth/CRUD) estava bloqueado sem ninguém saber. Reformatado
  (um campo por linha, enums expandidos) + `prisma format`; schema válido e Prisma Client gerado.
- `ConsentModule` ligado no `AppModule`.

**Arquivos alterados**
- `apps/api/src/modules/consent/consent.service.ts` (novo)
- `apps/api/src/modules/consent/consent.service.spec.ts` (novo, 12 testes)
- `apps/api/src/modules/consent/consent.module.ts` (novo)
- `apps/api/src/app.module.ts` (+ ConsentModule)
- `apps/api/prisma/schema.prisma` (+ ConsentRecord; reformatado inteiro p/ sintaxe Prisma válida)
- `docs/product/IDEAS.md` (seção LGPD), `BACKLOG.md` (bugs corrigidos + ideias promovidas)

**Verificação**
- `jest --config jest.config.js`: 4 suítes, **37/37 testes passando** (25 anteriores + 12 novos).
- `tsc --noEmit -p tsconfig.json` na API: **exit 0, sem erros**.
- `prisma validate`: **schema válido** (antes: 110 erros); `prisma generate`: **Prisma Client gerado
  com sucesso** (inclui ConsentRecord). Validação com `DATABASE_URL` fictício só p/ o comando
  (sem DB real no sandbox; `.env` não tocado).

**Próximo item sugerido**
- **Expurgo automático por retenção LGPD** (Impacto 4, Esforço 2, próxima candidata da frente e):
  job que apaga/anomiza selfie 30 dias após a retirada e foto ao fim da matrícula, usando o
  `retentionDeadline` já implementado — ou, fechando a base do Step 2, **Auth JWT + refresh +
  Guard de tenant/RBAC + seed de escola demo** (agora destravado pelo schema válido).

## 2026-11-16 23:16–23:40 — Testes unitários do núcleo + 2 bugs de segurança/correção

**O que foi feito**
- Criada a primeira suíte de testes unitários da API (Jest + ts-jest, `apps/api/jest.config.js`),
  cobrindo a lógica pura e crítica da fundação: geofencing, QR dinâmico e hash encadeado do PickupLog.
  - `geofencing.service.spec.ts` (11 testes): haversine, descarte por accuracy > 65 m,
    ENTER_APPROACH, regra dos 2 pings para ARRIVAL, histerese de +40 m, reset da contagem
    ao sair do raio e isolamento de estado por tutor/escola.
  - `qr-token.service.spec.ts` (10 testes): emissão/validação, anti-replay, corpo adulterado,
    assinatura truncada/maior, token malformado, expirado e janela de grace de 10 s.
  - `pickup.service.spec.ts` (4 testes): determinismo e encadeamento do `chainHash` (gênese com null).
- **Bug 1 (QR — segurança):** `QrTokenService.validate` chamava `timingSafeEqual` sem checar
  tamanhos; assinatura truncada/adulterada com tamanho diferente lançava `RangeError` (HTTP 500)
  em vez de `UnauthorizedException` (401). Corrigido com checagem de comprimento antes da
  comparação em tempo constante. Teste de regressão incluído.
- **Bug 2 (geofencing — regra quebrada):** a regra documentada "ARRIVAL exige 2 pings
  consecutivos" nunca valia: o 1º ping já emitia `ENTER_ARRIVAL` (fallback `ENTER_${zone}`) e
  a condição `prev.zone !== 'ARRIVAL'` impedia `confirmedArrival` de ser verdadeiro no 2º ping
  (o estado já era ARRIVAL). Corrigido com flag `confirmed` no estado por tutor/escola:
  1º ping → transition null; 2º ping → `ENTER_ARRIVAL` uma única vez; sair do raio zera tudo.
- **Pequeno ajuste:** timer de expiração do nonce do QR agora usa `.unref()` para não segurar
  o event loop/saída do processo.
- Adicionado `@types/jest` às devDependencies da API (faltava; sem ele o ts-jest não compila os specs).

**Arquivos alterados**
- `apps/api/src/modules/qr/qr-token.service.ts` (bug 1 + unref)
- `apps/api/src/modules/geofencing/geofencing.service.ts` (bug 2)
- `apps/api/src/modules/qr/qr-token.service.spec.ts` (novo)
- `apps/api/src/modules/geofencing/geofencing.service.spec.ts` (novo)
- `apps/api/src/modules/pickup/pickup.service.spec.ts` (novo)
- `apps/api/jest.config.js` (novo)
- `apps/api/package.json` (+ `@types/jest`)
- `pnpm-lock.yaml` (atualizado pelo install)

**Verificação**
- `jest --config jest.config.js`: 3 suítes, **25/25 testes passando** (rodado via binário do
  jest no store pnpm — ver limitação abaixo).
- `tsc --noEmit -p tsconfig.json` na API: **exit 0, sem erros**.

**Limitação conhecida (ambiente, não código)**
- `pnpm install` no sandbox falha no fim com `EPERM chown .../jscodeshift/bin/jscodeshift.js`
  (o sandbox bloqueia chown); os pacotes são baixados e ficam usáveis, mas os links `.bin`
  de `apps/api/node_modules` não são criados. Por isso o Jest foi rodado pelo caminho direto
  do store (`node_modules/.pnpm/jest-cli@.../node_modules/jest-cli/bin/jest.js`) e o
  `pnpm test` / `pnpm build` ainda não foram validados neste ambiente. Num ambiente sem essa
  restrição, `pnpm install && pnpm --filter @tutorpass/api test` deve funcionar.

**Próximo item sugerido**
- Step 2, item de maior impacto e esforço moderado do banco de ideias (`docs/product/IDEAS.md`):
  **saída antecipada solicitada no app com aprovação da secretaria** (Impacto 5, Esforço 2) —
  ou, se preferir fechar a base antes, **Auth JWT + refresh + Guard de tenant/RBAC + seed
  de escola demo** (primeiro item do Step 2 do BACKLOG.md).
