'use client';

import { useEffect } from 'react';

/**
 * Sombra na topbar quando a página rola — o clássico que separa o
 * cabeçalho do conteúdo sem pesar no layout. Não renderiza nada;
 * só alterna a classe no <header> existente.
 */
export default function TopbarScroll() {
  useEffect(() => {
    const header = document.querySelector('header.topbar');
    if (!header) return;
    const onScroll = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return null;
}
