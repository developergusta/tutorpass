# Módulo van/fretado

## O que é

O motorista retira **vários alunos numa rota** — realidade brasileira que
os concorrentes gringos de dismissal ignoram. A rota tem paradas ordenadas
(ida `TO_SCHOOL` ou volta `TO_HOME`), o motorista registra cada embarque
com um toque e a escola vê quem está a bordo em tempo real.

Inspiração (pesquisa frente b, ciclo 13 — transporte escolar BR):
- **Escolar** (lp.escolar.app.br, 2026): "a rota não fecha com criança a
  bordo nem com criança sem registro"; alerta a cada 5 min se a rota passa
  do tempo com criança a bordo (família avisada no dobro do tempo); três
  toques por criança — "Embarcou", "Entregue", "Não estava no ponto";
  "Corrigir pede um motivo e guarda o registro original — nada é apagado:
  a hora de um embarque é prova".
- **Vanep** (2026): 4 avisos por dia (embarcou em casa, chegou na escola,
  embarcou na volta, chegou em casa); "não vai hoje" com um toque.
- **Clickvan**: motorista inicia o roteiro, registra embarque/ausência/
  desembarque; responsáveis recebem notificação no início e na aproximação.
- **Cadê a Van? / Via Van**: localização só visível enquanto a rota roda;
  aviso automático 5 min antes de chegar na casa do aluno.
- **VanEscola**: notificação de aproximação com um clique; pai avisa a
  ausência do aluno.

## Regras

- **Uma rota ativa por motorista** (PLANNED ou RUNNING) — ele não roda
  duas ao mesmo tempo.
- **Paradas ordenadas** (`order` 1-based): a ordem é a ordem de embarque.
  `nextStop` devolve a "criança da vez" (Escolar: o botão amarelo é o da
  criança da vez) — a primeira parada ainda `WAITING`.
- **Estados da parada**: `WAITING` → `BOARDED` → `DELIVERED`; `WAITING` →
  `ABSENT` ("não estava no ponto", com observação opcional); `WAITING` →
  `NOT_RIDING` ("não vai hoje", avisado pelo responsável — antes de
  iniciar ou durante a rota, enquanto ainda estiver `WAITING`).
- **A rota NÃO fecha com criança a bordo** (Escolar): `finishRoute` só
  encerra quando toda parada está `DELIVERED`, `ABSENT` ou `NOT_RIDING`.
  O erro lista quem bloqueia (a bordo e/ou sem registro) — nunca some com
  o problema em silêncio. `cancelRoute` segue a mesma segurança: com
  criança a bordo, primeiro entrega.
- **Alerta de criança a bordo**: `listOverdueRoutes` devolve as rotas
  `RUNNING` além da duração esperada (default 90 min) com criança a bordo,
  com `overdueMinutes` — o job do Step 2 dispara a notificação dual-path
  (push + registro in-app) a cada ciclo, como o Escolar faz a cada 5 min.
- **Correção com motivo, sem apagar o original**: `correctStop` muda o
  estado de uma parada já registrada (BOARDED/DELIVERED/ABSENT) e exige
  motivo (≥ 3 caracteres). O evento original fica no log append-only com
  hash encadeado (`verifyChain`, mesmo padrão do PickupLog) — a hora de um
  embarque é prova.
- **Só o motorista da rota** registra embarques/entregas/ausências e
  inicia/encerra/cancela a rota (403 p/ outro motorista).
- `refresh()` (job diário, junto aos demais): cancela rotas planejadas de
  dias passados. Idempotente.

## Integração (Step 2)

- Feature `VAN_MODULE` do plano (TRIAL/PRO — ver `PlanService`): o
  controller confere `hasFeature(plano, 'VAN_MODULE')` antes de criar a
  rota. Escola FREE não cria rota de van.
- `driverId` é o identificador do motorista (Step 2: modelo `Driver` ou
  `Tutor` com papel de motorista, com documentos/vistoria — o Vanep
  bloqueia motorista com documento vencido; isso é fase 2).
- Notificações ao responsável (embarcou / entregue / van a caminho):
  `NotificationService` em dual-path — a decisão da van chega mesmo se o
  push falhar. Novos `NotificationKind`s (`VAN_BOARDED`, `VAN_DELIVERED`)
  no Step 2.
- O aluno da van **não passa pela fila da portaria**: quando a van chega,
  o `markDelivered` da ida alimenta a entrada do aluno na escola; a
  portaria só precisa saber que ele veio de van (campo no `PickupLog`,
  Step 2).
- Posição da van em tempo real: a localização do motorista vive só
  enquanto a rota roda (Cadê a Van? / School Drive) e nunca é persistida
  — mesma minimização LGPD do geofence do tutor. Fase 2, com o app do
  motorista.
- Preço de referência (2026): Escolar a partir de R$ 47/mês por
  transportador; Cadê a Van? R$ 29,90/mês; Vanep 1º mês grátis. Nosso
  `VAN_MODULE` já está no PRO (mensalidade fixa por faixa: R$ 89/199/349) sem custo extra por
  motorista — argumento de venda contra os apps de van avulsos.
