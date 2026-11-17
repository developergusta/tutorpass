import Link from 'next/link';

// Página 404 da marca (ciclo UI 9, 17/11/2026) — antes caía na tela
// padrão do Next, sem marca nem caminho de volta. Reusa o padrão
// `.state` (ícone + título em display + 1 linha + ações) e os botões
// do design system. Sem exclamação, sem período em rótulo curto
// (passada anti-genérica/unslop).
export default function NotFound() {
  return (
    <main className="container not-found">
      <div className="state">
        <span className="state-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="26"
            height="26"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3l7 3v5c0 4.5-3 8.1-7 10-4-1.9-7-5.5-7-10V6l7-3z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </span>
        <h1 className="state-title">Página não encontrada</h1>
        <p className="state-text">
          O endereço pode ter mudado ou foi digitado errado. Volte para a
          página inicial ou abra a portaria.
        </p>
        <div className="state-action not-found-actions">
          <Link className="btn" href="/">
            Voltar para a página inicial
          </Link>
          <Link className="btn secondary" href="/portaria">
            Ir para a portaria
          </Link>
        </div>
      </div>
    </main>
  );
}
