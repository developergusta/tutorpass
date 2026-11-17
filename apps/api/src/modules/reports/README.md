# Módulo reports — relatório de tempo de saída ("escola amiga do trânsito")

O relatório é a **prova de valor** do TutorPass p/ a diretoria: tempo médio de
saída, pico e score por dia/período — o material que a escola usa p/ captar
alunos e p/ medir o piloto de 30 dias (antes/depois de ligar o produto).

## O que mede

`DismissalReportService` (lógica pura, in-memory; persistência no Step 2
sobre `PickupQueueEntry` + `PickupLog`, já no schema):

- **Espera** = minutos entre a **chamada** do aluno e a **liberação** na
  portaria (`calledAt → releasedAt`). Sem chamada registrada, a retirada
  conta no total mas **não** entra nas estatísticas de espera — nunca se
  inventa um tempo.
- **Tempo na fila** = minutos entre a entrada na fila e a chamada
  (`joinedAt → calledAt`), p/ separar "espera do tutor" de "preparo do aluno".
- **Resumo diário** (`dailySummary`): total, média, mediana, p95, máxima,
  fração das esperas ≤ 5 min, janela de pico de 15 min, quebra por modo
  (CAR/WALK/BUS/VAN) e por sala, score de trânsito.
- **Resumo do período** (`periodSummary`): os mesmos agregados p/ o intervalo
  + série diária (p/ gráfico), melhor dia, pior dia e dia mais cheio — é o que
  alimenta a comparação antes/depois do piloto.
- **Export CSV** (`toCsv`): uma linha por dia (`date,total_pickups,
  avg_wait_minutes,traffic_score,traffic_label`); números ausentes saem
  vazios, nunca zero.

## Score "escola amiga do trânsito" (0–100)

```
score = round(50 × fração das esperas ≤ 5 min
            + 50 × max(0, 1 − espera média / 15 min))
```

- ≥ 80 **EXCELENTE** · 60–79 **BOA** · 40–59 **ATENÇÃO** · < 40 **CRÍTICA**.
- Sem dado de espera, o score é **null** (não existe "100" nem "0" sem dado).
- O score é proposta de lançamento — a diretoria valida os limites (5 e 15
  min) com os primeiros pilotos antes de publicar no site.

## Regras

- **Isolamento por escola**: todo resumo filtra por `schoolId`.
- **Ingestão idempotente**: `eventId` repetido devolve o registro original.
- **Validação**: `releasedAt ≥ joinedAt`, `calledAt` entre os dois,
  `releasedAt` nunca no futuro, modo no enum CAR/WALK/BUS/VAN.
- **Privacidade**: agregados nunca carregam nome de aluno ou tutor — só
  contagens e médias. Posição do tutor nunca entra no relatório.
- **Retenção**: `purgeOlderThan(90)` apaga eventos com mais de 90 dias
  (job junto aos demais refreshes; o DB guarda o histórico no Step 2).
- **Fuso**: o dia de um evento é a data UTC de `releasedAt`; o controller do
  Step 2 converte o horário local da escola p/ UTC na ingestão.

## Referências (pesquisa frente d, ciclo 14)

- PikMyKid/TechAhead: "33% menos tempo na fila", US$ 47 mil economizados por
  escola/ano, 75 min/semana devolvidos ao professor; Albion: saída média de
  15 min do início ao fim.
- Comparativo 2026 (eathealthy365): "Reporting & Analytics" é critério de
  compra — quanto o tempo caiu, quais os dias mais cheios, p/ mostrar o valor
  ao conselho e à comunidade de pais.
- Placa.ai (2026): 45+ min de saída média com coordenação manual; relatório
  diário + tendências + gargalos; "One-Lane Pilot": medir a redução do tempo
  de espera depois de 30 dias.
- GoHome já vende o ângulo "escola amiga do trânsito" no BR.

## Fase 2

- Comparador de piloto no próprio relatório (período A vs B com delta).
- Relatório diário por e-mail p/ a secretaria (PikMyKid inclui no tier free).
- Baseline automático: primeira semana sem TutorPass como referência.
