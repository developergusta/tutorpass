import Link from 'next/link';
import HeroBoard from '../components/HeroBoard';

const telemetryRibbon = [
  { value: '30 s', label: 'Janela máxima do QR', sub: 'Token efêmero no Redis, uso único' },
  { value: '< 40 ms', label: 'Chamada sala ↔ portão', sub: 'WebSocket dedicado por turma' },
  { value: '2 leituras', label: 'Filtro de cerca virtual', sub: 'Zero alarme falso de quem passa na rua' },
  { value: '53 min', label: 'Implantação completa', sub: 'Importação CSV com prévia a seco' },
];

const roleTerminals = [
  {
    href: '/portaria',
    code: '01',
    route: '/portaria',
    role: 'Agente de portão',
    title: 'Mesa da Portaria',
    desc: 'Chama a sala, valida o QR dinâmico de 30s, recebe alerta de irmãos separados e assina a entrega.',
  },
  {
    href: '/sala',
    code: '02',
    route: '/sala',
    role: 'Professor(a)',
    title: 'Terminal de Sala',
    desc: 'Filtra somente a turma atual e separa em tempo real quem deve descer para a baia.',
  },
  {
    href: '/responsavel',
    code: '03',
    route: '/responsavel',
    role: 'Família / Tutor',
    title: 'Passe do Responsável',
    desc: 'Avisa chegada com um toque, acompanha a chamada e exibe o QR anti-print na portaria.',
  },
  {
    href: '/telao',
    code: '04',
    route: '/telao',
    role: 'Pátio / Recepção',
    title: 'Telão de Alto Contraste',
    desc: 'Palco escuro em tela cheia com tipografia dimensionada para leitura a mais de 5 metros.',
  },
  {
    href: '/escola',
    code: '05',
    route: '/escola',
    role: 'Secretaria / Direção',
    title: 'Cadastro & Implantação',
    desc: 'Turmas, alunos, vínculo de contas de responsáveis, importação CSV e checklist guiado.',
  },
];

const priceTiers = [
  {
    code: 'GRÁTIS',
    band: 'Até 30 alunos',
    limit: 'Até 5 funcionários · fila ao vivo, QR 30s e relatório diário',
    price: 'R$ 0',
    period: '/mês para sempre',
    featured: false,
  },
  {
    code: 'TESTE 30D',
    band: 'Qualquer porte',
    limit: 'Todos os recursos do PRO liberados por 30 dias sem cartão',
    price: 'R$ 0',
    period: 'por 30 dias',
    featured: true,
  },
  {
    code: 'PRO · FAIXA A',
    band: 'Até 50 alunos',
    limit: 'Todos os módulos · múltiplos portões · telão · van · LGPD',
    price: 'R$ 89',
    period: '/mês fixo',
    featured: false,
  },
  {
    code: 'PRO · FAIXA B',
    band: '51 a 200 alunos',
    limit: 'Todos os módulos · até 50 funcionários · relatórios de pico',
    price: 'R$ 199',
    period: '/mês fixo',
    featured: false,
  },
  {
    code: 'PRO · FAIXA C',
    band: '201 a 2.000 alunos',
    limit: 'Operação de alto fluxo · condição de rede acima de 1.000',
    price: 'R$ 349',
    period: '/mês fixo',
    featured: false,
  },
];

