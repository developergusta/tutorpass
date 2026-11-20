'use client';

import { useEffect, useState } from 'react';
import RequireAuth from '../../components/RequireAuth';
import { listClassrooms, type Classroom } from '../../lib/api';
import { usePickupQueue, type QueueItem } from '../../lib/use-pickup-queue';

// A sala do professor (17/11/2026): até aqui o TEACHER entrava e via a
// portaria/telão genéricos — sem a SUA turma. Agora: ele escolhe a
// turma e acompanha só os alunos dela — quem já foi chamado (manda
// para o portão) e quem está na fila (responsável a caminho). A tela é
// de leitura: quem opera a fila é a portaria. A API liberou a leitura
// do cadastro para TEACHER junto desta tela (antes era 403).

const STORAGE_KEY = 'tutorpass.sala.classroom';

function SalaPanel() {
  const [classrooms, setClassrooms] = useState<Classroom[] | null>(null);
  const [selected, setSelected] = useState<string>('');

  useEffect(() => {
    let alive = true;
    void listClassrooms()
      .then((list) => {
        if (!alive) return;
        setClassrooms(list);
        const saved = window.localStorage.getItem(STORAGE_KEY);
        const initial =
          list.find((c) => c.id === saved)?.id ?? list[0]?.id ?? '';
        setSelected(initial);
      })
      .catch(() => {
        if (alive) setClassrooms([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const { items, socketConnected, apiOnline, retry } = usePickupQueue({
    classroomId: selected || undefined,
  });

  const mine = items.filter((i) => !selected || i.classroomId === selected);
  const called = mine.filter(
    (i) => i.status === 'CALLED' || i.status === 'VALIDATED',
  );
  const queued = mine.filter(
    (i) => i.status !== 'CALLED' && i.status !== 'VALIDATED',
  );

  const loading = apiOnline === null;
  const conn = loading
    ? { tone: 'wait', label: 'Conectando à fila…' }
    : apiOnline === false
      ? { tone: 'off', label: 'API fora do ar — a sala volta a atualizar assim que ela responder.' }
      : socketConnected
        ? { tone: 'live', label: 'Tempo real conectado' }
        : { tone: 'wait', label: 'API no ar · tempo real conectando…' };

  function onSelect(id: string) {
    setSelected(id);
    window.localStorage.setItem(STORAGE_KEY, id);
  }

  return (
    <main id="conteudo" tabIndex={-1} className="container container-wide ops-main">
      <header className="ops-header">
        <div className="ops-header-title">
          <span className="ops-eyebrow">TERMINAL DOCENTE · LINEAR OPS</span>
          <h1>Sala de aula</h1>
        </div>
        <div className="ops-header-controls">
          <span className={`conn-pill is-${conn.tone}`} role="status">
            <span className="status-dot" aria-hidden="true" />
            {conn.label}
          </span>
        </div>
      </header>

      {classrooms === null ? (
        <p role="status">Carregando as turmas…</p>
      ) : classrooms.length === 0 ? (
        <div className="state" role="status">
          <p className="state-title">Nenhuma turma encontrada</p>
          <p className="state-text">
            A sua escola ainda não tem turmas ativas no cadastro, ou a leitura
            não foi liberada para o seu perfil. Fale com a coordenação.
          </p>
          <p>
            <button className="btn secondary" type="button" onClick={retry}>
              Tentar de novo
            </button>
          </p>
        </div>
      ) : (
        <>
          <div className="sala-picker">
            <label htmlFor="sala-turma">Minha turma</label>
            <select
              id="sala-turma"
              value={selected}
              onChange={(e) => onSelect(e.target.value)}
            >
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.grade ? ` · ${c.grade}` : ''}
                </option>
              ))}
            </select>
          </div>

          <section className="card queue-section is-ready" aria-label="Alunos chamados">
            <div className="queue-section-head">
              <div>
                <h2>Indo para o portão ({called.length})</h2>
                <p className="muted ops-section-sub">
                  A portaria chamou — pode mandar estes alunos para o portão.
                </p>
              </div>
              <span className="count-badge">{called.length}</span>
            </div>
            {called.length === 0 ? (
              <p className="muted ops-empty-row">Nenhum aluno da sua turma foi chamado ainda.</p>
            ) : (
              <ul className="queue-list">
                {called.map((item) => (
                  <SalaRow key={item.id} item={item} highlight />
                ))}
              </ul>
            )}
          </section>

          <section className="card queue-section is-route" aria-label="Alunos na fila">
            <div className="queue-section-head">
              <div>
                <h2>Na fila ({queued.length})</h2>
                <p className="muted ops-section-sub">
                  O responsável já entrou na fila e está a caminho da escola.
                </p>
              </div>
              <span className="count-badge">{queued.length}</span>
            </div>
            {queued.length === 0 ? (
              <p className="muted ops-empty-row">Ninguém da sua turma na fila agora.</p>
            ) : (
              <ul className="queue-list">
                {queued.map((item) => (
                  <SalaRow key={item.id} item={item} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function SalaRow({ item, highlight = false }: { item: QueueItem; highlight?: boolean }) {
  return (
    <li className={highlight ? 'is-now' : undefined}>
      <span className="name">{item.studentName}</span>
      {item.gate ? <span className="chip">{item.gate}</span> : null}
      {item.status === 'VALIDATED' ? <span className="chip ok">Validado</span> : null}
    </li>
  );
}

export default function SalaPage() {
  return (
    <div className="ops-surface">
      <RequireAuth area="sala">
        <SalaPanel />
      </RequireAuth>
    </div>
  );
}
