import Link from 'next/link';
import type { ReactNode } from 'react';
import HeroBoard from '../components/HeroBoard';

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const iconQr = (
  <Icon>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <path d="M14 14h3v3h-3zM21 14v.01M14 21v.01M18 18h3v3h-3z" />
  </Icon>
);

const iconRadar = (
  <Icon>
    <circle cx="12" cy="12" r="2" />
    <path d="M12 10V4M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" />
  </Icon>
);

const iconShield = (
  <Icon>
    <path d="M12 3l7 3v5c0 4.5-3 8.1-7 10-4-1.9-7-5.5-7-10V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </Icon>
);

const iconQueue = (
  <Icon>
    <path d="M4 6h16M4 12h16M4 18h10" />
    <path d="M18 17l1.5 1.5L22 16" transform="translate(-2 1)" />
  </Icon>
);

const iconLock = (
  <Icon>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    <circle cx="12" cy="15.5" r="1.4" />
  </Icon>
);

const iconTv = (
  <Icon>
    <rect x="3" y="5" width="18" height="12" rx="2" />
    <path d="M9 21h6" />
  </Icon>
);

const iconGate = (
  <Icon>
    <path d="M5 21V8l7-4 7 4v13" />
    <path d="M2 21h20" />
    <path d="M10 21v-5h4v5" />
  </Icon>
);

const iconClassroom = (
  <Icon>
    <path d="M4 5h16v11H4z" />
    <path d="M8 20h8M12 16v4" />
  </Icon>
);

const iconFamily = (
  <Icon>
    <circle cx="9" cy="7" r="3" />
    <path d="M3 20v-1a5 5 0 0 1 10 0v1" />
    <circle cx="17" cy="9" r="2.2" />
    <path d="M15 20v-1a3.5 3.5 0 0 1 6 0v1" />
  </Icon>
);

const iconSchool = (
  <Icon>
    <path d="M12 3L2 8l10 5 10-5-10-5z" />
    <path d="M6 10.5V17c0 1.7 2.7 3 6 3s6-1.3 6-3v-6.5" />
  </Icon>
);

const ledgerFeatures = [
  {
    icon: iconRadar,
    title: 'Geofencing com dupla confirmação no servidor',
    text: 'Exige duas leituras consecutivas dentro do raio da escola antes de acionar a chamada. Evita alarmes falsos de quem apenas passou pela rua.',
  },
  {
    icon: iconQueue,
    title: 'Múltiplos portões e alerta de irmãos separados',
    text: 'Cada portão opera sua própria fila ao vivo, mas o painel avisa na hora se dois filhos do mesmo responsável caírem em portões diferentes.',
  },
  {
    icon: iconTv,
    title: 'Modo Telão para TV e credencial impressa',
    text: 'Painel de alto contraste sem rolagem para a TV do pátio e cartão com código de 6 dígitos para avós ou portadores autorizados sem smartphone.',
  },
  {
    icon: iconLock,
    title: 'Governança LGPD nativa para escolas',
    text: 'Sem armazenamento de coordenadas brutas de GPS, atendimento aos artigos 18 e 19 direto no painel e registro de incidentes com prazo ANPD.',
  },
];

const steps = [
  {
    n: '01',
    actor: 'Responsável no celular',
    title: 'O responsável avisa que está chegando',
    text: 'Com um toque na área do responsável (ou por aproximação na cerca virtual), os filhos entram na fila do portão certo e a escola recebe a estimativa em tempo real.',
  },
  {
    n: '02',
    actor: 'Sala de aula e pátio',
    title: 'A sala libera apenas quem já está no portão',
    text: 'A professora vê na tela da turma quem acabou de ser chamado e para qual portão encaminhar — sem microfone gritando no pátio nem alunos acumulados na grade.',
  },
  {
    n: '03',
    actor: 'Portaria e livro de custódia',
    title: 'QR de 30 s validado e entrega gravada',
    text: 'O agente confere o QR dinâmico (ou código impresso), libera o aluno e o evento entra na cadeia SHA-256 à prova de adulteração.',
  },
];

