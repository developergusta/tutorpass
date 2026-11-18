'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import RequireAuth from '../../components/RequireAuth';
import {
  changePassword,
  clearSession,
  confirmTwoFactor,
  disableTwoFactor,
  getTwoFactorStatus,
  listSessions,
  loadSession,
  regenerateRecoveryCodes,
  revokeAllSessions,
  setupTwoFactor,
  type AuthSession,
  type TwoFactorStatus,
} from '../../lib/api';

// Tela de Segurança — a tela que faltava (BACKLOG, IMPORTANTE): a API
// já tinha 2FA (setup/confirm/status/disable/recovery-codes), troca de
// senha e sessões, mas o web não tinha onde configurar — quem era
// obrigado a usar 2FA caía num aviso do login apontando p/ uma tela que
// não existia. O fluxo segue o padrão que funciona em SaaS (saasui,
// 2026): cadastro em etapas — escanear o QR, confirmar com um código
// (só então o 2FA vale) e guardar os códigos de recuperação, que são
// exibidos uma única vez. Nada aqui muda regra de negócio: só a camada
// visual sobre as rotas que já existiam.

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
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2l8 3.5v5.2c0 5-3.4 9.4-8 10.8-4.6-1.4-8-5.8-8-10.8V5.5L12 2z" />
      <path d="M8.5 12l2.5 2.5 4.5-4.5" />
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

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

type Step = 'idle' | 'scan' | 'confirm' | 'codes' | 'done';
type CodeAction = 'disable' | 'regenerate' | null;