export default function HomePage() {
  return (
    <main id="conteudo" tabIndex={-1} className="drb-home">
      {/* 1. PALCO EDITORIAL DRIBBBLE + COCKPIT INTERATIVO COM RADAR DE BAIAS */}
      <section className="drb-hero-stage">
        <div className="container container-wide">
          <div className="drb-masthead">
            <div className="drb-masthead-left">
              <div className="drb-pill-row">
                <span className="drb-pill-live">
                  <span className="drb-pulse-dot" aria-hidden="true" />
                  DESPACHO ESCOLAR CRIPTOGRAFADO
                </span>
                <span className="drb-pill-tech">SHA-256 · REDIS 30S · LGPD</span>
              </div>
              <h1 className="drb-display-title">
                A saída de alunos operada como{' '}
                <em className="editorial-serif">torre de controle</em>.
              </h1>
            </div>

            <div className="drb-masthead-right">
              <p className="drb-lead">
                Zero microfone no pátio, zero fila dupla na calçada e zero QR
                fixo clonado no WhatsApp. Da aproximação do carro até a assinatura
                criptográfica na grade, tudo sincronizado em tempo real.
              </p>
              <div className="drb-cta-cluster">
                <Link className="btn" href="/cadastro">
                  Criar conta da escola — Grátis
                </Link>
                <Link className="btn secondary" href="/planos">
                  Simular mensalidade
                </Link>
              </div>
            </div>
          </div>

          {/* O Cockpit interativo com Radar SVG + Cartão de Passe Tátil */}
          <HeroBoard />

          {/* Fita de telemetria acoplada à base do cockpit */}
          <dl className="drb-telemetry-strip" aria-label="Métricas operacionais">
            {telemetryRibbon.map((m) => (
              <div key={m.label} className="drb-tel-cell">
                <dd className="wb-mono drb-tel-val">{m.value}</dd>
                <dt className="drb-tel-lbl">{m.label}</dt>
                <span className="drb-tel-sub">{m.sub}</span>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 2. MOSAICO BENTO DE HARDWARE & TELEMETRIA (DRIBBBLE BENTO ARCHITECTURE) */}
      <section className="container container-wide drb-section">
        <header className="drb-sec-head">
          <div className="drb-sec-title-wrap">
            <span className="drb-sec-index">01 / ARQUITETURA DE CAMPO</span>
            <h2>Engenharia visual para os 25 minutos mais críticos do colégio</h2>
          </div>
          <p className="muted drb-sec-desc">
            Cada peça do TutorPass resolve uma falha real de segurança física na
            calçada — mostrada aqui com os próprios artefatos do sistema.
          </p>
        </header>

        <div className="drb-bento-grid">
          {/* Célula Bento 1 (8 colunas): Anti-Replay & QR de 30s */}
          <article className="drb-bento-card span-8 is-dark-accent">
            <div className="drb-bento-copy">
              <span className="drb-bento-tag">ANTI-FRAUDE · NONCE EFÊMERO</span>
              <h3>QR que expira em 30 segundos e bloqueia print de WhatsApp</h3>
              <p>
                Crachás plastificados ou códigos QR fixos permitem que qualquer
                pessoa com uma foto retire a criança. No TutorPass, o token nasce
                no Redis com TTL de 30s e é invalidado no milissegundo da
                primeira leitura.
              </p>
            </div>
            <div className="drb-bento-visual" aria-hidden="true">
              <div className="drb-terminal-compare">
                <div className="drb-tc-card is-ok">
                  <div className="drb-tc-top">
                    <span className="wb-mono">LEITURA #01 · PORTÃO A</span>
                    <span className="drb-tc-badge ok">200 · LIBERADO</span>
                  </div>
                  <div className="wb-mono drb-tc-code">NONCE: 84A2-91F (TTL 24s)</div>
                  <div className="drb-tc-foot">
                    Mariana Martins (Mãe) → Alice Martins (3º B)
                  </div>
                </div>
                <div className="drb-tc-card is-err">
                  <div className="drb-tc-top">
                    <span className="wb-mono">PRINT REPASSADO · +14s</span>
                    <span className="drb-tc-badge err">401 · QR_REJECTED</span>
                  </div>
                  <div className="wb-mono drb-tc-code">NONCE: 84A2-91F (CONSUMIDO)</div>
                  <div className="drb-tc-foot">
                    Alerta gravado no log de segurança da direção
                  </div>
                </div>
              </div>
            </div>
          </article>

          {/* Célula Bento 2 (4 colunas): Alerta de Irmãos Separados */}
          <article className="drb-bento-card span-4">
            <div className="drb-bento-copy">
              <span className="drb-bento-tag">MULTI-PORTÃO · SINCRONIA</span>
              <h3>Radar de irmãos em portões diferentes</h3>
              <p className="muted">
                Se um responsável tem filhos no Infantil e no Fundamental, o
                sistema cruza os portões ativos e alerta a portaria antes de
                alguém ficar esperando no portão errado.
              </p>
            </div>
            <div className="drb-sibling-widget" aria-hidden="true">
              <div className="drb-sw-head">
                <span className="drb-sw-dot" />
                <strong>CONFLITO DE PORTÃO DETECTADO</strong>
              </div>
              <div className="drb-sw-rows">
                <div className="drb-sw-row">
                  <span>Portão Principal</span>
                  <strong className="wb-mono">Alice M. (3º B)</strong>
                </div>
                <div className="drb-sw-row">
                  <span>Portão Infantil</span>
                  <strong className="wb-mono">Theo M. (Inf. IV)</strong>
                </div>
              </div>
              <span className="drb-sw-hint">
                Unificar entrega no Portão Infantil
              </span>
            </div>
          </article>

          {/* Célula Bento 3 (4 colunas): Cerca Virtual LGPD */}
          <article className="drb-bento-card span-4">
            <div className="drb-bento-copy">
              <span className="drb-bento-tag">GEOFENCING 2X · LGPD NATIVA</span>
              <h3>Dupla confirmação sem gravar o GPS da família</h3>
              <p className="muted">
                Exige 2 leituras consecutivas dentro do perímetro para confirmar
                chegada e descarta a coordenada exata na hora — privacidade
                total com atendimento ao art. 18 da LGPD.
              </p>
            </div>
            <div className="drb-geo-widget" aria-hidden="true">
              <div className="drb-geo-rings">
                <div className="drb-geo-r1">
                  <span>300m · 1ª leitura</span>
                  <div className="drb-geo-r2">
                    <span>150m · 2ª leitura ✓</span>
                    <div className="drb-geo-core">FILA ATIVA</div>
                  </div>
                </div>
              </div>
            </div>
          </article>

          {/* Célula Bento 4 (8 colunas): Cadeia SHA-256 & Credencial Física */}
          <article className="drb-bento-card span-8">
            <div className="drb-bento-split">
              <div className="drb-bento-copy">
                <span className="drb-bento-tag">PROVA JURÍDICA · CONTINGÊNCIA</span>
                <h3>Livro de custódia SHA-256 e cartão físico para avós</h3>
                <p className="muted">
                  Cada chamada, leitura de QR ou código impresso de 6 dígitos
                  (para portadores sem smartphone) gera um bloco assinado com o
                  hash do evento anterior. Qualquer adulteração no banco quebra
                  a verificação de integridade.
                </p>
              </div>
              <div className="drb-chain-widget" aria-hidden="true">
                <div className="drb-chain-node">
                  <span className="wb-mono drb-cn-id">BLOCO #0483 · VALIDATED</span>
                  <span className="wb-mono drb-cn-hash">hash: 4c127b09…ab10</span>
                </div>
                <div className="drb-chain-link">↓ encadeamento criptográfico</div>
                <div className="drb-chain-node is-latest">
                  <span className="wb-mono drb-cn-id">BLOCO #0484 · RELEASED</span>
                  <span className="wb-mono drb-cn-hash">prev: 4c127b09…ab10</span>
                  <span className="wb-mono drb-cn-sig">sha256: 9f3a8c12…e81c ✓</span>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* 3. DOCK DE TERMINAIS OPERACIONAIS (5 SUPERFÍCIES DEDICADAS) */}
      <section className="container container-wide drb-section">
        <header className="drb-sec-head">
          <div className="drb-sec-title-wrap">
            <span className="drb-sec-index">02 / ECOSSISTEMA AO VIVO</span>
            <h2>Cinco terminais dedicados, conectados ao mesmo núcleo</h2>
          </div>
          <p className="muted drb-sec-desc">
            Cada perfil entra direto na sua ferramenta de trabalho — sem menus
            administrativos poluindo a tela de quem está no portão ou na sala.
          </p>
        </header>

        <nav className="drb-terminal-dock" aria-label="Terminais do produto">
          {roleTerminals.map((t) => (
            <Link key={t.href} href={t.href} className="drb-dock-card">
              <div className="drb-dock-top">
                <span className="wb-mono drb-dock-num">{t.code}</span>
                <span className="wb-mono drb-dock-route">{t.route}</span>
              </div>
              <span className="drb-dock-role">{t.role}</span>
              <h3>{t.title}</h3>
              <p className="muted">{t.desc}</p>
              <span className="drb-dock-cta">Abrir terminal</span>
            </Link>
          ))}
        </nav>
      </section>

      {/* 4. MATRIZ COMERCIAL ABERTA (TRANSPARÊNCIA DE PREÇO POR FAIXA) */}
      <section className="container container-wide drb-section">
        <div className="drb-pricing-board">
          <div className="drb-pb-head">
            <div>
              <span className="drb-sec-index">03 / TABELA COMERCIAL PÚBLICA</span>
              <h2>Mensalidade fixa por faixa de alunos — sem &ldquo;sob consulta&rdquo;</h2>
              <p className="muted">
                Sem taxa de implantação e sem cobrança por responsável
                cadastrado. Comece grátis até 30 alunos ou ative 30 dias do PRO
                sem cartão.
              </p>
            </div>
            <div className="drb-pb-actions">
              <Link className="btn secondary" href="/cadastro">
                Criar conta grátis
              </Link>
              <Link className="btn secondary" href="/planos">
                Abrir calculadora de preço
              </Link>
            </div>
          </div>

          <div className="drb-tier-strip" role="list" aria-label="Faixas de preço">
            {priceTiers.map((t) => (
              <div
                key={t.code}
                role="listitem"
                className={`drb-tier-col${t.featured ? ' is-featured' : ''}`}
              >
                <span className="wb-mono drb-tier-code">{t.code}</span>
                <strong className="drb-tier-band">{t.band}</strong>
                <div className="drb-tier-price">
                  <span className="wb-mono">{t.price}</span>
                  <small>{t.period}</small>
                </div>
                <p className="muted">{t.limit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
