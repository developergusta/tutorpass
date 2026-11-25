'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import RequireAuth from '../../components/RequireAuth';
import SiblingGateAlert from '../../components/SiblingGateAlert';
import {
  callQueueEntry,
  cancelQueueEntry,
  getTodayArrivals,
  registerMorningCheckIn,
  releaseQueueEntry,
  validateQueueQr,
  type TodayArrivalItem,
  type TodayArrivalsSummary,
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
                <span className="name">
                  {item.studentId ? (
                    <Link href={`/escola/ficha/${item.studentId}`}>{item.studentName}</Link>
                  ) : (
                    item.studentName
                  )}
                </span>
                <span className="queue-chips">
                  {item.classroomName ? (
                    <span className="chip">{item.classroomName}</span>
                  ) : null}
                  {item.gate ? <span className="chip">{item.gate}</span> : null}
                  {item.etaMinutes != null ? (
                    <span className="chip eta">~{item.etaMinutes} min</span>
                  ) : null}
                  {item.clinicalAlerts?.hasExpiredVaccination ? (
                    <span
                      className="badge danger"
                      title={`Vacina vencida: ${item.clinicalAlerts.expiredVaccines.join(', ')}`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="13"
                        height="13"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M12 3.5L21 20H3L12 3.5z" />
                        <path d="M12 10v4.5" />
                        <path d="M12 17.6h.01" />
                      </svg>
                      Vacina vencida ({item.clinicalAlerts.expiredVaccines.join(', ')})
                    </span>
                  ) : null}
                  {item.clinicalAlerts?.hasDaycareMedication ? (
                    <span
                      className="badge warn"
                      title={item.clinicalAlerts.medicationSummary ?? 'Medicação programada na creche'}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="13"
                        height="13"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 2" />
                      </svg>
                      Medicação na creche
                    </span>
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

function formatTimeBrt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function ChegadasDeHojePanel({ queueRevision }: { queueRevision: string }) {
  const [summary, setSummary] = useState<TodayArrivalsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInStudentId, setWalkInStudentId] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'ARRIVED' | 'EXPECTED' | 'NOT_ARRIVED'>('ALL');

  const loadArrivals = useCallback(async () => {
    try {
      const data = await getTodayArrivals();
      setSummary(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as chegadas de hoje.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadArrivals();
  }, [loadArrivals, queueRevision]);

  useEffect(() => {
    const id = setInterval(() => void loadArrivals(), 15_000);
    return () => clearInterval(id);
  }, [loadArrivals]);

  const unarrivedItems = useMemo(
    () => (summary?.items ?? []).filter((item) => !item.attendance),
    [summary],
  );

  const expectedItems = useMemo(
    () => (summary?.items ?? []).filter((item) => item.isExpectedFromPlan),
    [summary],
  );

  const visibleItems = useMemo(() => {
    const all = summary?.items ?? [];
    if (filterTab === 'ARRIVED') {
      return all.filter((item) => item.status === 'ARRIVED' || item.status === 'CHECKED_OUT');
    }
    if (filterTab === 'EXPECTED') {
      return all.filter((item) => item.isExpectedFromPlan);
    }
    if (filterTab === 'NOT_ARRIVED') {
      return all.filter((item) => !item.attendance);
    }
    return all;
  }, [summary, filterTab]);

  async function handleCheckIn(studentId: string, studentName: string) {
    setBusyStudentId(studentId);
    setError(null);
    setFeedback(null);
    try {
      const res = await registerMorningCheckIn({ studentId });
      const notifBody = res.notifications[0]?.body ?? 'Seu pet chegou à creche 🐾';
      setFeedback(`Chegada de ${studentName} registrada · Notificação enviada: "${notifBody}"`);
      setWalkInStudentId('');
      setWalkInOpen(false);
      await loadArrivals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao registrar chegada.');
    } finally {
      setBusyStudentId(null);
    }
  }

  function handleWalkInSubmit(e: FormEvent) {
    e.preventDefault();
    if (!walkInStudentId) return;
    const item = summary?.items.find((i) => i.studentId === walkInStudentId);
    if (!item) return;
    void handleCheckIn(item.studentId, item.studentName);
  }

  return (
    <section className="card queue-section" aria-label="Chegadas de hoje">
      <div className="queue-section-head" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <span className="ops-eyebrow">CHECK-IN DA MANHÃ · RECEPÇÃO</span>
          <h2 style={{ marginTop: 2 }}>Chegadas de hoje</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn secondary small"
            onClick={() => setWalkInOpen((v) => !v)}
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ marginRight: 6, verticalAlign: '-2px' }}
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            Registrar chegada (avulso / walk-in)
          </button>
        </div>
      </div>

      {/* Contadores: chegaram / esperados / não chegaram */}
      <div
        className="queue-summary"
        role="group"
        aria-label="Resumo das chegadas de hoje"
        style={{ marginTop: 12, marginBottom: 14 }}
      >
        <div className="queue-stat is-ready">
          <strong>{loading && !summary ? '–' : summary?.counts.arrived ?? 0}</strong>
          <span>
            chegaram hoje
            {summary && summary.counts.checkedOut > 0
              ? ` (${summary.counts.checkedOut} já retirado${summary.counts.checkedOut > 1 ? 's' : ''})`
              : ''}
          </span>
        </div>
        <div className="queue-stat">
          <strong>{loading && !summary ? '–' : summary?.counts.expected ?? 0}</strong>
          <span>esperados (plano padrão)</span>
        </div>
        <div className="queue-stat">
          <strong>{loading && !summary ? '–' : summary?.counts.notArrived ?? 0}</strong>
          <span>não chegaram</span>
        </div>
      </div>

      {/* Filtros rápidos do painel Chegadas de hoje */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <button
          type="button"
          className={`btn small ${filterTab === 'ALL' ? '' : 'secondary'}`}
          onClick={() => setFilterTab('ALL')}
        >
          Todos ({summary?.items.length ?? 0})
        </button>
        <button
          type="button"
          className={`btn small ${filterTab === 'ARRIVED' ? '' : 'secondary'}`}
          onClick={() => setFilterTab('ARRIVED')}
        >
          Chegaram ({summary?.counts.arrived ?? 0})
        </button>
        <button
          type="button"
          className={`btn small ${filterTab === 'EXPECTED' ? '' : 'secondary'}`}
          onClick={() => setFilterTab('EXPECTED')}
        >
          Esperados do plano ({expectedItems.length})
        </button>
        <button
          type="button"
          className={`btn small ${filterTab === 'NOT_ARRIVED' ? '' : 'secondary'}`}
          onClick={() => setFilterTab('NOT_ARRIVED')}
        >
          Não chegaram ({summary?.counts.notArrived ?? 0})
        </button>
      </div>

      {/* Opção Walk-in / Registrar chegada de qualquer pet ainda não presente */}
      {walkInOpen ? (
        <form
          onSubmit={handleWalkInSubmit}
          style={{
            padding: '12px 14px',
            marginBottom: 14,
            borderRadius: 10,
            border: '1px solid var(--border, rgba(255,255,255,0.12))',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <label htmlFor="walkin-student-select" style={{ fontSize: 13, fontWeight: 600 }}>
            Check-in avulso (walk-in) ou esperado:
          </label>
          <select
            id="walkin-student-select"
            value={walkInStudentId}
            onChange={(e) => setWalkInStudentId(e.target.value)}
            style={{ minWidth: 220, padding: '6px 10px', borderRadius: 6 }}
          >
            <option value="">Selecione um pet pendente de chegada…</option>
            {unarrivedItems.map((item) => (
              <option key={item.studentId} value={item.studentId}>
                {item.studentName}
                {item.classroomName ? ` · ${item.classroomName}` : ''}
                {item.isExpectedFromPlan ? ' (Esperado hoje)' : ' (Walk-in / Sem plano)'}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="btn small"
            disabled={!walkInStudentId || busyStudentId !== null}
          >
            {busyStudentId ? 'Registrando…' : 'Registrar chegada'}
          </button>
          {unarrivedItems.length === 0 ? (
            <span className="muted" style={{ fontSize: 13 }}>
              Todos os pets ativos já registraram chegada hoje.
            </span>
          ) : null}
        </form>
      ) : null}

      {feedback ? (
        <p
          role="status"
          style={{
            margin: '0 0 12px',
            padding: '10px 12px',
            borderRadius: 8,
            background: 'rgba(22, 163, 74, 0.14)',
            border: '1px solid rgba(22, 163, 74, 0.35)',
            fontSize: 13,
          }}
        >
          {feedback}
        </p>
      ) : null}

      {error ? (
        <p className="queue-item-error" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </p>
      ) : null}

      {visibleItems.length === 0 ? (
        <div className="state">
          <StateIcon kind="empty" />
          <p className="state-title">Nenhum registro neste filtro</p>
          <p className="state-text">
            Altere o filtro acima ou use &ldquo;Registrar chegada&rdquo; quando um pet chegar à recepção.
          </p>
        </div>
      ) : (
        <ol className="queue-list">
          {visibleItems.map((item: TodayArrivalItem, idx: number) => {
            const arrived = item.attendance !== null;
            const checkedOut = item.attendance?.checkOutAt != null;
            return (
              <li key={item.studentId}>
                <span className="queue-pos" aria-hidden="true">
                  {idx + 1}
                </span>
                <span className="queue-main">
                  <span className="name">
                    <Link href={`/escola/ficha/${item.studentId}`}>{item.studentName}</Link>
                  </span>
                  <span className="queue-chips">
                    {item.classroomName ? (
                      <span className="chip">{item.classroomName}</span>
                    ) : null}
                    {checkedOut ? (
                      <span className="chip ok">
                        Entregue às {formatTimeBrt(item.attendance?.checkOutAt)} (check-in{' '}
                        {formatTimeBrt(item.attendance?.checkInAt)})
                      </span>
                    ) : arrived ? (
                      <span className="chip ok">
                        Na creche · Chegou às {formatTimeBrt(item.attendance?.checkInAt)}
                      </span>
                    ) : item.isExpectedFromPlan ? (
                      <span className="chip">
                        Esperado hoje
                        {item.expectedPlan.pickupBy ? ` · ${item.expectedPlan.pickupBy}` : ''}
                      </span>
                    ) : (
                      <span className="chip">Não chegou · Walk-in disponível</span>
                    )}
                    {item.clinicalAlerts?.hasExpiredVaccination ? (
                      <span
                        className="badge danger"
                        title={`Vacina vencida: ${item.clinicalAlerts.expiredVaccines.join(', ')}`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="13"
                          height="13"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M12 3.5L21 20H3L12 3.5z" />
                          <path d="M12 10v4.5" />
                          <path d="M12 17.6h.01" />
                        </svg>
                        Vacina vencida ({item.clinicalAlerts.expiredVaccines.join(', ')})
                      </span>
                    ) : null}
                    {item.clinicalAlerts?.hasDaycareMedication ? (
                      <span
                        className="badge warn"
                        title={
                          item.clinicalAlerts.medicationSummary ?? 'Medicação programada na creche'
                        }
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="13"
                          height="13"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 7v5l3 2" />
                        </svg>
                        Medicação na creche
                      </span>
                    ) : null}
                  </span>
                  <span className="entry-actions">
                    {!arrived ? (
                      <button
                        type="button"
                        className="btn small"
                        disabled={busyStudentId !== null}
                        onClick={() => void handleCheckIn(item.studentId, item.studentName)}
                      >
                        {busyStudentId === item.studentId ? 'Registrando…' : 'Registrar chegada'}
                      </button>
                    ) : null}
                    <Link
                      className="btn secondary small"
                      href={`/escola/ficha/${item.studentId}`}
                    >
                      Ficha do Pet
                    </Link>
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// Alerta de irmãos em portões diferentes (fase 2 do BACKLOG — a API já
// tinha GET sibling-gate-conflicts e o web não mostrava): um responsável
// com filhos ativos em 2+ portões. Sem o aviso, um filho espera no
function PortariaPanel() {
  const { ready, enRoute, items, socketConnected, apiOnline, retry } = usePickupQueue();
  const queueRevision = useMemo(
    () => items.map((i) => `${i.id}:${i.status ?? ''}`).join('|'),
    [items],
  );
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
    <main id="conteudo" tabIndex={-1} className="container container-wide ops-main">
      <header className="ops-header">
        <div className="ops-header-title">
          <span className="ops-eyebrow">TERMINAL DE PORTÃO · LINEAR OPS</span>
          <h1>Painel da portaria</h1>
        </div>
        <div className="ops-header-controls">
          <span className={`conn-pill is-${conn.tone}`} role="status">
            <span className="status-dot" aria-hidden="true" />
            {conn.label}
          </span>
          <Link className="btn secondary small" href="/telao">
            Ver no telão
          </Link>
        </div>
      </header>

      <SiblingGateAlert items={items} />

      <ChegadasDeHojePanel queueRevision={queueRevision} />

      {/* Resumo da fila como região viva (WCAG 4.1.3, ciclo UI 16): a
          portaria muda sozinha quando um tutor entra na fila — sem o
          anúncio, quem usa leitor de tela não sabe que o número mudou.
          `polite` (não interrompe) + `atomic` (lê o resumo inteiro, não
          só o dígito que mudou). A região já existe no DOM desde a
          montagem, então o anúncio dispara a cada mudança. */}
      <div
        className="queue-summary"
        role="group"
        aria-label="Resumo da fila"
        aria-live="polite"
        aria-atomic="true"
      >
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
    <div className="ops-surface">
      <RequireAuth area="portaria">
        <PortariaPanel />
      </RequireAuth>
    </div>
  );
}
