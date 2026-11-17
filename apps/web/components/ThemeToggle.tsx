'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 13.2A8.5 8.5 0 0 1 10.8 4 8.5 8.5 0 1 0 20 13.2z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

// Botão de tema claro/escuro da topbar (pedido do usuário, 17/11/2026).
// O tema inicial é aplicado por um script no layout ANTES da pintura
// (localStorage 'tutorpass.theme'; sem escolha salva, vale o
// prefers-color-scheme do aparelho) — este botão só lê o estado atual
// do <html data-theme> e alterna, salvando a escolha da pessoa.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(
      document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
    );
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('tutorpass.theme', next);
    } catch {
      // Sem localStorage (modo privado antigo): o tema vale só p/ a sessão.
    }
    setTheme(next);
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggle}
      aria-label={
        theme === 'dark' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'
      }
      title={
        theme === 'dark' ? 'Tema claro' : 'Tema escuro'
      }
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
