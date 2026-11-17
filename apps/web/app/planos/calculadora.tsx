'use client';

import { useState } from 'react';

// Espelha apps/api/src/modules/plans/plan.service.ts (fonte única de verdade):
// FREE até 30 alunos = R$ 0; PRO = mensalidade FIXA por faixa de alunos
// (até 50 → R$ 89; 51–200 → R$ 199; acima de 200 → R$ 349), teto de 2.000
// alunos por escola; TRIAL = 30 dias grátis com tudo do PRO, sem cartão,
// 1 por escola. Acima de 1.000 alunos, condição sob consulta (redes).
const FREE_MAX_STUDENTS = 30;
const PRO_MAX_STUDENTS = 2000;
const PRO_BANDS: { maxStudents: number; monthlyBRL: number; label: string }[] = [
  { maxStudents: 50, monthlyBRL: 89, label: 'até 50 alunos' },
  { maxStudents: 200, monthlyBRL: 199, label: 'de 51 a 200 alunos' },
  { maxStudents: PRO_MAX_STUDENTS, monthlyBRL: 349, label: 'acima de 200 alunos' },
];

function brl(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export default function CalculadoraPreco() {
  const [alunos, setAlunos] = useState('150');

  const n = Math.floor(Number(alunos));
  const valido = Number.isFinite(n) && n > 0;
  const band =
    valido && n > FREE_MAX_STUDENTS
      ? PRO_BANDS.find((b) => n <= b.maxStudents)
      : undefined;

  return (
    <div className="card calculator">
      <h2>Quanto custa para a minha escola?</h2>
      <label htmlFor="alunos">Número de alunos</label>
      <input
        id="alunos"
        type="number"
        min={1}
        max={10000}
        step={1}
        inputMode="numeric"
        value={alunos}
        onChange={(e) => setAlunos(e.target.value)}
      />
      {/* O resultado muda a cada tecla: aria-live avisa o leitor de tela
          sem ele precisar sair do campo. */}
      <div aria-live="polite">
      {!valido && (
        <p className="muted">Digite o número de alunos da escola.</p>
      )}
      {valido && n <= FREE_MAX_STUDENTS && (
        <p className="calc-result">
          <strong>{brl(0)}/mês</strong> — até {FREE_MAX_STUDENTS} alunos, o
          plano Grátis cobre tudo o que a escola precisa para começar.
        </p>
      )}
      {valido && band && (
        <p className="calc-result">
          <strong>{brl(band.monthlyBRL)}/mês</strong> no PRO — faixa{' '}
          {band.label}: mensalidade fixa de {brl(band.monthlyBRL)} por mês (
          {brl(band.monthlyBRL * 12)} por ano, sem desconto anual: o valor é
          mensal × 12). O preço não muda se a escola ganhar ou perder alunos
          dentro da faixa.
        </p>
      )}
      {valido && n > PRO_MAX_STUDENTS && (
        <p className="calc-result">
          Acima do teto do PRO ({PRO_MAX_STUDENTS.toLocaleString('pt-BR')}{' '}
          alunos por escola) — plano sob consulta, com preço por escola.
        </p>
      )}
      </div>
      <p className="muted">
        Escolas e redes com mais de 1.000 alunos têm condição sob consulta. E
        dá para testar tudo antes de pagar: 30 dias grátis com todas as
        funções do PRO, sem cartão.
      </p>
    </div>
  );
}
