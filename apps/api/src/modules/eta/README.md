# ETA ao vivo do tutor + fila ordenada por proximidade

## O que é

O painel da portaria deixa de mostrar "quem clicou primeiro" e passa a
mostrar **quem chega primeiro**: cada tutor com posição recente ganha um ETA
em minutos e a fila é ordenada por ele — quem já chegou primeiro, depois o
menor ETA, por último quem está sem sinal.

Inspiração (pesquisa frente c, ciclo 11): ReadyBell (ETA com chip + contagem
regressiva, fila por urgência, ETA "traffic-aware"), Technothera (ordem
automática Chegou → Pronto → Contagem regressiva, selo ARRIVED pulsante),
PickupFlow e SafePickApp (ETA em minutos por família, "4 minutes to gate"),
ClipEscola "Estou Chegando" (cores por raio, < 40 m = vermelho,
"encaminhar já"), Escola Ágil/Cheguei (ETA em faixas de 2, 5 e 10 min).

## Faixas de ETA (`EtaBand`)

| Banda | Regra | Cor | O que o painel mostra |
|---|---|---|---|
| `HERE` | distância ≤ 250 m ou botão "Estou aqui" | `RED` | **ENCAMINHAR JÁ** — o aluno precisa sair agora |
| `NOW` | ETA ≤ 2 min | `ORANGE` | "chega em ~2 min" |
| `SOON` | ETA ≤ 5 min | `YELLOW` | "chega em ~5 min" |
| `LATER` | ETA ≤ 10 min | `BLUE` | "chega em ~10 min" |
| `FAR` | ETA > 10 min | `GRAY` | "a caminho" |
| `STALE` | sem posição há > 60 s | `GRAY` | "sem sinal" — nunca um ETA inventado |

O ETA é arredondado **para cima** (1,8 min vira "2 min") e é uma
**estimativa**: distância em linha reta (haversine, do `GeofencingService`)
dividida pela velocidade. Não é tempo de rota com trânsito (ReadyBell usa
MapKit p/ isso) — isso é fase 2, com provedor de rotas. O painel exibe
"cerca de N min", nunca um horário exato.

## Velocidade

- Do GPS, quando o app informa (`speedKmh`); sem ela, o default do modo:
  **30 km/h de carro, 5 km/h a pé**.
- Velocidade inválida (≤ 0) cai no default — nunca divide por zero.
- Velocidade informada é limitada a 130 km/h (proteção contra GPS absurdo).

## Regras

- **Ordem da fila** (`getQueue`): chegados primeiro (pela ordem de chegada),
  depois ETA crescente (desempate: menor distância), por último os STALE.
  Cada entrada sai com `position` (1 = próximo a ser chamado).
- **Botão "Estou aqui"** (`markArrived` — RIS ONE / PickupFlow): fallback
  manual quando o GPS falha ou o tutor está a pé sem localização. Cria a
  entrada se ainda não existir e marca o tutor como chegado.
- **Histerese de saída** (+40 m, mesma do geofence): um tutor marcado como
  chegado só "des-chega" se o GPS o colocar a mais de 290 m — evita o
  vai-e-volta por imprecisão do GPS na porta da escola.
- **STALE ≠ fora da fila**: sem posição há > 60 s, a entrada fica STALE
  (ETA null, "sem sinal") e vai p/ o fim da fila, mas continua visível —
  sumir da tela seria pior que avisar que o sinal caiu.
- **Expiração** (`refresh`, job junto aos demais): tira da fila quem não
  atualiza há 5 min. Idempotente.
- **Privacidade**: a posição vive só em memória e some no `refresh` — nunca
  é persistida (minimização LGPD, mesma regra do geofence).

## Integração (Step 2)

- Trocar o store in-memory por Redis (mesma chave do geofence,
  `geo:{schoolId}:{tutorId}`).
- Alimentar `updatePosition` com a distância do `GeofencingService.ingest`
  (cada ping aceito) + velocidade do GPS do app.
- Emitir a fila pelo `RealtimeService` (evento `queue.updated` por escola)
  a cada mudança — o painel da portaria e o modo telão consomem a mesma fila.
- ETA com trânsito (rota real) vira fase 2, com provedor de rotas
  (MapKit/Google) — até lá, o ETA em linha reta + faixas de 2/5/10 min já
  resolve a dor da portaria ("quem eu preparo agora?").
