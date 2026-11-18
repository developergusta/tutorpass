import Link from 'next/link';
import HeroBoard from '../components/HeroBoard';

const protocolLogs = [
  {
    time: '17:38:04',
    code: '01 / GEOFENCE_2X',
    actor: 'Responsável (/responsavel)',
    title: 'Aproximação validada com dupla leitura na cerca virtual',
    detail:
      'O responsável toca em "Estou chegando" ou entra no raio da escola. O servidor exige duas confirmações consecutivas antes de enfileirar o aluno — eliminando alarmes falsos de carros que apenas cruzam a avenida.',
    artifact: 'gate: Portão Principal · leituras: 2/2 · coordenadas brutas: descartadas (LGPD)',
  },
  {
    time: '17:40:19',
    code: '02 / SILENT_CALL',
    actor: 'Sala de Aula (/sala) e Pátio (/telao)',
    title: 'Chamada silenciosa na turma certa, sem microfone no pátio',
    detail:
      'Quando o agente de portão chama o aluno, somente a tela da turma dele destaca a saída. Se dois irmãos estiverem alocados em portões diferentes, um alerta âmbar trava a confusão antes da criança descer.',
    artifact: 'turma: 3º B (Sala 14) · alerta de irmãos: 0 conflitos · latência WebSocket: <40ms',
  },
  {
    time: '17:42:18',
    code: '03 / NONCE_30S',
    actor: 'Agente de Portão (/portaria)',
    title: 'Validação de QR efêmero de 30 segundos ou credencial impressa',
    detail:
      'Na grade, o agente valida o QR dinâmico que rotaciona a cada 30s no Redis (ou o código impresso de 6 dígitos para avós sem smartphone). Qualquer print de tela encaminhado ou já lido retorna erro 401 na hora.',
    artifact: 'token: NONCE #84A2-91F · TTL: 30s · segunda leitura: 401 QR_REJECTED',
  },
  {
    time: '17:42:27',
    code: '04 / SHA256_CHAIN',
    actor: 'Livro de Custódia (/escola)',
    title: 'Entrega assinada em cadeia criptográfica à prova de edição',
    detail:
      'A liberação grava quem retirou, em qual portão, por qual agente e calcula um hash SHA-256 ligado ao evento anterior. A direção tem prova técnica irrefutável de cada saída do ano letivo.',
    artifact: 'evt_0484 · sha256: 9f3a8c12…e81c ⟵ prev: 4c127b09…ab10 · cadeia íntegra',
  },
];

const roleTerminals = [
  {
    href: '/portaria',
    code: 'TERM-01',
    route: '/portaria',
    role: 'Agente de portão',
    title: 'Mesa da Portaria',
    desc: 'Opera a fila por portão: chama a sala, lê o QR de 30s, recebe alerta de irmãos separados e assina a entrega.',
  },
  {
    href: '/sala',
    code: 'TERM-02',
    route: '/sala',
    role: 'Professor(a)',
    title: 'Terminal de Sala',
    desc: 'Filtra exclusivamente os alunos da turma atual e separa quem já deve descer para a baia de quem ainda está a caminho.',
  },
  {
    href: '/responsavel',
    code: 'TERM-03',
    route: '/responsavel',
    role: 'Família / Tutor',
    title: 'Credencial do Responsável',
    desc: 'Avisa chegada com um toque, acompanha o status do filho ao vivo e exibe o QR dinâmico anti-print na portaria.',
  },
  {
    href: '/telao',
    code: 'TERM-04',
    route: '/telao',
    role: 'Pátio / Recepção',
    title: 'Telão de Alto Contraste',
    desc: 'Modo TV em tela cheia com fundo escuro chapado e tipografia dimensionada para leitura a mais de 5 metros.',
  },
  {
    href: '/escola',
    code: 'TERM-05',
    route: '/escola',
    role: 'Secretaria / Direção',
    title: 'Cadastro & Implantação',
    desc: 'Turmas, alunos, vínculo de contas de responsáveis, importação CSV com prévia e checklist de implantação em 53 minutos.',
  },
];

