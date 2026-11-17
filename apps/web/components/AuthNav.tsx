'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  loadSession,
  logout,
  refreshSession,
  type LoginSuccess,
} from '../lib/api';
import ThemeToggle from './ThemeToggle';

function BurgerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

// Navegação da topbar ciente da sessão: sem login, mostra Entrar/Criar
// conta; logado, mostra quem é (avatar com inicial + primeiro nome) e o
// botão Sair — em todas as páginas, não só na tela de login. Ao montar
// sem sessão local, tenta o cookie de refresh (a sessão sobrevive a
// fechar a aba, porque o access token é que era só de sessão).
// No mobile (≤720 px) a navegação vira menu hambúrguer (pedido do
// usuário, 17/11/2026): botão de 44 px abre o painel com os mesmos
// links em linhas cheias; fecha ao tocar num link, ao trocar de rota
// e com Esc. No desktop o botão some e a linha é a de sempre.
export default function AuthNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<LoginSuccess | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  // Trocar de página fecha o menu (o clique no link já fecha; isto
  // cobre navegação por outros meios — voltar do navegador, redirect).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open ]);

  useEffect(() => {
    let alive = true;
    const sync = () => {
      if (alive) setSession(loadSession());
    };
    const local = loadSession();
    if (local) {
      setSession(local);
      setReady(true);
    } else {
      void refreshSession().then(() => {
        sync();
        if (alive) setReady(true);
      });
    }
    window.addEventListener('tutorpass:session', sync);
    return () => {
      alive = false;
      window.removeEventListener('tutorpass:session', sync);
    };
  }, []);

  async function onLogout() {
    await logout();
    setSession(null);
    setOpen(false);
    router.push('/');
  }

  const displayName = session
    ? session.user.name?.trim() || session.user.email
    : '';

  return (
    <>
      <ThemeToggle />
      <button
        className="nav-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="topnav-menu"
        aria-label={open ? 'Fechar menu' : 'Abrir menu'}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <CloseIcon /> : <BurgerIcon />}
      </button>
      <nav
        id="topnav-menu"
        className={open ? 'nav-open' : undefined}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a')) setOpen(false);
        }}
      >
        <Link href="/planos">Planos</Link>
        <Link href="/portaria">Portaria</Link>
        <Link href="/telao">Telão</Link>
        {session ? (
          <>
            <Link href="/escola">Escola</Link>
            <span className="nav-user" title={`Logado como ${session.user.email}`}>
              <span className="nav-avatar" aria-hidden="true">
                {displayName.charAt(0).toUpperCase()}
              </span>
              <span className="nav-user-name">{displayName.split(' ')[0]}</span>
            </span>
            <button className="btn secondary small" type="button" onClick={onLogout}>
              Sair
            </button>
          </>
        ) : ready ? (
          <>
            <Link href="/cadastro">Criar conta</Link>
            <Link href="/login">Entrar</Link>
          </>
        ) : null}
      </nav>
    </>
  );
}
