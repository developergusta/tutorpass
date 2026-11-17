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

export default function CadastroPage() {
  const [schoolName, setSchoolName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'form' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
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
      <main className="container">
        <section className="card" style={{ maxWidth: 520, margin: '24px auto' }}>
          <h1>Sua escola foi criada 🎉</h1>
          <p>
            <strong>{phase.schoolName}</strong> já está no TutorPass, e você (
            {phase.session.user.email}) é o administrador.
          </p>
          {phase.session.twoFactorSetupRequired ? (
            <p className="alert warn">
              Seu perfil de administrador exige verificação em duas etapas (2FA)
              — a configuração entra numa próxima versão do web. Guarde bem seu
              e-mail e sua senha.
            </p>
          ) : null}
          <p className="muted">
            Plano Grátis ativo: até 30 alunos e 5 funcionários, sem cartão. Sua
            conta fica salva — pode fechar e voltar quando quiser, é só entrar.
          </p>
          <p style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
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
    <main className="container">
      <section className="card" style={{ maxWidth: 520, margin: '24px auto' }}>
        <h1>Criar a conta da sua escola</h1>
        <p className="muted">
          Grátis até 30 alunos · sem cartão · leva 1 minuto. Você vira o
          administrador da escola e entra direto.
        </p>

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
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo de 8 caracteres"
          />
          <p style={{ marginTop: 20 }}>
            <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>
              {busy ? 'Criando sua escola…' : 'Criar conta grátis'}
            </button>
          </p>
        </form>

        <p className="muted">
          Já tem conta? <Link href="/login">Entrar</Link>
        </p>
      </section>
    </main>
  );
}
