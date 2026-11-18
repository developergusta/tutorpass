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

const iconLogin = (
  <Icon>
    <path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" />
    <path d="M3 12h11M10 8l4 4-4 4" />
  </Icon>
);

const iconGate = (
  <Icon>
    <path d="M5 21V8l7-4 7 4v13" />
    <path d="M2 21h20" />
    <path d="M10 21v-5h4v5" />
  </Icon>
);

const features = [
  {
    icon: iconQr,
    title: 'QR dinâmico anti-fraude',
    text: 'Código novo a cada 30 segundos, de uso único. Print de tela e código repassado não funcionam.',
  },
  {
    icon: iconRadar,
    title: 'Geofencing no servidor',
    text: 'A fila anda por proximidade real: quem está chegando entra na ordem certa, sem depender do “avisei no grupo”.',
  },
  {
    icon: iconShield,
    title: 'Auditoria imutável',
    text: 'Cada retirada vira um registro encadeado por hash, impossível de alterar sem deixar rastro. Prova para a escola e para a família.',
  },
  {
    icon: iconQueue,
    title: 'Fila em tempo real',
    text: 'Portaria, sala e telão enxergam a mesma fila ao vivo — por portão, com irmãos sinalizados entre portões diferentes.',
  },
  {
    icon: iconLock,
    title: 'LGPD levado a sério',
    text: 'Consentimento por finalidade, direitos do titular (art. 18/19) dentro do produto e relatório de conformidade pronto para o DPA.',
  },
  {
    icon: iconTv,
    title: 'Telão e tag impressa',
    text: 'TV da escola com letras grandes e cartão impresso com código para o responsável que não usa smartphone.',
  },
];

const steps = [
  {
    n: '1',
    title: 'O tutor avisa',
    text: 'Pelo app, o responsável entra na fila ao se aproximar da escola — o geofencing confirma que ele está vindo de verdade.',
  },
  {
    n: '2',
    title: 'A escola chama',
    text: 'A portaria vê a fila ao vivo, por portão, e chama o aluno na hora certa. Nada de criança esperando no sol nem carro parado em fila dupla.',
  },
  {
    n: '3',
    title: 'A saída é registrada',
    text: 'QR dinâmico validado, aluno entregue e tudo gravado no log imutável: quem retirou, quando e por qual portão.',
  },
];

export default function HomePage() {
  return (
    <main id="conteudo" tabIndex={-1}>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <h1>
              A saída da escola sem fila,
              <br />
              com cada retirada registrada
            </h1>
            <p className="hero-sub">
              O tutor avisa que está chegando, a portaria chama o aluno na hora certa e
              cada retirada fica registrada num log de auditoria imutável.
            </p>
            <div className="hero-ctas">
              <Link className="btn btn-hero" href="/planos">
                Ver planos e preços
              </Link>
              <Link className="btn btn-hero-ghost" href="/cadastro">
                Criar conta grátis
              </Link>
            </div>
            <ul className="hero-proof">
              <li>QR dinâmico anti-fraude</li>
              <li>Implantação em 1 dia</li>
              <li>Grátis até 30 alunos</li>
            </ul>
          </div>
          <HeroBoard />
        </div>
      </section>

      <section className="container section">
        <h2 className="section-title">Como funciona</h2>
        <div className="steps">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 80}>
              <div className="card step">
                <span className="step-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p className="muted">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container section">
        <h2 className="section-title">Feito para a hora da saída</h2>
        <div className="feature-list">
          {features.map((f, i) => (
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

      <section className="container section">
        <h2 className="section-title">Acesso rápido</h2>
        <nav className="quick-links">
          <Reveal>
          <Link className="quick-link" href="/login">
            <span className="q-icon">{iconLogin}</span>
            <span>
              <h3>Entrar</h3>
              <p className="muted">Acesso da equipe da escola, com 2FA quando ativo.</p>
            </span>
            <span className="q-arrow" aria-hidden="true">
              →
            </span>
          </Link>
          </Reveal>
          <Reveal delay={80}>
          <Link className="quick-link" href="/portaria">
            <span className="q-icon">{iconGate}</span>
            <span>
              <h3>Portaria</h3>
              <p className="muted">Fila de saída ao vivo: quem já pode retirar e quem está a caminho.</p>
            </span>
            <span className="q-arrow" aria-hidden="true">
              →
            </span>
          </Link>
          </Reveal>
          <Reveal delay={160}>
          <Link className="quick-link" href="/telao">
            <span className="q-icon">{iconTv}</span>
            <span>
              <h3>Telão</h3>
              <p className="muted">Tela para a TV da escola, com letras grandes e as colunas da saída.</p>
            </span>
            <span className="q-arrow" aria-hidden="true">
              →
            </span>
          </Link>
          </Reveal>
        </nav>
      </section>

      <section className="container section">
        <Reveal>
        <div className="cta-band">
          <h2>Preço simples, publicado e sem surpresa</h2>
          <p>
            Grátis até 30 alunos. Depois, mensalidade fixa por faixa: R$ 89 até 50 alunos,
            R$ 199 até 200 e R$ 349 acima de 200 — com 30 dias grátis para testar tudo.
          </p>
          <Link className="btn btn-hero" href="/planos">
            Conhecer os planos
          </Link>
        </div>
        </Reveal>
      </section>
    </main>
  );
}
