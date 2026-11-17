'use client';

import { usePickupQueue, type QueueItem } from '../../lib/use-pickup-queue';

function BigColumn({ title, items, emptyText }: { title: string; items: QueueItem[]; emptyText: string }) {
  return (
    <section className="col">
      <h2>{title}</h2>
      {items.length === 0 ? (
        <p className="empty">{emptyText}</p>
      ) : (
        <ul className="big-list">
          {items.map((item) => (
            <li key={item.id}>
              {item.studentName}
              {item.classroomName ? <span className="room">{item.classroomName}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function TelaoPage() {
  const { ready, enRoute, apiOnline, socketConnected } = usePickupQueue();

  return (
    <main className="telao">
      <h1>TutorPass — Saída</h1>
      <p style={{ color: '#9fb4c4', margin: 0 }}>
        {apiOnline === false
          ? 'Sem conexão com o servidor no momento. Tentando de novo automaticamente…'
          : socketConnected
            ? 'Atualizando em tempo real.'
            : 'Conectando…'}
      </p>
      <div className="cols">
        <BigColumn
          title="✅ Pronto para retirada"
          items={ready}
          emptyText="Nenhum aluno pronto agora."
        />
        <BigColumn
          title="🚗 A caminho"
          items={enRoute}
          emptyText="Nenhum tutor a caminho agora."
        />
      </div>
    </main>
  );
}
