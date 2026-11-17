'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { forgotPassword } from '../../lib/api';

// Esqueci minha senha — o pedido é registrado e o link de redefinição
// (válido por 1 h) fica com a administração da escola nesta v1, porque
// ainda não há envio de e-mail no produto. A tela diz isso com todas as
// letras, p/ a pessoa saber a quem pedir.
export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar o pedido.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-wrap">
      <section className="card auth-card">
        <div className="auth-brand">
          <h1>Esqueci minha senha</h1>
          <p>Registre o pedido e a administração da sua escola te passa o link de redefinição.</p>
        </div>

        {sent ? (
          <>
            <p className="alert ok">
              Pedido registrado para <strong>{email.trim()}</strong> (se o e-mail tiver conta).
            </p>
            <p>
              Peça o link de redefinição à <strong>administração da sua escola</strong> — ele
              aparece na Área da escola, em "Redefinições de senha pendentes", e vale por{' '}
              <strong>1 hora</strong>. Por enquanto o TutorPass ainda não envia esse link por
              e-mail.
            </p>
            <p className="auth-foot">
              <Link href="/login">Voltar para o login</Link>
            </p>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            {error ? (
              <p className="alert error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="field">
              <label htmlFor="email">E-mail da conta</label>
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
            <p style={{ marginTop: 20 }}>
              <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>
                {busy ? 'Registrando…' : 'Pedir redefinição'}
              </button>
            </p>
            <p className="auth-foot">
              Lembrou a senha? <Link href="/login">Entrar</Link>
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