const priceTiers = [
  {
    code: 'FAIXA 00',
    band: 'Até 30 alunos',
    limit: 'Até 5 funcionários · fila ao vivo + QR 30s + relatório diário',
    price: 'R$ 0/mês',
    note: 'Grátis para sempre',
  },
  {
    code: 'TESTE 30D',
    band: 'Qualquer porte (30 dias)',
    limit: 'Todos os módulos do PRO liberados · sem pedir cartão',
    price: 'R$ 0',
    note: 'Volta ao Grátis se não assinar',
  },
  {
    code: 'PRO · FAIXA A',
    band: 'Até 50 alunos',
    limit: 'Todos os módulos · múltiplos portões · telão · van · LGPD',
    price: 'R$ 89/mês',
    note: 'Valor fixo da escola',
  },
  {
    code: 'PRO · FAIXA B',
    band: 'De 51 a 200 alunos',
    limit: 'Todos os módulos · até 50 funcionários · relatórios de pico',
    price: 'R$ 199/mês',
    note: 'Valor fixo da escola',
  },
  {
    code: 'PRO · FAIXA C',
    band: 'De 201 a 2.000 alunos',
    limit: 'Operação completa de alto fluxo · condição de rede acima de 1.000',
    price: 'R$ 349/mês',
    note: 'Valor fixo da escola',
  },
];

