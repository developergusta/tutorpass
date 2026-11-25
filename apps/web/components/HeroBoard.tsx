'use client';

import { Chip } from '@heroui/react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  CheckCircle2,
  Clock,
  Lock,
  MapPin,
  Monitor,
  QrCode,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UserCheck,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type StudentEntry = {
  id: string;
  name: string;
  grade: string;
  classroom: string;
  tutorName: string;
  relation: string;
  delegatedBy?: string;
  gate: string;
  status: 'QUEUED' | 'CALLED' | 'VALIDATED' | 'RELEASED';
  etaMinutes: number | null;
  distanceMeters: number;
  hmacToken: string;
  hash: string;
  prevHash: string;
  time: string;
};

type AuditRecord = {
  seq: number;
  time: string;
  event: string;
  student: string;
  actor: string;
  hash: string;
  prev: string;
};

const INITIAL_ENTRIES: Record<string, StudentEntry[]> = {
  'Portão Principal': [
    {
      id: 'st-1',
      name: 'Alice Martins',
      grade: '3º Ano B',
      classroom: 'Sala 14 · Bloco A',
      tutorName: 'Mariana Martins',
      relation: 'Mãe titular',
      gate: 'Portão Principal',
      status: 'CALLED',
      etaMinutes: null,
      distanceMeters: 12,
      hmacToken: 'HMAC-84A2-91F0',
      hash: '9f3a8c12e81c',
      prevHash: '4c127b09ab10',
      time: '17:42:18',
    },
    {
      id: 'st-2',
      name: 'Pedro Santos',
      grade: '5º Ano A',
      classroom: 'Sala 22 · Bloco B',
      tutorName: 'Ricardo Santos',
      relation: 'Pai titular',
      gate: 'Portão Principal',
      status: 'VALIDATED',
      etaMinutes: null,
      distanceMeters: 4,
      hmacToken: 'HMAC-31C9-04D8',
      hash: '4c127b09ab10',
      prevHash: '7d8814f2c301',
      time: '17:41:52',
    },
    {
      id: 'st-3',
      name: 'Sofia Ribeiro',
      grade: '1º Ano A',
      classroom: 'Sala 03 · Térreo',
      tutorName: 'Helena Ribeiro',
      relation: 'Avó autorizada',
      delegatedBy: 'Autorizada por Camila Ribeiro (Mãe) até 18:30',
      gate: 'Portão Principal',
      status: 'QUEUED',
      etaMinutes: 2,
      distanceMeters: 140,
      hmacToken: 'HMAC-19B4-88C2',
      hash: '8a05f92b11e4',
      prevHash: '9f3a8c12e81c',
      time: '17:42:05',
    },
    {
      id: 'st-4',
      name: 'Lucas Almeida',
      grade: '4º Ano B',
      classroom: 'Sala 18 · Bloco A',
      tutorName: 'Cláudia Almeida',
      relation: 'Mãe titular',
      gate: 'Portão Principal',
      status: 'QUEUED',
      etaMinutes: 4,
      distanceMeters: 275,
      hmacToken: 'HMAC-77E1-52A9',
      hash: '3e71c40d9a22',
      prevHash: '8a05f92b11e4',
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
      delegatedBy: 'Autorizada por Rodrigo Souza (Pai)',
      gate: 'Educação Infantil',
      status: 'CALLED',
      etaMinutes: null,
      distanceMeters: 8,
      hmacToken: 'HMAC-63D0-19E5',
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
      relation: 'Pai titular',
      gate: 'Educação Infantil',
      status: 'QUEUED',
      etaMinutes: 3,
      distanceMeters: 165,
      hmacToken: 'HMAC-50F8-33B1',
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
    event: 'CHAMADO_PORTARIA',
    student: 'Alice Martins (3º Ano B)',
    actor: 'Mariana Martins (Mãe titular)',
    hash: '9f3a8c12e81c',
    prev: '4c127b09ab10',
  },
  {
    seq: 483,
    time: '17:41:52',
    event: 'QR_HMAC_VALIDADO',
    student: 'Pedro Santos (5º Ano A)',
    actor: 'Ricardo Santos (Pai titular)',
    hash: '4c127b09ab10',
    prev: '7d8814f2c301',
  },
  {
    seq: 482,
    time: '17:41:10',
    event: 'FILA_GEOLOCALIZACAO',
    student: 'Sofia Ribeiro (1º Ano A)',
    actor: 'Helena Ribeiro (Avó autorizada)',
    hash: '7d8814f2c301',
    prev: '3e71c40d9a22',
  },
];

const GATES = ['Portão Principal', 'Educação Infantil'] as const;
type SurfaceMode = 'split' | 'portaria' | 'telao';

export default function HeroBoard() {
  const [gate, setGate] = useState<(typeof GATES)[number]>('Portão Principal');
  const [surface, setSurface] = useState<SurfaceMode>('split');
  const [entriesByGate, setEntriesByGate] = useState(INITIAL_ENTRIES);
  const [selectedId, setSelectedId] = useState<string>('st-1');
  const [auditLog, setAuditLog] = useState<AuditRecord[]>(INITIAL_AUDIT);
  const [qrSeconds, setQrSeconds] = useState(24);
  const [parentNotice, setParentNotice] = useState<string | null>(
    'Pedro Santos: QR HMAC validado na portaria. Aguardando assinatura final de entrega.',
  );

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
          actor: `${student.tutorName} (${student.relation})`,
          hash: newHash,
          prev: prev[0]?.hash ?? '9f3a8c12e81c',
        },
        ...prev.slice(0, 3),
      ]);
    },
    [],
  );

  function advanceStudent(student: StudentEntry) {
    const nextStatus: Record<StudentEntry['status'], StudentEntry['status']> = {
      QUEUED: 'CALLED',
      CALLED: 'VALIDATED',
      VALIDATED: 'RELEASED',
      RELEASED: 'QUEUED',
    };
    const nextEvent: Record<StudentEntry['status'], string> = {
      QUEUED: 'CHAMADO_PORTARIA',
      CALLED: 'QR_HMAC_VALIDADO',
      VALIDATED: 'SAIDA_LIBERADA_NOTIFICADA',
      RELEASED: 'FILA_GEOLOCALIZACAO',
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
              etaMinutes: updatedStatus === 'QUEUED' ? 3 : null,
              distanceMeters:
                updatedStatus === 'QUEUED'
                  ? 180
                  : updatedStatus === 'CALLED'
                    ? 12
                    : 2,
              prevHash: item.hash,
              hash: newHash,
            }
          : item,
      ),
    }));

    if (updatedStatus === 'CALLED') {
      setParentNotice(
        `Telão atualizado: ${student.name} chamado(a) para o ${gate}. Sala avisada sem microfone.`,
      );
    } else if (updatedStatus === 'VALIDATED') {
      setParentNotice(
        `QR dinâmico HMAC de ${student.tutorName} (${student.relation}) validado em uso único.`,
      );
    } else if (updatedStatus === 'RELEASED') {
      setParentNotice(
        `Notificação instantânea enviada aos pais: ${student.name} entregue a ${student.tutorName} (${student.relation}) · hash sha256:${newHash}.`,
      );
    } else {
      setParentNotice(
        `${student.tutorName} aproximou-se da escola (180m) e entrou automaticamente na fila por geolocalização.`,
      );
    }

    pushAudit(nextEvent[student.status], student, newHash);
  }

  function resetDemo() {
    setEntriesByGate(INITIAL_ENTRIES);
    setAuditLog(INITIAL_AUDIT);
    setSelectedId('st-1');
    setParentNotice(
      'Pedro Santos: QR HMAC validado na portaria. Aguardando assinatura final de entrega.',
    );
  }

  const readyList = currentList.filter(
    (i) => i.status === 'CALLED' || i.status === 'VALIDATED',
  );
  const routeList = currentList.filter((i) => i.status === 'QUEUED');

  const statusMeta = (status: StudentEntry['status']) => {
    switch (status) {
      case 'QUEUED':
        return {
          label: 'Na fila (GPS)',
          action: 'Chamar aluno p/ portaria',
          cls: 'tp-chip-route',
        };
      case 'CALLED':
        return {
          label: 'Chamado no telão',
          action: 'Validar QR HMAC (30s)',
          cls: 'tp-chip-called',
        };
      case 'VALIDATED':
        return {
          label: 'QR HMAC validado',
          action: 'Confirmar retirada e notificar pais',
          cls: 'tp-chip-valid',
        };
      case 'RELEASED':
        return {
          label: 'Saída concluída',
          action: 'Simular nova chegada por GPS',
          cls: 'tp-chip-done',
        };
    }
  };

  return (
    <div
      className="tp-mockup-frame"
      aria-label="Demonstração realista das telas de Portaria e Telão em tempo real"
    >
      {/* Barra superior da bancada com seleção de portão e modo de tela */}
      <div className="tp-mockup-bar">
        <div className="tp-mockup-bar-left">
          <span className="tp-mockup-tag">
            <span className="tp-live-dot" aria-hidden="true" />
            OPERAÇÃO AO VIVO
          </span>
          <div className="tp-gate-tabs" role="group" aria-label="Selecionar portão">
            {GATES.map((g) => (
              <button
                key={g}
                type="button"
                className={`tp-gate-btn${gate === g ? ' is-active' : ''}`}
                onClick={() => {
                  setGate(g);
                  const first = INITIAL_ENTRIES[g]?.[0];
                  if (first) setSelectedId(first.id);
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="tp-surface-switch" role="tablist" aria-label="Visualização das telas reais">
          <button
            type="button"
            role="tab"
            aria-selected={surface === 'split'}
            className={`tp-surf-btn${surface === 'split' ? ' is-active' : ''}`}
            onClick={() => setSurface('split')}
          >
            Portaria + Telão TV
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={surface === 'portaria'}
            className={`tp-surf-btn${surface === 'portaria' ? ' is-active' : ''}`}
            onClick={() => setSurface('portaria')}
          >
            <Smartphone size={14} aria-hidden="true" />
            Tela da Portaria (/portaria)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={surface === 'telao'}
            className={`tp-surf-btn${surface === 'telao' ? ' is-active' : ''}`}
            onClick={() => setSurface('telao')}
          >
            <Monitor size={14} aria-hidden="true" />
            Telão da Portaria (/telao)
          </button>
        </div>

        <button
          type="button"
          className="tp-reset-btn"
          onClick={resetDemo}
          title="Restaurar estado inicial da fila"
        >
          <RotateCcw size={13} aria-hidden="true" />
          Reiniciar fila
        </button>
      </div>

      {/* Palco realista: Portaria à esquerda + Telão TV à direita */}
      <div className={`tp-mockup-grid is-${surface}`}>
        {/* 1. TELA REAL DA PORTARIA (/portaria) */}
        {surface !== 'telao' && (
          <section className="tp-screen-portaria" aria-label="Tela operacional da portaria">
            <header className="tp-scr-head">
              <div>
                <span className="tp-scr-route">/portaria · Agente no portão</span>
                <h3 className="tp-scr-title">Fila de saída e validação QR HMAC</h3>
              </div>
              <div className="tp-qr-ticker" title="Janela de rotação do QR dinâmico HMAC">
                <QrCode size={15} aria-hidden="true" />
                <span className="wb-mono">
                  HMAC <strong>{String(qrSeconds).padStart(2, '0')}s</strong>
                </span>
              </div>
            </header>

            {/* Lista de alunos na fila (Prontos + A caminho por geolocalização) */}
            <ul className="tp-portaria-list" aria-label="Alunos na fila da portaria">
              {currentList.map((item, idx) => {
                const meta = statusMeta(item.status);
                const isSelected = activeStudent?.id === item.id;
                return (
                  <li
                    key={item.id}
                    className={`tp-portaria-row${isSelected ? ' is-selected' : ''}`}
                  >
                    <div
                      className="tp-row-main"
                      onClick={() => setSelectedId(item.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedId(item.id);
                        }
                      }}
                    >
                      <span className="wb-mono tp-row-pos">{idx + 1}</span>
                      <div className="tp-row-identity">
                        <div className="tp-row-name-line">
                          <strong>{item.name}</strong>
                          <span className="tp-row-grade">{item.grade}</span>
                        </div>
                        <div className="tp-row-tutor-line">
                          <UserCheck size={13} aria-hidden="true" />
                          <span>
                            {item.tutorName} ({item.relation})
                          </span>
                          {item.delegatedBy ? (
                            <span className="tp-delegated-pill">Delegado</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="tp-row-right">
                        <Chip
                          size="sm"
                          variant="flat"
                          className={`tp-status-chip ${meta.cls}`}
                        >
                          {meta.label}
                        </Chip>
                        <span className="wb-mono tp-row-telemetry">
                          {item.status === 'QUEUED' ? (
                            <>
                              <MapPin size={11} aria-hidden="true" /> {item.distanceMeters}m · ~
                              {item.etaMinutes} min
                            </>
                          ) : (
                            item.hmacToken
                          )}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="tp-row-inspector">
                        {item.delegatedBy ? (
                          <div className="tp-inspector-delegation">
                            <ShieldCheck size={14} aria-hidden="true" />
                            <span>{item.delegatedBy}</span>
                          </div>
                        ) : null}
                        <div className="tp-inspector-chain">
                          <span className="wb-mono">
                            <Lock size={12} aria-hidden="true" /> hash:{item.hash}
                          </span>
                          <span className="wb-mono">prev:{item.prevHash}</span>
                        </div>
                        <button
                          type="button"
                          className="tp-action-btn"
                          onClick={() => advanceStudent(item)}
                        >
                          {meta.action}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Notificação instantânea disparada aos pais na liberação */}
            <AnimatePresence mode="wait">
              {parentNotice ? (
                <motion.div
                  key={parentNotice}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="tp-parent-push"
                  role="status"
                >
                  <Bell size={15} aria-hidden="true" />
                  <div>
                    <span className="tp-push-kicker">NOTIFICAÇÃO INSTANTÂNEA AOS PAIS</span>
                    <p>{parentNotice}</p>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>
        )}

        {/* 2. TELA REAL DO TELÃO TV (/telao) NO PORTÃO E NAS SALAS */}
        {surface !== 'portaria' && (
          <section className="tp-screen-telao" aria-label="Telão de TV em tempo real na portaria">
            <header className="tp-tv-top">
              <div className="tp-tv-brand">
                <span className="tp-tv-icon" aria-hidden="true">
                  <Monitor size={16} />
                </span>
                <div>
                  <strong>TutorPass · Telão do Portão</strong>
                  <span className="wb-mono">/telao · {gate}</span>
                </div>
              </div>
              <div className="tp-tv-clock">
                <span className="tp-tv-live">
                  <span className="tp-live-dot" aria-hidden="true" />
                  TEMPO REAL
                </span>
                <strong className="wb-mono">17:42</strong>
              </div>
            </header>

            <div className="tp-tv-columns">
              {/* Coluna 1: PODE RETIRAR AGORA */}
              <div className="tp-tv-panel is-ready">
                <div className="tp-tv-panel-head">
                  <span>PODE RETIRAR AGORA</span>
                  <strong className="wb-mono">{readyList.length}</strong>
                </div>
                {readyList.length === 0 ? (
                  <p className="tp-tv-empty">Nenhum aluno chamado no momento.</p>
                ) : (
                  <ul className="tp-tv-list">
                    {readyList.map((item, i) => (
                      <li
                        key={item.id}
                        className={i === 0 ? 'is-now' : undefined}
                      >
                        <div className="tp-tv-student">
                          <strong>{item.name}</strong>
                          <span>{item.classroom}</span>
                        </div>
                        <div className="tp-tv-badges">
                          {i === 0 ? (
                            <span className="tp-tv-badge-now">AGORA</span>
                          ) : null}
                          <span className="tp-tv-badge-room">{item.grade}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Coluna 2: A CAMINHO (GEOLOCALIZAÇÃO) */}
              <div className="tp-tv-panel is-route">
                <div className="tp-tv-panel-head">
                  <span>A CAMINHO · FILA POR GPS</span>
                  <strong className="wb-mono">{routeList.length}</strong>
                </div>
                {routeList.length === 0 ? (
                  <p className="tp-tv-empty">Nenhum responsável em aproximação.</p>
                ) : (
                  <ul className="tp-tv-list">
                    {routeList.map((item) => (
                      <li key={item.id}>
                        <div className="tp-tv-student">
                          <strong>{item.name}</strong>
                          <span>
                            {item.tutorName} ({item.relation})
                          </span>
                        </div>
                        <div className="tp-tv-badges">
                          <span className="wb-mono tp-tv-badge-eta">
                            <Clock size={11} aria-hidden="true" /> ~{item.etaMinutes} min
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Rodapé do telão: Fita do log imutável com hash encadeado */}
            <footer className="tp-tv-ledger" aria-label="Último registro no log imutável">
              <div className="tp-ledger-head">
                <CheckCircle2 size={13} aria-hidden="true" />
                <span className="wb-mono">LOG IMUTÁVEL (HASH ENCADEADO)</span>
              </div>
              {auditLog[0] ? (
                <div className="wb-mono tp-ledger-line">
                  <span>#{auditLog[0].seq}</span>
                  <strong>{auditLog[0].event}</strong>
                  <span>{auditLog[0].student}</span>
                  <span className="tp-ledger-hash">
                    sha256:{auditLog[0].hash} ⟵ {auditLog[0].prev}
                  </span>
                </div>
              ) : null}
            </footer>
          </section>
        )}
      </div>
    </div>
  );
}
