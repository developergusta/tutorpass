import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'TutorPass — saída escolar segura',
  description:
    'TutorPass: check-in/check-out e saída segura de alunos em escolas particulares, sem fila no drive-thru e com auditoria imutável.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="topbar">
          <Link className="logo" href="/">
            TutorPass
          </Link>
          <nav>
            <Link href="/planos">Planos</Link>
            <Link href="/login">Entrar</Link>
            <Link href="/portaria">Portaria</Link>
            <Link href="/telao">Telão</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