function SegurancaPanel() {
  const router = useRouter();
  const session = loadSession();
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Cadastro do 2FA, em etapas.
  const [step, setStep] = useState<Step>('idle');
  const [secret, setSecret] = useState('');
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [savedCodes, setSavedCodes] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [tfaBusy, setTfaBusy] = useState(false);
  const [tfaError, setTfaError] = useState<string | null>(null);
  const [tfaOk, setTfaOk] = useState<string | null>(null);

  // Desativar / gerar novos códigos pedem o código atual do app.
  const [codeAction, setCodeAction] = useState<CodeAction>(null);
  const [actionCode, setActionCode] = useState('');

  // Troca de senha.
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState<string | null>(null);

  // Sessões.
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revokeArmed, setRevokeArmed] = useState(false);
  const [revokeBusy, setRevokeBusy] = useState(false);

  const refreshStatus = useCallback(async () => {
    setLoadingStatus(true);
    setStatusError(null);
    try {
      setStatus(await getTwoFactorStatus());
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Não foi possível carregar o status do 2FA.');
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const refreshSessions = useCallback(async () => {
    setLoadingSessions(true);
    setSessionsError(null);
    try {
      setSessions(await listSessions());
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : 'Não foi possível listar as sessões.');
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    void refreshSessions();
  }, [refreshStatus, refreshSessions]);

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      // clipboard indisponível — o texto continua visível p/ copiar à mão.
    }
  }

  async function onStartSetup() {
    setTfaError(null);
    setTfaOk(null);
    setTfaBusy(true);
    try {
      const { secret: s, otpauthUrl } = await setupTwoFactor();
      setSecret(s);
      // O QR é gerado aqui, no navegador, a partir do otpauthUrl — o
      // segredo nunca vai p/ um serviço de QR de terceiros.
      setQr(await QRCode.toDataURL(otpauthUrl, { width: 240, margin: 1 }));
      setCode('');
      setStep('scan');
    } catch (err) {
      setTfaError(err instanceof Error ? err.message : 'Não foi possível iniciar o cadastro do 2FA.');
    } finally {
      setTfaBusy(false);
    }
  }

  async function onConfirmSetup(e: FormEvent) {
    e.preventDefault();
    setTfaError(null);
    setTfaBusy(true);
    try {
      const { recoveryCodes: codes } = await confirmTwoFactor(code.trim());
      setRecoveryCodes(codes);
      setSavedCodes(false);
      setStep('codes');
    } catch (err) {
      setTfaError(err instanceof Error ? err.message : 'Código inválido — tente de novo.');
    } finally {
      setTfaBusy(false);
    }
  }

  function onFinishSetup() {
    setStep('done');
    setTfaOk('Verificação em duas etapas ativa. Guarde os códigos de recuperação — eles não aparecem de novo.');
    void refreshStatus();
  }

  async function onCodeAction(e: FormEvent) {
    e.preventDefault();
    if (!codeAction) return;
    setTfaError(null);
    setTfaOk(null);
    setTfaBusy(true);
    try {
      if (codeAction === 'disable') {
        await disableTwoFactor(actionCode.trim());
        setCodeAction(null);
        setActionCode('');
        setTfaOk('Verificação em duas etapas desativada.');
        void refreshStatus();
      } else {
        const { recoveryCodes: codes } = await regenerateRecoveryCodes(actionCode.trim());
        setRecoveryCodes(codes);
        setSavedCodes(false);
        setCodeAction(null);
        setActionCode('');
        setStep('codes');
        setTfaOk('Lote novo gerado — o anterior não vale mais. Guarde estes códigos.');
      }
    } catch (err) {
      setTfaError(err instanceof Error ? err.message : 'Código inválido — tente de novo.');
    } finally {
      setTfaBusy(false);
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwOk(null);
    if (newPassword.length < 8) {
      setPwError('A senha nova precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (newPassword === currentPassword) {
      setPwError('A senha nova precisa ser diferente da atual.');
      return;
    }
    setPwBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setPwOk('Senha trocada. As outras sessões continuam valendo — encerre-as abaixo se quiser sair de todos os aparelhos.');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Não foi possível trocar a senha.');
    } finally {
      setPwBusy(false);
    }
  }

  async function onRevokeAll() {
    if (!revokeArmed) {
      setRevokeArmed(true);
      return;
    }
    setRevokeBusy(true);
    try {
      await revokeAllSessions();
    } catch {
      // Mesmo sem resposta da API, a sessão local sai: o usuário volta
      // ao login e o refresh revogado não volta sozinho.
    } finally {
      clearSession();
      router.push('/login');
    }
  }

  const required = Boolean(session?.twoFactorSetupRequired);
  const enabled = status?.enabled ?? false;

  return (
    <main id="conteudo" tabIndex={-1} className="container section">
      <h1>Segurança</h1>
      <p className="muted">
        A proteção da sua conta: verificação em duas etapas, senha e as
        sessões ativas neste momento.
      </p>

      {required && !enabled && !loadingStatus ? (
        <p className="alert warn">
          Seu perfil exige verificação em duas etapas (2FA) e ela ainda não
          foi configurada. Ative abaixo — sem ela, o próximo login vai pedir
          a configuração de novo.
        </p>
      ) : null}

      {/* ------------------------------------------------ 2FA */}
      <section className="card security-card" aria-labelledby="tfa-title">
        <div className="security-head">
          <span className="security-icon" aria-hidden="true">
            <ShieldIcon />
          </span>
          <div>
            <h2 id="tfa-title">Verificação em duas etapas (2FA)</h2>
            <p className="muted">
              Mesmo que alguém descubra sua senha, só entra quem tem o código
              do aplicativo autenticador no seu celular — ele muda a cada 30
              segundos e funciona sem internet.
            </p>
          </div>
        </div>

        {loadingStatus ? (
          <p className="muted" role="status">
            Verificando o status do 2FA…
          </p>
        ) : statusError ? (
          <div className="state state-error">
            <p className="state-title">Não consegui carregar o status do 2FA</p>
            <p className="state-text">{statusError}</p>
            <div className="state-action">
              <button className="btn secondary" type="button" onClick={() => void refreshStatus()}>
                Tentar de novo
              </button>
            </div>
          </div>
        ) : enabled && step !== 'codes' ? (
          <div>
            <p>
              <span className="badge">Ativa</span>
              <span className="security-meta">
                Último uso: {fmtDate(status?.lastUsedAt ?? null)} · Códigos de
                recuperação restantes: {status?.recoveryCodesRemaining ?? 0}
              </span>
            </p>
            {status?.lockedUntil ? (
              <p className="alert warn">
                Muitas tentativas erradas — o 2FA está bloqueado até {fmtDate(status.lockedUntil)}.
              </p>
            ) : null}
            {tfaOk ? <p className="alert ok" role="status">{tfaOk}</p> : null}
            {tfaError ? <p className="alert error" role="alert">{tfaError}</p> : null}
            {codeAction ? (
              <form onSubmit={onCodeAction} className="security-inline-form">
                <div className="field">
                  <label htmlFor="action-code">
                    {codeAction === 'disable'
                      ? 'Digite o código atual do aplicativo autenticador para desativar o 2FA'
                      : 'Digite o código atual do aplicativo autenticador para gerar códigos novos'}
                  </label>
                  <input
                    id="action-code"
                    className="code-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={8}
                    value={actionCode}
                    onChange={(e) => setActionCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    required
                  />
                  <p className="hint">
                    {codeAction === 'disable'
                      ? 'Desativar tira a segunda camada de proteção da conta.'
                      : 'O lote anterior para de valer na hora — guarde os novos.'}
                  </p>
                </div>
                <div className="row-actions">
                  <button className="btn" type="submit" disabled={tfaBusy || actionCode.length < 6}>
                    {tfaBusy ? 'Confirmando…' : codeAction === 'disable' ? 'Desativar o 2FA' : 'Gerar códigos novos'}
                  </button>
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => {
                      setCodeAction(null);
                      setActionCode('');
                      setTfaError(null);
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="row-actions">
                <button className="btn secondary" type="button" onClick={() => setCodeAction('regenerate')}>
                  Gerar novos códigos de recuperação
                </button>
                <button className="btn secondary" type="button" onClick={() => setCodeAction('disable')}>
                  Desativar o 2FA
                </button>
              </div>
            )}
            <p className="hint">
              Perdeu o celular? Use um código de recuperação no login — cada
              um vale uma vez. Se o seu perfil exige 2FA, a desativação é
              recusada pela API.
            </p>
          </div>
        ) : step === 'done' ? (
          <div className="state">
            <span className="state-icon" aria-hidden="true">
              <CheckIcon />
            </span>
            <p className="state-title">2FA ativo</p>
            <p className="state-text">
              A partir do próximo login, o TutorPass vai pedir o código do
              aplicativo autenticador além da senha.
            </p>
            <div className="state-action">
              <button
                className="btn secondary"
                type="button"
                onClick={() => {
                  setStep('idle');
                  setTfaOk(null);
                }}
              >
                Voltar
              </button>
            </div>
          </div>
        ) : step === 'codes' ? (
          <div>
            <p className="security-step">
              <strong>Passo 3 de 3 — guarde os códigos de recuperação.</strong>{' '}
              Eles aparecem uma única vez: se perder o celular, são eles que
              devolvem o acesso à conta. Cada código vale uma vez.
            </p>
            {tfaOk ? <p className="alert ok" role="status">{tfaOk}</p> : null}
            <ul className="recovery-codes" aria-label="Códigos de recuperação">
              {recoveryCodes.map((c) => (
                <li key={c}>
                  <code>{c}</code>
                </li>
              ))}
            </ul>
            <div className="row-actions">
              <button
                className="btn secondary"
                type="button"
                onClick={() => void copyText(recoveryCodes.join('\n'), 'codes')}
              >
                {copied === 'codes' ? 'Copiado' : 'Copiar todos os códigos'}
              </button>
            </div>
            <label className="security-check">
              <input
                type="checkbox"
                checked={savedCodes}
                onChange={(e) => setSavedCodes(e.target.checked)}
              />
              Guardei meus códigos num lugar seguro
            </label>
            <div className="row-actions">
              <button className="btn" type="button" disabled={!savedCodes} onClick={onFinishSetup}>
                Concluir a ativação
              </button>
            </div>
          </div>
        ) : step === 'scan' || step === 'confirm' ? (
          <div>
            <p className="security-step">
              <strong>Passo 1 de 3 — escaneie o QR.</strong> Abra o aplicativo
              autenticador (Google Authenticator, Authy, 1Password ou
              Bitwarden) e aponte a câmera.
            </p>
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="security-qr" src={qr} alt="QR code para cadastrar o TutorPass no aplicativo autenticador" width={240} height={240} />
            ) : null}
            <p>
              Não consegue escanear? Digite esta chave no aplicativo:{' '}
              <code className="security-secret">{secret}</code>{' '}
              <button
                className="btn secondary small"
                type="button"
                onClick={() => void copyText(secret, 'secret')}
              >
                {copied === 'secret' ? 'Copiada' : 'Copiar a chave'}
              </button>
            </p>
            {tfaError ? <p className="alert error" role="alert">{tfaError}</p> : null}
            <form onSubmit={onConfirmSetup}>
              <div className="field">
                <label htmlFor="setup-code">
                  <strong>Passo 2 de 3 — confirme com um código.</strong> Digite
                  o código de 6 dígitos que o aplicativo mostra agora — é ele
                  que prova que o cadastro funcionou.
                </label>
                <input
                  id="setup-code"
                  className="code-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  required
                />
              </div>
              <div className="row-actions">
                <button className="btn" type="submit" disabled={tfaBusy || code.length !== 6}>
                  {tfaBusy ? 'Confirmando…' : 'Confirmar e ativar o 2FA'}
                </button>
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => {
                    setStep('idle');
                    setTfaError(null);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div>
            {tfaError ? <p className="alert error" role="alert">{tfaError}</p> : null}
            <p>
              A verificação ainda não está ativa nesta conta. O cadastro leva
              menos de 2 minutos: escaneie o QR com o aplicativo
              autenticador, confirme com um código e guarde os códigos de
              recuperação.
            </p>
            <div className="row-actions">
              <button className="btn" type="button" onClick={() => void onStartSetup()} disabled={tfaBusy}>
                {tfaBusy ? 'Preparando…' : 'Ativar a verificação em duas etapas'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------------------------ senha */}
      <section className="card security-card" aria-labelledby="pw-title">
        <h2 id="pw-title">Trocar a senha</h2>
        <p className="muted">
          A senha nova precisa ter pelo menos 8 caracteres. Depois da troca,
          as outras sessões continuam valendo.
        </p>
        {pwOk ? <p className="alert ok" role="status">{pwOk}</p> : null}
        {pwError ? <p className="alert error" role="alert">{pwError}</p> : null}
        <form onSubmit={onChangePassword}>
          <div className="field">
            <label htmlFor="current-password">Senha atual</label>
            <div className="input-wrap">
              <input
                id="current-password"
                type={showCurrent ? 'text' : 'password'}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <button
                className="input-toggle"
                type="button"
                aria-pressed={showCurrent}
                aria-label={showCurrent ? 'Ocultar senha atual' : 'Mostrar senha atual'}
                onClick={() => setShowCurrent((v) => !v)}
              >
                <EyeIcon off={showCurrent} />
              </button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="new-password">Senha nova</label>
            <div className="input-wrap">
              <input
                id="new-password"
                type={showNew ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <button
                className="input-toggle"
                type="button"
                aria-pressed={showNew}
                aria-label={showNew ? 'Ocultar senha nova' : 'Mostrar senha nova'}
                onClick={() => setShowNew((v) => !v)}
              >
                <EyeIcon off={showNew} />
              </button>
            </div>
            <p className="hint">Mínimo de 8 caracteres.</p>
          </div>
          <div className="row-actions">
            <button className="btn" type="submit" disabled={pwBusy || !currentPassword || newPassword.length < 8}>
              {pwBusy ? 'Trocando…' : 'Trocar a senha'}
            </button>
          </div>
        </form>
      </section>

      {/* ------------------------------------------------ sessões */}
      <section className="card security-card" aria-labelledby="sessions-title">
        <h2 id="sessions-title">Sessões ativas</h2>
        <p className="muted">
          Os aparelhos e navegadores com login válido nesta conta. O
          TutorPass ainda não registra qual aparelho é qual — cada sessão
          mostra quando começou e até quando vale.
        </p>
        {loadingSessions ? (
          <p className="muted" role="status">Carregando as sessões…</p>
        ) : sessionsError ? (
          <div className="state state-error">
            <p className="state-title">Não consegui listar as sessões</p>
            <p className="state-text">{sessionsError}</p>
            <div className="state-action">
              <button className="btn secondary" type="button" onClick={() => void refreshSessions()}>
                Tentar de novo
              </button>
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="state">
            <p className="state-title">Nenhuma outra sessão ativa</p>
            <p className="state-text">Só esta sessão está valendo agora.</p>
          </div>
        ) : (
          <ul className="roster-list">
            {sessions.map((s) => (
              <li className="roster-row" key={s.jti}>
                <span className="member-id">
                  <span>Sessão iniciada em {fmtDate(s.createdAt)}</span>
                </span>
                <span className="muted">válida até {fmtDate(s.expiresAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="row-actions">
          <button
            className="btn secondary"
            type="button"
            onClick={() => void onRevokeAll()}
            disabled={revokeBusy}
          >
            {revokeBusy
              ? 'Encerrando…'
              : revokeArmed
                ? 'Tem certeza? Vai sair de todos os aparelhos, inclusive deste'
                : 'Encerrar todas as sessões'}
          </button>
          {revokeArmed ? (
            <button className="btn secondary" type="button" onClick={() => setRevokeArmed(false)}>
              Cancelar
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default function SegurancaPage() {
  return (
    <RequireAuth area="segurança">
      <SegurancaPanel />
    </RequireAuth>
  );
}