const roleViews = [
  {
    href: '/portaria',
    role: 'Agente de portão',
    route: '/portaria',
    title: 'Portaria ao vivo',
    desc: 'Chama o aluno, valida o QR dinâmico e confirma a retirada por portão.',
    icon: iconGate,
  },
  {
    href: '/sala',
    role: 'Professor(a)',
    route: '/sala',
    title: 'Visão de sala',
    desc: 'Filtra pela turma e destaca quem já deve descer para o portão.',
    icon: iconClassroom,
  },
  {
    href: '/responsavel',
    role: 'Família / Tutor',
    route: '/responsavel',
    title: 'Área do responsável',
    desc: 'Avisa "Estou chegando", acompanha a posição e exibe o QR de 30 s.',
    icon: iconFamily,
  },
  {
    href: '/telao',
    role: 'Pátio / Recepção',
    route: '/telao',
    title: 'Telão para TV',
    desc: 'Duas colunas de alto contraste legíveis a mais de 5 metros de distância.',
    icon: iconTv,
  },
  {
    href: '/escola',
    role: 'Secretaria / Direção',
    route: '/escola',
    title: 'Cadastro e implantação',
    desc: 'Turmas, alunos, responsáveis, importação CSV e checklist de implantação.',
    icon: iconSchool,
  },
];

const priceTiers = [
  { band: 'Até 30 alunos', detail: 'Para testar ou operar escolas pequenas', price: 'Grátis' },
  { band: 'Até 50 alunos', detail: 'Todos os módulos e múltiplos portões', price: 'R$ 89/mês' },
  { band: '51 a 200 alunos', detail: 'Telão de TV, relatórios e LGPD completo', price: 'R$ 199/mês' },
  { band: 'Acima de 200 alunos', detail: 'Operação de alto fluxo até 1.000 alunos', price: 'R$ 349/mês' },
];

