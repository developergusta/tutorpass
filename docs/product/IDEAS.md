# Banco de ideias — pesquisa de mercado (atualizado pelo agente a cada 30 min)

> Regra: ideia só entra aqui com fonte e data. O agente pontua Impacto (valor p/ escola/pais)
> e Esforço (1-5), promove a melhor para o BACKLOG.md e implementa uma por ciclo quando couber.
> Nada de copiar feature sem adaptar ao Brasil/escola particular.

## Semeado em 16/11/2026 — líderes internacionais
Fontes: comparativos públicos de dismissal software (PickupRoster/PikMyKid/SchoolPass, out/2026).

- **Plano de saída padrão por aluno + exceções do dia** (carro, a pé, ônibus/van, after-school)
  com horário-limite (cutoff) para mudança de última hora. Impacto 5, Esforço 3.
  É A dor nº 1 das secretarias (concorrente PickUp Patrol existe só para isso).
  ✅ IMPLEMENTADO em 17/11/2026 (DismissalPlanService + DismissalPlansModule — plano
  padrão por dia da semana só pela secretaria, "copiar segunda", exceção do dia com
  cutoff 13:30 configurável por escola, 1 exceção ativa/aluno/dia, resolve com
  EXCEPTION > DEFAULT > NONE, log de mudanças p/ auditoria; modelos
  DismissalDefaultPlan + DismissalException no schema; ver BACKLOG).
- **Carpool/rodízio entre famílias** vinculadas, com fila única por carro. Impacto 4, Esforço 3.
- **Reunificação em emergência + modo simulação (drill)** de evacuação/saída. Impacto 4, Esforço 4.
- **Botão de pânico silencioso** da portaria/coordenação. Impacto 3, Esforço 2.
- **Gestão de visitantes** integrada ao mesmo painel (expansão natural do produto). Impacto 4, Esforço 5 — fase 2.
- **Leitura de placa (ALPR) / tag veicular** como entrada alternativa ao GPS/QR. Impacto 4, Esforço 5 — fase 2, hardware parceiro.

## Semeado em 16/11/2026 — concorrentes Brasil
Fontes: Escola Ágil/Cheguei, ClipEscola "Estou Chegando", School Guardian, GoHome, iDapp (nov/2026).

- **ETA ao vivo do tutor** ("chega em 2, 5 ou 10 min") — Escola Ágil vende exatamente isso. Impacto 5, Esforço 3.
  Já temos geofencing; falta estimar ETA e exibir no painel.
- **Ordem da fila por proximidade (FIFO real)**, não por ordem de clique. Impacto 4, Esforço 2.
- **Modo telão/TV** para portaria e salas (compacto, detalhado, tela cheia). Impacto 4, Esforço 2.
- **Saída antecipada solicitada no app** com aprovação da secretaria (School Guardian). Impacto 5, Esforço 2.
- **Módulo van/fretado**: tutor = motorista da van, vários alunos, rota. Realidade BR que gringo ignora. Impacto 5, Esforço 3.
  ✅ IMPLEMENTADO em 17/11/2026 (VanRouteService + VanRoutesModule — rota
  com paradas ordenadas, "criança da vez", embarcou/entregue/não estava no
  ponto/não vai hoje, a rota NÃO fecha com criança a bordo nem sem registro,
  alerta de rota vencida com criança a bordo, correção com motivo sem apagar
  o original, log append-only com hash encadeado; modelos VanRoute +
  VanRouteStop no schema; ver BACKLOG).
- **Relatório "escola amiga do trânsito"**: tempo médio de saída, redução de fila — material de marketing
  que a diretoria usa para captar alunos (GoHome vende esse ângulo). Impacto 4, Esforço 2.
  ✅ IMPLEMENTADO em 17/11/2026 (DismissalReportService + ReportsModule — ver seção frente d, ciclo 14).
- **Implantação em 1 dia**: importação CSV + onboarding assistido como feature de produto, não serviço. Impacto 5, Esforço 2.

## Semeado em 17/11/2026 — LGPD, segurança e auditoria (frente e, ciclo 9)
Fontes: diarioescola.com.br "LGPD na escola" (ago/2026); ezeats.app.br "LGPD na escola"
(set/2026); educacaoeprofissao.com.br "LGPD na escola" (atual. 23/10/2026);
safeguardis.org "Safeguarding international schools in Brazil" (19/10/2026);
Norma Técnica 002/2026 (Nova Ramada/RS, DPO municipal).

- **ECA Digital regulamentado (Decreto 12.880/2026, em vigor desde 17/03/2026)**:
  regras próprias p/ produtos e serviços de TI direcionados a crianças e
  adolescentes ou de acesso provável por esse público, fiscalizados pela ANPD.
  O TutorPass é usado por pais, mas os dados são de menores — o app do tutor
  precisa seguir as mesmas exigências de transparência e minimização.
  Impacto — (contexto regulatório, sem ação de código).
- **Incidente de segurança: comunicar ANPD + titulares em até 3 dias úteis**
  (Resolução CD/ANPD nº 15/2024): quando o incidente puder acarretar risco ou
  dano relevante, o controlador comunica a Agência e os afetados em 3 dias
  úteis, com complementação em até 20 dias úteis. A infração mais comum
  apurada pela ANPD não é o vazamento em si — é a falha em comunicar no prazo.
  Um arquivo enviado à família errada, uma planilha com permissão aberta ou um
  equipamento perdido também contam como incidente. Impacto 4, Esforço 2.
  ✅ IMPLEMENTADO em 17/11/2026 (SecurityIncidentService + IncidentsModule —
  registro com categorias de dados (nunca o conteúdo), relógio de 3/20 dias
  úteis, checklist de contenção/comunicação, `listOverdue` p/ o DPO, log
  append-only com hash encadeado; modelo SecurityIncident no schema; ver
  BACKLOG). Reforça a tese (auditoria imutável).
- **Transferência internacional de dados (art. 33 LGPD, Resolução ANPD 19/2024)**:
  dados só saem do BR nos casos listados (cláusulas-padrão, consentimento
  específico). Nosso push passa por infra fora do BR (Expo) — mapear
  suboperadores e transferências no relatório de conformidade da escola.
  Impacto 3, Esforço 1 — detalhe p/ a ideia "relatório de conformidade LGPD".
- **Dever de denunciar violência contra criança (Lei 14.344/2022, Lei Henry Borel;
  Lei 13.431/2017; Lei 14.811/2024 — bullying/cyberbullying crime)**: escola
  denuncia ao Conselho Tutelar / Disque 100; omitir é infração. Não é feature
  de saída, mas o painel da secretaria é o lugar onde um sinal de alerta pode
  aparecer — fase 2, com orientação jurídica. Impacto — (fora da tese de saída).
- **Notificação dual-path (push + registro durável in-app)**:
  ✅ IMPLEMENTADO em 17/11/2026 (NotificationService + NotificationsModule —
  registro in-app sempre primeiro, push best-effort com consentimento
  PUSH_NOTIFICATIONS + token Expo, retry até 3 tentativas, leitura isolada
  por tutor, expurgo só de lidas antigas; modelo Notification no schema;
  ver BACKLOG). Reforça a tese (a decisão da saída antecipada e a chamada do
  aluno chegam mesmo se o push falhar).

## Semeado em 16/11/2026 — LGPD, segurança e auditoria (frente e)
Fontes: LGPD art. 14 (crianças/adolescentes), ECA Digital (Lei 15.211/2025, em vigor mar/2026),
ANPD como agência reguladora (Lei 15.352/2026, 19 processos sancionadores só em jun/2026, multa até R$ 50 mi) —
cassiusmarques.adv.br e ezeats.app.br (nov/2026).

- **Consentimento LGPD por finalidade, com registro em auditoria** (geolocalização do tutor, selfie
  de delegação, foto do aluno, push) — criança < 12 só com responsável legal + explícito + versão do
  aviso exibido; selfie (biométrico) exige explícito; revogação imediata e registrada. Impacto 5, Esforço 2.
  ✅ IMPLEMENTADO em 16/11/2026 (ConsentService + ConsentRecord) — reforça a tese (auditoria imutável).
- **Minimização de dados: posição do tutor nunca persistida** — geolocalização só em tempo real, sem
  histórico de localização; só o registro de consentimento fica no log. Impacto 4, Esforço 1.
  Parcialmente embutido no ConsentService (retenção 0 dias p/ geolocalização); falta garantir no
  RealtimeService/GeofencingService que nenhum ping é gravado.
- **Expurgo automático por retenção** (selfie 30 dias após a retirada; foto do aluno ao fim da matrícula)
  — job agendado que apaga/anomiza por `retentionDeadline`. Impacto 4, Esforço 2. → PRÓXIMA CANDIDATA.
- **Relatório de conformidade LGPD p/ a escola (DPA-ready)**: o que é coletado, finalidade, base legal,
  retenção e suboperadores — documento que a diretoria mostra a pais e à ANPD. Impacto 4, Esforço 2.
- **Exercício de direitos do titular (art. 18)**: exportar/apagar dados de aluno/tutor pelo painel do
  admin, com o pedido registrado em auditoria. Impacto 4, Esforço 3.
- **Consentimento separado por finalidade na matrícula** (nunca termo genérico escondido no contrato)
  + canal simples de revogação no app do tutor. Impacto 4, Esforço 2 — fase 2 (depende do app).

## Semeado em 17/11/2026 — tecnologia: geofencing, realtime e push (frente f)
Fontes: guias iOS/Android de geofencing 2026 (copyprogramming.com, appypie.com, smartupworld.com),
guias de escala Socket.io/Redis (oneuptime.com, dev.to, ably.com, ago–nov/2026).

- **Eventos realtime com ID + recuperação após reconexão (catch-up)**: Socket.io é at-most-once
  por padrão — o que a portaria perde durante uma queda de conexão some para sempre, a menos que
  haja IDs de evento e reenvio. Na saída escolar, perder um "aluno chamado" é falha operacional.
  Solução: numerar eventos por escola/sala e, ao reconectar, o cliente pede o que perdeu desde o
  último ID visto. Impacto 5, Esforço 3.
  ✅ IMPLEMENTADO em 17/11/2026 (EventLogService + envelope `{ seq, data }` + `events.catch_up`;
  ring buffer de 500 eventos/room com `hasGap` — ver docs/03).
- **Adapter Redis Streams em vez do pub/sub clássico**: o adapter clássico (@socket.io/redis-adapter,
  já no projeto) não suporta Connection State Recovery do Socket.io 4.6+; os adapters Redis Streams
  e MongoDB suportam. Sem isso, escalar para multi-instância e recuperar sessão são mutuamente
  exclusivos. Impacto 4, Esforço 3 — fase 2 (quando houver 2ª instância da API).
  ✅ IMPLEMENTADO em 17/11/2026 (ciclo 27: `@socket.io/redis-streams-adapter@0.3.1`,
  adapter com 1 cliente ioredis + CSR de 2 min; o clássico foi removido das dependências).
- **Geofence por evento, não rastreamento contínuo**: geofence bem feito custa 1–20% de bateria/dia
  vs 30–40% do GPS contínuo; usar a precisão mais grossa que resolve o problema (significant-change
  fora do raio, alta precisão só dentro da zona APPROACH). iOS limita a 20 geofences/app e Android a
  100 — 1 escola = 2 zonas, sem problema; tutor multi-escola precisa de rotação. iOS 18 exige
  CLServiceSession p/ monitoramento em background; Android 16 mostra indicador azul quando o app
  acessa localização (transparência vira requisito de UX). Impacto 4, Esforço 2.
  Parcialmente alinhado: já descartamos ping com accuracy > 65 m e usamos 2 pings p/ ARRIVAL;
  falta documentar a política de precisão/bateria no app mobile.
- **Raio de geofence 100–500 m (recomendado)**: nosso APPROACH hoje é 800 m — acima do recomendado,
  o que aumenta falsos positivos de "chegando". Reavaliar para 500 m quando o ETA ao vivo entrar.
  Impacto 3, Esforço 1.
- **Push via Expo quando o app está fechado**: geofence acorda o app, mas a chamada do aluno precisa
  chegar como push (não depende de websocket aberto). Depende do consentimento PUSH_NOTIFICATIONS,
  já modelado. Impacto 4, Esforço 3 — fase 2 (depende do app mobile).
- **CVE-2026-33151 (Socket.io)**: pacote malicioso pode travar o servidor com buffer de anexos
  binários sem limite; corrigido em 4.2.6+. Verificado em 17/11/2026: projeto usa **4.8.1** — não
  vulnerável. Impacto — (verificação, sem ação).

## Semeado em 17/11/2026 — tecnologia/realtime + saída antecipada (frentes f/a)
Fontes: dismissal.ai (2026, onboarding 2026–27); School Tag Parent (Google Play, atual. 25/07/2026);
ReadyBell (usereadybell.com, 2026); Technothera Smart Dismissal System; Vámonos (Google Play,
atual. 31/10/2026); Greennounce (technomous.com, atual. 12/11/2026).

- **Saída antecipada solicitada no app com aprovação da secretaria**:
  dismissal.ai (2026) — tutor pede com dia, hora e motivo, a secretaria aprova ou recusa e o
  tutor vê a resposta no app; School Tag agenda "early releases" com data/hora/motivo e avisa a
  escola automaticamente. Impacto 5, Esforço 2.
  ✅ IMPLEMENTADO em 17/11/2026 (EarlyDismissalService + EarlyPickupModule — motivo obrigatório,
  cutoff de 30 min, 1 pedido ativo/aluno/dia, recusa com motivo, expiração automática, validade
  na retirada via `isApprovedForPickup`; modelo `EarlyDismissalRequest` no schema; ver BACKLOG).
- **Notificação dual-path (push + registro durável in-app)**: ReadyBell (2026) — toda notificação
  tem dois caminhos (push e registro durável no app), então um push que falha nunca significa
  mensagem perdida; a interface distingue "na fila" de "enviado" de "falhou", em vez de prometer
  entrega. É o padrão certo p/ a decisão da saída antecipada e p/ a chamada do aluno.
  Impacto 4, Esforço 2. → PROMOVIDA ao BACKLOG (refina o item de push do Step 3).
