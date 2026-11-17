'use client';

import { useEffect, useState } from 'react';
import RequireAuth from '../../components/RequireAuth';
import SiblingGateAlert from '../../components/SiblingGateAlert';
import { usePickupQueue, type QueueItem } from '../../lib/use-pickup-queue';

// Telão — design próprio de "painel de saída" (não é uma página do admin):
// palco escuro em tela cheia, relógio ao vivo, painel de PRONTOS em verde
// aceso (é o que a família procura) e painel A CAMINHO calmo, com ETA.
// Pensado p/ leitura a 5+ metros: nomes gigantes, contraste alto e o item
// mais recente pulsando com a marca AGORA.

function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function ReadyPanel({ items, loading }: { items: QueueItem[]; loading: boolean }) {
  return (
    <section className="telao-panel is-ready">
      <header className="telao-panel-head">
        <h2>Pode retirar agora</h2>
        <span className="telao-count">{loading ? '–' : items.length}</span>
      </header>
      {loading && items.length === 0 ? (
        <div role="status">
          <span className="sr-only">Carregando a fila de saída…</span>
          <div className="telao-skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="telao-empty">
          <p className="telao-empty-big">Nenhum aluno pronto agora</p>
          <p>Quando um tutor chegar, o nome aparece aqui na hora.</p>
        </div>
      ) : (
        <ul className="telao-list">
          {items.map((item, i) => (
            <li key={item.id} className={i === 0 ? 'is-now' : undefined}>
              <span className="telao-name">{item.studentName}</span>
              <span className="telao-tags">
                {i === 0 ? <span className="telao-tag tag-now">Agora</span> : null}
                {item.classroomName ? (
                  <span className="telao-tag">{item.classroomName}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EnRoutePanel({ items, loading }: { items: QueueItem[]; loading: boolean }) {
  return (
    <section className="telao-panel is-route">
      <header className="telao-panel-head">
        <h2>A caminho</h2>
        <span className="telao-count">{loading ? '–' : items.length}</span>
      </header>
      {loading && items.length === 0 ? (
        <div role="status">
          <span className="sr-only">Carregando a fila de saída…</span>
          <div className="telao-skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="telao-empty">
          <p className="telao-empty-big">Ninguém a caminho agora</p>
          <p>Os tutores a caminho aparecem aqui com o tempo estimado.</p>
        </div>
      ) : (
        <ul className="telao-list">
          {items.map((item) => (
            <li key={item.id}>
              <span className="telao-name">{item.studentName}</span>
              <span className="telao-tags">
                {item.etaMinutes != null ? (
                  <span className="telao-tag tag-eta">~{item.etaMinutes} min</span>
                ) : null}
                {item.classroomName ? (
                  <span className="telao-tag">{item.classroomName}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TelaoPanel() {
  const { ready, enRoute, items, apiOnline, socketConnected } = usePickupQueue();
  const now = useClock();
  const loading = apiOnline === null;

  const status =
    apiOnline === false
      ? { kind: 'off', label: 'Sem conexão — tentando de novo…' }
      : socketConnected
        ? { kind: 'live', label: 'Ao vivo' }
        : { kind: 'wait', label: 'Conectando…' };

  return (
    <main className="telao">
      <header className="telao-top">
        <div className="telao-brand">
          <span className="telao-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l7 3v5c0 4.5-3 8.1-7 9.5C8 19.1 5 15.5 5 11V6l7-3z" />
              <path d="M9 11.6l2.1 2.1L15.4 9.4" />
            </svg>
          </span>
          <span className="telao-brand-text">
            <strong>TutorPass</strong>
            <span>Painel de saída</span>
          </span>
        </div>
        <div className="telao-top-right">
          <span className={`telao-status is-${status.kind}`}>
            <span className="telao-dot" aria-hidden="true" />
            {status.label}
          </span>
          <span className="telao-clock">
            <strong>
              {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </strong>
            <span>
              {now.toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </span>
          </span>
        </div>
      </header>

      {/* Irmãos em portões diferentes (ciclo UI 13): a versão compacta do
          alerta — só a contagem, sem nomes nem portões, porque o telão é
          público. Quem resolve é a portaria, que tem o detalhe. */}
      <SiblingGateAlert items={items} compact />

      <div className="telao-cols">
        <ReadyPanel items={ready} loading={loading} />
        <EnRoutePanel items={enRoute} loading={loading} />
      </div>

      <footer className="telao-foot">
        <span>
          {loading ? '–' : ready.length} pronto(s) · {loading ? '–' : enRoute.length} a caminho
        </span>
        <span>Aproxime-se da portaria quando o nome aparecer em verde.</span>
      </footer>
    </main>
  );
}

export default function TelaoPage() {
  return (
    <RequireAuth area="telão">
      <TelaoPanel />
    </RequireAuth>
  );
}
