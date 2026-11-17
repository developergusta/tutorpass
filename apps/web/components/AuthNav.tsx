'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  loadSession,
  logout,
  refreshSession,
  type LoginSuccess,
} from '../lib/api';

// Navegação da topbar ciente da sessão: sem login, mostra Entrar/Criar
// conta; logado, mostra quem é (avatar com inicial + primeiro nome) e o
// botão Sair — em todas as páginas, não só na tela de login. Ao montar
// sem sessão local, tenta o cookie de refresh (a sessão sobrevive a
// fechar a aba, porque o access token é que era só de sessão).
export default function AuthNav() {
  const router = useRouter();
  const [session, setSession] = useState<LoginSuccess | null>(null);
  const [ready, setReady] = useState(false);

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
    router.push('/');
  }

  const displayName = session
    ? session.user.name?.trim() || session.user.email
    : '';

  return (
    <nav>
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
  );
}