- **Pré-aviso ~10 min antes da chegada**: Technothera Smart Dismissal — o pai avisa ~10 min antes,
  o professor recebe push silencioso e deixa o aluno pronto; sem download de app (PWA no
  navegador). Greennounce: mesmo gesto, "one-tap arrival" em tempo real. Nosso geofence ARRIVAL
  já faz isso automaticamente; o pré-aviso manual é o fallback quando o GPS falha (mesmo gesto
  do botão "Estou aqui" da frente c). Impacto 4, Esforço 2.
- **Um só fix de GPS por toque, sem rastreamento contínuo**: ReadyBell — o app tira UMA posição
  quando o pai toca "Leaving Now"; nada de background tracking, por desenho. Reforça nossa
  minimização de dados (posição do tutor nunca persistida, verificado em 17/11/2026) e vira
  argumento de venda LGPD. Impacto — (reforço da tese, sem ação de código).
- **Cartão QR p/ avós e terceiros sem app**: Vámonos — o tutor gera um cartão com QR p/ cada
  pessoa autorizada, sem ela instalar nada; o cartão pode ser cancelado a qualquer momento.
  Complementa nossa delegação com selfie (que exige app). Impacto 3, Esforço 2 — fase 2.
- **Broadcast de emergência + lockdown**: ReadyBell — comunicado digitado p/ um público escolhido
  e um toque de lockdown que bloqueia novos pedidos de retirada na escola inteira e alerta todos
  os pais. Impacto 3, Esforço 4 — fase 2 (expansão além da saída do dia a dia).
- **PWA sem download de app**: Technothera — funciona no navegador do celular, sem App Store.
  Reduz fricção de onboarding (tese: implantação em 1 dia), mas perde push nativo no iOS.
  Impacto 3, Esforço 3 — fase 2 (avaliar quando o app mobile entrar).

## Semeado em 17/11/2026 — concorrentes internacionais (frente a)
Fontes: comparativo PickupRoster "Best School Dismissal Software (2026): 13 Tools Compared"
e "PikMyKid Alternatives (2026)", verificados em 18/10/2026 (staging.pickuproster.com);
Capterra PikMyKid 2026; eathealthy365.com "Top-Rated Car Line Dismissal App Options for 2026".

