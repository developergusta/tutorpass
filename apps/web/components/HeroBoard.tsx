'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * O painel do hero VIVO: a cada poucos segundos, quem estava
 * "a caminho" é chamado para "pode retirar agora" (com o pop da
 * chamada) e um novo nome entra na fila — a landing demonstra o
 * produto funcionando, não uma foto dele.
 *
 * Decorativo (aria-hidden, como o painel estático era). Para
 * sozinho se a aba ficar oculta ou se o sistema pedir menos
 * movimento. As keys são os nomes: a linha chamada remonta no
 * painel de prontos e as animações de entrada tocam de novo.
 */

type Ready = { name: string; meta: string; now: boolean };
type Coming = { name: string; meta: string; eta: number };

const INITIAL_READY: Ready[] = [
  { name: 'Alice Martins', meta: '3º B · Portão principal', now: true },
  { name: 'Pedro Santos', meta: '5º A · Portão principal', now: false },
  { name: 'Maria Clara Souza', meta: '2º C · Portão lateral', now: false },
];

const INITIAL_COMING: Coming[] = [
  { name: 'Lucas Almeida', meta: '4º B', eta: 3 },
  { name: 'Sofia Ribeiro', meta: '1º A', eta: 6 },
];

// Próximos a entrar em "A caminho", em ciclo. O ciclo (6) é maior
// que o tempo de permanência em cada painel (2–3 ciclos), então
// nenhum nome se repete dentro da mesma lista.
const NEXT: Coming[] = [
  { name: 'Helena Costa', meta: '2º A', eta: 7 },
  { name: 'Miguel Ferreira', meta: '5º B', eta: 8 },
  { name: 'Laura Mendes', meta: '1º C', eta: 6 },
  { name: 'Davi Oliveira', meta: '3º A', eta: 7 },
  { name: 'Alice Martins', meta: '3º B', eta: 8 },
  { name: 'Lucas Almeida', meta: '4º B', eta: 7 },
];

export default function HeroBoard() {
  const [ready, setReady] = useState<Ready[]>(INITIAL_READY);
  const [coming, setComing] = useState<Coming[]>(INITIAL_COMING);
  const nextIdx = useRef(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      setComing((prevComing) => {
        const [called, ...rest] = prevComing;
        if (!called) return prevComing;
        setReady((prevReady) => [
          { name: called.name, meta: `${called.meta} · Portão principal`, now: true },
          ...prevReady.map((r) => ({ ...r, now: false })),
        ].slice(0, 3));
        const next = NEXT[nextIdx.current % NEXT.length];
        nextIdx.current += 1;
        return [...rest.map((c) => ({ ...c, eta: Math.max(2, c.eta - 3) })), next];
      });
    }, 4200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hero-board" aria-hidden="true">
      <div className="hb-head">
        <span className="hb-title">Saída · Portão principal</span>
        <span className="hb-live">
          <span className="hb-dot" />
          Ao vivo
        </span>
      </div>
      <p className="hb-label">Pode retirar agora</p>
      {ready.map((r) => (
        <div className={`hb-row${r.now ? ' is-now' : ''}`} key={r.name}>
          <span className="hb-name">{r.name}</span>
          <span className="hb-meta">{r.meta}</span>
          {r.now ? <span className="hb-tag">Agora</span> : null}
        </div>
      ))}
      <p className="hb-label">A caminho</p>
      {coming.map((r) => (
        <div className="hb-row" key={r.name}>
          <span className="hb-name">{r.name}</span>
          <span className="hb-meta">{r.meta}</span>
          <span className="hb-eta">~{r.eta} min</span>
        </div>
      ))}
    </div>
  );
}
