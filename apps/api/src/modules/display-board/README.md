# Modo telão/TV (portaria e sala)

## O que é

O board que a escola pendura na parede: a TV da portaria, da sala ou do
corredor mostra **duas colunas, sem rolagem** — "Pronto p/ retirada" vs
"A caminho" — com nomes grandes de alto contraste, atualizadas ao mesmo
tempo em todas as telas.

Inspiração (pesquisa frentes c/d, ciclo 12): PickupRoster (board ao vivo
no navegador, cada sala/corredor/tela atualiza junto), Schoolhouse
Driveline (nome + local de retirada por cor em smartboards e projetores),
Dismissal Magic (pop-up em tela cheia + sino quando a turma é chamada;
qualquer tela com navegador, sem instalar nada), Time To Dismiss (nomes
grandes em TVs), "pickup." (telão com páginas ou lista e destaques de
embarque) e Carline Hound (telão na área de embarque). Preço dos
entrantes: Dismissal Magic US$ 149–249/escola/ano, PickupRoster US$ 150/
mês (Car Line) — o telão é o motivo de a escola pagar por escola/ano; no
TutorPass, `TV_MODE` já é feature do PRO (ver `PlanService`).

## Regras

- **O board é uma vista da fila, não uma fila nova**: a ordem vem do
  `EtaService.getQueue` (quem chegou primeiro, depois o menor ETA). O
  controller do Step 2 mapeia cada entrada da fila p/ um `BoardStudent`
  (tutor → alunos daquele carro) e chama `snapshot` a cada poucos
  segundos.
- **Sem rolagem**: cada coluna mostra até `pageSize` cartões (default 8,
  máx. 12 — o que cabe numa TV). Quando não cabe, o board pagina e **vira
  a página sozinho** a cada `rotateSeconds` (default 15 s); `nextPage`
  permite o avanço manual pelo staff.
- **Três modos de tela** (`registerDisplay`):
  | Modo | O que mostra |
  |---|---|
  | `GATE` | portaria — nome completo + foto + cor de urgência |
  | `CLASSROOM` | TV da sala — só os alunos daquela sala (`classroomId` obrigatório) |
  | `HALLWAY` | corredor/entrada — **1º nome + inicial do sobrenome, sem foto** (tela pública; LGPD) |
- **Chamada com pop-up** (`callStudent`): a portaria toca o sino e o
  board mostra o aluno em tela cheia por **20 s** (como o ônibus do
  Dismissal Magic), com contagem regressiva (`secondsLeft`). Uma chamada
  ativa por escola — a mais recente vence. O banner só aparece se o aluno
  ainda estiver na fila (se já foi retirado, não há o que chamar);
  `clearCall` cancela (ex.: aluno já saiu pela porta).
- **Rótulos de ETA** (`etaLabel`): READY + cor RED → "ENCAMINHAR JÁ";
  READY → "Pronto"; EN_ROUTE com ETA → "chega em ~N min"; EN_ROUTE sem
  posição → "sem sinal" (nunca um ETA inventado).
- **Board vazio** (`isEmpty`): a TV mostra uma tela calma ("Nenhum aluno
  na fila"), nunca em branco.
- **Expiração** (`refresh`, job junto aos demais): remove telas sem
  consulta há 10 min (TV desligada/desconectada). Idempotente.

## Integração (Step 2)

- Controller REST/WebSocket: `registerDisplay` no pareamento da TV (a TV
  abre um link com o `displayId` e fica em tela cheia — sem login de
  staff, como Time To Dismiss e Dismissal Magic); `snapshot` no poll da
  TV ou push via `RealtimeService` (mesmo envelope `{ seq, data }` do
  catch-up); `callStudent` a partir do painel da portaria.
- Antes de registrar, o controller confere
  `PlanService.hasFeature(plano, 'TV_MODE')` — FREE não tem telão.
- Persistência: `DisplayBoard`/`ActiveCall` ainda não estão no schema
  Prisma — o estado vive em memória nesta versão (como os demais
  serviços); ao persistir, a chamada ativa vira registro com
  `calledBy`/`calledAt` p/ auditoria (quem chamou quem, quando).
- Foto: o `photoUrl` vem do cadastro do aluno (consentimento
  `STUDENT_PHOTO`); no corredor a foto nunca é exibida, mesmo com
  consentimento — tela pública não é lugar de foto de menor.
- Fase 2: sino/áudio na TV (Web Audio, sem depender de som do sistema),
  destaque de embarque por zona (1–6, como "pickup.") e rotação por
  turma no modo `CLASSROOM` quando a sala tem mais de uma página.
