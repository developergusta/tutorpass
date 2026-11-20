'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { io, type Socket } from 'socket.io-client';
import RequireAuth from '../../components/RequireAuth';
import {
  API_URL,
  cancelMyEntry,
  getMyQrToken,
  getMyTutor,
  joinMyQueue,
  type MyStudent,
  type MyTutorInfo,
} from '../../lib/api';

// A área do responsável (17/11/2026): a conta TUTOR entrava e não via
// NADA — faltava o vínculo conta ↔ cadastro e uma tela própria. Aqui o
// responsável vê os filhos dele (a API resolve pela sessão), entra na
// fila com "Estou chegando", acompanha o status ao vivo (socket na room
// tutor:{id} + atualização a cada 10 s) e mostra o QR dinâmico de 30 s
// na portaria.

const RELATIONSHIP_LABEL: Record<string, string> = {
  MOTHER: 'Mãe',
  FATHER: 'Pai',
  GRANDPARENT: 'Avó/Avô',
  SIBLING: 'Irmão/Irmã',
  GUARDIAN: 'Responsável legal',
  OTHER: 'Responsável',
};

const STATUS_LABEL: Record<string, string> = {
  QUEUED: 'Na fila — a escola já sabe que você está vindo',
  CALLED: 'Chamado! Vá ao portão buscar',
  VALIDATED: 'Identidade validada — a retirada foi liberada',
};

function ResponsavelPanel() {
  const [info, setInfo] = useState<MyTutorInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setInfo(await getMyTutor());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os seus dados.');
    }
  }, []);

  useEffect(() => {
    void reload();
    const id = setInterval(() => void reload(), 10_000);
    return () => clearInterval(id);
  }, [reload]);

  // Tempo real: a room tutor:{id} recebe as mudanças das MINHAS
  // entradas — qualquer evento dispara a releitura (a cada 10 s segue
  // como rede de segurança).
  const tutorId = info?.tutor?.id ?? null;
  useEffect(() => {
    if (!tutorId) return;
    const socket: Socket = io(`${API_URL}/pickup`, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 5_000,
      auth: (cb) => {
        try {
          const raw = sessionStorage.getItem('tutorpass.session');
          const session = raw
            ? (JSON.parse(raw) as { accessToken?: string; schoolId?: string | null })
            : null;
          cb({
            token: session?.accessToken,
            schoolId: session?.schoolId ?? undefined,
            role: 'TUTOR',
            tutorId,
          });
        } catch {
          cb({});
        }
      },
    });
    const bump = () => void reload();
    socket.on('queue.entry.created', bump);
    socket.on('queue.entry.status_changed', bump);
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [tutorId, reload]);

  const hasActive = info?.students.some((s) => s.activeEntry) ?? false;

  return (
    <main id="conteudo" tabIndex={-1} className="container mercury-parent">
      <header className="mercury-parent-header">
        <span className="eyebrow-mono">PASSE DA FAMÍLIA · CREDENCIAL DE RETIRADA</span>
        <h1>Área do responsável</h1>
      </header>

      {error ? (
        <div className="state state-error" role="alert">
          <p className="state-title">Algo não carregou</p>
          <p className="state-text">{error}</p>
          <p>
            <button className="btn secondary" type="button" onClick={() => void reload()}>
              Tentar de novo
            </button>
          </p>
        </div>
      ) : info === null ? (
        <p role="status">Carregando os seus filhos…</p>
      ) : info.tutor === null ? (
        <div className="state" role="status">
          <p className="state-title">Sua conta ainda não foi vinculada</p>
          <p className="state-text">
            Você entrou, mas a secretaria ainda não ligou esta conta ao seu
            cadastro de responsável. Peça na secretaria: área da escola →
            Responsáveis → vincular conta com o seu e-mail. Depois disso,
            seus filhos aparecem aqui.
          </p>
        </div>
      ) : (
        <>
          <p className="muted">
            Olá, {info.tutor.name.split(' ')[0]}. Quando estiver vindo buscar,
            toque em <strong>Estou chegando</strong> — a portaria te chama pelo
            nome e você mostra o QR abaixo no portão.
          </p>

          {info.students.length === 0 ? (
            <div className="state" role="status">
              <p className="state-title">Nenhum filho vinculado</p>
              <p className="state-text">
                Seu cadastro existe, mas nenhum aluno está ligado a você.
                Procure a secretaria para fazer o vínculo.
              </p>
            </div>
          ) : (
            info.students.map((s) => (
              <StudentCard key={s.student.id} data={s} onChanged={reload} />
            ))
          )}

          {hasActive ? <QrCard /> : null}
        </>
      )}
    </main>
  );
}

