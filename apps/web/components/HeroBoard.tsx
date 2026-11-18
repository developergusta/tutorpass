'use client';

import { useCallback, useEffect, useState } from 'react';

type StudentEntry = {
  id: string;
  name: string;
  grade: string;
  classroom: string;
  tutorName: string;
  relation: string;
  status: 'EN_ROUTE' | 'CALLED' | 'VALIDATED' | 'RELEASED';
  eta: number;
  nonce: string;
  hash: string;
  prevHash: string;
  time: string;
};

type AuditRecord = {
  seq: number;
  time: string;
  event: string;
  student: string;
  gate: string;
  hash: string;
  prev: string;
};

const INITIAL_ENTRIES: Record<string, StudentEntry[]> = {
  'Portão Principal': [
    {
      id: 'st-1',
      name: 'Alice Martins',
      grade: '3º B',
      classroom: 'Sala 14 · Bloco A',
      tutorName: 'Mariana Martins',
      relation: 'Mãe',
      status: 'CALLED',
      eta: 0,
      nonce: '84A2-91F',
      hash: '9f3a8c12e81c',
      prevHash: '4c127b09ab10',
      time: '17:42:18',
    },
    {
      id: 'st-2',
      name: 'Pedro Santos',
      grade: '5º A',
      classroom: 'Sala 22 · Bloco B',
      tutorName: 'Ricardo Santos',
      relation: 'Pai',
      status: 'VALIDATED',
      eta: 0,
      nonce: '31C9-04D',
      hash: '4c127b09ab10',
      prevHash: '7d8814f2c301',
      time: '17:41:52',
    },
    {
      id: 'st-3',
      name: 'Lucas Almeida',
      grade: '4º B',
      classroom: 'Sala 18 · Bloco A',
      tutorName: 'Cláudia Almeida',
      relation: 'Mãe',
      status: 'EN_ROUTE',
      eta: 2,
      nonce: '77E1-52A',
      hash: '3e71c40d9a22',
      prevHash: '9f3a8c12e81c',
      time: '17:42:05',
    },
    {
      id: 'st-4',
      name: 'Sofia Ribeiro',
      grade: '1º A',
      classroom: 'Sala 03 · Térreo',
      tutorName: 'Helena Ribeiro',
      relation: 'Avó autorizada',
      status: 'EN_ROUTE',
      eta: 4,
      nonce: '19B4-88C',
      hash: '8a05f92b11e4',
      prevHash: '3e71c40d9a22',
      time: '17:40:49',
    },
  ],
  'Educação Infantil': [
    {
      id: 'st-5',
      name: 'Maria Clara Souza',
      grade: 'Infantil IV',
      classroom: 'Sala Girassol · Térreo',
      tutorName: 'Teresa Souza',
      relation: 'Avó autorizada',
      status: 'CALLED',
      eta: 0,
      nonce: '63D0-19E',
      hash: '7d8814f2c301',
      prevHash: '2c6391b408fa',
      time: '17:42:10',
    },
    {
      id: 'st-6',
      name: 'Davi Oliveira',
      grade: 'Infantil III',
      classroom: 'Sala Ipê · Térreo',
      tutorName: 'Felipe Oliveira',
      relation: 'Pai',
      status: 'EN_ROUTE',
      eta: 3,
      nonce: '50F8-33B',
      hash: '2c6391b408fa',
      prevHash: '5f49d08a77c1',
      time: '17:41:14',
    },
  ],
};

const INITIAL_AUDIT: AuditRecord[] = [
  {
    seq: 484,
    time: '17:42:18',
    event: 'STUDENT_CALLED',
    student: 'Alice Martins (3º B)',
    gate: 'Portão Principal',
    hash: '9f3a…e81c',
    prev: '4c12…ab10',
  },
  {
    seq: 483,
    time: '17:41:52',
    event: 'QR_NONCE_VALIDATED',
    student: 'Pedro Santos (5º A)',
    gate: 'Portão Principal',
    hash: '4c12…ab10',
    prev: '7d88…c301',
  },
  {
    seq: 482,
    time: '17:41:10',
    event: 'GEOFENCE_CONFIRMED_2X',
    student: 'Lucas Almeida (4º B)',
    gate: 'Portão Principal',
    hash: '7d88…c301',
    prev: '3e71…9a22',
  },
];