- **Tier gratuito / trial sem cartão como aquisição**: PikMyKid tem tier Free Car Line
  (portal web, entrada manual, 5 usuários staff, relatório diário por e-mail); PickupRoster
  dá 30 dias sem cartão; QManager 30 dias; Schoolhouse Driveline 60 dias. Impacto 5, Esforço 2.
  → PROMOVIDA ao BACKLOG: plano free limitado + trial sem cartão (casa com "implantação em
  1 dia" e preço simples — diferencial contra os gringos, que quase todos cobram por cotação).
- **Preço publicado por aluno/ano**: mercado 2026 cobra US$ 4–12/aluno/ano (maioria US$ 6–8);
  PickupRoster publica US$ 150/mês ou US$ 1.440/ano (Car Line) e US$ 500/mês (Campus);
  Carline Hound US$ 33/mês ou US$ 299/ano; PikMyKid a partir de US$ 3.750/ano (GetApp) e o
  resto é "quote". Publicar preço simples em R$/aluno/mês é diferencial de venda no BR.
  Impacto 4, Esforço 1.
- **Delegação com verificação por foto/documento na portaria**: PikMyKid permite delegar a
  retirada a amigo/parente por um dia e o staff verifica com foto/documento — nossa delegação
  com selfie já existe; falta o passo de conferência visual no painel da portaria.
  Impacto 4, Esforço 2.
- **Relatório diário de saída por e-mail**: PikMyKid inclui no tier free — resumo do dia
  (quem saiu, atrasos, exceções) enviado à secretaria. Impacto 3, Esforço 2.
- **Consolidação do mercado**: CENTEGIX comprou a PikMyKid (abr/2026) e a rebatizou CENTEGIX
  Dismissal (out/2026), dentro de uma plataforma ampla de segurança escolar. As suites amplas
  estão absorvendo os dismissal-only — nossa tese ("o melhor SÓ em saída") vira posicionamento
  contra suites caras e lentas, mas exige preço publicado e implantação em 1 dia como prova.
  Impacto — (posicionamento, sem ação de código).
- **Drills com templates + after-action report**: PickupRoster tem 12 templates de drill,
  chamada ao vivo (roll) e relatório pós-drill com replay (Campus). Reforça a ideia já
  semeada de reunificação/drill (Impacto 4, Esforço 4).
- **Botão de pânico silencioso**: PikMyKid tem — reforça a ideia já semeada (Impacto 3, Esforço 2).

## Semeado em 17/11/2026 — concorrentes Brasil (frente b)
Fontes: escolaagil.com.br; ajuda.classapp.com.br (Cheguei p/ funcionários); gohome.app.br
(artigos 10/08 e 05/10/2026); clipescola.com (blog "Estou Chegando", atualizado 03/02/2026);
tech.escolaeleva.com.br e sanfra.g12.br (tutoriais School Guardian, jan/2026); vídeos
Colégio Arcádia (26/10/2026) e Anglo-CID Dracena (06/01/2026); skolar.com.br (planos, nov/2026).

- **Preço publicado em R$/mês por faixa de alunos (estilo Skolar)**: a Skolar — agenda escolar
  digital BR — publica Start R$ 179/mês (até 20 alunos), Plus R$ 279 (até 100, recomendado) e
  Pro R$ 379 (até 200), 30 dias grátis sem cartão, PIX, sem fidelidade. O Plus sai a
  R$ 2,79/aluno/mês. É o benchmark BR mais próximo do nosso PRO (R$ 2,90/aluno/mês, sem teto
  de faixa) — e prova que escola BR compra plano publicado, sem "sob consulta". Impacto 4,
  Esforço 1. → Reforça a ideia já promovida "preço publicado por aluno/mês".
- **Implantação em 3 dias (Escola Ágil) vs nossa tese de 1 dia**: a Escola Ágil vende
  "implantação em 3 dias, sem interromper as aulas", 5.000+ alunos protegidos, 80% menos filas.
  Nossa tese (1 dia) é mais agressiva — e precisa ser provada pelo onboarding assistido +
  importação CSV, não só prometida. Impacto — (posicionamento, sem ação de código).
- **QR estático pessoal nos concorrentes BR**: School Guardian usa QR Code pessoal e
  intransferível por responsável (e pede p/ "não compartilhar ou printar" — depende de política,
  não de criptografia). Nosso QR dinâmico de 30 s com anti-replay é diferencial explícito
  contra eles. Impacto — (reforço da tese, sem ação).
- **Autorização temporária com prazo determinado (1 dia / 1 semana / 1 mês)**: School Guardian
  (Eleva/Colégio São Francisco) vende isso — o responsável autoriza um terceiro só nos dias
  definidos. Nossa delegação com selfie já existe; falta o prazo determinado. Impacto 4,
  Esforço 2. → PROMOVIDA ao BACKLOG (próxima candidata).
- **Tela de antecipação de chamado no app do tutor**: School Guardian (Eleva Barra/Brasília)
  abre uma tela p/ o tutor indicar ANTES quais alunos vai buscar — evita abrir o app na hora
  e organiza a fila antes da chegada. Impacto 3, Esforço 2.
- **Saída antecipada só pelo app, em horários fixos**: School Guardian (São Francisco) exige
  solicitação exclusivamente pelo app, em janelas fixas (15h, 16h ou 17h). Janelas fixas
  simplificam a operação da secretaria — detalhe novo p/ a ideia já semeada (Impacto 5,
  Esforço 2). → Reforça "saída antecipada com aprovação da secretaria" no BACKLOG.
- **Painel com anúncio por microfone**: Colégio Arcádia — coordenador anuncia o nome do aluno
  pelo microfone e o nome aparece no telão; confirmação da entrega num tablet na porta.
  Complemento barato do modo telão/TV (Impacto 4, Esforço 2). Impacto 3, Esforço 2 — fase 2
  (depende do telão).
- **ETA ao vivo "chega em 2, 5 ou 10 min" + saída antecipada (Escola Ágil/Cheguei)**:
  o Cheguei vende exatamente o ETA em faixas e a preparação de alunos/vans antes da chegada —
  reforça as ideias já semeadas de ETA ao vivo (Impacto 5, Esforço 3) e fila por proximidade.
- **Tag veicular/RFID como entrada (GoHome)**: chamada automática quando o carro se aproxima
  do perímetro; projetos modulares/personalizados, sem preço publicado. Reforça a ideia já
  semeada de ALPR/tag (Impacto 4, Esforço 5 — fase 2, hardware parceiro).
- **FIFO por proximidade com cores por raio (ClipEscola "Estou Chegando")**: painel ordena os
  pais por distância (o mais perto primeiro) e usa cores — amarelo p/ raio intermediário,
  vermelho p/ < 40 m ("encaminhar já"). Inspiração de UX p/ o painel da portaria quando a
  fila por proximidade entrar. Impacto 3, Esforço 1 — fase 2 (depende da fila por proximidade).
- **Tier gratuito limitado + trial sem cartão (frente a/b)**:
  ✅ IMPLEMENTADO em 17/11/2026 (PlanService + SchoolPlan — FREE 30 alunos/5 staff, TRIAL 30
  dias sem cartão, PRO R$ 2,90/aluno/mês; ver BACKLOG). Benchmark BR: Skolar testa 30 dias
  grátis sem cartão. Reforça a tese (aquisição sem fricção + implantação em 1 dia).

## Semeado em 17/11/2026 — UX/design de painéis e apps de fila (frente c)
Fontes: eathealthy365.com "Top-Rated Car Line Dismissal App Options for 2026";
pickupedu.com ("pickup.", 2026); sobrennan.myportfolio.com "School'sOut" (pesquisa UX,
Baltimore County, 16 semanas); instagram.com/p/DX1V1nAAAhH (RIS ONE "Smart Dismissal",
mai/2026).

- **Fila única compartilhada + telão de chamada**: "pickup." (2026, grátis p/ as 250
  primeiras escolas, depois US$ 200/escola/ano): um só queue compartilhado entre scanner
  da portaria, telão e admin — nada de listas paralelas por sala. Telão mostra quem é o
  próximo; zonas de embarque configuráveis (1–6); avanço em lote ou individual, por
  controle do staff. Impacto 4, Esforço 2. → Reforça "modo telão/TV" no BACKLOG.
- **Foto grande do aluno + cor por status no painel**: DismissalFlow (líder 2026 no
  comparativo) usa fotos grandes e color-coding no dashboard do staff; PikMyKid, "funcional
  mas datado". Na portaria, reconhecer o aluno pela foto em 1 segundo vale mais que
  qualquer coluna de texto. Impacto 4, Esforço 1 — aplicar no design do painel da portaria.
- **Botão "Estou aqui" no app do tutor**: RIS ONE "Smart Dismissal" (2026): o pai toca
  "I'm here — Send dismissal request" e a supervisão é notificada na hora, com status em
  tempo real. É o mesmo gesto do nosso geofence ARRIVAL, mas explícito — fallback manual
  quando o GPS falha ou o pai está a pé. Impacto 4, Esforço 2.
- **Scanner com conferência de alunos no ato**: "pickup." escaneia a tag QR do carro,
  confirma os alunos daquele carro e adiciona à fila; staff pode adicionar/remover alunos
  no scan, seguindo a autorização da escola. Impacto 3, Esforço 2 — detalhe p/ o nosso
  `validate-qr` do Step 2.
- **Dor raiz (pesquisa School'sOut)**: pais em fila com placas escritas à mão no
  para-brisa, staff com walkie-talkie e prancheta, sem prova de identidade na retirada —
  e os pais evitam o ônibus por insegurança. Nosso QR dinâmico + selfie do delegado ataca
  exatamente essa dor; o painel precisa eliminar o grito e a prancheta, não digitalizá-los.
  Impacto — (validação da tese, sem ação de código).
- **Autorização temporária com prazo determinado (1 dia / 1 semana / 1 mês)**:
  ✅ IMPLEMENTADO em 17/11/2026 (TemporaryAuthorizationService + DelegationsModule —
  ONE_DAY de uso único, ONE_WEEK/ONE_MONTH multiuso, selfie obrigatória, sem
  sobreposição, revogação e refresh p/ EXPIRED; ver BACKLOG). Reforça a tese
  (auditoria + anti-fraude: janela curta por padrão, expiração automática).

## Semeado em 17/11/2026 — modelo de negócio/preço/onboarding (frente d)
Fontes: myschoolreg.com "Best School Management Software in Nigeria (2026)";
codeclove.com "Stop Paying School SaaS Fees" (2026); campus.airanexus.in (FAQ, 2026);
campus24x7.in "School ERP Software Price in India (2026)"; osmic.co.in
"School Management Software: Features, Pricing & Rollout Plan" (out/2026);
guias de escolas PickUp Patrol / School Dismissal Manager (nov/2026).

- **Plano padrão + exceção com cutoff (o modelo PickUp Patrol/SDM)**: o default é o
  jeito normal de o aluno ir embora em cada dia da semana (ex.: ônibus 2ª/4ª/6ª,
  carro 3ª/5ª) e a exceção é o desvio num dia específico, que pode ser lançado com
  dias/semanas de antecedência; no mesmo dia, só até o cutoff — 13:30 (SDM),
  14:00 (PickUp Patrol), 13:20 (WCS). Depois do cutoff, só emergência por telefone;
  bilhete, e-mail e ligação não valem. O default é da escola (só a secretaria muda;
  no PickUp Patrol, nem entra pelo app — só no portal web) e o tutor só lança
  exceções; "COPY MONDAY" replica o plano de segunda p/ a semana. A confirmação de
  cada mudança chega por e-mail e o professor é avisado automaticamente; no SDM, o
  relatório do dia sai sozinho às 13:30. Impacto 5, Esforço 3.
  ✅ IMPLEMENTADO em 17/11/2026 (DismissalPlanService — ver BACKLOG).
- **Onboarding: o padrão de mercado é 7 dias úteis a 30 dias**: AiraNexus entra no ar
  em 7 dias úteis (migração de dados + treino inclusos, CSV de qualquer sistema);
  osmic.co.in planeja 30 dias (1 semana setup, 1 migração, 1 treino, 1 lançamento
  p/ os pais). Nossa tese de 1 dia é mais agressiva que todo o mercado — e só se
  prova com importação CSV com template de exemplo + onboarding assistido, não com
  promessa. O maior risco do dia do lançamento é dado sujo (aluno duplicado,
  telefone errado). Impacto 4, Esforço 2 — reforça "implantação em 1 dia" no BACKLOG
  (CSV + onboarding assistido como feature de produto).
- **Preço por aluno/mês é o modelo dominante — e o nosso é barato**: suites de gestão
  escolar cobram US$ 3,50–15/aluno/mês (ClassReach US$ 3,50–8; Classter US$ 5–12;
  Gradelink US$ 4–10; Alma/PowerSchool US$ 7–15 + retainer de onboarding); Índia
  ₹8–15/aluno/mês; Nigéria ₦500–2.500/aluno/termo. Nosso PRO (R$ 2,90/aluno/mês,
  ~US$ 0,55) fica bem abaixo de todas as faixas — é argumento de venda, não só
  preço. Atenção: quase todo fornecedor tem preço-mínimo (floor) p/ escolas pequenas
  (< 200–300 alunos pagam o piso de qualquer jeito) — avaliar um piso p/ o PRO
  quando o billing entrar. Impacto — (validação do preço, sem ação de código).
- **Trial longo como aquisição**: MySchoolReg dá 1 termo inteiro grátis + janela de
  pagamento de 45 dias; o trial de 30 dias sem cartão já é o padrão do mercado.
  Nosso TRIAL (30 dias, 1 por escola) está alinhado — o diferencial é o FREE
  permanente (30 alunos), que quase ninguém oferece. Impacto — (reforço da tese).
- **"Pague por aluno" cresce com a matrícula sem uso maior**: a crítica da codeclove
  (2026) é que a conta sobe a cada aluno novo mesmo sem o custo do fornecedor subir
  — por isso o mercado começa a vender plano por faixa com teto. Nosso PRO já tem
  teto (2.000 alunos) e preço único por aluno; manter o preço publicado simples é o
  diferencial contra os "quote" gringos. Impacto — (posicionamento, sem ação).

## Semeado em 17/11/2026 — concorrentes internacionais + incidentes (frentes a/e, ciclo 10)
Fontes: staging.pickuproster.com "Best School Dismissal Software (2026)" e
"PikMyKid Alternatives (2026)" (atual. out/2026); pikmykid.com (aquisição
CENTEGIX, 07/04/2026); globenewswire via nynewscast.com (plataforma expandida
CENTEGIX, 07/10/2026); trustloud.com / news.layer7data.com (brecha Frontline
Education, ago/2026, cartas a partir de 26/10/2026); theukpulse.co.uk (brecha
Equipple, Irlanda do Norte, nov/2026).

- **CENTEGIX Dismissal virou parte de uma Safety Platform**: após comprar a
  PikMyKid (abr/2026) e rebatizá-la (out/2026), a CENTEGIX vende dismissal
  junto com resposta a emergências, reunificação, gestão de visitantes,
  passes de corredor e alertas vestíveis — 18 mi de pessoas em 18 mil locais.
  O tier Dismissal Full inclui reunificação emergencial pai/filho. As suites
  amplas seguem absorvendo os dismissal-only: nossa tese ("o melhor SÓ em
  saída") precisa de prova concreta a cada ciclo — preço publicado,
  implantação em 1 dia e agora o registro de incidentes. Impacto — (reforço
  da tese, sem ação de código).
- **Vazamentos em software escolar são reais e a comunicação é lenta**:
  Frontline Education (ago/2026) — invasão por falha em software de terceiro,
  2 produtos (Frontline Central e School Health Management), 1,3 mi+ de
  pessoas (SSNs, datas de nascimento, CNH/passaporte, Medicaid IDs e IDs de
  alunos), cartas aos afetados só a partir de 26/10/2026; Equipple (Irlanda
  do Norte, nov/2026) — acesso não autorizado à nuvem, ~50 mil usuários,
  contato de pais + nomes, datas de nascimento e turmas de alunos. Nenhum
  concorrente de dismissal publica um registro estruturado de incidentes —
  é o nosso diferencial de auditoria. Impacto 4, Esforço 2.
  ✅ IMPLEMENTADO em 17/11/2026 (SecurityIncidentService — ver seção frente e
  acima e BACKLOG).
- **Reunificação emergencial como feature do tier pago**: PikMyKid/CENTEGIX
  e PickupRoster (12 templates de drill + after-action report com replay)
  vendem a reunificação pai/filho em emergência como parte do pacote —
  reforça a ideia já semeada (Impacto 4, Esforço 4 — fase 2, além da saída
  do dia a dia).

## Semeado em 17/11/2026 — UX/design de painéis e apps de fila (frente c, ciclo 11)
Fontes: usereadybell.com (ReadyBell, 2026); technothera.com "Smart Dismissal
System" (2026); pickupflow.app (2026); safepickapp.com (2026);
schoolcheckinapp.com (2026); dismisspro.app (2026); guia de carpool
Swift Creek Elementary (facebook.com, 18/08/2026); Baymeadows Charter
"Arrival and Dismissal Procedures" (2025–26).

- **ETA ao vivo do tutor no painel + fila ordenada por proximidade**:
  ReadyBell — ETA "traffic-aware" (MapKit, calculado 1× por pedido, não
  pollado), fila do professor ordenada por urgência, chip de ETA + contagem
  regressiva ao vivo e timeline de 5 passos visível p/ pai e professor ao
  mesmo tempo; Technothera — contagem regressiva por pedido, selo ARRIVED
  pulsante, READY em verde, ordem automática Chegou → Pronto → Contagem
  regressiva; PickupFlow — ETA em contagem regressiva por família, fila ao
  vivo por carro/a pé, botão "I'm Here"; SafePickApp — "4 minutes to gate",
  chip de ETA, fila ao vivo espelhada nos dois lados; Escola Ágil/Cheguei —
  ETA em faixas de 2, 5 e 10 min. O padrão do mercado é **ordenar por
  urgência, não por ordem de clique**: quem chegou primeiro, depois o menor
  ETA. Impacto 5, Esforço 3.
  ✅ IMPLEMENTADO em 17/11/2026 (EtaService + EtaModule — faixas HERE/NOW/
  SOON/LATER/FAR/STALE com cores RED/ORANGE/YELLOW/BLUE/GRAY, ETA por
  distância/velocidade com default 30 km/h carro e 5 km/h a pé, botão
  "Estou aqui" como fallback p/ GPS falho, histerese de saída +40 m, STALE
  após 60 s sem posição e expurgo após 5 min; ver BACKLOG). Reforça a tese
  (a portaria sabe quem preparar agora — é o coração da saída).
- **Painel dividido "Pronto p/ retirada" vs "A caminho"**: ReadyBell — board
  em paisagem (Pickup Lane) separa quem já está pronto de quem está a
  caminho; Technothera — colunas Preparando/Pronto no telão. É a vista do
  modo telão/TV: duas colunas, sem rolagem. Impacto 3, Esforço 1 — detalhe
  p/ a ideia "modo telão/TV" no BACKLOG.
- **Cores por zona/placa no mundo real**: escolas americanas usam cor da
  placa por série (vermelho K–1º, verde 2º, azul 3º–5º) com horário de fila
  por cor, e cones coloridos no pátio (Swift Creek: 6 primeiros alunos em
  ordem vermelho→roxo, cada um num cone da mesma cor). A cor como
  identificador rápido vale mais que texto — reforça o color-coding do
  nosso painel (foto grande + cor por status, frente c). Impacto — (validação
  da tese de UX, sem ação de código).
- **Preço dos novos entrantes**: DismissPro — grátis por 12 meses, depois
  US$ 199/escola/ano com admins ilimitados; "pickup." — grátis p/ as 250
  primeiras escolas, depois US$ 200/escola/ano. O preço por escola/ano (não
  por aluno) é o modelo dos entrantes 2026 — nosso PRO (R$ 2,90/aluno/mês)
  precisa do piso p/ escolas pequenas (já anotado na frente d) p/ não
  perder p/ esse modelo. Impacto — (posicionamento, sem ação de código).

## Semeado em 17/11/2026 — modo telão/TV + preço por escola/ano (frentes c/d, ciclo 12)
Fontes: staging.pickuproster.com "Best School Dismissal Software (2026)" e
"PikMyKid Alternatives (2026)" (atual. out/2026); dismissalmagic.com (2026);
pickupedu.com (2026); pickceldev.pickcel.com "Best Digital Signage Software
for Schools" (out/2026).

- **Telão ao vivo é o produto, não um acessório**: PickupRoster — board ao
  vivo no navegador, cada sala/corredor/tela atualiza ao mesmo tempo;
  Schoolhouse Driveline — nome do aluno + local de retirada por cor em
  smartboards, projetores ou qualquer navegador (até 9 locais por cor);
  Time To Dismiss — nomes grandes de alto contraste em laptops, tablets,
  projetores e TVs a partir de um link, sem instalar nada; Carline Hound —
  telão na área de embarque alimentado pelo app do "line walker". O
  critério de compra do comparativo é literalmente "quem vê o resultado:
  só um aparelho do staff, um board ao vivo p/ salas e corredores, ou as
  famílias também?". Impacto 4, Esforço 2.
  ✅ IMPLEMENTADO em 17/11/2026 (DisplayBoardService + DisplayBoardModule —
  duas colunas "Pronto p/ retirada" vs "A caminho" sem rolagem, paginação
  com rotação automática, modos GATE/CLASSROOM/HALLWAY, pop-up de chamada
  de 20 s com contagem regressiva, nome mascarado + sem foto no corredor;
  ver BACKLOG). Reforça a tese (o telão é o que a escola mostra — é a
  prova visível de que a saída funciona).
- **Pop-up em tela cheia + sino quando a turma é chamada**: Dismissal Magic
  — quando a turma é chamada, um ônibus alegre ocupa a tela inteira com um
  sino, p/ ninguém perder mesmo do fundo da sala; cada turma vê os ônibus
  chegando, esperando e saindo na ordem certa. É o gesto que o nosso
  `callStudent` implementa (20 s, um por vez). Impacto 3, Esforço 1 —
  detalhe p/ o telão (fase 2: sino/áudio na TV).
- **Preço por escola/ano é o modelo dos telões**: Dismissal Magic — US$
  149/ano (25 primeiras escolas, preço travado) ou US$ 249/ano, tudo
  incluído, telas ilimitadas, 1 mês grátis; PickupRoster — Car Line US$
  150/mês ou US$ 1.440/ano; Schoolhouse Driveline — US$ 748 no 1º ano
  (60 dias grátis) e US$ 935/ano por campus, sem taxa por aluno; Carline
  Hound — US$ 33/mês ou US$ 299/ano. O telão vende por escola/ano, não por
  aluno — reforça a anotação da frente d (avaliar um piso p/ o PRO quando
  o billing entrar) e o preço publicado em R$ como diferencial. Impacto —
  (posicionamento, sem ação de código).
- **Tela de sinalização digital na escola custa à parte**: tela nova de
  43–55" custa US$ 550–2.250 instalada (Pickcel, out/2026) + software por
  tela/mês — mas a maioria das escolas já tem smart TVs nos corredores e
  paga só o software. Nosso telão roda em qualquer navegador (sem player
  dedicado), então o custo p/ a escola é zero de hardware novo quando ela
  já tem TV. Impacto — (argumento de venda, sem ação de código).

## Semeado em 17/11/2026 — transporte escolar/van no Brasil (frente b, ciclo 13)
Fontes: lp.escolar.app.br (Escolar, 2026); vanep.com.br (Vanep, 2026);
clickvan.app (Clickvan, 2026); cadeavan.com.br (Cadê a Van?); vanescola.com
(VanEscola, 2026); play.google.com (VanEscola Pais, Via Van, School Drive
Drivers, atual. 2026).

- **A rota não fecha com criança a bordo nem com criança sem registro**
  (Escolar): se a rota passa do tempo com criança a bordo, alerta a cada
  5 min por até 2 h (no dobro do tempo, a família é avisada); no fim, o
  motorista confirma que foi até o último banco e que o veículo está vazio.
  É a regra de segurança que o dismissal gringo não tem — e a nossa tese
  (auditoria imutável) pede que ela seja aplicada pelo servidor, não pela
  memória do motorista. Impacto 5, Esforço 2.
  ✅ IMPLEMENTADO em 17/11/2026 (VanRouteService — `finishRoute` e
  `cancelRoute` bloqueados com criança a bordo; `listOverdueRoutes` p/ o
  alerta; ver BACKLOG).
- **Três toques por criança + correção com motivo sem apagar o original**
  (Escolar): "Embarcou", "Entregue", "Não estava no ponto"; "Corrigir pede
  um motivo e guarda o registro original. Nada é apagado: a hora de um
  embarque é prova". É o mesmo padrão do nosso PickupLog (hash encadeado)
  aplicado à van. Impacto 4, Esforço 1.
  ✅ IMPLEMENTADO em 17/11/2026 (VanRouteService — `correctStop` com motivo
  obrigatório + log append-only com `verifyChain`; ver BACKLOG).
- **"Não vai hoje" com um toque (Vanep/Escolar)**: o responsável avisa pelo
  app que o aluno não vai, e o motorista já fica sabendo — sem parar numa
  casa vazia nem depender de mensagem no grupo do WhatsApp. Impacto 4,
  Esforço 1.
  ✅ IMPLEMENTADO em 17/11/2026 (VanRouteService — `markWillNotRide`,
  status NOT_RIDING; ver BACKLOG).
- **Quatro avisos por dia (Vanep)**: embarcou em casa, chegou na escola,
  embarcou na volta, chegou em casa — cada etapa dispara uma notificação na
  hora. É o caso de uso da nossa notificação dual-path na van. Impacto 4,
  Esforço 2 — fase 2 (notificar via NotificationService quando o Step 2
  ligar os kinds VAN_BOARDED/VAN_DELIVERED).
- **Localização só enquanto a rota roda (Cadê a Van? / School Drive)**:
  os responsáveis só veem a van durante a viagem, com aviso visível; ao
  encerrar, o compartilhamento para. Reforça nossa minimização LGPD
  (posição nunca persistida). Impacto — (reforço da tese, fase 2 com o app
  do motorista).
- **Preço dos apps de van (2026)**: Escolar a partir de R$ 47/mês por
  transportador; Cadê a Van? R$ 29,90/mês (plano grátis sem notificações
  nem localização); Vanep 1º mês grátis. Nosso VAN_MODULE já está no PRO
  (R$ 2,90/aluno/mês) sem custo extra por motorista — é argumento de venda
  contra os apps de van avulsos. Impacto — (posicionamento, sem ação).
- **Documentos do motorista com vencimento (Vanep)**: o app avisa antes de
  qualquer documento vencer — e quem está com documento vencido não recebe
  novos alunos. Detalhe p/ a fase 2 do modelo Driver. Impacto 3, Esforço 2
  — fase 2.

## Semeado em 17/11/2026 — relatórios de saída como argumento de venda (frente d, ciclo 14)
Fontes: techaheadcorp.com "School Dismissal System" (PikMyKid, 2026);
eathealthy365.com "Top-Rated Car Line Dismissal App Options for 2026";
albionk12.org (PikMyKid, 2026); placa.ai "Student Pickup Line App" (2026).

- **O relatório é o argumento de venda, não um acessório**: PikMyKid vende
  "33% menos tempo na fila" (mínimo), US$ 47 mil economizados por
  escola/ano e 75 min/semana devolvidos ao professor; Albion (PikMyKid) mede
  saída média de 15 min do início ao fim. O comparativo 2026 lista
  "Reporting & Analytics" como critério de compra: quanto o tempo de saída
  caiu, quais os dias mais cheios — p/ mostrar o valor ao conselho e à
  comunidade de pais. Placa.ai (2026): 45+ min de saída média com
  coordenação manual; relatório diário + tendências de horário + gargalos.
  Impacto 4, Esforço 2.
  ✅ IMPLEMENTADO em 17/11/2026 (DismissalReportService + ReportsModule —
  espera chamada→liberação com média/mediana/p95/máxima, fração ≤ 5 min,
  janela de pico de 15 min, quebra por modo e por sala, score "escola amiga
  do trânsito" 0–100 com rótulo, resumo de período com melhor/pior dia e
  série diária, export CSV; sem dado, as estatísticas são null — nunca
  número inventado; ver BACKLOG).
- **Piloto de 30 dias com medição antes/depois (Placa.ai "One-Lane Pilot")**:
  configurar uma faixa, medir a redução do tempo de espera e o feedback dos
  pais depois de 30 dias — o piloto vira a prova de venda. Nosso resumo de
  período já compara dois intervalos; falta o comparador A vs B com delta no
  próprio relatório. Impacto 4, Esforço 1 — fase 2 (comparador no relatório).
- **Relatório diário por e-mail p/ a secretaria**: PikMyKid inclui no tier
  free — resumo do dia (quem saiu, atrasos, exceções). Impacto 3, Esforço 2
  — fase 2 (precisa do envio de e-mail do Step 2).

## Semeado em 17/11/2026 — autenticação: MFA p/ staff + refresh rotativo (frente e, ciclo 15)
Fontes: help.realsmart.info "Require MFA for staff and students" (2026);
cornerstone-innovations.com "Why So Many Districts Still Leave Student MFA Off" (23/10/2026);
infotech.center "Security and 2-step sign-in"; session-management.com "Token Refresh & Rotation"
e "Detecting Refresh Token Reuse" (RFC 9700, OAuth 2.1); systemdesign.academy
"Authentication System Design" (NIST SP 800-63B rev. 2025, OWASP); diego-rodriguez.work
"JWT Refresh Rotation in Node.js" (2026).

- **2FA obrigatório p/ ADMIN, opcional por escola p/ o resto do staff**: Realsmart
  (2026) — admins e owners SEMPRE usam 2FA, sem como desligar, com 14 dias p/
  configurar a partir do próximo login; Infotech — a escola escolhe "só admins"
  ou "todo o staff", quem deve e não configurou só abre a página de Segurança;
  FACTS SIS (abr/2026) — MFA p/ staff e pais, alunos fora. Nenhum concorrente
  de dismissal publica isso como diferencial — e a nossa tese (auditoria
  imutável) fica furada se a conta da secretaria cai por senha roubada.
  Impacto 5, Esforço 3 — fase 2 (TOTP no login; o AuthService já isola o login
  num só lugar, então o segundo fator entra como passo extra, sem reescrever
  os serviços).
  ✅ IMPLEMENTADO em 17/11/2026 (TwoFactorService + TwoFactorModule — ver
  seção frente e, ciclo 18; AuthController /auth/2fa/*; ver BACKLOG).
- **Tutor entra por código SMS, não por senha** (Infotech): tutores nunca usam
  2FA — entram com código no celular, que já é o segundo fator. Pais não
  precisam gerenciar senha p/ buscar o filho; o login por senha fica p/ o
  staff. Impacto 4, Esforço 3 — fase 2 (provedor de SMS no Step 2).
- **Refresh rotativo com detecção de reuso é obrigatório, não opcional**
  (OAuth 2.1 / RFC 9700, jan/2025): access de 15 min, refresh de 7–30 dias
  com teto absoluto, rotação a cada uso, família revogada inteira quando um
  token já usado reaparece, janela de graça de ~10 s p/ retry de rede
  (devolver o mesmo sucessor, não tratar como roubo). Impacto 5, Esforço 2.
  ✅ IMPLEMENTADO em 17/11/2026 (AuthService — access JWT HS256 15 min,
  refresh opaco com rotação + detecção de reuso + graça de 10 s, lockout de
  5 tentativas/15 min, authorize por tenant/papel; ver BACKLOG).
- **Senha: comprimento mínimo + bloqueio de comuns, sem complexidade forçada**
  (NIST SP 800-63B rev. 2025): nada de "1 maiúscula + 1 símbolo + troca a
  cada 90 dias"; mínimo de 8 caracteres e checagem contra senhas vazadas.
  Impacto 3, Esforço 1 — já aplicado no AuthService (blocklist das mais
  comuns; checagem contra base de vazados fica p/ o Step 2).
- **Bloqueio após tentativas + trilha de auditoria de login** (Infotech: 5
  tentativas erradas travam 15 min; todo login, falha e mudança de 2FA vai
  p/ o AuditLog): o lockout já existe no AuthService; o gancho p/ o
  AuditLog/SecurityIncidentService (reuso detectado = incidente) fica p/ o
  Step 2, quando os controllers existirem. Impacto 4, Esforço 1 — fase 2.
- **MFA de aluno sem telefone** (Cornerstone, out/2026): o 2º fator padrão
  assume um celular — aluno do fundamental não tem um. Soluções: senha com
  imagem, código do professor, aprovação do responsável p/ login incomum.
  Fora da tese (nossos alunos não têm login) — registrado só p/ não copiar o
  erro dos SIS que exigem MFA de criança. Impacto — (sem ação).

## Semeado em 17/11/2026 — guards/RBAC NestJS + seed de dados demo (frente f, ciclo 16)
Fontes: leonwijaya.id "Role-Based Access Control in NestJS with Guards and
Decorators" (2026); copyprogramming.com "TypeScript Role Guard in NestJS:
Complete 2026 Guide with JWT Integration" (NestJS 11, 2026);
theaienabledcoder.com "What Is Database Seeding?" (Prisma seed idempotente);
cedarjs.com "Database Seeds" (upsert, nunca deleteMany); dev.to
"Prisma Postgres Seed" (seed só em dev, nunca em produção).

- **Ordem dos guards é o contrato: auth antes de autorização** (leonwijaya,
  2026): o JwtAuthGuard verifica o token e anexa `request.user` (401 quando
  falta/inválido); o RolesGuard só depois confere o papel (403). Guard de
  papel rodando antes do de auth devolve 403 p/ quem nem logou — o erro
  clássico de configuração. Guard fino (< 50 linhas), decisão delegada ao
  serviço (`AuthService.authorize`) — o guard não reimplementa regra.
  Impacto 4, Esforço 1 — ✅ IMPLEMENTADO em 17/11/2026 (JwtAuthGuard +
  RolesGuard + TenantGuard sobre o AuthService).
- **@Roles por metadata, com `getAllAndOverride`** (NestJS 10: `SetMetadata`;
  Nest 11: `Reflector.createDecorator`): o decorator só rotula a rota, o
  guard impõe; o valor do método vence o da classe. Rota sem @Roles deixa
  passar qualquer autenticado — o padrão do projeto é "tudo autenticado por
  padrão" com `@Public()` só em login/refresh/logout/register, p/ um
  decorator esquecido deixar a rota protegida, nunca exposta. Papéis no
  payload do JWT (barato por requisição, sem lookup) vs carregar do banco a
  cada request (sempre atual, com cache) — ficamos com o payload; a
  revogação de vínculo no Step 2 precisa encurtar a sessão ou ir p/ o
  banco. Impacto 4, Esforço 1 — ✅ IMPLEMENTADO em 17/11/2026.
- **Seed idempotente com upsert, dados demo só fora de produção**
  (theaienabledcoder/cedarjs, 2026): seed bom roda 2× sem duplicar (upsert
  por chave única, nunca `deleteMany`); dados de teste nunca vão p/
  produção (gate por `NODE_ENV`); separar defaults de produção de dados
  demo; `prisma db seed` roda no `migrate reset`. Impacto 3, Esforço 1 —
  ✅ IMPLEMENTADO em 17/11/2026 (prisma/seed.ts — escola demo TRIAL 30
  dias, 2 salas, 4 alunos, 6 usuários com os 5 papéis; senha demo
  documentada, hash scrypt igual ao do login).
- **Parâmetro opcional no construtor quebra o DI do Nest** (achado do ciclo,
  não da pesquisa): `constructor(secret?: string)` faz o Nest tentar
  resolver `String` como provider — o módulo nem sobe. O padrão seguro é
  ler env como propriedade da classe (QrTokenService) ou `@Optional()
  @Inject('TOKEN')`. O mesmo valia p/ `NotificationService(pushSender?)`
  (tentava resolver `Object`) e p/ o `PickupGateway` (RealtimeModule não
  importava o GeofencingModule). Nenhum teste unitário pegava: cada serviço
  era instanciado com `new` direto. A rede de segurança é um teste que
  compila o AppModule e resolve os serviços (app.module.spec.ts).
  Impacto 5, Esforço 1 — ✅ CORRIGIDO em 17/11/2026 (3 bugs de DI, com
  specs de regressão).

## Semeado em 17/11/2026 — cadastro/roster + importação CSV (frente a, ciclo 17)
Fontes: staging.pickuproster.com "PikMyKid Alternatives (2026)" e
"SchoolPass vs PickupRoster" (atual. out/2026); dismissalsoftware.com
(QManager, 2026); dismisspro.app "Help Center" (2026); pickupedu.com
(2026); play.google.com (SchoolPass 2.0, atual. 06/10/2026).

- **Importação CSV com prévia de matches/duplicatas antes de salvar**:
  PickupRoster — CSV/XLSX com guias por SIS (PowerSchool, Infinite Campus,
  Skyward, Blackbaud) e re-importação que ATUALIZA o aluno existente;
  "pickup." — "Review matches and duplicates before saving". É o coração da
  tese "implantação em 1 dia": a secretaria confere antes de salvar, em vez
  de descobrir o erro depois. Impacto 5, Esforço 2.
  ✅ IMPLEMENTADO em 17/11/2026 (RosterService.importStudents — dryRun que
  valida tudo sem gravar, dedupe por matrícula ou nome + turma, erro por
  linha com nº da linha; ver BACKLOG).
- **Template CSV p/ download + export do cadastro atual (backup)**:
  DismissPro — "Download Roster Template (.CSV)" e "Download Master Roster
  (.CSV)" antes de qualquer upload. O template elimina o erro de formato na
  origem; o export é o backup antes de re-importar. Impacto 4, Esforço 1.
  ✅ IMPLEMENTADO em 17/11/2026 (RosterService.rosterTemplateCsv +
  exportRosterCsv, no mesmo formato da importação; o export re-importado
  atualiza, não duplica; ver BACKLOG).
- **Re-importação atualiza, nunca apaga (anti-padrão DismissPro)**:
  o DismissPro avisa que "Uploading replaces your whole roster" — o upload
  sobrescreve o cadastro inteiro. Nosso import faz upsert por matrícula e
  pula duplicata: nada some sem rastro, aluno nunca é apagado (só muda de
  status). Impacto 4, Esforço 1.
  ✅ IMPLEMENTADO em 17/11/2026 (RosterService.importStudents — ver BACKLOG).
- **Inferir o modo de saída das colunas do CSV**: DismissPro — aluno com nº
  de carro vira car rider, só com nº de ônibus vira bus rider. No nosso
  CSV, a coluna de ônibus/van pode alimentar o DismissalDefaultPlan direto
  na importação. Impacto 3, Esforço 1 — fase 2 (coluna `transporte` no CSV
  → plano padrão do aluno).
- **Setup guiado passo a passo**: "pickup." — "Create your school account
  and follow the guided setup" (escola → importar alunos → grupos de
  retirada → tags QR → convidar o time). Nosso onboarding de 1 dia precisa
  desse assistente no web, não só do CSV. Impacto 3, Esforço 2 — fase 2 (web).
- **Cadastro de veículo do tutor com foto da placa**: SchoolPass 2.0 (out/
  2026) — upload de placa/marca/modelo/cor/ano, ou foto do veículo que
  preenche os campos por ML; unificou staff app + parent app num só app.
  Nosso Vehicle já existe no schema; a foto da placa é fase 2. Impacto 3,
  Esforço 3 — fase 2.
- **QManager: setup em 24 h + sync com SIS**: US$ 1.295/ano (Carline &
  Carpool), taxa de setup de US$ 300 isenta até 30/12/2026, trial de 30
  dias sem cartão; sync com Veracross/Blackbaud e, via GG4L, com vários
  outros SIS; "no re-typing". Reforça que o padrão de mercado é importar
  do SIS, não digitar — nosso CSV cobre o 1º dia, o sync é fase 2.
  Impacto — (posicionamento, sem ação de código).
- **"pickup." grátis p/ as 250 primeiras escolas**: grátis pelo resto do
  ano letivo 2026–27, depois US$ 200/escola/ano. O modelo por escola/ano
  segue pressionando nosso PRO (R$ 2,90/aluno/mês) — o piso p/ escolas
  pequenas continua anotado na frente d p/ quando o billing entrar.
  Impacto — (posicionamento, sem ação de código).

## Semeado em 17/11/2026 — 2FA TOTP: implementação (frente e, ciclo 18)
Fontes: wcytcn.com "TOTP Two-Factor Authentication Guide" (2026); toolninja.io
"How to Set Up 2FA the Right Way: TOTP, Backup Codes, and What Actually
Breaks" (2026); nhimg.org "MFA Backup Codes and Recovery Codes: Storage and
Design" (2026, NIST SP 800-63B-4); doi.org/10.6028/NIST.SP.800-63B-4 (jul/2025);
moreonlinetools.com "Two-Factor Authentication (2FA) & TOTP Explained" (atual.
15/11/2026); toolsarena.in "How Does TOTP Work?" (2026).

- **TOTP RFC 6238 sobre HOTP RFC 4226, sem biblioteca externa**: segredo
  Base32 (RFC 4648), HMAC-SHA1 do contador (tempo Unix / 30 s), truncamento
  dinâmico, 6 dígitos, janela de verificação ±1 passo (±30 s p/ tolerar
  relógio dessincronizado). O bug clássico do 2FA artesanal não é a cripto —
  é algoritmo/dígitos/período divergentes entre emissor e app, ou janela
  estreita demais (só o passo exato falha na borda dos 30 s). Validado
  contra os vetores oficiais: RFC 4226 Apêndice D (HOTP 0–9) e RFC 6238
  Apêndice B (59 → 94287082; 1111111109 → 07081804; 1111111111 → 14050471;
  1234567890 → 89005924; 2000000000 → 69279037). Impacto 5, Esforço 2.
  ✅ IMPLEMENTADO em 17/11/2026 (TwoFactorService — TOTP puro com
  node:crypto; HMAC-SHA1 continua seguro aqui porque a segurança do HMAC
  depende de pré-imagem, não de colisão; ver BACKLOG).
- **Códigos de recuperação como "look-up secrets" (NIST SP 800-63B-4
  §3.1.2)**: ≥6 dígitos de gerador aleatório aprovado, uso único, hash com
  salt (obrigatório abaixo de 112 bits de entropia — 8 dígitos têm ~27
  bits), rate limiting. Padrão de mercado: Google 10 códigos de 8 dígitos,
  GitHub 16; gerar um lote novo invalida o anterior (o conserto quando a
  lista pode ter vazado). Nunca guardar em claro nem "só p/ mostrar de
  novo". Impacto 5, Esforço 1.
  ✅ IMPLEMENTADO em 17/11/2026 (10 códigos de 8 dígitos, hash scrypt com
  salt por código, uso único, regeneração invalida o lote; ver BACKLOG).
- **Anti-replay do TOTP + lockout do 2º fator**: cada passo de 30 s vale
  uma única vez (o código do confirm não vale p/ o login seguinte — o
  usuário usa o próximo código); 5 códigos errados travam o 2FA por 15 min
  (mesmo padrão do lockout de senha). Desafio de login opaco de uso único
  (5 min, só o hash SHA-256 guardado, como o refresh token); código errado
  não queima o desafio. Impacto 4, Esforço 1.
  ✅ IMPLEMENTADO em 17/11/2026 (lastUsedStep + lockout 5/15 min +
  challenge opaco; ver BACKLOG).
- **otpauth:// URI é o contrato com o app autenticador**: tipo `totp`,
  `secret` Base32, `issuer`, `algorithm=SHA1`, `digits=6`, `period=30` —
  o QR é só essa URL renderizada. O segredo nunca confirmado nunca
  autentica; re-cadastro mantém o segredo antigo até confirmar o novo
  (nunca deixar a conta sem 2FA no meio da troca). Impacto 3, Esforço 1.
  ✅ IMPLEMENTADO em 17/11/2026 (beginSetup/confirmSetup com segredo
  pendente separado do ativo; ver BACKLOG).
- **Passkeys (FIDO2/WebAuthn) são o substituto superior do TOTP**: à prova
  de phishing (amarradas ao domínio), mas o TOTP continua o mais suportado
  (Google/Microsoft Authenticator, Authy). Usar passkey onde houver, TOTP
  onde não houver. Impacto 4, Esforço 4 — fase 2 (WebAuthn p/ staff, após
  o TOTP; tutores continuam por SMS).

## Semeado em 17/11/2026 — preço publicado + página de planos (frente d, ciclo 19)
Fontes: staging.pickuproster.com "Best School Dismissal Software (2026)"
(atual. out/2026); frontiertemplates.com "SaaS pricing page anatomy"
(05/10/2026); bayleafdigital.com "Build a SaaS Pricing Page That Converts
in 2026"; mykidreports.com (2026); canelmas.com "SaaS Pricing Page Best
Practices" (atual. 26/05/2026).

- **Preço publicado por aluno/mês (página `/planos` + calculadora)**:
  o comparativo 2026 lista "published price" como critério de escolha e
  pergunta "per campus, per student, or by quote? Is there a free trial,
  and does it need a credit card?". Quem publica vira referência; quem
  esconde atrás de "quote" (PikMyKid/CENTEGIX a partir de US$ 3.750/ano,
  Ruvna, PickUp Patrol) perde a comparação. Transparência é decisiva p/
  86% dos compradores B2B (LinkedIn) e 60% dos visitantes checam o preço
  antes de pedir demo; esconder o preço atrás de cadastro aumenta o bounce
  em 30–40%. A página boa responde, em ordem: qual plano é p/ mim, quanto
  vou pagar de fato, e o que acontece se eu errar — com cartões de plano,
  calculadora quando o preço depende de volume, FAQ de objeções, rota p/
  compradores grandes e confiança junto aos botões (cartão exigido? como
  cancela?). Impacto 4, Esforço 1.
  ✅ IMPLEMENTADO em 17/11/2026 (página `/planos` no web: 3 cartões
  Grátis/Teste/PRO, calculadora interativa nº de alunos → mensalidade,
  FAQ só com regras do PlanService, link no topbar e na home;
  `docs/product/PRECOS.md` com a política e as pendências; ver BACKLOG).
- **Calculadora com a conta à mostra**: o preço por aluno só se entende
  com o número da escola — a calculadora mostra a fórmula (n × R$ 2,90)
  e o anual como mensal × 12, sem desconto inventado. "Uma calculadora que
  lisonjeia é pior que nenhuma" (Frontier, 2026): nunca pré-preencher o
  melhor caso. Impacto 3, Esforço 1 — embutido na página `/planos`.
- **Piso p/ escolas pequenas continua em aberto**: Carline.app cobra
  US$ 0,15/aluno/mês com **mínimo de 50 alunos**; Dismissal Magic e
  "pickup." vendem por escola/ano (US$ 149–249 e US$ 200). Nosso PRO puro
  por aluno rende R$ 116/mês numa escola de 40 alunos — avaliar um piso
  mensal quando o billing (Stripe) entrar. Impacto 3, Esforço 1 — fase 2
  (billing; registrado em `docs/product/PRECOS.md`).
- **"Grátis até N" como aquisição**: MyKidReports — "No quote call. The
  price is on the page", grátis até 5 crianças, US$ 0,99/criança/mês;
  Elimikasasa — grátis p/ sempre até 100 alunos. Nosso Grátis permanente
  (30 alunos) já segue esse padrão; o diferencial é o teste de 30 dias com
  tudo do PRO sem cartão. Impacto — (reforço da tese, sem ação de código).
- **Plano "sob consulta" só acima do teto**: a página mantém uma rota p/
  compradores grandes (acima de 2.000 alunos, preço por escola) sem
  esconder o preço dos demais — o padrão dos guias 2026 (sempre incluir um
  tier sem preço, mas nunca fazer dele o único caminho). Impacto — (aplicado
  na página `/planos`, sem ação de código extra).

## Semeado em 17/11/2026 — relatório de conformidade LGPD da escola (frente e, ciclo 20)
Fontes: lgpdcloud.com.br "Evidências LGPD: como organizar a conformidade"
(2026); sistematoth.com.br "Checklist LGPD para Escolas — 30 Itens
Essenciais" (2026); educacaoeprofissao.com.br "LGPD na escola" (atual.
23/10/2026); cassiusmarques.adv.br "Proteção de Dados na Educação"
(2026); getprivacy.com.br "Relatório de Impacto" (2026);
sinceracompliance.com.br "RIPD" (atual. 2026, com a FAQ da ANPD de
set/2026).

- **RoPA é a primeira evidência — e a base de todas as outras** (lgpdcloud,
  2026): o Registro das Operações de Tratamento (art. 37) lista, por
  atividade, finalidade, categorias de titulares e dados, dados sensíveis,
  base legal + justificativa, sistemas/fornecedores/destinatários,
  localização e transferências, prazos de retenção/descarte, responsáveis
  e data da última revisão. A base legal não pode aparecer só como coluna
  sem explicação — a escola precisa demonstrar por que escolheu aquela
  hipótese p/ aquela operação, o que pesa mais quando há dado sensível,
  criança ou combinação de finalidades. Impacto 4, Esforço 2.
  ✅ IMPLEMENTADO em 17/11/2026 (ComplianceReportService — RoPA com 8
  atividades do TutorPass, cada uma com base legal, retenção,
  suboperadores e transferência internacional; ver BACKLOG).
- **RIPD: recomendado p/ dados de crianças em larga escala, exigível a
  qualquer momento pela ANPD** (cassiusmarques/getprivacy/sincera, 2026):
  a LGPD não manda toda empresa ter um RIPD pronto, mas dá à ANPD o poder
  de pedi-lo — e, a partir do pedido, a elaboração passa a ser obrigatória
  (arts. 5º XVII, 10 §3º, 32 e 38). A ANPD recomenda elaborá-lo sempre
  que o tratamento puder gerar alto risco, de preferência antes de começar;
  o critério de alto risco (Res. CD/ANPD nº 2/2022, art. 4º) é larga
  escala + dado sensível/criança — o caso de toda escola. O relatório de
  conformidade é o inventário-base; a avaliação de risco é da escola e do
  DPO. Impacto 4, Esforço 1 — checklist do relatório marca o RIPD como
  PENDENTE permanente até a escola elaborá-lo.
- **O relatório não pode conter dado pessoal** (lgpdcloud/sistematoth,
  2026): evidência de qualidade mostra o que foi analisado, quem decidiu
  e quando — sem virar um segundo vazamento. Nosso relatório traz só
  contagens, categorias e referências opacas; o registro do incidente
  guarda só categorias de dados, nunca o conteúdo. Impacto 4, Esforço 1
  — aplicado no `toMarkdown` (teste: nenhum subjectId no documento).
- **Contratos, fornecedores e treinamentos são evidência** (lgpdcloud,
  2026): due diligence, cláusulas e versões de contratos de suboperadores.
  O push via Expo (infra fora do BR) é a nossa transferência internacional
  — mapeada no RoPA com a hipótese do art. 33 (consentimento específico
  PUSH_NOTIFICATIONS). Impacto 3, Esforço 1 — aplicado no RoPA.
- **Checklist de 30 itens p/ escolas** (sistematoth, 2026): mapear todos
  os dados de alunos, definir retenção/descarte, nomear o DPO, verificar
  contratos e permissões dos fornecedores. Nosso checklist cobre os itens
  que o sistema consegue medir (DPO, aviso, expurgo, incidentes,
  auditoria, transferência, RIPD); o resto é processo da escola, não do
  software. Impacto — (validação do escopo, sem ação de código).

## Semeado em 17/11/2026 — tecnologia: Redis p/ multi-instância (frente f, ciclo 21)
Fontes: socket.io/docs/v4 "Redis Streams adapter" (2026); dev.to
"Scaling Socket.io Rooms in NestJS With the Redis Adapter" (atual.
nov/2026); matthewswong.com "Scaling WebSockets with Redis Pub/Sub"
(2025); shehzaib.online "Why Real-Time Apps Break on a Second Server"
(2026); oneuptime.com "How to Implement WebSocket Connections in
Node.js with Socket.io and Scaling" (2026); codewithgagan.com "Using
the Redis Adapter to Scale Socket.IO" (2026); varcore.dev "Redis From
Zero, Part 8: Pub/Sub and Streams" (2026).

- **O adapter move o broadcast, não o estado da aplicação** (dev.to /
  matthewswong, 2025–2026): com 2 instâncias, a room vive só na memória
  de cada uma — o broadcast da instância A não chega a quem está na B.
  O adapter Redis resolve o broadcast, mas nonce de QR, estado de
  geofence e log de eventos continuam por instância se ficarem em
  memória. Impacto 5, Esforço 3.
  ✅ IMPLEMENTADO em 17/11/2026 (RedisService + EphemeralStore —
  nonce QR via `SET NX` TTL 90 s, geofence em `geo:*` TTL 10 min, e
  RedisIoAdapter no `main.ts`; ver BACKLOG).
- **Dois clientes Redis são obrigatórios p/ o adapter** (todas as
  fontes): uma conexão em modo subscribe não aceita comando nenhum —
  `pubClient` + `subClient = pubClient.duplicate()`, conectados antes
  do app escutar. Impacto — (aplicado no RedisIoAdapter).
- **Sticky sessions continuam obrigatórias** (docs NestJS, via dev.to /
  codewithgagan, 2026): o adapter não resolve o handshake — sem
  afinidade no balanceador (ou transporte só-websocket no cliente), o
  polling do mesmo cliente cai em instâncias diferentes e dá HTTP 400.
  Impacto 4, Esforço 1 — documentado no README do módulo e no
  `main.ts`; a verificar no deploy multi-instância (Render/Railway
  hoje é 1 instância, então não bloqueia).
- **Adapter clássico não suporta connection state recovery; o de
  Streams, sim** (socket.io docs, 2026): o adapter Pub/Sub perde
  pacote quando o Redis cai (at-most-once, sem histórico); o adapter
  de Redis Streams (`@socket.io/redis-streams-adapter`) retoma o
  stream sem perder pacote, guarda as sessões de recovery no Redis e
  é o caminho p/ ligar o catch-up do EventLogService ao recovery
  nativo. Impacto 4, Esforço 3 — FASE 2 (próximo item do Step 2:
  trocar o EventLog em memória por Redis Streams + recovery).
  ✅ IMPLEMENTADO em 17/11/2026 (ciclo 27: adapter trocado + EventLog em Streams + CSR ligado).
- **Pub/Sub é at-most-once; Streams é log com replay**
  (varcore/primelearnpoint, 2026): o que não pode se perder (auditoria,
  evento de fila) não vai p/ Pub/Sub — vai p/ Stream ou p/ banco.
  Nosso catch-up por seq continua necessário enquanto o EventLog for
  em memória. Impacto — (validação da arquitetura atual, sem ação de
  código neste ciclo).
  Atualização 17/11/2026 (ciclo 27): o EventLog agora é em Streams — o
  catch-up continua necessário como fallback do recovery (janela > 2 min
  ou sessão expirada), não mais como único caminho de volta.
- **Redis é infra interna confiável, não exposta** (socket.io docs,
  2026): o tráfego do adapter não é assinado nem cifrado — nada de
  segredo ou dado sensível no payload dos eventos. Nossos eventos já
  carregam só ids opacos e payload mínimo. Impacto — (validação, sem
  ação de código).
- **Degradação graciosa quando o Redis cai** (shehzaib/oneuptime,
  2026): broadcast entre instâncias para, mas o resto (banco, resto
  da API) continua. Aplicado: RedisService com fail-fast (sem retry
  infinito) + ResilientEphemeralStore (fallback p/ memória) e o
  `main.ts` que nem registra o adapter se o Redis não conectar.
  Impacto 4, Esforço 2 — aplicado.

## Semeado em 17/11/2026 — tecnologia: Redis Streams + connection state recovery (frente f, ciclo 27)
Fontes: socket.io/docs/v4 "Connection state recovery" (2026); deepwiki
socket.io-redis-streams-adapter "Connection State Recovery", "Troubleshooting"
e "API Reference" (2026); nirajiitr.com "How to Secure and Scale Real-Time
Presence with Socket.io, Redis Streams, and JWT Auth" (2026).

- **Connection state recovery é opt-in e nem sempre funciona** (socket.io
  docs, 2026): o servidor precisa habilitar explicitamente
  (`connectionStateRecovery: { maxDisconnectionDuration }`); ao desconectar
  sem `socket.disconnect()`, guarda id, rooms e `data` do socket; na volta,
  `socket.recovered` diz se deu certo. A janela deve ser sensata (o default
  é 2 min — nada de `Infinity`): passou dela, a sessão expirou e o cliente
  precisa sincronizar por outro caminho. No nosso caso, esse caminho é o
  catch-up manual (`events.catch_up` + snapshot) — o recovery NÃO o
  substitui, só cobre a queda curta. Impacto 4, Esforço 3.
  ✅ IMPLEMENTADO em 17/11/2026 (ciclo 27: adapter de Streams com
  `maxDisconnectionDuration: 2 min` + `skipMiddlewares: false` — o JWT é
  revalidado no recovery; catch-up manual mantido como fallback).
- **O adapter de Streams guarda sessão + pacotes no Redis**
  (deepwiki, 2026): sessões em `sio:session:{pid}` (MessagePack, TTL =
  `maxDisconnectionDuration`) e pacotes no Stream; o restore valida o
  offset (`{timestamp}-{seq}`), dá `GETDEL` na sessão e faz replay por
  `XRANGE` (limite de 100 chamadas p/ não entrar em loop). O offset vai
  anexado a cada pacote — o cliente precisa ter recebido ao menos 1 evento
  p/ inicializar o offset. Impacto — (detalhe de implementação aplicado).
- **O `maxLen` do stream do adapter precisa cobrir a janela da sessão**
  (deepwiki/Troubleshooting, 2026): se o stream trima o offset antes da
  sessão expirar, o restore falha com "session or offset not found" — o
  default do adapter cobre os 2 min, mas quem afinar o `maxLen` precisa
  lembrar disso. Redis < 6.2 não suporta range exclusivo; ioredis >= 5.3.2
  é suportado (problemas de `GETDEL`/`SET` com ioredis corrigidos na 0.2.1;
  usamos a 0.3.1). Impacto — (regra p/ o deploy, sem código).
- **Cliente 4.6+ recupera sozinho; servidor antigo, não** (socket.io docs,
  2026): o recovery exige socket.io >= 4.6 nos dois lados. Nosso web usa
  socket.io-client 4.7.5 e o servidor 4.8.4 — ok, sem mudança no cliente.
  Impacto — (checagem de compatibilidade, sem código).
- **O log de eventos em Streams fecha o ciclo do adapter** (nirajiitr,
  2026): o adapter move o broadcast com replay, mas o histórico da
  aplicação (o que a portaria perdeu) continua sendo problema nosso — por
  isso o EventLog trocou o ring buffer em memória por Stream por room
  (`XADD` com `MAXLEN ~ 500`, seq por contador via Lua INCR+XADD).
  Impacto 4, Esforço 3.
  ✅ IMPLEMENTADO em 17/11/2026 (ciclo 27: `RedisStreamsEventLogStore` +
  `EventLogService` com degradação p/ memória; ver BACKLOG).

## Semeado em 17/11/2026 — concorrentes internacionais (frente a, ciclo 22)
Fontes: staging.pickuproster.com "PikMyKid Alternatives (2026)" (atual.
out/2026); pikmykid.com "School Dismissal Software in 2026" (15/01/2026);
educationtechnologyinsights.com "Pikmykid — Platform of the Year 2026";
eatsip365.com "Top-Rated Car Line Dismissal App Options for 2026";
carta de escola usuária PikMyKid 2026-2027 (4.files.edl.io).

- **CENTEGIX comprou a PikMyKid (07/04/2026) e a absorveu como
  "CENTEGIX Dismissal" (07/10/2026)**: a saída virou parte de uma
  plataforma de segurança (visitantes, hall passes, mensagens, alertas
  vestíveis p/ staff, reunificação). O movimento do mercado é saída
  dentro de segurança, não saída sozinha — mas a tese TutorPass se
  mantém: ser o melhor SÓ em saída, não virar suite. Quem quiser
  segurança ampla compra CENTEGIX; quem quer a melhor saída compra
  a gente. Impacto — (validação da tese, sem ação de código).
- **Pulse AI (PikMyKid, 2026)**: analytics que organiza os dados da
  saída e agora estende insights p/ os pais (planejar melhor o horário
  de chegada). Nosso DismissalReportService já calcula o lado da escola;
  falta o lado do pai: "seu filho espera em média X min; chegue às Y".
  Impacto 3, Esforço 3 — fase 2 (depois do web da portaria; usa os
  mesmos números, sem coleta nova).
- **Drills/simulados com templates (PickupRoster, 2026)**: 12 templates
  prontos, roll ao vivo, relatório pós-ação e replay do drill (plano
  Campus). Refina a ideia já anotada de reunificação + simulação
  (Impacto 4, Esforço 4): o formato vendável é template + replay, não
  só "modo emergência". Fase 2.
- **Botão de pânico físico planejado (PikMyKid, 2026)**: além do botão
  silencioso no app, um botão físico p/ quando o celular não está ao
  alcance. Reforça a ideia já anotada (Impacto 3, Esforço 2) — no nosso
  caso, fase 2 e via hardware parceiro, nunca prioridade sobre a fila.
- **Tag/cartão impresso p/ delegado sem smartphone (carta PikMyKid
  2026-2027)**: a escola entrega car tags p/ exibir no para-brisa; o
  delegado sem app é anunciado pela tag. Realidade BR igual (avós sem
  smartphone): nossa autorização temporária já cobre o delegado, mas
  exige o app p/ a selfie — um código impresso de uso único, validado
  na portaria, fecha o caso sem smartphone. Impacto 3, Esforço 2 —
  PROMOVIDO ao BACKLOG (próxima candidata após login por SMS / Streams).
- **Relatório diário da saída por e-mail (PikMyKid Free Car Line)**:
  resumo do dia enviado à escola — o plano gratuito vende com isso.
  Nosso relatório já existe (DismissalReportService); falta o envio
  diário (job + e-mail transacional). Impacto 3, Esforço 2 — fase 2
  (precisa de provedor de e-mail no Step 2).
- **Cutoff real de mudança de plano (carta PikMyKid 2026-2027)**:
  pais mudam o plano até 14h (dia cheio) ou 11h (saída antecipada).
  Valida nosso cutoff 13:30 configurável por escola — mesma ordem de
  grandeza, e o nosso é por escola, não fixo. Impacto — (validação,
  sem ação de código).
- **Preços publicados dos concorrentes (PickupRoster, out/2026)**:
  Car Line US$ 150/mês ou US$ 1.440/ano; Campus US$ 500/mês;
  QManager a partir de US$ 995 no 1º ano; Schoolhouse Driveline
  US$ 748 no 1º ano e US$ 935/ano depois; Carline Hound US$ 33/mês
  ou US$ 299/ano. PikMyKid por cotação (GetApp: a partir de
  US$ 3.750/ano). Nosso PRO (R$ 2,90/aluno/mês) segue ordens de
  magnitude abaixo de todos — o argumento de preço continua forte,
  e o piso p/ escolas pequenas (anotado na frente d) segue pendente.
  Impacto — (validação do preço, sem ação de código).
- **Trial sem cartão é o padrão do mercado (PickupRoster, out/2026)**:
  30 dias (PickupRoster, PikMyKid Free, QManager, Carline Hound) ou
  60 dias (Schoolhouse Driveline, PickUp Patrol) — todos sem cartão.
  Nosso TRIAL de 30 dias sem cartão já está no padrão. Impacto —
  (validação, sem ação de código).

## Semeado em 17/11/2026 — concorrentes Brasil (frente b, ciclo 23)
Fontes: ajuda.classapp.com.br "Cheguei: Funcionários" (ClassApp, 2026);
dotnet.microsoft.com "Escola Ágil tira proveito do .NET MAUI" (2026);
tech.escolaeleva.com.br "School Guardian" (2026); play.google.com
"School Guardian" (atual. 21/09/2026); inoutchi.com "Sistema de controle
de entrada e saída de alunos" (atual. 04/11/2026); 18happ.com.br (2026);
instagram.com/gohome_brasil (14/11/2026); play.google.com "ClipEscola"
(atual. 07/10/2025).

- **Cheguei (ClassApp, 2026) — filtro por portaria**: com mais de um
  portão, o funcionário filtra os chamados da SUA portaria; cada
  responsável só chama o aluno vinculado a ele; a aba "Entregues" mostra
  os entregues por 2 h e depois só no histórico do admin. Nossa fila é
  por escola, sem portão — o filtro por portão é o próximo refinamento
  da portaria (campo `gate` na entrada + filtro na lista). Impacto 3,
  Esforço 2 — PROMOVIDO ao BACKLOG (múltiplos portões).
- **Inoutchi (novo, out/2026) — código de 6 dígitos como alternativa ao
  QR**: o delegado sem smartphone mostra QR **ou um código de 6
  dígitos** digitado na portaria; recusa invalida o token e avisa o
  responsável; implantação em até 72 h, sem hardware obrigatório.
  O código de 6 dígitos é mais simples de imprimir e digitar que um QR
  — refina o item de tag/cartão impresso do BACKLOG (a tag passa a
  carregar código + QR). Impacto 3, Esforço 2 — anotado no item da tag.
- **Inoutchi — implantação em 72 h**: o concorrente novo promete operar
  em 72 h após a assinatura. Nosso "implantação em 1 dia" continua sendo
  o diferencial — mas precisa ser verdade no piloto, não só no discurso
  (CSV + seed + web mínimo já existem; falta o runbook de 1 dia).
  Impacto — (validação da tese, sem ação de código neste ciclo).
- **School Guardian — "Estou indo" + a pé ou de carro**: o responsável
  avisa que está a caminho e informa o meio (a pé/carro); QR pessoal e
  intransferível; autorizações permanentes e temporárias com prazo;
  saída antecipada só pelo app, em horários fixos (15h/16h/17h);
  white-label por escola (Eleva, St. Paul's). Nosso plano de saída +
  autorização temporária + saída antecipada já cobrem o mesmo — e com
  cutoff por escola, não fixo. Impacto — (validação, sem ação de código).
- **School Guardian — crítica à localização sempre ligada** (avaliação
  na Play Store, 2026): "exige acesso à localização o tempo todo... não
  faz sentido" — usuário vê o rastreio contínuo como perigoso. Nosso
  diferencial de privacidade: geofence só na janela da saída, guarda só
  a zona derivada (nunca lat/lng, RoPA 0 dias) e o botão "Estou aqui"
  dispensa o GPS. Vale virar argumento de venda na página. Impacto 3,
  Esforço 1 — fase 2 (texto da página /planos + README de privacidade).
- **18H (2026) — botão só libera perto da escola**: "Ninguém avisa de
  casa" — o botão de chegada só funciona dentro do raio definido pela
  escola; fila com foto, turma e ordem de chegada; FIFO ("quem chegou
  primeiro, sai primeiro"); uma tela e um botão p/ o responsável. Nosso
  geofence já impõe o raio (2 pings + histerese) e a fila já é FIFO —
  falta só a UX do botão desabilitado fora do raio com a explicação.
  Impacto 2, Esforço 1 — fase 2 (web/mobile do tutor).
- **GoHome (2026) — "é só chegar que ele é avisado"**: chegada automática
  sem apertar nada — o app detecta e avisa. Nosso geofence + ETA já fazem
  o mesmo caminho; a diferença é o marketing da automação total.
  Impacto — (validação, sem ação de código).
- **ClipEscola (2025) — suite ampla**: agenda, aulas ao vivo, chat e
  controle de entrada/saída no mesmo app. Confirma a tese por contraste:
  quem é suite não é o melhor em saída — o TutorPass não vira suite.
  Impacto — (validação da tese, sem ação de código).
- **Escola Ágil — reconhecimento facial p/ entrada/saída** (.NET MAUI,
  2026): 3.000 alunos/dia em 10 escolas, detecção de desconhecido em
  tempo real. Facial é o caminho dos concorrentes BR p/ "sem celular" —
  mas é dado biométrico sensível (art. 11 LGPD) e exige hardware; nossa
  resposta é a tag impressa com código (sem biometria, sem hardware).
  Impacto — (validação da escolha da tag, sem ação de código).

## Semeado em 17/11/2026 — UX/design de painéis e apps de fila (frente c, ciclo 24)
Fontes: khantkyawhtet.space "NIS Dismissal Management System" (Network
International School, Dubai, 2024 — 784 alunos, 500+ pais, 40 staff, 3 zonas
físicas simultâneas); facebook.com RapidDismiss (demo, 01/09/2026);
technothera.com "Smart Dismissal System" (2026); nyos.org "School Dismissal
Manager — SDM" (NYOS Charter School); trellisgo.com "Dismissal" (2026);
qa.authexit.org (atual. 09/09/2026); afaqtech.com.sa "Smart Student Dismissal
Platform" (2026).

- **NIS Dismissal (Dubai, 2024) — 3 zonas físicas, 4 usuários, 1 fluxo**:
  portão (traffic manager escaneia QR/placa e registra carros), pátio
  (loader alinha alunos por prioridade), telão no pátio (fila numerada,
  tipo grande, alto contraste, legível a 20+ m) e web dashboard. Os estados
  Queuing → Ready to Dismiss → Dismissed não são rótulos de UI — são
  sinais de coordenação: um toque atualiza 4 interfaces ao mesmo tempo.
  Nosso fluxo QUEUED → CALLED → VALIDATED → RELEASED já é esse sinal; o
  que falta é o telão por portão (nosso DisplayBoard ainda não separa por
  portão) e o papel do "traffic manager" (nosso GATE_AGENT). Impacto 3,
  Esforço 2 — fase 2 (telão por portão + papel GATE_AGENT no display).
- **RapidDismiss (2026) — estação de saída por área**: a "Dismissal
  Station" escolhe a área ('Car Loop' vs 'Gate') e digita o nº da tag no
  teclado; a sala recebe "Ariana Gomez — Spot 5 — Tag 196 — Car Loop"; a
  visão "All School" mostra a atividade de todas as áreas com o local de
  espera (Back Loop, Gate, Car Loop). É exatamente o nosso `gate` — a
  implementação deste ciclo (campo + filtro + contagem) é a base; falta a
  UX da estação: selecionar o portão ANTES de chamar, não depois.
  Impacto 3, Esforço 1 — fase 2 (web da portaria: seletor de portão fixo
  por estação).
- **AuthExit (2026) — "Pickup Lanes & Location"**: mais de um ponto de
  retirada sem dividir a fila à mão; "nomeie cada faixa como o seu
  estacionamento funciona"; irmãos divididos entre faixas são sinalizados
  no painel; cartões de QR gerados em lote p/ a escola inteira. Dois
  refinamentos p/ o BACKLOG: (1) o nome do portão é livre, como a escola
  chama — já é assim no nosso `gate`; (2) **irmãos em portões diferentes
  sinalizados no painel** — o tutor que busca 2 filhos em portões
  distintos precisa ver o alerta, senão um filho espera no portão errado.
  Impacto 3, Esforço 2 — PROMOVIDO ao BACKLOG (sinalizar irmãos em
  portões diferentes).
- **SDM / NYOS (2026) — QR por método de retirada**: cada método tem seu
  próprio QR — FastLane, Driveline (QR em postes ao longo da rota),
  Back Walk-Up (QR no portão dos fundos, saída só pelas portas dos fundos)
  e Side Walk-Up (QR no portão da frente). O QR já diz DE QUAL portão o
  tutor veio — o nosso `QR_GATE` ainda não carrega o portão no token. Se
  o token levasse o `gate`, o join por QR já entraria na fila certa sem o
  tutor escolher nada. Impacto 3, Esforço 2 — fase 2 (QR do portão com
  `gate` no payload do token).
- **Trellisgo (2026) — dashboard por faixa**: "Lane 1 — Zone A" até
  "Lane 4 — Zone D", cada faixa com staff e scanner próprios, contagens ao
  vivo (147 na fila, 32 liberados, ~8 min restantes) e ETA por família.
  Nosso `GET gates` devolve a contagem por portão — é a matéria-prima
  desse dashboard; falta a contagem de liberados + tempo restante por
  portão (o DismissalReportService já calcula p/ a escola inteira).
  Impacto 2, Esforço 2 — fase 2 (relatório por portão).
- **Technothera / Afaq (2026) — o distintivo "ARRIVED" pulsa**: quando o
  responsável chega, o selo pisca com urgência em TODAS as telas; a tela
  da sala mostra nome + foto + status e a professora toca "Release". Nosso
  ETA já tem as faixas de urgência (HERE/NOW/SOON) — falta o pulso visual
  no telão/painel quando o tutor entra na zona de chegada. Impacto 2,
  Esforço 1 — fase 2 (web: badge ARRIVED pulsante no painel/telão).

## Semeado em 17/11/2026 — modelo de negócio/preço/onboarding (frente d, ciclo 25)
Fontes: dismisspro.app/help.html (Getting started, 2026); yes-sys.com/docs
/getting-started ("Open your school in 24 hours", YESS handbook, 2026);
beanstack.com/faq-resources/ease-of-implementation (2026); help.schoolday.com
(Onboarding Wizard); instagram.com/p/DfX9BQrGCGU e facebook.com/attendzy
("Guided setup that gets out of the way", 05/11/2026); instagram.com/reel
/Deswo4Thhax (Foundation Roster, 20/10/2026).

- **DismissPro (2026) — começar em 4 passos, sem instalar nada**: cadastro
  em ~1 min, subir a planilha de alunos (template CSV p/ baixar), compartilhar
  o School ID + senha do staff e abrir no navegador (nada p/ instalar); demo
  pública que zera toda manhã p/ experimentar sem medo. A lição é a ordem:
  conta → roster → convite → primeira saída — e a demo descartável tira o
  medo de "estragar" o sistema. Nosso CSV + seed já existem; falta o
  checklist que guia a escola nessa ordem e a demo que zera sozinha.
  Impacto 4, Esforço 2 — PROMOVIDO ao BACKLOG (checklist de implantação em
  1 dia + escola demo que zera).
- **YESS (2026) — "Abra sua escola em 24 horas", em 5 passos testados com
  escolas reais**: cadastro em 3 min (o tenant já nasce com tudo ligado —
  papéis, ano letivo, trial de 30 dias), primeiro staff com credencial
  impressa p/ entregar em mãos, alunos pelo formulário ou por admissão (com
  busca de irmãos no caminho) e o painel já mostra os módulos ligados antes
  de ter dado nenhum — "os próximos passos só despejam os dados". E a nota
  de honestidade: o importador em massa "ainda não foi construído" — eles
  admitem o que falta em vez de prometer. Nosso CSV já é o importador que
  eles não têm; o que falta é o runbook de 1 dia com os passos e o tempo
  de cada um. Impacto 4, Esforço 1 — parte do item promovido (runbook de
  implantação em 1 dia, docs).
- **Beanstack (2026) — implantação guiada, não faça-você-mesmo**: a equipe
  de implantação importa o roster (Clever/ClassLink/Google ou CSV), um
  gerente de sucesso acompanha do dia 1 e as mudanças de roster
  sincronizam sozinhas em 24–48 h. O contraste valida o nosso caminho:
  escola pequena não tem TI p/ integração com SIS — o CSV bem feito + o
  re-import que atualiza (nosso RosterService) É a integração dela.
  Impacto — (validação da tese, sem ação de código).
- **Attendzy (05/11/2026) — "guided setup that gets out of the way"**:
  checklist de 4 itens com check verde — nomear a turma, importar o roster,
  escolher o check-in, convidar os alunos — e nada mais na tela. A
  simplicidade é o produto: o setup não é uma tela de configurações, é uma
  lista que some quando acaba. É o formato do nosso checklist de 1 dia.
  Impacto — (formato do item promovido).
- **Foundation Roster (20/10/2026) — "a pior parte do software novo são
  os primeiros 5 minutos"**: tela em branco no primeiro login é o que mata
  a adoção; a resposta é um checklist "Getting Started" sempre visível e
  a oferta "nós movemos por você, grátis" (a equipe importa alunos, leads
  e histórico). P/ o TutorPass: a escola demo com dados (seed) é o
  antídoto da tela em branco — e o piloto pode oferecer a importação do
  CSV feita por nós como serviço de implantação. Impacto 3, Esforço 1 —
  fase 2 (seed como demo permanente + oferta de importação assistida no
  piloto).
- **SchoolDay (2026) — Onboarding Wizard**: checklist que guia importação
  de dados, segurança e IdP na primeira entrada — o padrão de "wizard" é
  consenso no SaaS escolar; ninguém deixa a escola descobrir sozinha o que
  falta. Impacto — (validação do item promovido).

## Semeado em 17/11/2026 — direitos do titular (art. 18/19 LGPD) (frente e, ciclo 26)
Fontes: nedueducacao.com.br "Política de Privacidade" (atual. 30/10/2026);
realeza.pr.gov.br "Privacidade e Proteção de Dados" (2026); secti.es.gov.br
"Direitos do titular" (2026); viadireito.com.br "Direitos garantidos pela
LGPD" (atual. 15/11/2026); infotela.com "LGPD no dia a dia" (11/11/2026);
LGPD arts. 18, 19 e 16.

- **Pedido de acesso é também vetor de ataque — verificar a identidade
  antes de entregar**: as fontes 2026 repetem o mesmo ponto — antes de
  atender o pedido, a empresa pode (e deve) confirmar a identidade do
  requerente, p/ evitar que outra pessoa acesse os dados. Um pedido de
  acesso atendido sem verificação vira vazamento com protocolo. No
  TutorPass, o pedido de um tutor/aluno só pode ser aberto por quem está
  autenticado como aquele titular (ou pelo responsável legal do menor) —
  e o atendimento fica registrado em auditoria. Impacto 4, Esforço 1 —
  detalhe p/ a ideia "exercício de direitos do titular" abaixo.
- **Dois prazos, não um (art. 19)**: confirmação da existência do
  tratamento + acesso em formato simplificado são IMEDIATOS; a declaração
  completa (origem dos dados, critérios, finalidade) tem até 15 dias. O
  pedido é gratuito (art. 18, §5º). O painel do admin precisa distinguir
  os dois — um pedido "completo" que some na fila estoura o prazo sem
  ninguém ver. Impacto 4, Esforço 1 — parte da ideia abaixo.
- **Eliminação nem sempre é possível (art. 16)**: dado guardado por
  obrigação legal não se apaga — e o nosso PickupLog/auditoria com hash
  encadeado é exatamente esse caso: apagar um evento quebra a cadeia e
  apaga a prova da saída. O atendimento do pedido precisa dizer O QUE foi
  apagado e O QUE foi mantido por obrigação legal, com o fundamento — não
  um "não" seco. Impacto 4, Esforço 1 — parte da ideia abaixo.
- **Escola é controladora, TutorPass é operadora (art. 5º, VI e VII)**:
  o padrão das plataformas escolares (NedEducação, 30/10/2026) é o
  titular exercer o direito direto com a escola OU com a plataforma, que
  encaminha à escola. O pedido nasce no painel do admin da escola, o DPO
  decide, o sistema executa e registra — o TutorPass nunca decide sozinho
  sobre dado de aluno. Impacto 3, Esforço 1 — parte da ideia abaixo.
- **Exercício de direitos do titular (art. 18) pelo painel do admin**:
  abrir o pedido (acesso, correção, anonimização/bloqueio/eliminação,
  portabilidade), com prazo de 15 dias p/ a declaração completa, verificação
  de identidade do requerente, registro em auditoria e as exceções do
  art. 16 (logs de auditoria nunca apagados) explícitas na resposta.
  Impacto 4, Esforço 3 — PROMOVIDO ao BACKLOG (próxima candidata após
  login por SMS / tag impressa / Streams).
  ✅ IMPLEMENTADO em 17/11/2026 (ciclo 29: DataSubjectRequestService +
  controller REST /api/data-subject-requests/schools/:schoolId/* — 8 tipos
  de pedido, dois prazos do art. 19 (acesso simplificado imediato +
  declaração completa em 15 dias corridos), identidade verificada antes de
  entregar dado, ERASURE/ANONYMIZATION só PARTIAL com retenção do art. 16,
  log com hash encadeado, filas do DPO listOverdue +
  listSimplifiedAccessPending; modelos DataSubjectRequest +
  DataSubjectRequestEvent no schema; ver BACKLOG).

## Semeado em 17/11/2026 — concorrentes internacionais: car tags + LPR (frente a, ciclo 28)
Fontes: pikmykid.com "Parent App Support" (2026); placa.ai "PikMyKid
Alternatives for School Dismissal" (atual. out/2026); pickuppatrol.net
"How It Works"; manisteemariners.org "PikMyKid" (2026); wisevoter.com
"CENTEGIX Expanded Safety Platform" (07/10/2026); carta de escola usuária
PikMyKid 2026-2027 (4.files.edl.io).

- **Car tag é a resposta oficial p/ quem não tem smartphone (PikMyKid)**:
  a página de suporte responde direto "What if the person picking up does
  NOT have a smartphone? — The school will provide you with a car tag...
  The car tag will have the student's name, teacher, and school dismissal
  ID". A tag vai no para-brisa, o staff lê o QR da tag e o delegado anuncia
  a chegada sem app. Escolas chegam a exigir a tag de TODOS os motoristas
  ("IT IS THE SAFEST WAY FOR OUR DISMISSAL TO HAPPEN" — Peck Place, ago/2026).
  O PickUp Patrol gera e imprime as tags (car line tags e bus passes)
  direto na plataforma. Valida a nossa tag impressa — e o refinamento é o
  código de 6 dígitos digitável (o QR do PikMyKid exige o staff com o
  aparelho; o dígito funciona até com a tag amassada ou o QR apagado).
  Impacto 3, Esforço 2 —
  ✅ IMPLEMENTADO em 17/11/2026 (ciclo 28: PrintedTagService — código de 6
  dígitos + QR `TUTORPASS-TAG:<schoolId>:<código>`, validade 1–30 dias, uso
  único ou multiuso, código único por escola, anti-brute-force 5/15 min,
  recusa que invalida e avisa o responsável, sem sobreposição; modelos
  PrintedTag + PrintedTagStudent no schema; ver BACKLOG).
- **CENTEGIX ampliou a plataforma (07/10/2026)**: PikMyKid integrada como
  "CENTEGIX Dismissal" junto a visitantes, hall passes, alertas vestíveis
  e reunificação — 18 mi de pessoas, 18 mil locais, 50 estados. Reforça a
  tese: o mercado vai p/ suite de segurança; o TutorPass vence sendo o
  melhor SÓ em saída, não tentando copiar a suite. Impacto — (validação da
  tese, sem ação de código).
- **LPR / leitura de placa como entrada (PLACA.AI LineCam, 2026)**: câmera
  solar lê a placa na entrada da fila, casa com o roster e enfileira o
  aluno antes do carro chegar à frente — sem staff na carline. Custo:
  US$ 99/mês por câmera + US$ 949 de hardware. O PikMyKid (US$ 3.750/ano)
  é só software e "não tira o gargalo: o staff continua identificando os
  carros". Refina a ideia já anotada de ALPR (Impacto 4, Esforço 5):
  no Brasil, placa no para-brisa não existe — o equivalente é a nossa tag
  com código + QR, que já resolve sem hardware. LPR segue fase 2, só com
  parceiro de hardware e p/ escolas com fila de carro longa. Impacto —
  (fase 2, sem ação de código).
- **Código de conexão do responsável por QR (Parent Connection Code,
  PikMyKid)**: a escola entrega um QR único p/ o responsável escanear no
  app e se vincular ao aluno — sem digitar e-mail/telefone e sem a escola
  cadastrar dado errado. O nosso seed/onboarding hoje depende de cadastro
  manual; um QR de conexão impresso na matrícula corta o erro de digitação
  e o suporte de "não vejo meu filho no app". Impacto 3, Esforço 2 —
  próxima candidata (depois de login por SMS / direitos do titular).
- **Plano padrão reseta todo ano (PikMyKid, carta 2026-2027)**: o plano de
  saída volta p/ "ônibus" no início de cada ano letivo, como mecanismo de
  segurança caso os planos tenham mudado. O nosso DismissalPlanService
  resolve por dia da semana sem reset anual — um reset no início do ano
  letivo (configurável por escola) evita plano do ano passado valendo em
  janeiro. Impacto 2, Esforço 1 — detalhe p/ o DismissalPlanService, fase 2.

## Semeado em 17/11/2026 — concorrentes Brasil: Elo Saída, Inoutchi, GoHome, School Guardian (frente b, ciclo 29)
Fontes: elosaida.com.br (Instagram, 16/10/2026); inoutchi.com "Sistema de
controle de entrada e saída de alunos" (atual. 04/11/2026); gohome.app.br
(artigos 10/08/2026 e 05/10/2026); tech.escolaeleva.com.br "School Guardian";
sanfra.g12.br "Tutorial School Guardian" (jan/2026); Instagram Colégio
Arcádia / SOS Gestor Escolar (out/2026); Instagram Instituto Dom Barreto
"Saída Inteligente — Agenda Edu" (28/10/2026).

- **Elo Saída — concorrente novo (out/2026, elosaida.com.br)**: sistema
  digital de saída em 3 passos — Autorizar (a mãe escolhe quem busca, por
  quanto tempo, com foto, e gera um QR pass), Verificar (o portão confere
  rosto, documento e placa e libera a criança) e Notificar (a família recebe
  alerta instantâneo "Pedro saiu da escola" com hora, portão e pessoa — e
  pode sinalizar uma saída NÃO reconhecida). Extras: vans com QR pass,
  aluno que sai sozinho com permissão agendada, alertas de restrição e
  funcionamento offline. Piloto grátis de 30 dias, sem hardware e sem
  biometria facial obrigatória. É o concorrente mais próximo da nossa tese
  (só saída, sem hardware) — e o passo "sinalizar saída não reconhecida"
  é o refinamento que nos falta. Impacto — (inteligência competitiva).
- **Sinalizar saída não reconhecida (Elo Saída)**: depois da liberação, o
  tutor recebe a notificação com hora, portão e quem retirou — e pode
  marcar "não reconheço esta saída", o que abre um incidente de segurança
  (SecurityIncidentService) e avisa o DPO. Fecha o loop da notificação
  dual-path: hoje avisamos, mas o tutor não tem como contestar na hora.
  Impacto 4, Esforço 2 — próxima candidata (depois de login por SMS /
  código de conexão por QR).
- **Inoutchi (atual. 04/11/2026) valida a nossa tag impressa**: retirada
  por terceiros com token de uso único ou por período, lido por QR ou
  código de 6 dígitos; se a pessoa não for a esperada, a portaria recusa,
  o token deixa de valer e o responsável é avisado — exatamente o nosso
  PrintedTagService + TemporaryAuthorizationService. O roteiro de
  implantação deles é de 72 h após a assinatura; o nosso é de 1 dia
  (OnboardingService) — velocidade de implantação é o nosso argumento de
  venda contra eles. Impacto — (validação, sem ação de código).
- **GoHome é hardware-pesado — e esse é o calcanhar dele**: tags
  veiculares, cartões RFID, biometria e reconhecimento facial, com totem +
  tela smart na escola (456.122 alunos controlados, segundo o site). O
  nosso "sem hardware obrigatório" (celular do tutor + TVs que a escola já
  tem) é o contraponto direto p/ a escola pequena que não quer comprar
  equipamento — vale como frase de venda na /planos e no onboarding, não
  como código. Impacto — (posicionamento, sem ação de código).
- **School Guardian virou suíte de segurança (out/2026)**: além da saída
  (QR pessoal por tutor, autorizações permanentes/temporárias de 1 dia,
  1 semana ou 1 mês — iguais às nossas — e saída desacompanhada com prazo),
  agora vende reconhecimento facial, IA p/ detectar brigas, botão de
  pânico, GPS de ônibus e LPR. Usado por Escola Eleva, Colégio Arcádia e
  Sanfra. Reforça a tese: o mercado vai p/ suite; o TutorPass vence sendo
  o melhor SÓ em saída, não tentando copiar a suite. Impacto — (validação
  da tese, sem ação de código).
- **Agenda Edu adicionou "Saída Inteligente" (Instituto Dom Barreto,
  out/2026)**: a plataforma de agenda/comunicação que a escola já usa
  passou a registrar quem busca a criança no app. O risco não é o
  concorrente novo — é o incumbente que já está dentro da escola e
  adiciona a saída como mais um módulo raso. A defesa é profundidade:
  QR dinâmico anti-fraude, auditoria imutável e fila por proximidade, que
  o módulo de agenda não tem. Impacto — (alerta estratégico, sem ação de
  código).

## Semeado em 17/11/2026 — UX/design de painéis e apps de fila: exceção sem travar a fila + alerta de guarda (frente c, ciclo 30)
Fontes: khantkyawhtet.space "NIS Dismissal Management System" (2024, 784
alunos, 3 zonas, Dubai); technothera.com "Smart Dismissal System" (2026);
positive-proof.com "Custody Alert Systems for Schools" (2026);
sobrennan.myportfolio.com "School'sOut" (pesquisa UX, 16 semanas).

- **NIS Dismissal — "uma exceção trava a fila inteira" é o anti-padrão**:
  um veículo não cadastrado parava todas as famílias atrás dele; a
  correção foi o registro paralelo — a fila continua enquanto a exceção é
  resolvida à parte. O mesmo vale p/ a nossa contestação: sinalizar uma
  saída não reconhecida NUNCA pode travar a portaria nem reverter a
  liberação — o aluno já saiu; a contestação corre em paralelo, via
  incidente + fila do DPO. Impacto — (princípio de design aplicado na
  implementação deste ciclo).
- **Technothera Smart Dismissal — o selo ARRIVED pulsa em todas as telas**:
  4 interfaces sincronizadas (app do responsável, telão, app do staff,
  painel do admin), contagem regressiva por pedido e "um toque atualiza
  4 interfaces". O refinamento p/ nós é o mesmo padrão aplicado à
  contestação: um badge "CONTESTADA" pulsante no painel da portaria e no
  telão da sala quando uma saída é contestada — a exceção tem de ser
  visível onde o staff já está olhando. Impacto 3, Esforço 2 — fase 2 do
  item implementado neste ciclo (badge no DisplayBoardService).
- **Positive Proof — alerta de guarda/restrição no ponto de contato**:
  os tribunais NÃO avisam a escola quando a guarda muda (ordem de
  segunda não está no registro de terça); a lista de quem pode buscar
  fica desatualizada mais rápido que o papel acompanha, e a portaria
  decide no meio do caos da saída. A resposta é o alerta aplicado NA
  HORA da retirada: quando alguém com restrição (guarda, medida
  protetiva, bloqueio da secretaria) tenta retirar, o sistema sinaliza
  antes de liberar — e o registro vira defesa jurídica da escola (houve
  caso de condenação por liberar p/ pessoa não autorizada). O nosso
  bloqueio de aluno (PickupService.block) já barra a retirada, mas não
  existe o bloqueio por PESSOA: um tutor/restrito cuja guarda mudou
  continua liberado se o aluno não estiver bloqueado. Impacto 4, Esforço
  3 — próxima candidata (bloqueio por pessoa + sinal na validação do QR).
- **School'sOut (pesquisa UX) — o responsável compartilha o código com
  um familiar p/ autorizar a retirada**: valida a nossa autorização
  temporária + tag impressa — o compartilhamento do código é o fluxo
  real das famílias, não um atalho. Impacto — (validação, sem ação de
  código).

## Semeado em 17/11/2026 — acessibilidade e mobile do login: mostrar senha + alvos de toque (frente c, ciclo UI 2)
Fontes: copyprogramming.com "Password Eye Icon Toggle: Complete 2026 Guide"
(WCAG 2.2, 2026); blog.a11yfix.dev "Accessible Login and Password Fields"
(21/06/2026, EAA/WCAG 2.2 AA).

- **Mostrar/ocultar senha é expectativa, não luxo (WCAG 3.3.8 Accessible
  Authentication)**: esconder a senha não aumenta a segurança e derruba a
  usabilidade — até ~20% das falhas de login vêm de erro de digitação; o
  toggle reduz abandono em mobile porque o usuário confere o que digitou
  antes de enviar. Regras: botão real (não ícone decorativo), nome
  acessível que muda ("Mostrar senha" → "Ocultar senha"), `aria-pressed`,
  operável por teclado, alvo de toque ≥ 44×44 px e a senha volta a ficar
  oculta ao enviar (p/ o navegador não guardar o valor visível). Impacto
  4, Esforço 1 — **implementado neste ciclo no /login** (botão olho com
  SVG próprio, 44 px, `aria-pressed` + rótulo dinâmico, reset no submit).
- **Login é a porta da frente — e é onde os testes de acessibilidade mais
  falham**: os erros mais comuns são campos sem rótulo visível conectado
  ao input, o olho sem nome acessível, alvos de toque minúsculos e o
  zoom do iOS quando o input tem menos de 16 px. O nosso login já tinha
  rótulos conectados, `autocomplete` correto e fonte 1rem — o que faltava
  era o toggle e o layout centrado com marca. Próximo passo da mesma
  frente: aplicar o mesmo padrão (`.auth-*` reutilizável) ao /cadastro e
  revisar os botões da portaria p/ o mínimo de 44 px. Impacto 3, Esforço 2
  — próxima candidata (portaria: alvos de toque + foco visível).

## Semeado em 17/11/2026 — painéis operacionais e filas em tempo real (frente a, ciclo UI 3)
Fontes: hiperfusion.com "Dense Admin Screens for Operators: Patterns That Beat
Dashboards in Repetitive Work" (13/07/2026); contactcentresummit.co.uk "Display
Board Layout" (atual. 20/07/2026); rocketscreens.com "How to Display Zendesk
Tickets on Call Center TVs" (2026); designhq.io "Dashboard UI Design: Best
Practices & SaaS Examples" (2026); fuselabcreative.com "Mobile Dashboard
Design: What to Leave Off the Screen" (2026).

- **O loop do operador, não o modelo de dados**: encontrar → avaliar → agir →
  confirmar → próximo; as 5 ações mais frequentes num trilho consistente e
  previsível; estado é contrato (texto + ícone, nunca só cor). Impacto 3,
  Esforço 2 — **aplicado neste ciclo na portaria** (resumo em 3 contadores +
  seções por status + selo de conexão com texto).
- **3 a 5 métricas no máximo numa visão operacional**: mais dado vira ruído,
  não insight; contadores grandes com limiares verde/âmbar/vermelho
  comunicam urgência sem ninguém interpretar número. Impacto 3, Esforço 1
  — aplicado (resumo de 3 números; "prontos" em verde).
- **Numerais tabulares em contagens ao vivo**: dígitos de largura fixa não
  dançam quando o valor muda — o operador lê o número sem re-focar.
  Impacto 2, Esforço 1 — aplicado (tabular-nums nos contadores, badges de
  contagem e chips de ETA).
- **Mobile é um olhar com uma mão**: a primeira posição vertical responde à
  pergunta única da tela; o resto vai p/ um toque de distância; o olhar
  vale p/ 3–5 pontos primários, não mais. Impacto 3, Esforço 2 — próxima
  candidata (revisão mobile geral da fila UI).

## Diferencial TutorPass (tese)
Concorrente BR forte é suite ampla (comunicação/ERP/facial). TutorPass vence sendo **o melhor só em saída**:
mais rápido de implantar, QR dinâmico anti-fraude (eles usam QR estático), auditoria imutável com hash
(ângulo jurídico/LGPD) e preço simples por aluno. Toda ideia nova deve reforçar essa tese ou ser fase 2.
