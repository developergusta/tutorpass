'use client';

import { useCallback, useEffect, useState } from 'react';

type StudentEntry = {
  id: string;
  name: string;
  grade: string;
  classroom: string;
  tutorName: string;
  relation: string;
  vehicle: string;
  bay: string;
  status: 'EN_ROUTE' | 'CALLED' | 'VALIDATED' | 'RELEASED';
  eta: number;
  distanceMeters: number;
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
      vehicle: 'Baia 01 · Portão Norte',
      bay: 'B-01',
      status: 'CALLED',
      eta: 0,
      distanceMeters: 12,
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
      vehicle: 'Baia 02 · Portão Norte',
      bay: 'B-02',
      status: 'VALIDATED',
      eta: 0,
      distanceMeters: 4,
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
      vehicle: 'Zona 150m · 2ª leitura OK',
      bay: 'Z-150',
      status: 'EN_ROUTE',
      eta: 2,
      distanceMeters: 145,
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
      vehicle: 'Tag impressa · #604918',
      bay: 'Z-300',
      status: 'EN_ROUTE',
      eta: 4,
      distanceMeters: 280,
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
      vehicle: 'Recepção Infantil · Baia A',
      bay: 'INF-A',
      status: 'CALLED',
      eta: 0,
      distanceMeters: 8,
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
      vehicle: 'Zona 150m · 2ª leitura OK',
      bay: 'Z-150',
      status: 'EN_ROUTE',
      eta: 3,
      distanceMeters: 160,
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
              distanceMeters:
                updatedStatus === 'EN_ROUTE'
                  ? 180
                  : updatedStatus === 'CALLED'
                    ? 15
                    : 2,
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
      `401 QR_REJECTED — Nonce #${activeStudent.nonce} já consumido. Print bloqueado e registrado no livro SHA-256.`,
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

  const statusBadge = (status: StudentEntry['status']) => {
    switch (status) {
      case 'EN_ROUTE':
        return { label: 'A caminho', cls: 'st-route', stepIndex: 1 };
      case 'CALLED':
        return { label: 'Na baia', cls: 'st-called', stepIndex: 2 };
      case 'VALIDATED':
        return { label: 'QR validado', cls: 'st-validated', stepIndex: 3 };
      case 'RELEASED':
        return { label: 'Entregue', cls: 'st-released', stepIndex: 4 };
    }
  };

  const actionButtonLabel = (status: StudentEntry['status']) => {
    switch (status) {
      case 'EN_ROUTE':
        return 'Acionar chamada silenciosa na sala';
      case 'CALLED':
        return 'Validar QR de 30s do responsável';
      case 'VALIDATED':
        return 'Assinar entrega na cadeia SHA-256';
      case 'RELEASED':
        return 'Reiniciar ciclo deste aluno';
    }
  };

  const progressRatio = (qrSeconds / 30) * 100;

  return (
    <div
      className="drb-cockpit"
      aria-label="Console interativo de saída escolar"
    >
      {/* Topo da janela com moldura de hardware, seletor de portão e lentes */}
      <div className="drb-chrome">
        <div className="drb-chrome-left">
          <div className="drb-lights" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="drb-gate-switch" role="group" aria-label="Portão ativo">
            {GATES.map((g) => (
              <button
                key={g}
                type="button"
                className={`drb-gate-pill${gate === g ? ' is-active' : ''}`}
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
        </div>

        <div className="drb-lens-bar" role="tablist" aria-label="Superfície operacional">
          {(
            [
              ['portaria', 'Portaria'],
              ['sala', 'Sala de Aula'],
              ['familia', 'App Família'],
              ['telao', 'Telão TV'],
              ['custodia', 'Cadeia SHA-256'],
            ] as [RoleTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={roleTab === id}
              className={`drb-lens-tab${roleTab === id ? ' is-active' : ''}`}
              onClick={() => setRoleTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="drb-chrome-right">
          <span className="drb-live-badge">
            <span className="drb-pulse-dot" aria-hidden="true" />
            INTERATIVO
          </span>
          <button
            type="button"
            className="drb-reset"
            onClick={resetDemo}
            title="Restaurar simulação"
          >
            Resetar
          </button>
        </div>
      </div>

      {/* Palco principal do cockpit */}
      <div className="drb-stage">
        {/* Coluna esquerda: Radar de baias + lista de fila */}
        <div className="drb-radar-col">
          <div className="drb-col-header">
            <span>RADAR DE BAIAS · {gate.toUpperCase()}</span>
            <span className="wb-mono">
              {readyList.length} PRONTOS / {routeList.length} A CAMINHO
            </span>
          </div>

          {/* Esquemático visual SVG da zona de embarque (Dribbble telemetry signature) */}
          <div className="drb-zone-map" aria-hidden="true">
            <svg viewBox="0 0 380 86" className="drb-zone-svg">
              {/* Anéis de aproximação */}
              <rect
                x="4"
                y="8"
                width="372"
                height="70"
                rx="10"
                fill="rgba(255,255,255,0.02)"
                stroke="rgba(255,255,255,0.08)"
              />
              <line
                x1="130"
                y1="8"
                x2="130"
                y2="78"
                stroke="rgba(52, 211, 153, 0.25)"
                strokeDasharray="3 3"
              />
              <line
                x1="255"
                y1="8"
                x2="255"
                y2="78"
                stroke="rgba(255,255,255,0.12)"
                strokeDasharray="3 3"
              />
              <text x="14" y="24" fill="#7fe0ae" fontSize="9" fontWeight="700" fontFamily="monospace">
                BAIA DE EMBARQUE (0-20m)
              </text>
              <text x="140" y="24" fill="#9fc9b4" fontSize="9" fontFamily="monospace">
                ZONA GEOFENCE 2X (150m)
              </text>
              <text x="265" y="24" fill="#7c9c8c" fontSize="9" fontFamily="monospace">
                EM ROTA (300m+)
              </text>

              {/* Pinos dinâmicos dos alunos no mapa */}
              {currentList.map((st, idx) => {
                const isSel = activeStudent?.id === st.id;
                const xPos =
                  st.status === 'VALIDATED'
                    ? 36
                    : st.status === 'CALLED'
                      ? 84
                      : st.status === 'RELEASED'
                        ? 20
                        : st.eta <= 2
                          ? 185
                          : 305;
                const yPos = 44 + (idx % 2) * 18;
                const fill =
                  st.status === 'CALLED' || st.status === 'VALIDATED'
                    ? '#34d399'
                    : st.status === 'RELEASED'
                      ? '#6b8a7a'
                      : '#f5c56b';
                return (
                  <g key={st.id}>
                    {isSel ? (
                      <circle
                        cx={xPos}
                        cy={yPos}
                        r="11"
                        fill="none"
                        stroke={fill}
                        strokeWidth="1.5"
                        opacity="0.65"
                      />
                    ) : null}
                    <circle cx={xPos} cy={yPos} r="5.5" fill={fill} />
                    <text
                      x={xPos + 9}
                      y={yPos + 3}
                      fill={isSel ? '#ffffff' : '#b7dcc8'}
                      fontSize="9.5"
                      fontWeight={isSel ? '700' : '500'}
                      fontFamily="sans-serif"
                    >
                      {st.name.split(' ')[0]} ({st.bay})
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <ul className="drb-queue-cards" aria-label="Fila de alunos">
            {currentList.map((item) => {
              const badge = statusBadge(item.status);
              const isSelected = activeStudent?.id === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`drb-q-card${isSelected ? ' is-selected' : ''}`}
                    onClick={() => {
                      setSelectedId(item.id);
                      setReplayBlocked(null);
                    }}
                  >
                    <span className="drb-q-bay">{item.bay}</span>
                    <div className="drb-q-info">
                      <span className="drb-q-name">{item.name}</span>
                      <span className="drb-q-sub">
                        {item.grade} · {item.tutorName} ({item.relation})
                      </span>
                    </div>
                    <div className="drb-q-meta">
                      <span className={`wb-status-chip ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <span className="wb-mono drb-q-dist">
                        {item.status === 'EN_ROUTE'
                          ? `${item.distanceMeters}m · ~${item.eta}m`
                          : `#${item.nonce.slice(0, 4)}`}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Coluna direita: Cartão de Custódia Tátil & Lente Ativa */}
        <div className="drb-focus-col">
          {activeStudent ? (
            <>
              {roleTab === 'portaria' && (
                <div className="drb-pass-card">
                  <div className="drb-pass-header">
                    <div>
                      <span className="drb-pass-kicker">
                        CREDENCIAL DE LIBERAÇÃO · {activeStudent.bay}
                      </span>
                      <h3 className="drb-pass-title">{activeStudent.name}</h3>
                      <p className="drb-pass-room">
                        {activeStudent.grade} · {activeStudent.classroom}
                      </p>
                    </div>
                    <div className="drb-ttl-ring">
                      <span className="wb-mono drb-ttl-num">
                        {String(qrSeconds).padStart(2, '0')}s
                      </span>
                      <span className="drb-ttl-label">TTL QR</span>
                      <div className="drb-ttl-bar">
                        <span style={{ width: `${progressRatio}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Trilha visual das 4 etapas da máquina de estados */}
                  <div className="drb-state-track" aria-label="Progresso da retirada">
                    {[
                      { step: 1, label: 'Geofence 2x' },
                      { step: 2, label: 'Chamado' },
                      { step: 3, label: 'QR 30s OK' },
                      { step: 4, label: 'SHA-256' },
                    ].map((s) => {
                      const activeIdx = statusBadge(activeStudent.status).stepIndex;
                      const done = s.step <= activeIdx;
                      const current = s.step === activeIdx;
                      return (
                        <div
                          key={s.step}
                          className={`drb-st-node${done ? ' is-done' : ''}${current ? ' is-current' : ''}`}
                        >
                          <span className="drb-st-dot">{done ? '✓' : s.step}</span>
                          <span className="drb-st-text">{s.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="drb-pass-specs">
                    <div className="drb-spec-cell">
                      <span>PORTADOR VERIFICADO</span>
                      <strong>
                        {activeStudent.tutorName} ({activeStudent.relation})
                      </strong>
                    </div>
                    <div className="drb-spec-cell">
                      <span>TOKEN EFÊMERO REDIS</span>
                      <strong className="wb-mono">
                        NONCE #{activeStudent.nonce}
                      </strong>
                    </div>
                    <div className="drb-spec-cell">
                      <span>ASSINATURA DO EVENTO</span>
                      <strong className="wb-mono">
                        sha256:{activeStudent.hash}
                      </strong>
                    </div>
                    <div className="drb-spec-cell">
                      <span>ELO ANTERIOR</span>
                      <strong className="wb-mono">
                        prev:{activeStudent.prevHash}
                      </strong>
                    </div>
                  </div>

                  {replayBlocked ? (
                    <div className="wb-alert-err" role="alert">
                      {replayBlocked}
                    </div>
                  ) : null}

                  <div className="drb-pass-actions">
                    <button
                      type="button"
                      className="drb-btn-advance"
                      onClick={() => advanceStudent(activeStudent)}
                    >
                      {actionButtonLabel(activeStudent.status)}
                    </button>
                    <button
                      type="button"
                      className="drb-btn-attack"
                      onClick={simulateReplayAttack}
                    >
                      Simular print clonado (401)
                    </button>
                  </div>
                </div>
              )}

              {roleTab === 'sala' && (
                <div className="drb-pass-card">
                  <div className="drb-col-header">
                    <span>TERMINAL SILENCIOSO DA TURMA (/SALA)</span>
                    <span className="wb-mono">{activeStudent.classroom}</span>
                  </div>
                  <p className="wb-pane-intro">
                    Zero microfone no pátio. A tela da professora destaca em verde
                    somente quem já está com o responsável parado na baia:
                  </p>
                  <div className="wb-classroom-board">
                    <div className="wb-cb-group">
                      <span className="wb-cb-title">
                        LIBERAR IMEDIATAMENTE PARA O PORTÃO ({readyList.length})
                      </span>
                      {readyList.length === 0 ? (
                        <p className="wb-cb-empty">
                          Nenhum aluno aguardando na baia agora.
                        </p>
                      ) : (
                        readyList.map((s) => (
                          <div key={s.id} className="wb-cb-row is-urgent">
                            <strong>
                              {s.name} ({s.grade})
                            </strong>
                            <span className="wb-mono">
                              {s.bay} · {s.tutorName}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="wb-cb-group">
                      <span className="wb-cb-title">
                        PREPARAR MOCHILA — EM APROXIMAÇÃO ({routeList.length})
                      </span>
                      {routeList.map((s) => (
                        <div key={s.id} className="wb-cb-row">
                          <span>
                            {s.name} ({s.grade})
                          </span>
                          <span className="wb-mono">
                            {s.distanceMeters}m · ~{s.eta} min
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="drb-pass-actions">
                    <button
                      type="button"
                      className="drb-btn-advance"
                      onClick={() => advanceStudent(activeStudent)}
                    >
                      {actionButtonLabel(activeStudent.status)}
                    </button>
                  </div>
                </div>
              )}

              {roleTab === 'familia' && (
                <div className="drb-pass-card">
                  <div className="drb-col-header">
                    <span>CARTÃO DIGITAL DA FAMÍLIA (/RESPONSAVEL)</span>
                    <span className="wb-mono">{activeStudent.tutorName}</span>
                  </div>
                  <div className="wb-qr-sim">
                    <svg
                      viewBox="0 0 64 64"
                      width="92"
                      height="92"
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
                        NONCE #{activeStudent.nonce} · {activeStudent.bay}
                      </span>
                      <span className="wb-qr-timer">
                        Rotaciona em{' '}
                        <strong>{String(qrSeconds).padStart(2, '0')}s</strong> (anti-print)
                      </span>
                      <span className="wb-qr-status">
                        Aluno: <strong>{activeStudent.name}</strong> (
                        {statusBadge(activeStudent.status).label})
                      </span>
                    </div>
                  </div>
                  <p className="wb-pane-intro">
                    Com um toque em &ldquo;Estou chegando&rdquo;, o responsável entra na fila
                    do portão certo e apresenta este QR dinâmico na janela do carro.
                  </p>
                  <div className="drb-pass-actions">
                    <button
                      type="button"
                      className="drb-btn-advance"
                      onClick={() => advanceStudent(activeStudent)}
                    >
                      {actionButtonLabel(activeStudent.status)}
                    </button>
                  </div>
                </div>
              )}

              {roleTab === 'telao' && (
                <div className="drb-pass-card">
                  <div className="drb-col-header">
                    <span>PAINEL DE ALTO CONTRASTE (/TELAO)</span>
                    <span className="wb-mono">TV DO PÁTIO · 5+ METROS</span>
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
                    </div>
                  </div>
                  <div className="drb-pass-actions">
                    <button
                      type="button"
                      className="drb-btn-advance"
                      onClick={() => advanceStudent(activeStudent)}
                    >
                      {actionButtonLabel(activeStudent.status)}
                    </button>
                  </div>
                </div>
              )}

              {roleTab === 'custodia' && (
                <div className="drb-pass-card">
                  <div className="drb-col-header">
                    <span>LIVRO DE CUSTÓDIA IMUTÁVEL</span>
                    <span className="wb-mono">CADEIA SHA-256</span>
                  </div>
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
                          sha256:{log.hash} ⟵ {log.prev}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="drb-pass-actions">
                    <button
                      type="button"
                      className="drb-btn-advance"
                      onClick={() => advanceStudent(activeStudent)}
                    >
                      Registrar novo elo na cadeia SHA-256
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Fita inferior do livro criptográfico */}
      <div className="wb-audit-tape" aria-live="polite">
        <span className="wb-tape-tag">LEDGER SHA-256 AO VIVO</span>
        <span className="wb-mono">
          evt_#{String(auditLog[0]?.seq ?? 484).padStart(4, '0')} · {auditLog[0]?.time}
        </span>
        <strong className="wb-mono">{auditLog[0]?.event}</strong>
        <span>{auditLog[0]?.student}</span>
        <span className="wb-mono wb-tape-hash">
          sha256:{auditLog[0]?.hash} ⟵ prev:{auditLog[0]?.prev}
        </span>
      </div>
    </div>
  );
}