const GATES = ['Portão Principal', 'Educação Infantil'] as const;

type RoleTab = 'portaria' | 'sala' | 'familia' | 'telao' | 'custodia';

export default function HeroBoard() {
  const [gate, setGate] = useState<(typeof GATES)[number]>('Portão Principal');
  const [roleTab, setRoleTab] = useState<RoleTab>('portaria');
  const [entriesByGate, setEntriesByGate] = useState(INITIAL_ENTRIES);
  const [selectedId, setSelectedId] = useState<string>('st-1');
  const [auditLog, setAuditLog] = useState<AuditRecord[]>(INITIAL_AUDIT);
  const [qrSeconds, setQrSeconds] = useState(24);
  const [replayBlocked, setReplayBlocked] = useState<string | null>(null);

  const currentList = entriesByGate[gate] ?? [];
  const activeStudent =
    currentList.find((item) => item.id === selectedId) ?? currentList[0];

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => {
      setQrSeconds((s) => (s <= 1 ? 30 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const pushAudit = useCallback(
    (event: string, student: StudentEntry, newHash: string) => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setAuditLog((prev) => [
        {
          seq: (prev[0]?.seq ?? 484) + 1,
          time: timeStr,
          event,
          student: `${student.name} (${student.grade})`,
          gate,
          hash: `${newHash.slice(0, 4)}…${newHash.slice(-4)}`,
          prev: prev[0]?.hash ?? '9f3a…e81c',
        },
        ...prev.slice(0, 4),
      ]);
    },
    [gate],
  );

  function advanceStudent(student: StudentEntry) {
    setReplayBlocked(null);
    const nextStatus: Record<StudentEntry['status'], StudentEntry['status']> = {
      EN_ROUTE: 'CALLED',
      CALLED: 'VALIDATED',
      VALIDATED: 'RELEASED',
      RELEASED: 'EN_ROUTE',
    };
    const nextEvent: Record<StudentEntry['status'], string> = {
      EN_ROUTE: 'STUDENT_CALLED',
      CALLED: 'QR_NONCE_VALIDATED',
      VALIDATED: 'CUSTODY_RELEASED',
      RELEASED: 'GEOFENCE_CONFIRMED_2X',
    };
    const updatedStatus = nextStatus[student.status];
    const randomHex = Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, '0');
    const newHash = `${randomHex}e81c9a`;

    setEntriesByGate((prev) => ({
      ...prev,
      [gate]: prev[gate].map((item) =>
        item.id === student.id
          ? {
              ...item,
              status: updatedStatus,
              eta: updatedStatus === 'EN_ROUTE' ? 3 : 0,
              prevHash: item.hash,
              hash: newHash,
            }
          : item,
      ),
    }));

    pushAudit(nextEvent[student.status], student, newHash);
  }

  function simulateReplayAttack() {
    if (!activeStudent) return;
    setReplayBlocked(
      `401 QR_REJECTED — Nonce #${activeStudent.nonce} já consumido ou expirado. Tentativa gravada no livro SHA-256.`,
    );
    pushAudit('REPLAY_ATTEMPT_BLOCKED', activeStudent, 'err401blocked');
  }

  function resetDemo() {
    setEntriesByGate(INITIAL_ENTRIES);
    setAuditLog(INITIAL_AUDIT);
    setSelectedId('st-1');
    setReplayBlocked(null);
  }

  const readyList = currentList.filter(
    (i) => i.status === 'CALLED' || i.status === 'VALIDATED',
  );
  const routeList = currentList.filter((i) => i.status === 'EN_ROUTE');
  const releasedList = currentList.filter((i) => i.status === 'RELEASED');

  const statusBadge = (status: StudentEntry['status']) => {
    switch (status) {
      case 'EN_ROUTE':
        return { label: 'A caminho', cls: 'st-route' };
      case 'CALLED':
        return { label: 'Chamado à baia', cls: 'st-called' };
      case 'VALIDATED':
        return { label: 'QR validado', cls: 'st-validated' };
      case 'RELEASED':
        return { label: 'Entregue', cls: 'st-released' };
    }
  };

  const actionButtonLabel = (status: StudentEntry['status']) => {
    switch (status) {
      case 'EN_ROUTE':
        return '1. Chamar aluno para o portão';
      case 'CALLED':
        return '2. Validar QR dinâmico do responsável';
      case 'VALIDATED':
        return '3. Confirmar entrega e assinar SHA-256';
      case 'RELEASED':
        return 'Simular nova chegada deste aluno';
    }
  };

  return (
    <section
      className="wb-shell"
      aria-label="Mesa de despacho interativa em tempo real"
    >
      {/* Barra superior técnica da bancada */}
      <div className="wb-topbar">
        <div className="wb-gates" role="group" aria-label="Selecionar portão">
          {GATES.map((g) => (
            <button
              key={g}
              type="button"
              className={`wb-gate-btn${gate === g ? ' is-active' : ''}`}
              onClick={() => {
                setGate(g);
                const first = INITIAL_ENTRIES[g]?.[0];
                if (first) setSelectedId(first.id);
                setReplayBlocked(null);
              }}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="wb-views" role="tablist" aria-label="Alternar lente operacional">
          {(
            [
              ['portaria', '1. Visão Portaria'],
              ['sala', '2. Visão Sala de Aula'],
              ['familia', '3. Celular da Família'],
              ['telao', '4. Telão do Pátio'],
              ['custodia', '5. Livro SHA-256'],
            ] as [RoleTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={roleTab === id}
              className={`wb-view-tab${roleTab === id ? ' is-active' : ''}`}
              onClick={() => setRoleTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="wb-telemetry">
          <span className="wb-live-dot" aria-hidden="true" />
          <span>Simulador interativo</span>
          <button
            type="button"
            className="wb-reset-btn"
            onClick={resetDemo}
            title="Restaurar fila inicial"
          >
            Reiniciar
          </button>
        </div>
      </div>

      {/* Corpo principal da bancada: 2 colunas operacionais */}
      <div className="wb-body">
        {/* Coluna 1: Fila do portão */}
        <div className="wb-queue-col">
          <div className="wb-col-head">
            <span>Fila ativa · {gate}</span>
            <span className="wb-mono">
              {readyList.length} na baia · {routeList.length} a caminho
            </span>
          </div>

          <ul className="wb-student-list" aria-label="Alunos na fila de saída">
            {currentList.map((item) => {
              const badge = statusBadge(item.status);
              const isSelected = activeStudent?.id === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`wb-student-row${isSelected ? ' is-selected' : ''} is-${item.status.toLowerCase()}`}
                    onClick={() => {
                      setSelectedId(item.id);
                      setReplayBlocked(null);
                    }}
                  >
                    <div className="wb-student-main">
                      <span className="wb-student-name">{item.name}</span>
                      <span className="wb-student-meta">
                        <span className="wb-grade-tag">{item.grade}</span>
                        <span>
                          {item.tutorName} ({item.relation})
                        </span>
                      </span>
                    </div>
                    <div className="wb-student-right">
                      <span className={`wb-status-chip ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <span className="wb-eta-code">
                        {item.status === 'EN_ROUTE'
                          ? `~${item.eta} min`
                          : `#${item.nonce.slice(0, 4)}`}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="wb-helper-note">
            Clique em um aluno acima ou avance o passo ao lado para testar cada
            terminal.
          </p>
        </div>

        {/* Coluna 2: Inspetor contextual que muda conforme a lente escolhida */}
        <div className="wb-inspector-col">
          {activeStudent ? (
            <>
              {roleTab === 'portaria' && (
                <div className="wb-pane">
                  <div className="wb-col-head">
                    <span>Inspetor do Agente de Portão</span>
                    <span className="wb-mono">NONCE #{activeStudent.nonce}</span>
                  </div>

                  <div className="wb-dossier">
                    <div className="wb-dossier-top">
                      <div>
                        <span className="wb-dossier-label">Aluno selecionado</span>
                        <h3 className="wb-dossier-name">{activeStudent.name}</h3>
                        <p className="wb-dossier-sub">
                          {activeStudent.grade} · {activeStudent.classroom}
                        </p>
                      </div>
                      <span
                        className={`wb-status-chip ${statusBadge(activeStudent.status).cls}`}
                      >
                        {statusBadge(activeStudent.status).label}
                      </span>
                    </div>

                    <dl className="wb-dossier-grid">
                      <div>
                        <dt>Portador autorizado</dt>
                        <dd>
                          {activeStudent.tutorName} ({activeStudent.relation})
                        </dd>
                      </div>
                      <div>
                        <dt>Janela do QR dinâmico</dt>
                        <dd className="wb-mono">
                          Expira em {String(qrSeconds).padStart(2, '0')}s (uso único)
                        </dd>
                      </div>
                      <div>
                        <dt>Hash SHA-256 do evento</dt>
                        <dd className="wb-mono">{activeStudent.hash}</dd>
                      </div>
                      <div>
                        <dt>Encadeado ao evento anterior</dt>
                        <dd className="wb-mono">{activeStudent.prevHash}</dd>
                      </div>
                    </dl>

                    {replayBlocked ? (
                      <div className="wb-alert-err" role="alert">
                        {replayBlocked}
                      </div>
                    ) : null}

                    <div className="wb-actions">
                      <button
                        type="button"
                        className="wb-primary-action"
                        onClick={() => advanceStudent(activeStudent)}
                      >
                        {actionButtonLabel(activeStudent.status)}
                      </button>
                      <button
                        type="button"
                        className="wb-secondary-action"
                        onClick={simulateReplayAttack}
                      >
                        Testar print clonado (401)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {roleTab === 'sala' && (
                <div className="wb-pane">
                  <div className="wb-col-head">
                    <span>Terminal da Professora (/sala)</span>
                    <span className="wb-mono">{activeStudent.classroom}</span>
                  </div>
                  <div className="wb-dossier">
                    <p className="wb-pane-intro">
                      Na sala de aula, nenhum microfone interrompe a turma. A
                      professora enxerga apenas quem já teve presença confirmada no
                      portão:
                    </p>
                    <div className="wb-classroom-board">
                      <div className="wb-cb-group">
                        <span className="wb-cb-title">
                          Liberar agora para o {gate} ({readyList.length})
                        </span>
                        {readyList.length === 0 ? (
                          <p className="wb-cb-empty">
                            Nenhum aluno chamado no portão neste instante.
                          </p>
                        ) : (
                          readyList.map((s) => (
                            <div key={s.id} className="wb-cb-row is-urgent">
                              <strong>
                                {s.name} ({s.grade})
                              </strong>
                              <span className="wb-mono">
                                Enviar ao {gate} · {s.tutorName} aguardando
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="wb-cb-group">
                        <span className="wb-cb-title">
                          Prepare a mochila — responsável a caminho ({routeList.length})
                        </span>
                        {routeList.map((s) => (
                          <div key={s.id} className="wb-cb-row">
                            <span>
                              {s.name} ({s.grade})
                            </span>
                            <span className="wb-mono">Chegada em ~{s.eta} min</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="wb-actions">
                      <button
                        type="button"
                        className="wb-primary-action"
                        onClick={() => advanceStudent(activeStudent)}
                      >
                        {actionButtonLabel(activeStudent.status)}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {roleTab === 'familia' && (
                <div className="wb-pane">
                  <div className="wb-col-head">
                    <span>Tela do Responsável (/responsavel)</span>
                    <span className="wb-mono">{activeStudent.tutorName}</span>
                  </div>
                  <div className="wb-dossier wb-family-view">
                    <div className="wb-qr-sim">
                      <svg
                        viewBox="0 0 64 64"
                        width="88"
                        height="88"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        aria-hidden="true"
                      >
                        <rect x="6" y="6" width="18" height="18" />
                        <rect x="40" y="6" width="18" height="18" />
                        <rect x="6" y="40" width="18" height="18" />
                        <path d="M13 13h4v4h-4zM47 13h4v4h-4zM13 47h4v4h-4zM32 10v14M32 32h14M40 44h16M32 48v10" />
                      </svg>
                      <div className="wb-qr-meta">
                        <span className="wb-mono wb-qr-nonce">
                          TOKEN #{activeStudent.nonce}
                        </span>
                        <span className="wb-qr-timer">
                          Renova automaticamente em{' '}
                          <strong>{String(qrSeconds).padStart(2, '0')}s</strong>
                        </span>
                        <span className="wb-qr-status">
                          Status para {activeStudent.name}:{' '}
                          <strong>{statusBadge(activeStudent.status).label}</strong>
                        </span>
                      </div>
                    </div>
                    <p className="wb-pane-intro">
                      O código muda a cada 30 segundos no Redis. Se alguém tirar print e
                      mandar por mensagem, o servidor recusa na portaria.
                    </p>
                    <div className="wb-actions">
                      <button
                        type="button"
                        className="wb-primary-action"
                        onClick={() => advanceStudent(activeStudent)}
                      >
                        {actionButtonLabel(activeStudent.status)}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {roleTab === 'telao' && (
                <div className="wb-pane">
                  <div className="wb-col-head">
                    <span>Modo Telão de Pátio (/telao)</span>
                    <span className="wb-mono">Leitura a 5+ metros</span>
                  </div>
                  <div className="wb-telao-mini">
                    <div className="wb-tm-col is-ready">
                      <span className="wb-tm-head">
                        PODE RETIRAR AGORA ({readyList.length})
                      </span>
                      {readyList.length === 0 ? (
                        <span className="wb-tm-empty">Aguardando chamada</span>
                      ) : (
                        readyList.map((s, idx) => (
                          <div key={s.id} className="wb-tm-row">
                            <strong>{s.name}</strong>
                            <span>{idx === 0 ? 'AGORA' : s.grade}</span>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="wb-tm-col">
                      <span className="wb-tm-head">
                        A CAMINHO ({routeList.length})
                      </span>
                      {routeList.map((s) => (
                        <div key={s.id} className="wb-tm-row">
                          <strong>{s.name}</strong>
                          <span>~{s.eta} min</span>
                        </div>
                      ))}
                      {releasedList.length > 0 && (
                        <span className="wb-tm-empty">
                          +{releasedList.length} já entregue(s) neste ciclo
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="wb-actions" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="wb-primary-action"
                      onClick={() => advanceStudent(activeStudent)}
                    >
                      {actionButtonLabel(activeStudent.status)}
                    </button>
                  </div>
                </div>
              )}

              {roleTab === 'custodia' && (
                <div className="wb-pane">
                  <div className="wb-col-head">
                    <span>Livro de Custódia Criptográfica</span>
                    <span className="wb-mono">SHA-256 Encadeado</span>
                  </div>
                  <div className="wb-dossier">
                    <ul className="wb-audit-list">
                      {auditLog.map((log) => (
                        <li key={log.seq} className="wb-audit-item">
                          <span className="wb-mono wb-audit-seq">
                            #{String(log.seq).padStart(4, '0')} · {log.time}
                          </span>
                          <strong className="wb-mono wb-audit-evt">
                            {log.event}
                          </strong>
                          <span className="wb-audit-st">{log.student}</span>
                          <span className="wb-mono wb-audit-hash">
                            sha256:{log.hash} (prev:{log.prev})
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="wb-actions">
                      <button
                        type="button"
                        className="wb-primary-action"
                        onClick={() => advanceStudent(activeStudent)}
                      >
                        Gerar novo evento na cadeia SHA-256
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Fita inferior do livro de auditoria ao vivo */}
      <div className="wb-audit-tape" aria-live="polite">
        <span className="wb-tape-tag">ÚLTIMO REGISTRO IMUTÁVEL</span>
        <span className="wb-mono">
          evt_#{String(auditLog[0]?.seq ?? 484).padStart(4, '0')} [{auditLog[0]?.time}]
        </span>
        <strong className="wb-mono">{auditLog[0]?.event}</strong>
        <span>{auditLog[0]?.student}</span>
        <span className="wb-mono wb-tape-hash">
          sha256:{auditLog[0]?.hash} ⟵ prev:{auditLog[0]?.prev}
        </span>
      </div>
    </section>
  );
}
