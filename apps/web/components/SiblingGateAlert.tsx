'use client';

import { useEffect, useState } from 'react';
import {
  listSiblingGateConflicts,
  type SiblingGateConflict,
} from '../lib/api';
import type { QueueItem } from '../lib/use-pickup-queue';

// Alerta de irmãos em portões diferentes — compartilhado pela portaria e
// pelo telão (ciclo UI 12 criou só a versão da portaria; o telão ganhou a
// sua no ciclo UI 13). Lê por REST (não depende do socket da fila) e
// atualiza a cada 30 s e quando a fila muda; sem permissão (TUTOR, 403)
// ou fora do ar, some em silêncio — a fila segue. O nome do aluno só
// aparece na versão detalhada, quando a fila ao vivo resolve o
// studentId; sem nome, a linha mostra a contagem — nunca um nome
// inventado. O "Aluno" do hook é o placeholder p/ nome ausente no
// evento, então não conta como nome resolvido.
//
// Privacidade no telão: o telão é público (famílias no pátio leem os
// nomes), então a versão compacta mostra SÓ a contagem — nenhum nome,
// nenhum portão. Quem resolve é a portaria, que tem o detalhe.
function useSiblingGateConflicts(items: QueueItem[]) {
  const [conflicts, setConflicts] = useState<SiblingGateConflict[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void listSiblingGateConflicts()
        .then((c) => {
          if (!cancelled) setConflicts(c);
        })
        .catch(() => {
          // Sem permissão ou fora do ar: sem alerta, sem erro na tela.
        });
    };
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [items]);

  return conflicts;
}

function WarningIcon({ size }: { size: number }) {
  return (
    <span className="gate-alert-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3.5L21 20H3L12 3.5z" />
        <path d="M12 10v4.5" />
        <path d="M12 17.6h.01" />
      </svg>
    </span>
  );
}

function countLabel(count: number): string {
  return count === 1
    ? '1 família com filhos em portões diferentes'
    : `${count} famílias com filhos em portões diferentes`;
}

// Versão compacta (telão): uma só linha, só a contagem — meio de
// relance (regra 3×5: no máximo 3 linhas de 5 palavras; aqui 1 linha).
// O aviso não depende só da cor: triângulo + texto, p/ quem não
// distingue o âmbar (daltonismo, reflexo na TV).
function CompactNotice({ conflicts }: { conflicts: SiblingGateConflict[] }) {
  return (
    <div
      className="telao-gate-notice"
      role="status"
      aria-label="Famílias com filhos em portões diferentes"
    >
      <WarningIcon size={26} />
      <p>
        <strong>{countLabel(conflicts.length)}</strong>
        {' — combine um só portão na portaria'}
      </p>
    </div>
  );
}

// Versão detalhada (portaria): contagem + orientação + os portões com
// os nomes dos alunos (ou a contagem) por responsável.
function DetailedAlert({
  conflicts,
  items,
}: {
  conflicts: SiblingGateConflict[];
  items: QueueItem[];
}) {
  const namesByStudentId = new Map<string, string>();
  for (const item of items) {
    if (item.studentId && item.studentName !== 'Aluno') {
      namesByStudentId.set(item.studentId, item.studentName);
    }
  }

  return (
    <section
      className="gate-alert"
      role="status"
      aria-label="Irmãos em portões diferentes"
    >
      <p className="gate-alert-title">
        <WarningIcon size={20} />
        {conflicts.length === 1
          ? '1 responsável com filhos em portões diferentes'
          : `${conflicts.length} responsáveis com filhos em portões diferentes`}
      </p>
      <p className="gate-alert-text">
        Combine um só portão com o responsável antes de liberar — um filho
        pode ficar esperando no portão errado.
      </p>
      <ul className="gate-alert-list">
        {conflicts.map((conflict) => (
          <li key={conflict.tutorId}>
            {conflict.gates.map((g) => {
              const names = g.studentIds
                .map((id) => namesByStudentId.get(id))
                .filter((n): n is string => Boolean(n));
              const missing = g.studentIds.length - names.length;
              const parts = [...names];
              if (missing > 0) {
                parts.push(`${missing} ${missing === 1 ? 'aluno' : 'alunos'}`);
              }
              return (
                <span key={g.gate ?? 'fila-única'} className="gate-alert-gate">
                  <strong>{g.gate ?? 'Fila única'}</strong>
                  {' — '}
                  {parts.join(', ')}
                </span>
              );
            })}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function SiblingGateAlert({
  items,
  compact = false,
}: {
  items: QueueItem[];
  compact?: boolean;
}) {
  const conflicts = useSiblingGateConflicts(items);

  if (!conflicts || conflicts.length === 0) return null;

  return compact ? (
    <CompactNotice conflicts={conflicts} />
  ) : (
    <DetailedAlert conflicts={conflicts} items={items} />
  );
}
