'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import RequireAuth from '../../components/RequireAuth';
import {
  callQueueEntry,
  cancelQueueEntry,
  listSiblingGateConflicts,
  releaseQueueEntry,
  validateQueueQr,
  type SiblingGateConflict,
} from '../../lib/api';
import { usePickupQueue, type QueueItem } from '../../lib/use-pickup-queue';

// Ações da portaria numa entrada da fila — a tela deixou de ser só
// leitura (varredura 17/11/2026): chamar, validar o QR do responsável e
// confirmar a retirada, seguindo a máquina de estados da API
// (QUEUED → CALLED → VALIDATED → RELEASED; cancelar até a validação).
function EntryActions({ item }: { item: QueueItem }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrToken, setQrToken] = useState('');

  const status = item.status;
  const canCall = status === 'QUEUED' || status === null;
  const canValidate = status === 'QUEUED' || status === 'CALLED' || status === null;
  const canRelease = status === 'VALIDATED';
  const canCancel = canValidate;

  async function run(name: string, fn: () => Promise<unknown>) {
    setBusy(name);
    setError(null);
    try {
      await fn();
      if (name === 'qr') {
        setQrOpen(false);
        setQrToken('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A ação falhou. Tente de novo.');
    } finally {
      setBusy(null);
    }
  }

  function onValidate(e: FormEvent) {
    e.preventDefault();
    void run('qr', () => validateQueueQr(item.id, qrToken.trim()));
  }

  return (
    <span className="entry-actions">
      {status === 'CALLED' ? <span className="chip ok">Chamado</span> : null}
      {status === 'VALIDATED' ? <span className="chip ok">QR validado</span> : null}
      {canCall ? (
        <button
          className="btn small"
          type="button"
          disabled={busy !== null}
          onClick={() => void run('call', () => callQueueEntry(item.id))}
        >
          {busy === 'call' ? 'Chamando…' : 'Chamar'}
        </button>
      ) : null}
      {canValidate ? (
        <button
          className="btn secondary small"
          type="button"
          disabled={busy !== null}
          onClick={() => setQrOpen((v) => !v)}
        >
          Validar QR
        </button>
      ) : null}
      {canRelease ? (
        <button
          className="btn small"
          type="button"
          disabled={busy !== null}
          onClick={() => void run('release', () => releaseQueueEntry(item.id))}
        >
          {busy === 'release' ? 'Confirmando…' : 'Confirmar retirada'}
        </button>
      ) : null}
      {canCancel ? (
        <button
          className="btn secondary small"
          type="button"
          disabled={busy !== null}
          onClick={() => void run('cancel', () => cancelQueueEntry(item.id))}
        >
          Cancelar
        </button>
      ) : null}
      {qrOpen && canValidate ? (
        <form className="qr-form" onSubmit={onValidate}>
          <input
            value={qrToken}
            onChange={(e) => setQrToken(e.target.value)}
            placeholder="Código do QR do responsável"
            aria-label="Código do QR do responsável"
            autoFocus
          />
          <button className="btn small" type="submit" disabled={busy !== null || !qrToken.trim()}>
            {busy === 'qr' ? 'Validando…' : 'Validar'}
          </button>
        </form>
      ) : null}
      {error ? (
        <span className="queue-item-error" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}

// Ícones do padrão de estados (traço 2, cantos arredondados, como o resto
// do site): o vazio é uma confirmação calma, o erro é um aviso.
function StateIcon({ kind }: { kind: 'empty' | 'error' }) {
  return (
    <span className="state-icon" aria-hidden="true">
      {kind === 'empty' ? (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 12.2l2.4 2.4 4.6-5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3.5L21 20H3L12 3.5z" />
          <path d="M12 10v4.5" />
          <path d="M12 17.6h.01" />
        </svg>
      )}
    </span>
  );
}

// Skeleton no formato das linhas da fila: a portaria vê a estrutura
// chegando, sem salto de layout e sem um "vazio" falso enquanto conecta.
function QueueSkeleton({ title }: { title: string }) {
  return (
    <section className="card queue-section" aria-label={title}>
      <div className="queue-section-head">
        <h2>{title}</h2>
        <span className="count-badge" aria-hidden="true">
          –
        </span>
      </div>
      <ul className="skeleton-list" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="skeleton-row">
            <span className="skeleton-pos" />
            <span className="skeleton-bars">
              <span className="skeleton-bar" />
              <span className="skeleton-bar short" />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function QueueSection({
  title,
  items,
  tone,
  emptyTitle,
  emptyHint,
  interactive = false,
}: {
  title: string;
  items: QueueItem[];
  tone: 'ready' | 'route';
  emptyTitle: string;
  emptyHint: string;
  interactive?: boolean;
}) {
  return (
    <section
      className={`card queue-section ${tone === 'ready' ? 'is-ready' : 'is-route'}`}
      aria-label={title}
    >
      <div className="queue-section-head">
        <h2>{title}</h2>
        <span className="count-badge" aria-label={`${items.length} ${title.toLowerCase()}`}>
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="state">
          <StateIcon kind="empty" />
          <p className="state-title">{emptyTitle}</p>
          <p className="state-text">{emptyHint}</p>
        </div>
      ) : (
        <ol className="queue-list">
          {items.map((item, i) => (
            <li key={item.id}>
              <span className="queue-pos" aria-hidden="true">
                {i + 1}
              </span>
              <span className="queue-main">
                <span className="name">{item.studentName}</span>
                <span className="queue-chips">
                  {item.classroomName ? (
                    <span className="chip">{item.classroomName}</span>
                  ) : null}
                  {item.gate ? <span className="chip">{item.gate}</span> : null}
                  {item.etaMinutes != null ? (
                    <span className="chip eta">~{item.etaMinutes} min</span>
                  ) : null}
                </span>
                {interactive ? <EntryActions item={item} /> : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// Alerta de irmãos em portões diferentes (fase 2 do BACKLOG — a API já
// tinha GET sibling-gate-conflicts e o web não mostrava): um responsável
// com filhos ativos em 2+ portões. Sem o aviso, um filho espera no
// portão errado enquanto o outro já foi liberado. Lê por REST (não
// depende do socket da fila) e atualiza a cada 30 s e quando a fila
// muda; sem permissão (TUTOR) ou fora do ar, some em silêncio — a fila
// segue. O nome do aluno só aparece quando a fila ao vivo resolve o
// studentId; sem nome, a linha mostra a contagem — nunca um nome
// inventado. O "Aluno" do hook é o placeholder p/ nome ausente no
// evento, então não conta como nome resolvido.
function SiblingGateAlert({ items }: { items: QueueItem[] }) {
  const [conflicts, setConflicts] = useState<SiblingGateConflict[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void listSiblingGateConflicts()
        .then((c) => {
          if (!cancelled) setConflicts(c);
        })
        .catch(() => {
          // Sem permissão ou fora do ar: sem alerta, sem erro na tela.
        });
    };
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [items]);

  if (!conflicts || conflicts.length === 0) return null;

  const namesByStudentId = new Map<string, string>();
  for (const item of items) {
    if (item.studentId && item.studentName !== 'Aluno') {
      namesByStudentId.set(item.studentId, item.studentName);
    }
  }

  return (
    <section
      className="gate-alert"
      role="status"
      aria-label="Irmãos em portões diferentes"
    >
      <p className="gate-alert-title">
        <span className="gate-alert-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3.5L21 20H3L12 3.5z" />
            <path d="M12 10v4.5" />
            <path d="M12 17.6h.01" />
          </svg>
        </span>
        {conflicts.length === 1
          ? '1 responsável com filhos em portões diferentes'
          : `${conflicts.length} responsáveis com filhos em portões diferentes`}
      </p>
      <p className="gate-alert-text">
        Combine um só portão com o responsável antes de liberar — um filho
        pode ficar esperando no portão errado.
      </p>
      <ul className="gate-alert-list">
        {conflicts.map((conflict) => (
          <li key={conflict.tutorId}>
            {conflict.gates.map((g) => {
              const names = g.studentIds
                .map((id) => namesByStudentId.get(id))
                .filter((n): n is string => Boolean(n));
              const missing = g.studentIds.length - names.length;
              const parts = [...names];
              if (missing > 0) {
                parts.push(`${missing} ${missing === 1 ? 'aluno' : 'alunos'}`);
              }
              return (
                <span key={g.gate ?? 'fila-única'} className="gate-alert-gate">
                  <strong>{g.gate ?? 'Fila única'}</strong>
                  {' — '}
                  {parts.join(', ')}
                </span>
              );
            })}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PortariaPanel() {
  const { ready, enRoute, items, socketConnected, apiOnline, retry } = usePickupQueue();
  // A fila nasce vazia nesta sessão (só eventos ao vivo a preenchem), então
  // "vazio" e "ainda conectando" eram indistinguíveis — a tela afirmava
  // "nenhuma saída" antes mesmo de saber. Agora são 3 estados distintos.
  const loading = apiOnline === null;
  const apiDown = apiOnline === false;

  const conn =
    loading
      ? { tone: 'wait', label: 'Conectando à fila…' }
      : apiDown
        ? { tone: 'off', label: 'API fora do ar — a fila volta a atualizar assim que ela responder.' }
        : socketConnected
          ? { tone: 'live', label: 'Tempo real conectado' }
          : { tone: 'wait', label: 'API no ar · tempo real conectando…' };

  return (
    <main className="container">
      <h1>Painel da portaria</h1>
      <p>
        <span className={`conn-pill is-${conn.tone}`} role="status">
          <span className="status-dot" aria-hidden="true" />
          {conn.label}
        </span>
      </p>

      <SiblingGateAlert items={items} />

      <div className="queue-summary" role="group" aria-label="Resumo da fila">
        <div className="queue-stat">
          <strong>{loading ? '–' : items.length}</strong>
          <span>na fila agora</span>
        </div>
        <div className="queue-stat is-ready">
          <strong>{loading ? '–' : ready.length}</strong>
          <span>prontos p/ retirada</span>
        </div>
        <div className="queue-stat">
          <strong>{loading ? '–' : enRoute.length}</strong>
          <span>a caminho</span>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <>
          <p role="status">
            <span className="sr-only">Carregando a fila de saída…</span>
          </p>
          <QueueSkeleton title="Pronto para retirada" />
          <QueueSkeleton title="A caminho" />
        </>
      ) : apiDown && items.length === 0 ? (
        <div className="state state-error" role="alert">
          <StateIcon kind="error" />
          <p className="state-title">A fila não está atualizando</p>
          <p className="state-text">
            A API não respondeu. Nada foi perdido — tente de novo ou aguarde:
            a página verifica sozinha a cada 30 segundos.
          </p>
          <p className="state-action">
            <button type="button" className="btn" onClick={retry}>
              Tentar de novo
            </button>
          </p>
        </div>
      ) : items.length === 0 ? (
        <section className="card">
          <div className="state">
            <StateIcon kind="empty" />
            <p className="state-title">Nenhuma saída em andamento</p>
            <p className="state-text">
              Quando um tutor entrar na fila, ele aparece aqui automaticamente
              — não precisa recarregar a página.
            </p>
            <p className="state-action">
              <Link className="btn secondary" href="/telao">
                Ver no telão
              </Link>
            </p>
          </div>
        </section>
      ) : (
        <>
          <QueueSection
            title="Pronto para retirada"
            items={ready}
            tone="ready"
            emptyTitle="Ninguém pronto por enquanto"
            emptyHint="Quem chegar aparece aqui em cima."
            interactive
          />
          <QueueSection
            title="A caminho"
            items={enRoute}
            tone="route"
            emptyTitle="Ninguém a caminho por enquanto"
            emptyHint="Os tutores a caminho aparecem aqui com o tempo estimado."
            interactive
          />
          <p className="queue-actions">
            <Link className="btn secondary" href="/telao">
              Ver no telão
            </Link>
          </p>
        </>
      )}
    </main>
  );
}

export default function PortariaPage() {
  return (
    <RequireAuth area="portaria">
      <PortariaPanel />
    </RequireAuth>
  );
}
