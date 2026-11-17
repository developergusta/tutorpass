'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import {
  clearSession,
  isNeeds2fa,
  loadSession,
  login,
  saveSession,
  verify2fa,
  type LoginSuccess,
} from '../../lib/api';

type Phase =
  | { kind: 'form' }
  | { kind: '2fa'; twoFactorToken: string }
  | { kind: 'done'; session: LoginSuccess };

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'form' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [existing] = useState<LoginSuccess | null>(() =>
    typeof window === 'undefined' ? null : loadSession(),
  );

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await login(email.trim(), password);
      if (isNeeds2fa(result)) {
        setPhase({ kind: '2fa', twoFactorToken: result.twoFactorToken });
        return;
      }
      saveSession(result);
      setPhase({ kind: 'done', session: result });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar. Tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  async function onVerify2fa(e: FormEvent) {
    e.preventDefault();
    if (phase.kind !== '2fa') return;
    setBusy(true);
    setError(null);
    try {
      const session = await verify2fa(phase.twoFactorToken, code.trim());
      saveSession(session);
      setPhase({ kind: 'done', session });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Código não conferiu. Confira o aplicativo autenticador e tente de novo.',
      );
    } finally {
      setBusy(false);
    }
  }

  function onLogout() {
    clearSession();
    setPhase({ kind: 'form' });
    setPassword('');
    setCode('');
  }

  if (phase.kind === 'done') {
    return (
      <main className="container">
        <section className="card">
          <h1>Login feito ✅</h1>
          <p>
            Olá, <strong>{phase.session.user.name}</strong> ({phase.session.user.email}).
          </p>
          {phase.session.twoFactorSetupRequired ? (
            <p className="alert warn">
              Seu perfil exige verificação em duas etapas (2FA) e ela ainda não
              foi configurada. A configuração é feita na tela de Segurança —
              que entra numa próxima versão do web.
            </p>
          ) : null}
          <p style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link className="btn" href="/portaria">
              Abrir a portaria
            </Link>
            <Link className="btn secondary" href="/telao">
              Abrir o telão
            </Link>
            <button className="btn secondary" type="button" onClick={onLogout}>
              Sair
            </button>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="container">
      <section className="card" style={{ maxWidth: 480, margin: '24px auto' }}>
        <h1>Entrar no TutorPass</h1>

        {existing && phase.kind === 'form' ? (
          <p className="alert ok">
            Você já tem uma sessão neste navegador ({existing.user.email}).{' '}
            <Link href="/portaria">Ir para a portaria</Link> ou entre de novo abaixo.
          </p>
        ) : null}

        {error ? (
          <p className="alert error" role="alert">
            {error}
          </p>
        ) : null}

        {phase.kind === 'form' ? (
          <form onSubmit={onLogin}>
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@escola.com.br"
            />
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
            />
            <p style={{ marginTop: 20 }}>
              <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>
                {busy ? 'Entrando…' : 'Entrar'}
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={onVerify2fa}>
            <p>
              Sua conta usa verificação em duas etapas. Digite o código de 6
              dígitos do aplicativo autenticador (ou um código de recuperação).
            </p>
            <label htmlFor="code">Código de verificação</label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              minLength={6}
              maxLength={12}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
            />
            <p style={{ marginTop: 20, display: 'flex', gap: 12 }}>
              <button className="btn" type="submit" disabled={busy} style={{ flex: 1 }}>
                {busy ? 'Verificando…' : 'Verificar e entrar'}
              </button>
              <button
                className="btn secondary"
                type="button"
                onClick={() => {
                  setPhase({ kind: 'form' });
                  setCode('');
                  setError(null);
                }}
              >
                Voltar
              </button>
            </p>
          </form>
        )}

        <p className="muted">
          Ainda não tem conta?{' '}
          <Link href="/cadastro">Criar a conta da sua escola — grátis até 30 alunos</Link>
        </p>
        <p className="muted">
          Se o servidor estiver fora do ar, o erro aparece aqui em cima — a
          página não trava. Confira também se você está na rede certa da escola.
        </p>
      </section>
    </main>
  );
}