export default function HomePage() {
  return (
    <main id="conteudo" tabIndex={-1}>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <p className="hero-kicker">
              Despacho de saída escolar em tempo real
            </p>
            <h1>
              A saída da escola sem fila na calçada, com cada entrega provada
            </h1>
            <p className="hero-sub">
              O responsável avisa que está a caminho, a sala recebe o chamado silencioso na
              hora exata e a portaria só entrega a criança após validar o QR dinâmico de uso
              único.
            </p>
            <div className="hero-ctas">
              <Link className="btn btn-hero" href="/cadastro">
                Começar grátis em 1 dia
              </Link>
              <Link className="btn btn-hero-ghost" href="/planos">
                Simular mensalidade
              </Link>
            </div>
            <dl className="hero-metrics">
              <div>
                <dt>Validade do QR</dt>
                <dd>30 s (uso único)</dd>
              </div>
              <div>
                <dt>Implantação</dt>
                <dd>53 min via CSV</dd>
              </div>
              <div>
                <dt>Faixa inicial</dt>
                <dd>R$ 0 até 30 alunos</dd>
              </div>
            </dl>
          </div>
          <HeroBoard />
        </div>
      </section>

      <section className="container section home-section">
        <div className="section-header">
          <h2 className="section-title">Três movimentos da calçada até a entrega</h2>
          <p className="muted section-lead">
            Cada pessoa vê somente a fila e o comando que precisa para agir em segundos — do
            celular da família até o tablet da portaria.
          </p>
        </div>
        <ol className="protocol-ledger">
          {steps.map((s) => (
            <li key={s.n} className="protocol-item">
              <div className="protocol-top">
                <span className="step-n">{s.n}</span>
                <span className="step-tag">{s.actor}</span>
              </div>
              <h3>{s.title}</h3>
              <p className="muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container section home-section">
        <div className="section-header">
          <h2 className="section-title">Feito para os 25 minutos mais críticos do dia</h2>
          <p className="muted section-lead">
            Verificação criptográfica na portaria e cadeia de custódia verificável para
            proteger o aluno, a família e a direção da escola.
          </p>
        </div>

        <div className="spotlight-grid">
          <article className="spotlight-card">
            <div className="spotlight-head">
              <span className="f-icon">{iconQr}</span>
              <div>
                <h3>QR dinâmico anti-fraude</h3>
                <p className="muted">
                  Renovado a cada 30 segundos com nonce criptográfico no servidor. Captura
                  de tela encaminhada por mensagem ou código já lido é recusado na hora.
                </p>
              </div>
            </div>
            <div className="specimen-box" aria-hidden="true">
              <div className="specimen-row is-valid">
                <span className="specimen-code">NONCE #84A2 [00:24]</span>
                <span className="specimen-pill ok">1ª leitura · Liberado</span>
              </div>
              <div className="specimen-row is-blocked">
                <span className="specimen-code">REPLAY #84A2 [captura]</span>
                <span className="specimen-pill err">401 · QR_REJECTED</span>
              </div>
            </div>
          </article>

          <article className="spotlight-card">
            <div className="spotlight-head">
              <span className="f-icon">{iconShield}</span>
              <div>
                <h3>Cadeia de custódia imutável</h3>
                <p className="muted">
                  Cada chamada, validação e liberação grava um hash SHA-256 encadeado ao
                  evento anterior. Qualquer alteração manual invalida a auditoria.
                </p>
              </div>
            </div>
            <div className="specimen-box" aria-hidden="true">
              <div className="specimen-row">
                <span className="specimen-code">evt_0481 VALIDATED</span>
                <span className="specimen-hash">prev: 4c12…b09a</span>
              </div>
              <div className="specimen-row is-valid">
                <span className="specimen-code">evt_0482 RELEASED</span>
                <span className="specimen-hash">sha256: 9f3a…e81c</span>
              </div>
            </div>
          </article>
        </div>

        <div className="feature-list">
          {ledgerFeatures.map((f) => (
            <div className="feature-row" key={f.title}>
              <span className="f-icon">{f.icon}</span>
              <div>
                <h3>{f.title}</h3>
                <p className="muted">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container section home-section">
        <div className="section-header">
          <h2 className="section-title">Cinco terminais conectados à mesma fila</h2>
          <p className="muted section-lead">
            Abra diretamente qualquer visão operacional do sistema para testar o fluxo de
            ponta a ponta.
          </p>
        </div>
        <nav className="dispatch-directory" aria-label="Visões operacionais do produto">
          {roleViews.map((v) => (
            <Link key={v.href} className="dispatch-row" href={v.href}>
              <div className="dispatch-row-id">
                <span className="q-icon">{v.icon}</span>
                <div>
                  <span className="role-tag">{v.role}</span>
                  <h3>{v.title}</h3>
                </div>
              </div>
              <p className="muted dispatch-row-desc">{v.desc}</p>
              <span className="dispatch-row-route">{v.route}</span>
            </Link>
          ))}
        </nav>
      </section>

      <section className="container section home-section">
        <div className="cta-band cta-split">
          <div className="cta-copy">
            <h2>Mensalidade fixa por faixa de alunos, publicada na página</h2>
            <p>
              Sem taxa de implantação e sem cobrança por responsável cadastrado. Comece no
              plano gratuito até 30 alunos ou ative 30 dias de teste do PRO sem cartão.
            </p>
            <div className="cta-actions">
              <Link className="btn btn-hero" href="/planos">
                Abrir calculadora de planos
              </Link>
              <Link className="btn secondary" href="/login">
                Entrar na minha escola
              </Link>
            </div>
          </div>
          <dl className="cta-ledger" aria-label="Faixas de preço mensal">
            {priceTiers.map((t) => (
              <div className="cta-ledger-row" key={t.band}>
                <dt>
                  <strong>{t.band}</strong>
                  <span>{t.detail}</span>
                </dt>
                <dd>{t.price}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </main>
  );
}
