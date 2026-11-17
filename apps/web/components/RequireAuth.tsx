'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { loadSession, refreshSession } from '../lib/api';

type State = 'checking' | 'ok' | 'out';

// Guarda das telas da equipe (portaria e telão): sem sessão válida, nada
// de fila vazia e confusa — a tela explica e leva ao login. Com sessão,
// renova o access token (15 min) a cada 10 min, porque essas telas ficam
// abertas a tarde inteira na escola.
export default function RequireAuth({
  children,
  area,
}: {
  children: ReactNode;
  area: string;
}) {
  const [state, setState] = useState<State>('checking');

  useEffect(() => {
    let alive = true;
    async function check() {
      if (loadSession()) {
        if (alive) setState('ok');
        return;
      }
      const session = await refreshSession();
      if (alive) setState(session ? 'ok' : 'out');
    }
    void check();
    const id = setInterval(() => {
      void refreshSession();
    }, 10 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (state === 'ok') return <>{children}</>;

  return (
    <main className="auth-wrap">
      <section className="card auth-card auth-success">
        <h1>{state === 'checking' ? 'Verificando sua sessão…' : 'Você precisa entrar'}</h1>
        <p>
          {state === 'checking'
            ? 'Um instante — conferindo se você já está logado neste aparelho.'
            : `A tela de ${area} só aparece para a equipe da escola logada. Entre com o e-mail e a senha da escola para continuar.`}
        </p>
        {state === 'out' ? (
          <div className="auth-actions">
            <Link className="btn" href="/login">
              Entrar no TutorPass
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
