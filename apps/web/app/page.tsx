import Link from 'next/link';
import type { ReactNode } from 'react';
import HeroBoard from '../components/HeroBoard';
import Reveal from '../components/Reveal';

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
    text: 'Exige 2 leituras consecutivas na zona de chegada antes de acionar a chamada — evita alarmes falsos de quem só passou na rua.',
  },
  {
    icon: iconQueue,
    title: 'Múltiplos portões e alerta de irmãos separados',
    text: 'Cada portão opera sua própria fila ao vivo, mas o painel avisa na hora se dois filhos do mesmo responsável caírem em portões diferentes.',
  },
  {
    icon: iconTv,
    title: 'Modo Telão para TV e tag impressa sem smartphone',
    text: 'Painel de alto contraste sem rolagem para a TV do pátio e cartão com código de 6 dígitos para avós ou portadores autorizados.',
  },
  {
    icon: iconLock,
    title: 'Governança LGPD nativa para escolas',
    text: 'Sem armazenamento de coordenadas brutas de GPS, atendimento ao art. 18/19 no painel e registro de incidentes com prazo ANPD.',
  },
];

const steps = [
  {
    n: '01',
    tag: 'Responsável · App ou Web',
    title: 'O responsável avisa que está chegando',
    text: 'Com um toque em /responsavel (ou por aproximação na cerca virtual), os filhos entram na fila do portão certo e a escola recebe o ETA em tempo real.',
  },
  {
    n: '02',
    tag: 'Portaria, Sala e Telão',
    title: 'A sala libera apenas quem já está no portão',
    text: 'A professora vê na tela da turma (/sala) quem acabou de ser chamado e para qual portão encaminhar — sem microfone gritando no pátio.',
  },
  {
    n: '03',
    tag: 'Validação e Auditoria',
    title: 'QR de 30 s validado e entrega gravada',
    text: 'O agente confere o QR dinâmico (ou código impresso), libera o aluno e o evento entra na cadeia SHA-256 à prova de adulteração.',
  },
];

const roleViews = [
  {
    href: '/portaria',
    role: 'Agente de portão',
    title: 'Portaria ao vivo',
    desc: 'Chama o aluno, valida o QR dinâmico e confirma a retirada por portão.',
    icon: iconGate,
  },
  {
    href: '/sala',
    role: 'Professor(a)',
    title: 'Visão de sala',
    desc: 'Filtra pela turma e destaca quem já deve descer para o portão.',
    icon: iconClassroom,
  },
  {
    href: '/responsavel',
    role: 'Família / Tutor',
    title: 'Área do responsável',
    desc: 'Avisa "Estou chegando", acompanha a posição e exibe o QR de 30 s.',
    icon: iconFamily,
  },
  {
    href: '/telao',
    role: 'Pátio / Recepção',
    title: 'Telão para TV',
    desc: 'Duas colunas de alto contraste legíveis a metros de distância.',
    icon: iconTv,
  },
  {
    href: '/escola',
    role: 'Secretaria / Direção',
    title: 'Cadastro e implantação',
    desc: 'Turmas, alunos, responsáveis, importação CSV e checklist de 53 min.',
    icon: iconSchool,
  },
];

