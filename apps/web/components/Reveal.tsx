'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Reveal on scroll (o clássico de landing page): o conteúdo sobe e
 * aparece quando entra na viewport, uma vez só.
 *
 * Sem JS, nada fica invisível: a classe `armed` (que esconde) só é
 * adicionada pelo efeito, no cliente — e quem pede menos movimento
 * no sistema recebe o conteúdo direto, sem transição.
 */
export default function Reveal({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-in');
      return;
    }
    el.classList.add('armed');
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add('is-in');
            io.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -32px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="reveal" style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
