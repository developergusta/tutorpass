# Preços publicados — TutorPass

> Fonte única de verdade: `apps/api/src/modules/plans/plan.service.ts`
> (`PLAN_DEFINITIONS`). A página pública `/planos` espelha estes valores.
> Se o preço mudar na API, mude na página junto — nunca o contrário.

## Os três planos (valores em R$, por mês — PRO por faixa de alunos)

| Plano | Preço | Limites | Inclui |
|---|---|---|---|
| **Grátis** | R$ 0, para sempre | até 30 alunos, 5 staff | Fila em tempo real, QR dinâmico, relatório diário por e-mail |
| **Teste** | R$ 0 por 30 dias | limites do PRO (2.000 alunos, 50 staff) | Todas as funções do PRO |
| **PRO** | Mensalidade fixa por faixa: até 50 alunos R$ 89/mês · 51–200 R$ 199/mês · acima de 200 R$ 349/mês | até 2.000 alunos, 50 staff | Todas as funções (9): fila, QR, relatório diário, saída antecipada, telão/TV, van, ETA ao vivo, fila por proximidade, relatórios avançados |

## Regras (as mesmas do `PlanService`)

- **Mensalidade do PRO** = valor fixo da faixa do nº de alunos
  (`proMonthlyPriceBRL` / `monthlyPriceBRL`): até 50 → R$ 89; 51–200 →
  R$ 199; acima de 200 → R$ 349. Dentro da faixa, o preço não muda. Não
  há desconto anual definido — o valor anual exibido na calculadora é
  mensal × 12, dito como tal.
- **Teste**: 30 dias, sem cartão, 1 por escola. Escola PRO não volta para
  teste. Ao vencer, o plano volta sozinho para o Grátis (downgrade
  automático) e passam a valer os limites do Grátis.
- **Grátis**: sem expiração. Escola nova entra nele por padrão.
- **Acima de 1.000 alunos**: condição sob consulta (redes). **Teto do
  PRO**: 2.000 alunos por escola; acima disso, preço por escola, sob
  consulta (não há valor definido — não inventar um na página).
- **Nenhum módulo é cobrado à parte** no PRO: van, telão, ETA e relatórios
  avançados já estão incluídos.

## Por que publicar (benchmark, nov/2026)

- O mercado de dismissal quase todo esconde o preço atrás de "quote"
  (PikMyKid/CENTEGIX a partir de US$ 3.750/ano, Ruvna, PickUp Patrol);
  quem publica vira referência no comparativo 2026 (PickupRoster,
  Carline.app, Dismissal Magic).
- Transparência de preço é critério de compra: 86% dos compradores B2B
  dizem que ela é decisiva (LinkedIn, cit. em guias 2026) e 60% dos
  visitantes checam o preço antes de pedir demo.
- Nossas faixas (R$ 89/199/349 por mês) ficam abaixo ou dentro da faixa
  das suítes BR por faixa de alunos (Skolar publica R$ 179–379/mês) e bem
  abaixo dos suites gringos (US$ 299–4.800/ano) — é argumento de venda,
  não só preço.

## Decidido

- **Modelo de faixas fixas** (não por aluno): decisão do usuário em
  17/11/2026, que também resolve o antigo item do "piso para escolas
  pequenas" — a menor faixa (R$ 89/mês) é o piso. Valores CONFIRMADOS
  pelo usuário em 17/11/2026: R$ 89 até 50 alunos, R$ 199 de 51 a 200,
  R$ 349 acima de 200; Grátis até 30 alunos mantido.

## Em aberto (não prometer na página até decidir)

- **Desconto anual**: não definido — não anunciar nenhum % até decidir.
- **Pagamento**: PIX/boleto/cartão ainda não definidos (billing é Step 2).
  A página não promete meio de pagamento.