function StudentCard({
  data,
  onChanged,
}: {
  data: MyStudent;
  onChanged: () => Promise<void>;
}) {
  const [gate, setGate] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const entry = data.activeEntry;

  async function onJoin() {
    setBusy(true);
    setActionError(null);
    try {
      await joinMyQueue(data.student.id, gate);
      await onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível entrar na fila.');
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    if (!entry) return;
    setBusy(true);
    setActionError(null);
    try {
      await cancelMyEntry(entry.id);
      await onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível cancelar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card resp-student" aria-label={data.student.name}>
      <div className="resp-student-top">
        <div>
          <h2>{data.student.name}</h2>
          <p className="muted resp-student-meta">
            {data.classroomName ?? 'Sem turma'}
            {' · '}
            {RELATIONSHIP_LABEL[data.relationship] ?? 'Responsável'}
            {data.student.pickupBlocked ? (
              <>
                {' · '}
                <span className="badge danger">Retirada bloqueada</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="resp-eta-block" aria-label="Tempo estimado e estado">
          <span className="resp-eta-label">TEMPO / ESTADO</span>
          <strong className="resp-eta-value">
            {entry
              ? entry.status === 'CALLED'
                ? '00:00 · AGORA'
                : entry.status === 'VALIDATED'
                  ? 'OK · LIBERADO'
                  : '~02 min · FILA'
              : '— · AGUARDANDO'}
          </strong>
        </div>
      </div>

      {entry ? (
        <div className="resp-active-state">
          <p className="resp-chip-row">
            <span className={`chip ${entry.status === 'QUEUED' ? '' : 'ok'}`}>
              {STATUS_LABEL[entry.status] ?? entry.status}
            </span>
            {entry.gate ? <span className="chip">{entry.gate}</span> : null}
          </p>
          {entry.status === 'QUEUED' || entry.status === 'CALLED' ? (
            <p style={{ margin: 0 }}>
              <button className="btn secondary" type="button" disabled={busy} onClick={onCancel}>
                {busy ? 'Cancelando…' : 'Desistir de buscar agora'}
              </button>
            </p>
          ) : null}
        </div>
      ) : data.canPickup ? (
        <div className="resp-checkin-flow">
          <div className="field">
            <label htmlFor={`gate-${data.student.id}`}>
              Portão (só se a escola separar por portões)
            </label>
            <input
              id={`gate-${data.student.id}`}
              value={gate}
              onChange={(e) => setGate(e.target.value)}
              placeholder="Ex.: Portão A"
              maxLength={40}
            />
          </div>
          <p className="resp-arrival-wrap">
            <button className="btn btn-arrival" type="button" disabled={busy} onClick={onJoin}>
              {busy ? 'Entrando…' : 'Estou chegando'}
            </button>
          </p>
        </div>
      ) : (
        <p className="muted">
          Você está cadastrado como contato, sem autorização de retirada para
          este aluno. Para retirar, procure a secretaria.
        </p>
      )}

      {actionError ? (
        <p className="state-text" role="alert">
          {actionError}
        </p>
      ) : null}
    </section>
  );
}

/** QR dinâmico de 30 s: renova sozinho antes de expirar. */
function QrCard() {
  const [img, setImg] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const aliveRef = useRef(true);

  const fetchToken = useCallback(async () => {
    try {
      const { token, expiresIn } = await getMyQrToken();
      const url = await QRCode.toDataURL(token, { width: 440, margin: 1 });
      if (!aliveRef.current) return;
      setImg(url);
      setSecondsLeft(expiresIn);
    } catch {
      if (aliveRef.current) setSecondsLeft(3); // tenta de novo em seguida
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    void fetchToken();
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          void fetchToken();
          return 30;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      aliveRef.current = false;
      clearInterval(id);
    };
  }, [fetchToken]);

  return (
    <section className="card qr-box" aria-label="Seu QR para a portaria">
      <div className="qr-box-header">
        <div>
          <span className="eyebrow-mono">TOKEN EFÊMERO ANTI-PRINT</span>
          <h2>Seu QR na portaria</h2>
        </div>
        <div className="qr-tabular-timer" aria-hidden="true">
          <span className="qr-timer-num">{String(secondsLeft).padStart(2, '0')}s</span>
          <span className="qr-timer-lbl">TTL ATIVO</span>
        </div>
      </div>
      {img ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="QR dinâmico para apresentar na portaria" />
          <p className="muted">
            Mostre este código na portaria. Ele muda a cada 30 segundos —
            novo em {secondsLeft}s.
          </p>
        </>
      ) : (
        <p role="status">Gerando o seu QR…</p>
      )}
    </section>
  );
}

export default function ResponsavelPage() {
  return (
    <RequireAuth area="responsável">
      <ResponsavelPanel />
    </RequireAuth>
  );
}