export default function HomePage() {
  return (
    <main id="conteudo" tabIndex={-1} className="dossier-home">
      {/* CABEÇALHO EM FICHA DE COMANDO + BANCADA DE DESPACHO EM LARGURA TOTAL */}
      <section className="workbench-stage">
        <div className="container container-wide">
          <div className="command-masthead">
            <div className="cm-headline">
              <div className="cm-kicker-row">
                <span className="cm-badge">SISTEMA DE CUSTÓDIA E DESPACHO ESCOLAR</span>
                <span className="cm-spec">SHA-256 · QR 30s · LGPD NATIVA</span>
              </div>
              <h1>
                Saída escolar coordenada como controle de tráfego, não no grito.
              </h1>
            </div>

            <div className="cm-brief">
              <p>
                Substitua a fila dupla na calçada e o microfone no pátio por uma
                mesa de despacho sincronizada entre celular da família, sala de
                aula e portaria — com cada entrega assinada em cadeia criptográfica.
              </p>
              <div className="cm-actions">
                <Link className="btn btn-hero" href="/cadastro">
                  Implantar na minha escola (Grátis até 30 alunos)
                </Link>
                <Link className="btn btn-hero-ghost" href="/planos">
                  Calcular mensalidade fixa
                </Link>
              </div>
            </div>
          </div>

          {/* A peça única desta página: a bancada operacional interativa em 5 lentes */}
          <HeroBoard />
        </div>
      </section>

      {/* CORPO EM DOSSIÊ ASSIMÉTRICO (ÍNDICE FIXO À ESQUERDA + MANIFESTO TÉCNICO À DIREITA) */}
      <div className="container container-wide dossier-layout">
        <aside className="dossier-rail" aria-label="Especificação operacional">
          <div className="rail-sticky">
            <div className="rail-box">
              <span className="rail-title">PARÂMETROS DO SISTEMA</span>
              <dl className="rail-specs">
                <div>
                  <dt>Rotação de token QR</dt>
                  <dd>30 segundos (Redis)</dd>
                </div>
                <div>
                  <dt>Proteção contra print</dt>
                  <dd>Nonce de leitura única</dd>
                </div>
                <div>
                  <dt>Auditoria de entrega</dt>
                  <dd>Hash SHA-256 encadeado</dd>
                </div>
                <div>
                  <dt>Cerca virtual (GPS)</dt>
                  <dd>2 leituras · zero rastro bruto</dd>
                </div>
                <div>
                  <dt>Tempo de implantação</dt>
                  <dd>53 min via planilha CSV</dd>
                </div>
              </dl>
              <nav className="rail-anchors" aria-label="Seções do dossiê">
                <a href="#cronologia">§1. Cronologia de custódia</a>
                <a href="#engenharia">§2. Provas anti-fraude</a>
                <a href="#terminais">§3. Os 5 terminais ao vivo</a>
                <a href="#tabela-precos">§4. Tabela pública de preços</a>
              </nav>
            </div>
          </div>
        </aside>

        <div className="dossier-content">
          {/* §1. CRONOLOGIA TÉCNICA DE UMA RETIRADA (substitui cartões de "3 passos") */}
          <section id="cronologia" className="dossier-section">
            <header className="ds-head">
              <span className="ds-num">§ 01</span>
              <div>
                <h2>Cronologia real de uma retirada (17h38 às 17h42)</h2>
                <p className="muted">
                  Em vez de promessas abstratas, veja exatamente o que o servidor
                  valida nos 4 minutos entre a aproximação do responsável e a saída
                  pelo portão.
                </p>
              </div>
            </header>

            <ol className="timeline-ledger">
              {protocolLogs.map((item) => (
                <li key={item.code} className="tl-row">
                  <div className="tl-time-col">
                    <span className="tl-clock">{item.time}</span>
                    <span className="tl-code">{item.code}</span>
                  </div>
                  <div className="tl-main-col">
                    <span className="tl-actor">{item.actor}</span>
                    <h3>{item.title}</h3>
                    <p className="muted">{item.detail}</p>
                    <div className="tl-artifact" aria-hidden="true">
                      <code>{item.artifact}</code>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* §2. ESPECIFICAÇÃO ANTI-FRAUDE E LGPD (substitui grade de features com ícones) */}
          <section id="engenharia" className="dossier-section">
            <header className="ds-head">
              <span className="ds-num">§ 02</span>
              <div>
                <h2>Arquitetura contra fraude, fila travada e vazamento de dados</h2>
                <p className="muted">
                  Construído especificamente para o horário de pico de escolas
                  particulares brasileiras, onde segurança jurídica e velocidade na
                  calçada não admitem improviso.
                </p>
              </div>
            </header>

            <div className="spec-sheet">
              <article className="spec-block">
                <div className="spec-block-meta">
                  <span className="spec-id">SPEC-A · ANTI-REPLAY</span>
                  <h3>Bloqueio instantâneo de print de WhatsApp</h3>
                </div>
                <div className="spec-block-body">
                  <p className="muted">
                    Códigos QR fixos colados no vidro do carro ou enviados por
                    mensagem permitem que qualquer pessoa retire um aluno sem a
                    escola perceber. No TutorPass, cada QR nasce com validade de 30
                    segundos e morre na primeira leitura da portaria.
                  </p>
                  <div className="specimen-box" aria-hidden="true">
                    <div className="specimen-row">
                      <span className="specimen-code">1ª LEITURA · NONCE #84A2</span>
                      <span className="specimen-pill ok">200 OK · LIBERADO</span>
                    </div>
                    <div className="specimen-row">
                      <span className="specimen-code">PRINT REPASSADO · #84A2</span>
                      <span className="specimen-pill err">401 · QR_REJECTED</span>
                    </div>
                  </div>
                </div>
              </article>

              <article className="spec-block">
                <div className="spec-block-meta">
                  <span className="spec-id">SPEC-B · MULTI-GATE</span>
                  <h3>Detecção automática de irmãos em portões diferentes</h3>
                </div>
                <div className="spec-block-body">
                  <p className="muted">
                    Escolas que separam a saída do Infantil e do Fundamental
                    sofrem quando uma mesma mãe tem filhos nos dois blocos. O motor
                    da fila cruza o identificador do responsável em todos os portões
                    ativos e exibe um alerta de unificação para o porteiro.
                  </p>
                  <div className="specimen-box" aria-hidden="true">
                    <div className="specimen-row">
                      <span className="specimen-code">
                        CONFLITO DETECTADO · TUTOR #194 (2 FILHOS)
                      </span>
                      <span className="specimen-pill warn">
                        Portão A + Portão Infantil
                      </span>
                    </div>
                  </div>
                </div>
              </article>

              <article className="spec-block">
                <div className="spec-block-meta">
                  <span className="spec-id">SPEC-C · CONTINGÊNCIA</span>
                  <h3>Cartão impresso com código para avós sem celular</h3>
                </div>
                <div className="spec-block-body">
                  <p className="muted">
                    Nem todo portador autorizado usa aplicativo. A secretaria emite
                    credenciais impressas com código verificador e delegação
                    temporária com data de validade, mantendo o mesmo registro no
                    livro SHA-256.
                  </p>
                </div>
              </article>

              <article className="spec-block">
                <div className="spec-block-meta">
                  <span className="spec-id">SPEC-D · PRIVACIDADE LGPD</span>
                  <h3>Geofencing sem rastrear a rotina da família</h3>
                </div>
                <div className="spec-block-body">
                  <p className="muted">
                    A cerca virtual calcula apenas se o responsável entrou no raio
                    de chegada da escola e descarta a coordenada exata. Inclui
                    fluxo nativo de direitos do titular (art. 18 e 19 da LGPD) e
                    relatório de conformidade para a direção.
                  </p>
                </div>
              </article>
            </div>
          </section>

          {/* §3. ÍNDICE DE TERMINAIS OPERACIONAIS */}
          <section id="terminais" className="dossier-section">
            <header className="ds-head">
              <span className="ds-num">§ 03</span>
              <div>
                <h2>Cinco terminais dedicados, conectados ao mesmo núcleo</h2>
                <p className="muted">
                  Nada de um painel genérico cheio de menus para todo mundo. Cada
                  papel abre direto na sua superfície de trabalho.
                </p>
              </div>
            </header>

            <nav
              className="dispatch-directory"
              aria-label="Terminais operacionais do sistema"
            >
              {roleTerminals.map((t) => (
                <Link key={t.href} className="dispatch-row" href={t.href}>
                  <div className="dispatch-row-id">
                    <span className="term-code">{t.code}</span>
                    <div>
                      <span className="role-tag">{t.role}</span>
                      <h3>{t.title}</h3>
                    </div>
                  </div>
                  <p className="muted dispatch-row-desc">{t.desc}</p>
                  <span className="dispatch-row-route">Abrir {t.route}</span>
                </Link>
              ))}
            </nav>
          </section>

          {/* §4. TABELA PÚBLICA DE PREÇOS EM FORMATO DE FOLHA DE CONTRATO */}
          <section id="tabela-precos" className="dossier-section">
            <header className="ds-head">
              <span className="ds-num">§ 04</span>
              <div>
                <h2>Tabela comercial aberta — valor fixo por faixa de alunos</h2>
                <p className="muted">
                  Sem reunião obrigatória para descobrir preço e sem cobrança por
                  aluno ou responsável adicional dentro da faixa.
                </p>
              </div>
            </header>

            <div className="contract-ledger">
              <div className="cl-table" role="table" aria-label="Faixas de preço mensal">
                {priceTiers.map((tier) => (
                  <div className="cl-row" role="row" key={tier.code}>
                    <div className="cl-cell-code" role="cell">
                      <span>{tier.code}</span>
                    </div>
                    <div className="cl-cell-main" role="cell">
                      <strong>{tier.band}</strong>
                      <span className="muted">{tier.limit}</span>
                    </div>
                    <div className="cl-cell-price" role="cell">
                      <strong>{tier.price}</strong>
                      <span>{tier.note}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="cl-footer">
                <p className="muted">
                  A escola cria a conta em 1 minuto, importa os alunos por CSV e
                  pode ativar 30 dias do plano PRO completo sem informar cartão.
                </p>
                <div className="cl-actions">
                  <Link className="btn" href="/cadastro">
                    Criar conta da escola agora
                  </Link>
                  <Link className="btn secondary" href="/planos">
                    Simular na calculadora
                  </Link>
                  <Link className="btn secondary" href="/login">
                    Entrar em conta existente
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
