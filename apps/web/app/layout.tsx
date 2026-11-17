import type { Metadata, Viewport } from 'next';
import { Inter, Open_Sans, Sora } from 'next/font/google';
import Link from 'next/link';
import Script from 'next/script';
import type { ReactNode } from 'react';
import AuthNav from '../components/AuthNav';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
// Fonte de display (títulos e marca) — passada anti-genérica/unslop de
// 17/11/2026: Inter em tudo era o sinal nº 1 de "template de IA".
const sora = Sora({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['500', '600', '700'],
});
// Open Sans: só o texto da Hero Section da home (pedido do usuário,
// 17/11/2026) — aplicada via .hero no globals.css.
const openSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-open-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TutorPass — saída escolar segura',
  description:
    'TutorPass: check-in/check-out e saída segura de alunos em escolas particulares, sem fila no drive-thru e com auditoria imutável.',
};

// Viewport com safe-area (revisão mobile, ciclo UI 6): `cover` deixa a
// página ir até sob o notch/barra de gestos e o CSS compensa com
// env(safe-area-inset-*) na topbar, no telão e no rodapé. Sem
// maximum-scale nem user-scalable=no — o zoom de pinça continua livre
// (o zoom automático do iOS em campo < 16 px já não acontece: todos os
// inputs têm 1rem).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

function LogoMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l7 3v5c0 4.5-3 8.1-7 10-4-1.9-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${sora.variable} ${openSans.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/* Tema claro/escuro: aplica o tema ANTES da primeira pintura
            (escolha salva em localStorage; sem escolha, o aparelho
            decide via prefers-color-scheme) — sem isso, quem usa o
            escuro veria um clarão branco a cada página. */}
        <Script id="tutorpass-theme-init" strategy="beforeInteractive">
          {`try{var t=localStorage.getItem('tutorpass.theme');if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='light';}`}
        </Script>
        {/* Umami (analytics próprio, sem cookies — kit essencial 17/11/2026).
            URL/id da era do IP; com domínio próprio, trocar p/ o subdomínio
            de analytics. */}
        <Script
          async
          src="http://187.53.122.5:3002/script.js"
          data-website-id="d5ab136f-d22f-4d49-9c8e-5c0725f52515"
          strategy="afterInteractive"
        />
        <header className="topbar">
          <Link className="logo" href="/">
            <span className="logo-mark">
              <LogoMark />
            </span>
            TutorPass
          </Link>
          <AuthNav />
        </header>
        {children}
        <footer className="footer">
          <div className="container footer-inner">
            <span>
              <strong>TutorPass</strong> — saída escolar segura, com auditoria imutável e LGPD
              desde o primeiro dia.
            </span>
            {/* Sem menu aqui (pedido do usuário, 17/11/2026): o rodapé
                repetia a navegação inteira da topbar. Fica só a marca
                e o ano — navegação é trabalho do topo. */}
            <span>© 2026 TutorPass</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
