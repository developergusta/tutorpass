'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { resetPassword } from '../../lib/api';

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

// Redefinição de senha pelo link (?token=...): consome o token de uso
// único, define a senha nova e derruba as sessões antigas (a API revoga
// todos os refresh tokens da conta).
function RedefinirForm() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('As senhas não conferem — digite a mesma senha nos dois campos.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível redefinir. Peça um link novo à administração.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <>
        <p className="alert error" role="alert">
          Este endereço está sem o código do link de redefinição.
        </p>
        <p>
          Peça o link completo à administração da sua escola ou registre um pedido novo em{' '}
          <Link href="/esqueci-senha">Esqueci minha senha</Link>.
        </p>
      </>
    );
  }

  if (done) {
    return (
      <>
        <p className="alert ok">Senha redefinida. As sessões antigas foram encerradas.</p>
        <p className="auth-actions">
          <Link className="btn" href="/login">
            Entrar com a senha nova
          </Link>
        </p>
      </>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      {error ? (
        <p className="alert error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="field">
        <label htmlFor="password">Senha nova</label>
        <div className="input-wrap">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ao menos 8 caracteres"
          />
          <button
            className="input-toggle"
            type="button"
            aria-pressed={showPassword}
            aria-label={showPassword ? 'Ocultar senha nova' : 'Mostrar senha nova'}
            onClick={() => setShowPassword((v) => !v)}
          >
            <EyeIcon off={showPassword} />
          </button>
        </div>
      </div>
      <div className="field">
        <label htmlFor="confirm">Repita a senha nova</label>
        <div className="input-wrap">
          <input
            id="confirm"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <button
            className="input-toggle"
            type="button"
            aria-pressed={showConfirm}
            aria-label={showConfirm ? 'Ocultar confirmação da senha' : 'Mostrar confirmação da senha'}
            onClick={() => setShowConfirm((v) => !v)}
          >
            <EyeIcon off={showConfirm} />
          </button>
        </div>
      </div>
      <p style={{ marginTop: 20 }}>
        <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Redefinindo…' : 'Redefinir senha'}
        </button>
      </p>
    </form>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <main id="conteudo" tabIndex={-1} className="auth-wrap">
      <section className="card auth-card">
        <div className="auth-brand">
          <h1>Redefinir senha</h1>
          <p>Escolha a senha nova da sua conta TutorPass.</p>
        </div>
        <Suspense fallback={<p className="muted">Carregando…</p>}>
          <RedefinirForm />
        </Suspense>
      </section>
    </main>
  );
}
