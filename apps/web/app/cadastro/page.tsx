'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import {
  createSchool,
  isNeeds2fa,
  login,
  register,
  saveSession,
  type LoginSuccess,
} from '../../lib/api';

type Phase =
  | { kind: 'form' }
  | { kind: 'done'; session: LoginSuccess; schoolName: string };

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

export default function CadastroPage() {
  const [schoolName, setSchoolName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'form' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setShowPassword(false);
    try {
      // 1) Conta do usuário. 2) Sessão "sem escola" p/ autorizar a criação.
      // 3) A escola (o servidor vincula o criador como ADMIN).
      // 4) Login de novo, agora COM a escola, p/ a sessão já nascer completa.
      await register(name.trim(), email.trim(), password);
      const first = await login(email.trim(), password);
      if (isNeeds2fa(first)) {
        throw new Error(
          'Esta conta já existia e usa verificação em duas etapas. Entre pela tela de login.',
        );
      }
      const school = await createSchool(first.accessToken, schoolName.trim());
      const scoped = await login(email.trim(), password, school.id);
      if (isNeeds2fa(scoped)) {
        throw new Error(
          'Escola criada, mas a conta pede verificação em duas etapas. Entre pela tela de login.',
        );
      }
      saveSession(scoped);
      setPhase({ kind: 'done', session: scoped, schoolName: school.name });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível criar a conta. Tente de novo.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (phase.kind === 'done') {
    return (
      <main className="auth-wrap">
        <section className="card auth-card auth-success">
          <span className="auth-success-icon" aria-hidden="true">
            <CheckIcon />
          </span>
          <h1>Sua escola foi criada</h1>
          <p>
            <strong>{phase.schoolName}</strong> já está no TutorPass, e você (
            {phase.session.user.email}) é o administrador.
          </p>
          {phase.session.twoFactorSetupRequired ? (
            <p className="alert warn">
              Seu perfil de administrador exige verificação em duas etapas (2FA)
              — <Link href="/seguranca">configure na tela de Segurança</Link>.
              Guarde bem seu e-mail e sua senha.
            </p>
          ) : null}
          <p className="muted">
            Plano Grátis ativo: até 30 alunos e 5 funcionários, sem cartão. Sua
            conta fica salva — pode fechar e voltar quando quiser, é só entrar.
          </p>
          <p className="auth-actions">
            <Link className="btn" href="/portaria">
              Abrir a portaria
            </Link>
            <Link className="btn secondary" href="/telao">
              Abrir o telão
            </Link>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-wrap">
      <section className="card auth-card">
        <div className="auth-brand">
          <span className="logo-mark" aria-hidden="true">
            <ShieldIcon />
          </span>
          <h1>Criar a conta da sua escola</h1>
          <p>
            Grátis até 30 alunos · sem cartão · leva 1 minuto. Você vira o
            administrador da escola e entra direto.
          </p>
        </div>

        {error ? (
          <p className="alert error" role="alert">
            {error}
            {error.includes('Já existe uma conta') ? (
              <>
                {' '}
                <Link href="/login">Entrar na conta existente</Link>
              </>
            ) : null}
          </p>
        ) : null}

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="school">Nome da escola</label>
            <input
              id="school"
              type="text"
              autoComplete="organization"
              required
              minLength={2}
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="Colégio Girassol"
            />
          </div>
          <div className="field">
            <label htmlFor="name">Seu nome</label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Maria Silva"
            />
          </div>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
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
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo de 8 caracteres"
              />
              <button
                type="button"
                className="input-toggle"
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
              {busy ? 'Criando sua escola…' : 'Criar conta grátis'}
            </button>
          </p>
        </form>

        <p className="auth-foot">
          Já tem conta? <Link href="/login">Entrar</Link>
        </p>
      </section>
    </main>
  );
}
