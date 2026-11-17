'use client';

import Link from 'next/link';
import { usePickupQueue, type QueueItem } from '../../lib/use-pickup-queue';

function QueueSection({
  title,
  items,
  tone,
  emptyHint,
}: {
  title: string;
  items: QueueItem[];
  tone: 'ready' | 'route';
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
        <p className="empty">{emptyHint}</p>
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

export default function PortariaPage() {
  const { ready, enRoute, items, socketConnected, apiOnline } = usePickupQueue();

  const conn =
    apiOnline === null
      ? { tone: 'wait', label: 'Verificando a conexão com a API…' }
      : !apiOnline
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
          <strong>{items.length}</strong>
          <span>na fila agora</span>
        </div>
        <div className="queue-stat is-ready">
          <strong>{ready.length}</strong>
          <span>prontos p/ retirada</span>
        </div>
        <div className="queue-stat">
          <strong>{enRoute.length}</strong>
          <span>a caminho</span>
        </div>
      </div>

      {items.length === 0 ? (
        <section className="card">
          <p className="empty">
            Nenhuma saída em andamento agora. Quando um tutor entrar na fila,
            ele aparece aqui automaticamente — não precisa recarregar a página.
          </p>
          <p className="queue-actions">
            <Link className="btn secondary" href="/telao">
              Ver no telão
            </Link>
          </p>
        </section>
      ) : (
        <>
          <QueueSection
            title="Pronto para retirada"
            items={ready}
            tone="ready"
            emptyHint="Ninguém pronto para retirada por enquanto — quem chegar aparece aqui em cima."
          />
          <QueueSection
            title="A caminho"
            items={enRoute}
            tone="route"
            emptyHint="Ninguém a caminho por enquanto."
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
