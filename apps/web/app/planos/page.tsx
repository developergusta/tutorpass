import type { Metadata } from 'next';
import Link from 'next/link';
import CalculadoraPreco from './calculadora';

export const metadata: Metadata = {
  title: 'Planos e preços — TutorPass',
  description:
    'Preço publicado do TutorPass: Grátis para sempre até 30 alunos, 30 dias grátis com tudo do PRO sem cartão, e PRO com mensalidade fixa por faixa: R$ 89 até 50 alunos, R$ 199 até 200 e R$ 349 acima de 200.',
};

// Os valores desta página espelham apps/api/src/modules/plans/plan.service.ts
// (PLAN_DEFINITIONS — fonte única de verdade). Se o preço mudar na API,
// mude aqui junto; não invente faixa, desconto ou condição que não exista lá.
const FEATURES_PRO = [
  'Fila de saída em tempo real',
  'QR dinâmico de 30 s anti-fraude',
  'Relatório diário por e-mail',
  'Saída antecipada com aprovação da secretaria',
  'Modo telão/TV para portaria e salas',
  'Módulo van/fretado',
  'ETA ao vivo do tutor',
  'Fila ordenada por proximidade',
  'Relatórios avançados (tempo de espera, pico, “escola amiga do trânsito”)',
];

const FEATURES_FREE = FEATURES_PRO.slice(0, 3);

export default function PlanosPage() {
  return (
    <main className="container">
      <section className="card">
        <h1>Planos e preços — sem “sob consulta”</h1>
        <p>
          O preço está na página, não atrás de uma ligação comercial. A escola
          começa grátis, testa tudo por 30 dias sem cartão e só paga quando
          cresce — mensalidade fixa por faixa de alunos, sem conta por aluno.
        </p>
        <p className="muted">
          Preços em reais, por mês, por faixa de alunos. Valores iguais aos do
          plano vigente na API do TutorPass.
        </p>
      </section>

      <section className="pricing-grid">
        <div className="card plan">
          <h2>Grátis</h2>
          <p className="price">
            R$ 0 <span className="muted">/mês, para sempre</span>
          </p>
          <p className="muted">Para começar — até 30 alunos e 5 funcionários.</p>
          <ul>
            {FEATURES_FREE.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <Link className="btn secondary" href="/cadastro">
            Criar conta grátis
          </Link>
        </div>

        <div className="card plan recommended">
          <p className="plan-badge">Recomendado</p>
          <h2>Teste de 30 dias</h2>
          <p className="price">
            R$ 0 <span className="muted">por 30 dias</span>
          </p>
          <p className="muted">
            Todas as funções do PRO, sem cartão. Um teste por escola; ao fim,
            volta sozinho para o plano Grátis.
          </p>
          <ul>
            {FEATURES_PRO.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <Link className="btn" href="/cadastro">
            Começar o teste grátis
          </Link>
        </div>

        <div className="card plan">
          <h2>PRO</h2>
          <p className="price">
            R$ 89–349 <span className="muted">/mês, por faixa</span>
          </p>
          <p className="muted">
            Mensalidade fixa pela faixa de alunos, para a escola inteira —
            até 2.000 alunos e 50 funcionários.
          </p>
          <ul className="plan-bands" aria-label="Faixas de preço do PRO">
            <li>
              <span>Até 50 alunos</span>
              <strong>R$ 89/mês</strong>
            </li>
            <li>
              <span>De 51 a 200 alunos</span>
              <strong>R$ 199/mês</strong>
            </li>
            <li>
              <span>Acima de 200 alunos</span>
              <strong>R$ 349/mês</strong>
            </li>
          </ul>
          <ul>
            {FEATURES_PRO.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <Link className="btn secondary" href="/cadastro">
            Assinar o PRO
          </Link>
        </div>
      </section>

      <CalculadoraPreco />

      <section className="card">
        <h2>Perguntas frequentes</h2>
        <h3>Preciso de cartão para testar?</h3>
        <p>
          Não. O teste de 30 dias não pede cartão e vale uma vez por escola.
          Quando acaba, o plano volta sozinho para o Grátis e passam a valer
          os limites do Grátis.
        </p>
        <h3>O plano Grátis expira?</h3>
        <p>
          Não — é R$ 0 para sempre, até 30 alunos e 5 funcionários, com fila em
          tempo real, QR dinâmico e relatório diário por e-mail.
        </p>
        <h3>Como é calculada a mensalidade do PRO?</h3>
        <p>
          É fixa por faixa de alunos: até 50 alunos, R$ 89/mês; de 51 a 200,
          R$ 199/mês; acima de 200, R$ 349/mês — a mesma regra que a API
          aplica na cobrança. A mensalidade não muda quando a escola ganha
          ou perde alguns alunos dentro da mesma faixa. Nenhum módulo é
          cobrado à parte: van, telão, ETA e relatórios avançados já estão
          incluídos.
        </p>
        <h3>Minha escola tem mais de 1.000 alunos. E agora?</h3>
        <p>
          Escolas e redes com mais de 1.000 alunos têm condição sob consulta
          — fale com a gente para fechar um valor. O PRO atende até 2.000
          alunos por escola.
        </p>
      </section>
    </main>
  );
}