const priceTiers = [
  { band: 'Até 30 alunos', detail: 'Para testar ou operar escolas pequenas', price: 'Grátis' },
  { band: 'Até 50 alunos', detail: 'Todos os módulos + múltiplos portões', price: 'R$ 89/mês' },
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
              Operação de saída escolar · Tempo real &amp; cadeia SHA-256
            </p>
            <h1>
              A saída da escola sem fila, com cada retirada provada
            </h1>
            <p className="hero-sub">
              O responsável avisa que está chegando, a sala recebe o chamado silencioso na
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
                <dt>Janela do QR</dt>
                <dd>30 s · uso único</dd>
              </div>
              <div>
                <dt>Implantação</dt>
                <dd>53 min via CSV</dd>
              </div>
              <div>
                <dt>Entrada</dt>
                <dd>Grátis até 30 alunos</dd>
              </div>
            </dl>
          </div>
          <HeroBoard />
        </div>
      </section>

      <section className="container section home-section">
        <div className="section-header">
          <p className="section-eyebrow">Fluxo operacional</p>
          <h2 className="section-title">Três movimentos, zero improviso na calçada</h2>
          <p className="muted section-lead">
            Cada perfil enxerga apenas o que precisa para agir em segundos — do celular dos
            pais até o painel da portaria.
          </p>
        </div>
        <div className="steps">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 80}>
              <article className="step-card">
                <div className="step-card-top">
                  <span className="step-n">{s.n}</span>
                  <span className="step-tag">{s.tag}</span>
                </div>
                <h3>{s.title}</h3>
                <p className="muted">{s.text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container section home-section">
        <div className="section-header">
          <p className="section-eyebrow">Segurança e precisão</p>
          <h2 className="section-title">Feito para o horário mais crítico do dia</h2>
        </div>

        <div className="spotlight-grid">
          <Reveal>
            <article className="spotlight-card">
              <div className="spotlight-head">
                <span className="f-icon">{iconQr}</span>
                <div>
                  <h3>QR dinâmico anti-fraude</h3>
                  <p className="muted">
                    Renovado a cada 30 segundos com nonce criptográfico no Redis. Print de
                    WhatsApp ou código já lido é bloqueado na hora e gera alerta no log.
                  </p>
                </div>
              </div>
              <div className="specimen-box" aria-hidden="true">
                <div className="specimen-row is-valid">
                  <span className="specimen-code">NONCE #84A2 · 00:24</span>
                  <span className="specimen-pill ok">1ª leitura · Liberado</span>
                </div>
                <div className="specimen-row is-blocked">
                  <span className="specimen-code">PRINT REPASSADO · #84A2</span>
                  <span className="specimen-pill err">401 · QR_REJECTED</span>
                </div>
              </div>
            </article>
          </Reveal>

          <Reveal delay={80}>
            <article className="spotlight-card">
              <div className="spotlight-head">
                <span className="f-icon">{iconShield}</span>
                <div>
                  <h3>Cadeia de custódia imutável</h3>
                  <p className="muted">
                    Cada chamada, validação e liberação calcula um hash SHA-256 ligado ao
                    evento anterior. Qualquer tentativa de edição quebra a verificação.
                  </p>
                </div>
              </div>
              <div className="specimen-box" aria-hidden="true">
                <div className="specimen-row">
                  <span className="specimen-code">evt_481 · VALIDATED</span>
                  <span className="specimen-hash">prev: 4c12…b09a</span>
                </div>
                <div className="specimen-row is-valid">
                  <span className="specimen-code">evt_482 · RELEASED</span>
                  <span className="specimen-hash">sha256: 9f3a…e81c ✓</span>
                </div>
              </div>
            </article>
          </Reveal>
        </div>

        <div className="feature-list">
          {ledgerFeatures.map((f, i) => (
            <Reveal key={f.title} delay={Math.min(i, 3) * 60}>
              <div className="feature-row">
                <span className="f-icon">{f.icon}</span>
                <div>
                  <h3>{f.title}</h3>
                  <p className="muted">{f.text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container section home-section">
        <div className="section-header">
          <p className="section-eyebrow">Acesso direto às telas</p>
          <h2 className="section-title">Cinco visões conectadas em tempo real</h2>
          <p className="muted section-lead">
            Navegue pelas interfaces operacionais reais do TutorPass para cada papel da
            escola e da família.
          </p>
        </div>
        <nav className="role-grid" aria-label="Visões operacionais do produto">
          {roleViews.map((v, i) => (
            <Reveal key={v.href} delay={Math.min(i, 4) * 60}>
              <Link className="role-card" href={v.href}>
                <div className="role-card-top">
                  <span className="q-icon">{v.icon}</span>
                  <span className="role-tag">{v.role}</span>
                  <span className="q-arrow" aria-hidden="true">
                    →
                  </span>
                </div>
                <h3>{v.title}</h3>
                <p className="muted">{v.desc}</p>
              </Link>
            </Reveal>
          ))}
        </nav>
      </section>

      <section className="container section home-section">
        <Reveal>
          <div className="cta-band cta-split">
            <div className="cta-copy">
              <p className="section-eyebrow">Transparência comercial</p>
              <h2>Preço publicado, fixo por faixa e sem surpresa</h2>
              <p>
                Sem taxa de implantação e sem cobrar por responsável cadastrado. Comece no
                plano gratuito ou ative 30 dias de teste completo do PRO sem cartão.
              </p>
              <div className="cta-actions">
                <Link className="btn btn-hero" href="/planos">
                  Abrir calculadora de planos
                </Link>
                <Link className="btn secondary" href="/login">
                  Já tenho conta
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
        </Reveal>
      </section>
    </main>
  );
}
