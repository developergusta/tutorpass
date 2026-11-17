'use client';

import Link from 'next/link';
import { usePickupQueue, type QueueItem } from '../../lib/use-pickup-queue';

function QueueSection({ title, items }: { title: string; items: QueueItem[] }) {
  return (
    <section className="card">
      <h2>
        {title} ({items.length})
      </h2>
      {items.length === 0 ? (
        <p className="empty">Ninguém aqui por enquanto.</p>
      ) : (
        <ul className="queue-list">
          {items.map((item) => (
            <li key={item.id}>
              <span>
                <span className="name">{item.studentName}</span>
                {item.classroomName ? (
                  <span className="muted"> — {item.classroomName}</span>
                ) : null}
              </span>
              {item.etaMinutes != null ? (
                <span className="muted">~{item.etaMinutes} min</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function PortariaPage() {
  const { ready, enRoute, items, socketConnected, apiOnline } = usePickupQueue();

  return (
    <main className="container">
      <h1>Painel da portaria</h1>
      <p>
        <span
          className={`status-dot ${apiOnline === null ? '' : apiOnline ? 'on' : 'off'}`}
        />
        {apiOnline === null
          ? 'Verificando a conexão com a API…'
          : apiOnline
            ? socketConnected
              ? 'API no ar e tempo real conectado.'
              : 'API no ar. Tempo real conectando… (a fila atualiza sozinha quando conectar)'
            : 'API fora do ar no momento — a fila volta a atualizar assim que ela responder.'}
      </p>

      {items.length === 0 ? (
        <section className="card">
          <p className="empty">
            Nenhuma saída em andamento agora. Quando um tutor entrar na fila,
            ele aparece aqui automaticamente — não precisa recarregar a página.
          </p>
          <p style={{ textAlign: 'center' }}>
            <Link className="btn secondary" href="/telao">
              Ver no telão
            </Link>
          </p>
        </section>
      ) : (
        <>
          <QueueSection title="Pronto para retirada" items={ready} />
          <QueueSection title="A caminho" items={enRoute} />
        </>
      )}
    </main>
  );
}
