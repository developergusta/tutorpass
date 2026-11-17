'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import {
  isNeeds2fa,
  loadSession,
  login,
  logout,
  saveSession,
  verify2fa,
  type LoginSuccess,
} from '../../lib/api';

type Phase =
  | { kind: 'form' }
  | { kind: '2fa'; twoFactorToken: string }
  | { kind: 'done'; session: LoginSuccess };

function EyeIcon({ off }: { off?: boolean }) {
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
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
      {off ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}

function CheckIcon() {
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
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

function ShieldIcon() {
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

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'form' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<LoginSuccess | null>(() =>
    typeof window === 'undefined' ? null : loadSession(),
  );

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // A senha volta a ficar oculta ao enviar, para o navegador não
    // guardar o valor visível no autocompletar (WCAG 3.3.8 / NIST).
    setShowPassword(false);
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

  async function onLogout() {
    // Logout de verdade: revoga a sessão na API (cookie de refresh) e não
    // só o sessionStorage desta aba.
    await logout();
    setExisting(null);
    setPhase({ kind: 'form' });
    setPassword('');
    setCode('');
  }

  if (phase.kind === 'done') {
    return (
      <main className="auth-wrap">
        <section className="card auth-card auth-success">
          <span className="auth-success-icon">
            <CheckIcon />
          </span>
          <h1>Login feito</h1>
          <p>
            Olá, <strong>{phase.session.user.name}</strong> ({phase.session.user.email}).
          </p>
          {phase.session.twoFactorSetupRequired ? (
            <p className="alert warn">
              Seu perfil exige verificação em duas etapas (2FA) e ela ainda não
              foi configurada.{' '}
              <Link href="/seguranca">Configure o 2FA na tela de Segurança</Link>.
            </p>
          ) : null}
          <div className="auth-actions">
            <Link className="btn" href="/portaria">
              Abrir a portaria
            </Link>
            <Link className="btn secondary" href="/telao">
              Abrir o telão
            </Link>
            <button className="btn secondary" type="button" onClick={onLogout}>
              Sair
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-wrap">
      <section className="card auth-card">
        <div className="auth-brand">
          <span className="logo-mark">
            <ShieldIcon />
          </span>
          <h1>{phase.kind === '2fa' ? 'Verificação em duas etapas' : 'Entrar no TutorPass'}</h1>
          <p>
            {phase.kind === '2fa'
              ? 'Sua conta usa 2FA. Digite o código do aplicativo autenticador.'
              : 'Acesso da equipe da escola — portaria, sala e gestão.'}
          </p>
        </div>

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
            <div className="field">
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
            </div>
            <div className="field">
              <label htmlFor="password">Senha</label>
              <div className="input-wrap">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                />
                <button
                  className="input-toggle"
                  type="button"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <EyeIcon off={showPassword} />
                </button>
              </div>
            </div>
            <p style={{ marginTop: 20 }}>
              <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>
                {busy ? 'Entrando…' : 'Entrar'}
              </button>
            </p>
            <p className="auth-foot">
              <Link href="/esqueci-senha">Esqueci minha senha</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={onVerify2fa}>
            <div className="field">
              <label htmlFor="code">Código de verificação</label>
              <input
                id="code"
                className="code-input"
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
              <p className="hint">
                Código de 6 dígitos do aplicativo autenticador — ou um código de recuperação.
              </p>
            </div>
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

        <p className="auth-foot">
          Ainda não tem conta?{' '}
          <Link href="/cadastro">Criar a conta da sua escola — grátis até 30 alunos</Link>
        </p>
        <p className="auth-foot muted">
          Se o servidor estiver fora do ar, o erro aparece aqui em cima — a
          página não trava. Confira também se você está na rede certa da escola.
        </p>
      </section>
    </main>
  );
}
