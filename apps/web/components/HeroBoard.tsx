'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Painel interativo do hero (Frontend Design — Mesa de Despacho):
 * Demonstra a operação real de saída no topo da landing page — além da
 * rotação automática a cada 4,5 s, o visitante pode alternar o portão
 * ou clicar em "Chamar próximo" para ver a transição da fila e o registro
 * no PickupLog encadeado por hash acontecerem na hora.
 */

type Ready = { name: string; grade: string; relation: string; now: boolean; code: string };
type Coming = { name: string; grade: string; eta: number; code: string };

const INITIAL_READY: Ready[] = [
  { name: 'Alice Martins', grade: '3º B', relation: 'Mãe verificada', now: true, code: '9f3a…e81c' },
  { name: 'Pedro Santos', grade: '5º A', relation: 'Pai verificado', now: false, code: '4c12…b09a' },
  { name: 'Maria Clara Souza', grade: '2º C', relation: 'Avó autorizada', now: false, code: '7d88…14f2' },
];

const INITIAL_COMING: Coming[] = [
  { name: 'Lucas Almeida', grade: '4º B', eta: 2, code: '3e71…c40d' },
  { name: 'Sofia Ribeiro', grade: '1º A', eta: 5, code: '8a05…f92b' },
];

const NEXT: Coming[] = [
  { name: 'Helena Costa', grade: '2º A', eta: 6, code: '1b94…a73e' },
  { name: 'Miguel Ferreira', grade: '5º B', eta: 7, code: '6d20…e11c' },
  { name: 'Laura Mendes', grade: '1º C', eta: 5, code: '5f49…d08a' },
  { name: 'Davi Oliveira', grade: '3º A', eta: 6, code: '2c63…91b4' },
  { name: 'Alice Martins', grade: '3º B', eta: 7, code: '9f3a…e81c' },
  { name: 'Lucas Almeida', grade: '4º B', eta: 6, code: '3e71…c40d' },
];

const GATES = ['Portão principal', 'Educação Infantil'] as const;

export default function HeroBoard() {
  const [gateIdx, setGateIdx] = useState(0);
  const [ready, setReady] = useState<Ready[]>(INITIAL_READY);
  const [coming, setComing] = useState<Coming[]>(INITIAL_COMING);
  const [logSeq, setLogSeq] = useState(482);
  const nextIdx = useRef(0);
  const gate = GATES[gateIdx];

  const advanceQueue = useCallback(() => {
    setComing((prevComing) => {
      const [called, ...rest] = prevComing;
      if (!called) return prevComing;
      setReady((prevReady) =>
        [
          {
            name: called.name,
            grade: called.grade,
            relation: 'QR dinâmico validado',
            now: true,
            code: called.code,
          },
          ...prevReady.map((r) => ({ ...r, now: false })),
        ].slice(0, 3),
      );
      setLogSeq((n) => n + 1);
      const next = NEXT[nextIdx.current % NEXT.length];
      nextIdx.current += 1;
      return [...rest.map((c) => ({ ...c, eta: Math.max(1, c.eta - 2) })), next];
    });
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      advanceQueue();
    }, 4500);
    return () => clearInterval(timer);
  }, [advanceQueue]);

  const latestHash = ready[0]?.code ?? '9f3a…e81c';

  return (
    <div className="hero-board" aria-label="Demonstração interativa do painel de saída">
      <div className="hb-head">
        <div className="hb-head-left">
          <span className="hb-title">{gate}</span>
          <div className="hb-gates" role="group" aria-label="Alternar portão de demonstração">
            {GATES.map((g, idx) => (
              <button
                key={g}
                type="button"
                className={`hb-gate-pill${idx === gateIdx ? ' is-active' : ''}`}
                onClick={() => setGateIdx(idx)}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <span className="hb-live">
          <span className="hb-dot" />
          Operação ao vivo
        </span>
      </div>

      <div className="hb-section-bar">
        <p className="hb-label">Prontos na baia de embarque</p>
        <span className="hb-counter">{ready.length} alunos</span>
      </div>
      {ready.map((r) => (
        <div className={`hb-row${r.now ? ' is-now' : ''}`} key={r.name}>
          <div className="hb-row-main">
            <span className="hb-name">{r.name}</span>
            <span className="hb-meta">
              <span className="hb-grade">{r.grade}</span>
              <span>{r.relation}</span>
            </span>
          </div>
          {r.now ? <span className="hb-tag">AGORA</span> : <span className="hb-eta">Na baia</span>}
        </div>
      ))}

      <div className="hb-section-bar">
        <p className="hb-label">A caminho pela cerca virtual</p>
        <button type="button" className="hb-step-btn" onClick={advanceQueue}>
          Simular chamada
        </button>
      </div>
      {coming.map((r) => (
        <div className="hb-row" key={r.name}>
          <div className="hb-row-main">
            <span className="hb-name">{r.name}</span>
            <span className="hb-meta">
              <span className="hb-grade">{r.grade}</span>
              <span>Aproximação confirmada</span>
            </span>
          </div>
          <span className="hb-eta">~{r.eta} min</span>
        </div>
      ))}

      <div className="hb-audit" aria-hidden="true">
        <span className="hb-audit-code">evt_{String(logSeq).padStart(4, '0')}</span>
        <span className="hb-audit-hash">sha256:{latestHash}</span>
        <span className="hb-audit-status">Cadeia íntegra</span>
      </div>
    </div>
  );
}
