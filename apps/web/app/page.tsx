import {
  ArrowUpRight,
  Bell,
  Calculator,
  Check,
  FileSpreadsheet,
  Link2,
  MapPin,
  Monitor,
  QrCode,
  ShieldCheck,
  Smartphone,
  Tv,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import HeroBoard from '../components/HeroBoard';
import Reveal from '../components/Reveal';

const operationalStats = [
  {
    value: '30 s',
    label: 'Rotação do QR code via HMAC',
    detail: 'Expira a cada meio minuto e invalida print de tela no primeiro uso.',
  },
  {
    value: '2 leituras',
    label: 'Fila automática por geolocalização',
    detail: 'O responsável entra na fila ao se aproximar do colégio, sem gravar histórico de rota.',
  },
  {
    value: 'SHA-256',
    label: 'Log imutável com hash encadeado',
    detail: 'Cada entrega assina o hash anterior; ninguém altera quem retirou ou o horário.',
  },
  {
    value: '< 1 s',
    label: 'Telão na portaria + aviso aos pais',
    detail: 'Chamada silenciosa na TV do portão e notificação instantânea na liberação.',
  },
];

const releaseSequence = [
  {
    step: '01',
    icon: MapPin,
    time: 'A 150 m do portão',
    title: 'Fila automática por geolocalização',
    body: 'Quando o responsável se aproxima da escola, o aplicativo confirma duas leituras dentro do perímetro e posiciona o aluno na fila da portaria automaticamente — sem tocar no celular no trânsito e sem armazenar o trajeto da família.',
    artifact: 'status: QUEUED · distância: 145 m · ETA: ~2 min',
  },
  {
    step: '02',
    icon: Tv,
    time: 'Na chegada à baia',
    title: 'Telão em tempo real na portaria e nas salas',
    body: 'Sem microfone gritando no pátio. O nome da criança sobe na coluna "Pode retirar agora" do telão de alto contraste no portão e na tela silenciosa da professora, que libera apenas quem já tem o responsável aguardando.',
    artifact: 'canal: /telao + /sala · latência WebSocket < 40 ms',
  },
  {
    step: '03',
    icon: QrCode,
    time: 'Na grade do portão',
    title: 'QR code dinâmico HMAC que muda a cada 30 segundos',
    body: 'Crachá de papel ou QR fixo permite que qualquer pessoa com uma foto no WhatsApp retire o aluno. No TutorPass, o código é assinado via HMAC, rotaciona a cada 30 segundos e é destruído no milissegundo da primeira leitura.',
    artifact: 'token: HMAC-84A2-91F0 · TTL: 30 s · uso único',
  },
  {
    step: '04',
    icon: Users,
    time: 'Tios, avós e terceiros',
    title: 'Delegação formal de pessoas autorizadas',
    body: 'Os pais cadastram e delegam terceiros autorizados (avós, tios, motoristas) direto pela conta da família. Se o portador não estiver ativo na lista de autorizados do aluno, a leitora da portaria bloqueia a entrega na hora.',
    artifact: 'vínculo: Avó autorizada · delegada por Mãe titular',
  },
  {
    step: '05',
    icon: Bell,
    time: 'No segundo da entrega',
    title: 'Notificação instantânea aos pais e log com hash encadeado',
    body: 'Confirmada a saída pelo porteiro, os pais recebem uma notificação instantânea informando exatamente quem retirou a criança e em qual portão. O evento é gravado em um livro de custódia com hash SHA-256 encadeado ao registro anterior — impossível de editar ou apagar depois.',
    artifact: 'sha256:9f3a8c12e81c ⟵ prev:4c127b09ab10',
  },
];

const roleTerminals = [
  {
    href: '/portaria',
    route: '/portaria',
    role: 'Porteiro / Agente de portão',
    title: 'Mesa da Portaria',
    desc: 'Aciona a chamada para a sala, lê o QR dinâmico HMAC de 30s, confere terceiros delegados e assina a liberação.',
    icon: ShieldCheck,
  },
  {
    href: '/telao',
    route: '/telao',
    role: 'Pátio / Portão de embarque',
    title: 'Telão em Tempo Real',
    desc: 'Painel de alto contraste para TV ou monitor no portão, separando quem pode sair agora de quem está chegando pelo GPS.',
    icon: Monitor,
  },
  {
    href: '/sala',
    route: '/sala',
    role: 'Professor(a) em sala',
    title: 'Chamada Silenciosa de Sala',
    desc: 'Filtra somente a turma da professora e destaca em verde quem deve descer para a portaria naquele instante.',
    icon: Users,
  },
  {
    href: '/responsavel',
    route: '/responsavel',
    role: 'Pais e pessoas autorizadas',
    title: 'Passe do Responsável',
    desc: 'Entrada na fila por aproximação, QR code HMAC rotativo de 30 segundos e aviso imediato quando o filho é entregue.',
    icon: Smartphone,
  },
  {
    href: '/escola',
    route: '/escola',
    role: 'Secretaria e direção',
    title: 'Gestão da Escola e Log',
    desc: 'Importação de turmas por planilha CSV, vínculo de responsáveis, delegação de autorizados e auditoria do log encadeado.',
    icon: FileSpreadsheet,
  },
];

const pricingTiers = [
  {
    name: 'Grátis',
    band: 'Até 30 alunos',
    price: 'R$ 0',
    period: '/mês para sempre',
    highlight: false,
    note: 'Até 5 funcionários · fila ao vivo, QR dinâmico HMAC de 30s e relatório diário por e-mail.',
    ctaLabel: 'Começar grátis',
    ctaHref: '/cadastro',
  },
  {
    name: 'Faixa 1 · PRO',
    band: 'Até 50 alunos',
    price: 'R$ 89',
    period: '/mês fixo',
    highlight: false,
    note: 'Todos os recursos liberados: fila por geolocalização, telão de TV no portão, delegação e log encadeado.',
    ctaLabel: 'Testar 30 dias grátis',
    ctaHref: '/cadastro',
  },
  {
    name: 'Faixa 2 · PRO',
    band: '51 a 200 alunos',
    price: 'R$ 199',
    period: '/mês fixo',
    highlight: true,
    note: 'Até 50 funcionários, múltiplos portões simultâneos, alerta de irmãos em portões distintos e relatórios de pico.',
    ctaLabel: 'Testar 30 dias grátis',
    ctaHref: '/cadastro',
  },
  {
    name: 'Faixa 3 · PRO',
    band: 'Acima de 200 alunos',
    price: 'R$ 349',
    period: '/mês fixo',
    highlight: false,
    note: 'Para colégios de médio e grande porte (até 2.000 alunos). Condição dedicada para redes acima de 1.000 alunos.',
    ctaLabel: 'Testar 30 dias grátis',
    ctaHref: '/cadastro',
  },
];

export default function HomePage() {
  return (
    <main id="conteudo" tabIndex={-1} className="tp-landing">
      {/* 1. HERO EDITORIAL ASSIMÉTRICO + MOCKUP REALISTA PORTARIA / TELÃO */}
      <section className="tp-hero-section">
        <div className="container container-wide">
          <div className="tp-hero-header">
            <div className="tp-hero-headline-col">
              <div className="tp-kicker-line">
                <span className="tp-kicker-dot" aria-hidden="true" />
                <span>CONTROLE DE CUSTÓDIA NA SAÍDA ESCOLAR</span>
              </div>
              <h1 className="tp-hero-title">
                Quem retira cada aluno, provado por{' '}
                <em>QR de 30 segundos</em> e log que ninguém pode alterar.
              </h1>
            </div>

            <div className="tp-hero-aside-col">
              <p className="tp-hero-lead">
                Os pais entram na fila automaticamente por geolocalização ao se
                aproximar do colégio. O telão da portaria chama a sala em
                silêncio, o porteiro valida o QR HMAC rotativo de quem foi
                autorizado e a família recebe notificação instantânea na
                liberação.
              </p>
              <div className="tp-hero-ctas">
                <Link className="btn tp-btn-primary" href="/cadastro">
                  Criar conta da escola — Grátis até 30 alunos
                </Link>
                <Link className="btn secondary tp-btn-secondary" href="/planos">
                  <Calculator size={16} aria-hidden="true" />
                  Simular faixa de preço
                </Link>
              </div>
            </div>
          </div>

          {/* Mockup realista das telas de Portaria (/portaria) e Telão (/telao) */}
          <HeroBoard />

          {/* Barra de métricas com números tabulares acoplada à base */}
          <dl className="tp-metrics-bar" aria-label="Parâmetros técnicos da operação">
            {operationalStats.map((stat) => (
              <div key={stat.label} className="tp-metric-item">
                <dd className="wb-mono tp-metric-value">{stat.value}</dd>
                <dt className="tp-metric-label">{stat.label}</dt>
                <p className="tp-metric-detail">{stat.detail}</p>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 2. SEÇÃO EDITORIAL ASSIMÉTRICA: FLUXO PASSO A PASSO + NÚMERO ÂNCORA */}
      <section className="tp-editorial-section">
        <div className="container container-wide">
          <div className="tp-editorial-layout">
            {/* Coluna esquerda fixa: grande número editorial + resumo de segurança */}
            <aside className="tp-editorial-rail">
              <div className="tp-big-stat-block">
                <span className="wb-mono tp-big-stat-number">30s</span>
                <p className="tp-big-stat-caption">
                  Tempo máximo de vida de cada código QR gerado por HMAC antes de
                  expirar sozinho.
                </p>
              </div>
              <div className="tp-rail-body">
                <h2 className="tp-serif-heading">
                  Da esquina da escola até a assinatura criptográfica no portão.
                </h2>
                <p className="muted">
                  Em vez de microfone no pátio, fila dupla na rua e crachás
                  plastificados que podem ser fotografados, o TutorPass amarra
                  cinco verificações reais entre o celular da família, o telão da
                  portaria e o banco de dados.
                </p>
                <div className="tp-rail-links">
                  <Link href="/portaria" className="tp-inline-link">
                    Abrir painel da portaria
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                  <Link href="/telao" className="tp-inline-link">
                    Abrir telão de TV
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </aside>

            {/* Coluna direita: lista editorial numerada de 5 passos */}
            <ol className="tp-step-ledger">
              {releaseSequence.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <li key={item.step} className="tp-step-row">
                    <Reveal delay={idx * 45}>
                      <div className="tp-step-inner">
                        <div className="tp-step-num-col">
                          <span className="wb-mono tp-step-num">{item.step}</span>
                          <span className="tp-step-icon" aria-hidden="true">
                            <Icon size={18} strokeWidth={1.75} />
                          </span>
                        </div>
                        <div className="tp-step-content">
                          <span className="wb-mono tp-step-time">{item.time}</span>
                          <h3 className="tp-step-title">{item.title}</h3>
                          <p className="tp-step-desc">{item.body}</p>
                          <div className="wb-mono tp-step-artifact">
                            {item.artifact}
                          </div>
                        </div>
                      </div>
                    </Reveal>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      {/* 3. ARQUITETURA ASSIMÉTRICA DE PROVAS REAIS (DELEGAÇÃO + LOG ENCADEADO) */}
      <section className="tp-proof-section">
        <div className="container container-wide">
          <header className="tp-section-header">
            <div>
              <h2 className="tp-serif-heading">
                Duas garantias que uma planilha ou crachá impresso nunca entregam.
              </h2>
            </div>
            <p className="muted tp-section-sub">
              Quando a direção precisa responder quem autorizou um terceiro ou
              provar o horário exato em que um aluno cruzou o portão, a resposta
              está gravada com verificação matemática.
            </p>
          </header>

          {/* Layout assimétrico 7 / 5 colunas (sem grade 3x2 de cartões iguais) */}
          <div className="tp-asymmetric-proof">
            {/* Bloco largo (7 colunas): Log imutável de retirada com hash encadeado */}
            <article className="tp-proof-block is-wide">
              <div className="tp-proof-copy">
                <div className="tp-proof-title-row">
                  <Link2 size={18} strokeWidth={1.75} aria-hidden="true" />
                  <h3>Log imutável de saída com hash SHA-256 encadeado</h3>
                </div>
                <p>
                  Cada evento de chamada, validação de QR code HMAC e liberação
                  no portão calcula um hash criptográfico que inclui o hash do
                  registro imediatamente anterior. Se alguém tentar alterar no
                  banco de dados quem buscou uma criança ou mudar o horário, a
                  cadeia inteira acusa violação na auditoria da escola.
                </p>
              </div>

              <div className="tp-hash-ledger" aria-label="Demonstração de blocos encadeados">
                <div className="tp-hash-row">
                  <div className="tp-hash-meta">
                    <span className="wb-mono tp-hash-seq">REGISTRO #0482 · 17:41:10</span>
                    <span className="wb-mono tp-hash-event">FILA_GEOLOCALIZACAO</span>
                  </div>
                  <p className="tp-hash-summary">
                    Sofia Ribeiro (1º Ano A) · Aproximação confirmada a 140m do Portão Principal
                  </p>
                  <div className="wb-mono tp-hash-digest">
                    <span>prev: 3e71c40d9a22</span>
                    <strong>sha256: 7d8814f2c301</strong>
                  </div>
                </div>

                <div className="tp-hash-row">
                  <div className="tp-hash-meta">
                    <span className="wb-mono tp-hash-seq">REGISTRO #0483 · 17:41:52</span>
                    <span className="wb-mono tp-hash-event">QR_HMAC_VALIDADO</span>
                  </div>
                  <p className="tp-hash-summary">
                    Pedro Santos (5º Ano A) · Portador: Ricardo Santos (Pai titular) · Token consumido
                  </p>
                  <div className="wb-mono tp-hash-digest">
                    <span>prev: 7d8814f2c301</span>
                    <strong>sha256: 4c127b09ab10</strong>
                  </div>
                </div>

                <div className="tp-hash-row is-verified">
                  <div className="tp-hash-meta">
                    <span className="wb-mono tp-hash-seq">REGISTRO #0484 · 17:42:18</span>
                    <span className="wb-mono tp-hash-event">SAIDA_LIBERADA_NOTIFICADA</span>
                  </div>
                  <p className="tp-hash-summary">
                    Alice Martins (3º Ano B) · Entregue a Mariana Martins · Push enviado aos pais
                  </p>
                  <div className="wb-mono tp-hash-digest">
                    <span>prev: 4c127b09ab10</span>
                    <strong>sha256: 9f3a8c12e81c · ÍNTEGRO</strong>
                  </div>
                </div>
              </div>
            </article>

            {/* Coluna vertical empilhada (5 colunas): Delegação + Anti-Replay HMAC */}
            <div className="tp-proof-stack">
              <article className="tp-proof-block">
                <div className="tp-proof-copy">
                  <div className="tp-proof-title-row">
                    <Users size={18} strokeWidth={1.75} aria-hidden="true" />
                    <h3>Delegação de pessoas autorizadas pela família</h3>
                  </div>
                  <p>
                    Avós, tios, babás ou motoristas não dependem de bilhete na
                    agenda nem de ligação de última hora para a secretaria. O
                    responsável titular autoriza o terceiro no aplicativo e cada
                    pessoa delegada apresenta seu próprio QR dinâmico ou código
                    de retirada vinculado ao aluno.
                  </p>
                </div>
                <div className="tp-delegation-table" aria-label="Exemplo de pessoas autorizadas">
                  <div className="tp-del-row">
                    <div>
                      <strong>Mariana Martins</strong>
                      <span>Mãe titular · QR HMAC ativo</span>
                    </div>
                    <span className="wb-mono tp-del-status is-ok">AUTORIZADA</span>
                  </div>
                  <div className="tp-del-row">
                    <div>
                      <strong>Helena Martins</strong>
                      <span>Avó · Delegada pela mãe (terças e quintas)</span>
                    </div>
                    <span className="wb-mono tp-del-status is-ok">AUTORIZADA</span>
                  </div>
                  <div className="tp-del-row is-revoked">
                    <div>
                      <strong>Carlos Eduardo (Ex-transporte)</strong>
                      <span>Permissão encerrada pela família em 12/11</span>
                    </div>
                    <span className="wb-mono tp-del-status is-err">BLOQUEADO</span>
                  </div>
                </div>
              </article>

              <article className="tp-proof-block">
                <div className="tp-proof-copy">
                  <div className="tp-proof-title-row">
                    <QrCode size={18} strokeWidth={1.75} aria-hidden="true" />
                    <h3>Por que o QR muda a cada 30 segundos (HMAC)</h3>
                  </div>
                  <p>
                    Se alguém tirar print do código e encaminhar por mensagem, o
                    código já estará expirado na chegada ao portão — e qualquer
                    tentativa de reutilizar um token já lido retorna erro
                    imediato na tela do porteiro.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      {/* 4. SUPERFÍCIES DO SISTEMA (LINKS DIRETOS PARA CADA ROTA REAL) */}
      <section className="tp-terminals-section">
        <div className="container container-wide">
          <header className="tp-section-header">
            <div>
              <h2 className="tp-serif-heading">
                Cinco telas dedicadas para quem opera o portão, a sala e a secretaria.
              </h2>
            </div>
            <p className="muted tp-section-sub">
              Cada perfil acessa sua rota direta no navegador, celular ou TV, sem
              menus administrativos na frente de quem precisa liberar alunos em
              horário de pico.
            </p>
          </header>

          <nav className="tp-terminals-list" aria-label="Acesso rápido às telas do produto">
            {roleTerminals.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="tp-terminal-row">
                  <div className="tp-terminal-left">
                    <span className="tp-terminal-icon" aria-hidden="true">
                      <Icon size={18} strokeWidth={1.75} />
                    </span>
                    <div>
                      <span className="tp-terminal-role">{item.role}</span>
                      <h3 className="tp-terminal-title">{item.title}</h3>
                    </div>
                  </div>
                  <p className="tp-terminal-desc">{item.desc}</p>
                  <div className="tp-terminal-right">
                    <span className="wb-mono tp-terminal-route">{item.route}</span>
                    <span className="tp-terminal-go">
                      Abrir
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </section>

      {/* 5. PREÇO PÚBLICO EXATO POR FAIXA DE ALUNOS */}
      <section className="tp-pricing-section" id="precos">
        <div className="container container-wide">
          <div className="tp-pricing-ledger">
            <header className="tp-pricing-header">
              <div>
                <h2 className="tp-serif-heading">
                  Preço público por faixa de alunos, sem orçamento escondido.
                </h2>
                <p className="muted">
                  Grátis para sempre até 30 alunos. Acima disso, mensalidade fixa
                  por faixa com todos os recursos incluídos (QR HMAC de 30s, fila
                  por geolocalização, telão de TV, delegação de autorizados,
                  notificação instantânea e log com hash encadeado) e 30 dias de
                  teste grátis sem cartão.
                </p>
              </div>
              <div className="tp-pricing-header-actions">
                <Link className="btn secondary" href="/planos">
                  <Calculator size={16} aria-hidden="true" />
                  Abrir calculadora por número de alunos
                </Link>
              </div>
            </header>

            <div className="tp-pricing-columns" role="list" aria-label="Tabela de preços por faixa de alunos">
              {pricingTiers.map((tier) => (
                <div
                  key={tier.band}
                  role="listitem"
                  className={`tp-pricing-col${tier.highlight ? ' is-featured' : ''}`}
                >
                  <div className="tp-pricing-col-top">
                    <span className="wb-mono tp-pricing-tier-name">{tier.name}</span>
                    <h3 className="tp-pricing-band">{tier.band}</h3>
                  </div>

                  <div className="tp-pricing-amount">
                    <span className="wb-mono tp-price-figure">{tier.price}</span>
                    <span className="tp-price-period">{tier.period}</span>
                  </div>

                  <p className="tp-pricing-note">{tier.note}</p>

                  <ul className="tp-pricing-checks">
                    <li>
                      <Check size={14} aria-hidden="true" />
                      <span>QR dinâmico HMAC (30s)</span>
                    </li>
                    <li>
                      <Check size={14} aria-hidden="true" />
                      <span>Log imutável com hash encadeado</span>
                    </li>
                    <li>
                      <Check size={14} aria-hidden="true" />
                      <span>Notificação instantânea aos pais</span>
                    </li>
                  </ul>

                  <Link
                    href={tier.ctaHref}
                    className={`btn ${tier.highlight ? '' : 'secondary'} tp-pricing-cta`}
                  >
                    {tier.ctaLabel}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
