'use client';

import Link from 'next/link';
import RequireAuth from '../../components/RequireAuth';
import { usePickupQueue, type QueueItem } from '../../lib/use-pickup-queue';

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
}: {
  title: string;
  items: QueueItem[];
  tone: 'ready' | 'route';
  emptyTitle: string;
  emptyHint: string;
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
              </span>
            </li>
          ))}
        </ol>
      )}
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
          />
          <QueueSection
            title="A caminho"
            items={enRoute}
            tone="route"
            emptyTitle="Ninguém a caminho por enquanto"
            emptyHint="Os tutores a caminho aparecem aqui com o tempo estimado."
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
