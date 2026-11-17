# Plano de saída padrão + exceção do dia

Plano de saída padrão por aluno (um modo por dia da semana) + exceção do dia com
horário-limite (cutoff) — a dor nº 1 das secretarias e o motivo de existir do
PickUp Patrol e do School Dismissal Manager. Ver `docs/product/IDEAS.md`,
frentes (a)/(d).

## Regras

- **Plano padrão é da escola**: só staff define/muda (`setDefault` rejeita tutor com
  403). O tutor confere o plano e pede mudança por exceção. Igual ao PickUp Patrol
  (default só no portal web) e ao SDM (só a secretaria muda o default).
- **Um modo por dia da semana** (0 = domingo … 6 = sábado): `CAR` (carro),
  `WALK` (a pé/saída autorizada), `BUS` (ônibus/van) e `AFTER_SCHOOL`
  (atividade pós-aula/contraturno). `CAR` exige quem busca; `BUS` exige a linha.
- **`copyDefault` ("copiar segunda")**: replica o plano de um dia para os demais —
  o atalho do cadastro em massa na implantação de 1 dia.
- **Exceção do dia**: desvio num dia específico. Pode ser criada com antecedência;
  no mesmo dia, só até o cutoff da escola — padrão **13:30** (SDM), configurável
  por escola via `setCutoff` (PickUp Patrol usa 14:00). Depois do cutoff, só
  emergência — ligue para a secretaria. Uma exceção ATIVA por aluno por dia;
  atualizar/cancelar também respeita o cutoff no dia.
- **Saída antecipada NÃO é um modo**: passa pelo `EarlyDismissalService`
  (motivo + aprovação da secretaria), porque sair antes do horário é decisão,
  não rotina.
- **`resolvePlanForDate`**: o que a portaria/sala consulta. Exceção ativa vence o
  plano padrão; sem nenhum dos dois, a resposta é `NONE` — a secretaria precisa
  definir o plano (o relatório diário sinaliza alunos sem plano, nunca inventa um).
- **Auditoria**: toda mudança entra no log append-only (`listChangeLog`); no Step 2,
  persistir em `AuditLog` (hash encadeado).

## Contrato de fuso

`now` chega no horário **local da escola** (a camada de API converte de UTC para
`School.timezone`); o serviço compara só data e hora local.

## Integração no Step 2

- Trocar os stores in-memory por Prisma (`DismissalDefaultPlan` +
  `DismissalException`, já no schema).
- O relatório diário da secretaria junta `resolvePlanForDate` com a matrícula
  (o serviço não conhece a lista de alunos) e é enviado no cutoff, como o SDM faz
  às 13:30.
- Notificar a mudança ao tutor/professor por dual-path (push Expo + registro
  durável in-app) quando o módulo de notificações entrar.
- `refresh()` roda no job diário, junto ao expurgo LGPD e aos refreshes de
  planos/autorizações/saídas antecipadas.
