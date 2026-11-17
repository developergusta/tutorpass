# Registro de incidentes de segurança (prazo ANPD)

`SecurityIncidentService` — log de incidentes de segurança da escola com o
relógio de comunicação da Resolução CD/ANPD nº 15/2024: quando o incidente
puder acarretar risco ou dano relevante, a escola comunica a ANPD e os
titulares afetados em até **3 dias úteis** (complementação em até 20 dias
úteis). A infração mais comum apurada pela ANPD não é o vazamento — é a
falha em comunicar no prazo.

## O que é um incidente

Não só invasão: arquivo enviado à família errada (`WRONG_RECIPIENT`),
planilha com permissão aberta (`OPEN_SPREADSHEET`), equipamento perdido
(`LOST_DEVICE`), acesso não autorizado (`UNAUTHORIZED_ACCESS`), ransomware
(`RANSOMWARE`) ou outro (`OTHER`). O registro guarda **só categorias de
dados e a contagem de titulares** — nunca o conteúdo vazado (o registro do
incidente não pode virar um segundo vazamento).

## Fluxo

```
OPEN → CONTAINED → COMMUNICATED → CLOSED
```

- `report`: cria OPEN e calcula os prazos a partir de `detectedAt`
  (`communicationDueAt` = +3 dias úteis, `supplementDueAt` = +20 dias úteis).
  Dias úteis pulam sábado e domingo; feriados estão fora do escopo desta
  versão.
- `contain`: OPEN → CONTAINED, com nota obrigatória (o que foi feito).
- `recordAnpdNotification` / `recordSubjectsNotification`: a partir de OPEN
  ou CONTAINED. Com `relevantRisk: true`, as duas juntas viram COMMUNICATED.
- `recordSupplement`: complementação à ANPD (exige a comunicação inicial).
- `addNote`: anotação no log, sem mudar o status.
- `close`: exige contenção + (ANPD e titulares comunicados, se
  `relevantRisk`). Sem risco relevante, fecha só com contenção — a escola
  documenta o porquê no log.

## O que a diretoria/DPO usa

- `listOverdue(now)`: incidentes com comunicação à ANPD vencida (e não
  feita) ou complementação vencida — a lista que o DPO abre toda manhã.
- `businessDaysRemaining(id, now)`: dias úteis até o prazo (negativo = vencido).
- `listForSchool(schoolId)`: todos os incidentes da escola.
- `listEvents(id)` + `verifyChain(id)`: log append-only com hash encadeado
  (mesmo padrão do PickupLog/RetentionService) — a prova para a ANPD.

## Integração (Step 2)

- Persistência em Prisma (`SecurityIncident`, já no schema; eventos em
  `SecurityIncidentEvent`).
- O painel do admin lista `listOverdue` + `listForSchool`; o DPO da escola
  é o responsável (`dpoContact`).
- Notificar o DPO em dual-path (`NotificationService`) quando um incidente
  ficar a 1 dia útil do vencimento.
