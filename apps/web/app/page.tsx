import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="container">
      <section className="card">
        <h1>Saída escolar sem fila, com segurança de verdade</h1>
        <p>
          O TutorPass organiza o check-in e o check-out dos alunos em escolas
          particulares: o tutor avisa que está chegando, a portaria chama o
          aluno na hora certa e cada retirada fica registrada num log de
          auditoria imutável — com QR dinâmico anti-fraude e geofencing no
          servidor.
        </p>
        <p className="muted">
          Esta é a versão web mínima: login da equipe, painel da portaria com
          a fila de saída em tempo real e o telão da TV. O app do tutor é o
          próximo passo.
        </p>
      </section>

      <section className="grid-links">
        <div className="card">
          <h2>Entrar</h2>
          <p className="muted">Acesso da equipe da escola (com 2FA quando ativo).</p>
          <Link className="btn" href="/login">
            Ir para o login
          </Link>
        </div>
        <div className="card">
          <h2>Portaria</h2>
          <p className="muted">Fila de saída ao vivo: quem já pode retirar e quem está a caminho.</p>
          <Link className="btn" href="/portaria">
            Abrir a portaria
          </Link>
        </div>
        <div className="card">
          <h2>Planos</h2>
          <p className="muted">Preço publicado: grátis até 30 alunos, 30 dias grátis com tudo, PRO com mensalidade fixa por faixa — R$ 89 até 50 alunos, R$ 199 até 200, R$ 349 acima de 200.</p>
          <Link className="btn" href="/planos">
            Ver planos e preços
          </Link>
        </div>
        <div className="card">
          <h2>Telão</h2>
          <p className="muted">Tela para a TV da escola, com letras grandes e as duas colunas da saída.</p>
          <Link className="btn" href="/telao">
            Abrir o telão
          </Link>
        </div>
      </section>
    </main>
  );
}
