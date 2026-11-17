# Onboarding — checklist de implantação em 1 dia + escola demo

## O que é

O checklist que guia a escola na implantação do TutorPass no dia 1, na
ordem em que as coisas acontecem — e some quando zera. A tese é
"implantação em 1 dia": sem ele, a promessa é só discurso (ver
`docs/product/IDEAS.md`, frente d, ciclo 25 — DismissPro/YESS/Attendzy).

## Os 4 passos (ordem fixa, tempos do runbook)

| Passo | O que é | Tempo |
|---|---|---|
| `ACCOUNT_CREATED` | Conta da escola criada (nome, CNPJ, contato) | ~3 min |
| `ROSTER_IMPORTED` | Alunos importados do CSV (com prévia dryRun) | ~15 min |
| `STAFF_INVITED` | Equipe convidada (portaria, salas, coordenação) | ~5 min |
| `FIRST_DISMISSAL_DONE` | Primeira saída realizada de verdade | ~30 min |

Total estimado: **53 min** de trabalho da escola no dia 1. O resto do
dia é a saída rodando — o checklist prova que a implantação aconteceu,
não que alguém clicou em "concluído".

## Regras

- Marcar é idempotente; reabrir um passo é explícito e fica registrado.
- Cada ação guarda quem fez (`actorId` = `user.sub`) e quando — o
  checklist é a prova da implantação, não só um progresso de UI.
- `nextStep` é sempre o primeiro passo aberto, na ordem do runbook.
- **Só a escola demo zera.** `resetDemo` recusa qualquer escola que não
  esteja marcada como demo — zerar a escola errada apagaria o progresso
  real de implantação de um cliente. O job diário (06:00, Step 2) chama
  `resetDemo` na demo; aqui só existe o método + a guarda.
- Sem passo marcado, o checklist diz 0/4 — nada de progresso inventado.

## Endpoints (`/api/onboarding/schools/:schoolId/*`)

| Rota | Papéis | O que faz |
|---|---|---|
| `GET checklist` | ADMIN, COORDINATOR, GATE_AGENT, TEACHER | Checklist com progresso e próximo passo |
| `POST steps/:step/complete` | ADMIN, COORDINATOR | Marca o passo (idempotente) |
| `POST steps/:step/reopen` | ADMIN, COORDINATOR | Reabre o passo |
| `POST demo/mark` | ADMIN | Marca a escola como demo |
| `POST demo/reset` | ADMIN | Zera o checklist da demo (recusa não-demo) |

## Integração Step 2 (ainda não ligada)

Os passos hoje são marcados à mão (pela secretaria, no painel). A
ligação automática é:

- `RosterService.importStudents` → `completeStep(ROSTER_IMPORTED)`
- `AuthService.register` de staff → `completeStep(STAFF_INVITED)`
- `PickupService.release` → `completeStep(FIRST_DISMISSAL_DONE)`
- Job diário 06:00 → `resetDemo` na escola demo
- Persistência: modelo `OnboardingChecklist` no schema, com os eventos

Nunca marcar por adivinhação: sem o evento real, o passo fica aberto.

## Runbook

Ver `docs/product/ONBOARDING-1-DIA.md` — o dia 1 hora a hora, quem faz
o quê, e o que a escola demo (seed) cobre.
