'use client';

// Hook da fila de saída em tempo real.
//
// A API expõe o namespace Socket.io `/pickup` (apps/api/src/realtime/
// pickup.gateway.ts) e emite, via RealtimeService:
//   - `queue.entry.created`        (nova entrada na fila)
//   - `queue.entry.status_changed` (mudança de status da entrada)
//   - `student.called`             (aluno chamado na sala)
// Não há endpoint REST de fila no Step 2 — a fila nasce vazia nesta sessão
// e é montada a partir dos eventos. Sem API/socket, as telas mostram o
// estado vazio amigável em vez de travar.
//
// Nomes: o payload do evento NÃO traz o nome do aluno nem a turma (falta
// na API, ver BACKLOG — bug crítico do realtime). Como todo concorrente
// de dismissal faz (PickupRoster, Cadence, RapidDismiss: o evento traz
// o id e a tela resolve o nome no cadastro), o hook resolve o nome e a
// turma no roster da escola (GET /roster/students + /roster/classrooms,
// que a portaria já pode ler) e só usa o "Aluno" do evento quando o
// roster não resolve — nunca um nome inventado. Sem permissão (TEACHER
// e TUTOR recebem 403 no roster) ou fora do ar, a resolução some em
// silêncio e a fila segue com o que o evento trouxe.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL, checkApiHealth, listClassrooms, listStudents } from './api';

export type QueueGroup = 'ready' | 'enRoute';

export interface QueueItem {
  id: string;
  /** Id do aluno (entry.studentId) — o alerta de irmãos em portões
   * diferentes cruza por ele; o `id` acima é o da entrada, não do aluno. */
  studentId: string | null;
  studentName: string;
  classroomName: string | null;
  gate: string | null;
  group: QueueGroup;
  etaMinutes: number | null;
  /** Status bruto da entrada (QUEUED/CALLED/VALIDATED/...) — a portaria
   * usa p/ saber quais ações oferecer; null quando o evento não trouxe. */
  status: string | null;
}

type RawEntry = Record<string, unknown>;

/** Nome + turma vindos do cadastro — a fonte de verdade p/ exibir. */
type RosterEntry = { name: string; classroomName: string | null };
type RosterMap = Map<string, RosterEntry>;

function pickString(obj: RawEntry, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

function groupFromStatus(status: string | null, fallback: QueueGroup): QueueGroup {
  if (!status) return fallback;
  const s = status.toUpperCase();
  if (
    s.includes('READY') ||
    s.includes('CALLED') ||
    s.includes('VALIDATED') ||
    s.includes('HERE') ||
    s.includes('WAITING') ||
    s.includes('ARRIVED')
  ) {
    return 'ready';
  }
  if (
    s.includes('EN_ROUTE') ||
    s.includes('ENROUTE') ||
    s.includes('APPROACH') ||
    s.includes('SOON') ||
    s.includes('LATER') ||
    s.includes('FAR') ||
    s.includes('ON_THE_WAY')
  ) {
    return 'enRoute';
  }
  return fallback;
}

function normalize(raw: unknown, fallback: QueueGroup, roster?: RosterMap): QueueItem | null {
  if (!raw || typeof raw !== 'object') return null;
  // O RealtimeService embrulha o payload em { seq, data }.
  const wrapped = raw as RawEntry;
  const entry = (
    wrapped.data && typeof wrapped.data === 'object' ? wrapped.data : wrapped
  ) as RawEntry;

  const id =
    pickString(entry, ['id', 'entryId', 'studentId']) ??
    pickString(wrapped, ['id', 'studentId']);
  if (!id) return null;

  const firstName = pickString(entry, ['firstName', 'studentFirstName']);
  const lastName = pickString(entry, ['lastName', 'studentLastName']);
  const studentName =
    pickString(entry, ['studentName', 'displayName', 'name']) ??
    ([firstName, lastName].filter(Boolean).join(' ') || null) ??
    'Aluno';

  const etaRaw = entry.etaMinutes;
  const rawStatus = pickString(entry, ['status', 'band', 'proximityBand']);
  const studentId = pickString(entry, ['studentId']);
  // O cadastro resolve o que o evento não traz: nome e turma são do
  // roster quando o studentId casa — o "Aluno" do evento some da tela.
  const resolved = studentId ? roster?.get(studentId) : undefined;
  return {
    id,
    studentId,
    studentName: resolved?.name ?? studentName,
    classroomName: resolved?.classroomName ?? pickString(entry, ['classroomName', 'classroom']),
    gate: pickString(entry, ['gate', 'gateName']),
    group: groupFromStatus(rawStatus, fallback),
    etaMinutes: typeof etaRaw === 'number' ? etaRaw : null,
    status: rawStatus ? rawStatus.toUpperCase() : null,
  };
}

/** Reaplica o roster num item já na fila (o cadastro pode chegar depois
 * do evento — o "Aluno" vira o nome sem esperar a próxima entrada). */
function enrichItem(item: QueueItem, roster: RosterMap): QueueItem {
  if (!item.studentId) return item;
  const resolved = roster.get(item.studentId);
  if (!resolved) return item;
  if (item.studentName === resolved.name && item.classroomName === resolved.classroomName) {
    return item;
  }
  return { ...item, studentName: resolved.name, classroomName: resolved.classroomName };
}

const REMOVED_HINTS = ['DELIVERED', 'PICKED_UP', 'RELEASED', 'COMPLETED', 'CANCELLED', 'CANCELED', 'REMOVED'];

export interface PickupQueueState {
  items: QueueItem[];
  ready: QueueItem[];
  enRoute: QueueItem[];
  socketConnected: boolean;
  apiOnline: boolean | null; // null = ainda verificando
  /** Re-verifica a saúde da API e reconecta o socket (botão "Tentar de novo"). */
  retry: () => void;
}

export function usePickupQueue(): PickupQueueState {
  const [byId, setById] = useState<Map<string, QueueItem>>(new Map());
  const [socketConnected, setSocketConnected] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [roster, setRoster] = useState<RosterMap>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const rosterRef = useRef<RosterMap>(new Map());
  const retryRef = useRef<() => void>(() => {});

  const retry = useCallback(() => retryRef.current(), []);

  // O cadastro da escola, uma vez por montagem (+ no "Tentar de novo"):
  // alunos por id e turmas por id. Falha silenciosa — sem permissão
  // (TEACHER/TUTOR, 403) ou fora do ar, a fila segue com o que o evento
  // trouxe e o "Aluno" continua sendo o fallback honesto.
  const loadRoster = useCallback(() => {
    void Promise.all([listStudents(), listClassrooms()])
      .then(([students, classrooms]) => {
        const classroomName = new Map(classrooms.map((c) => [c.id, c.name]));
        const map: RosterMap = new Map(
          students.map((s) => [
            s.id,
            {
              name: s.name,
              classroomName: classroomName.get(s.classroomId) ?? null,
            },
          ]),
        );
        rosterRef.current = map;
        setRoster(map);
      })
      .catch(() => {
        // Sem roster, sem nomes resolvidos — a fila segue.
      });
  }, []);

  // Quando o cadastro chega depois dos eventos, os itens já na fila
  // ganham o nome e a turma sem esperar a próxima entrada.
  useEffect(() => {
    if (roster.size === 0) return;
    setById((prev) => {
      let changed = false;
      const next = new Map<string, QueueItem>();
      prev.forEach((item, id) => {
        const enriched = enrichItem(item, roster);
        if (enriched !== item) changed = true;
        next.set(id, enriched);
      });
      return changed ? next : prev;
    });
  }, [roster]);

  useEffect(() => {
    let cancelled = false;

    const check = () => {
      void checkApiHealth().then((ok) => {
        if (!cancelled) setApiOnline(ok);
      });
    };
    check();
    loadRoster();
    const healthTimer = setInterval(check, 30_000);
    // Retry manual: re-verifica a API, recarrega o cadastro e reconecta
    // o socket (ele desiste sozinho após 5 tentativas — o botão devolve
    // o controle). O roster recarrega aqui p/ um aluno cadastrado no
    // meio do dia aparecer sem recarregar a página.
    retryRef.current = () => {
      check();
      loadRoster();
      socketRef.current?.connect();
    };

    // O gateway EXIGE schoolId no handshake (sem ele, desconecta na
    // hora) e usa o `role` p/ escolher a room — a portaria/telão
    // precisam da room do portão. Mandar só o token era o bug do
    // "conectando…" eterno (17/11/2026). A forma de função faz o
    // socket.io reler a sessão a cada (re)conexão — token renovado
    // pelo RequireAuth entra sozinho.
    const socket = io(`${API_URL}/pickup`, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 5_000,
      auth: (cb) => {
        try {
          const raw = sessionStorage.getItem('tutorpass.session');
          const session = raw
            ? (JSON.parse(raw) as {
                accessToken?: string;
                schoolId?: string | null;
                roles?: string[];
              })
            : null;
          const roles = session?.roles ?? [];
          const role =
            ['GATE_AGENT', 'COORDINATOR', 'ADMIN', 'TEACHER'].find((r) =>
              roles.includes(r),
            ) ?? roles[0];
          cb({
            token: session?.accessToken,
            schoolId: session?.schoolId ?? undefined,
            role,
          });
        } catch {
          cb({});
        }
      },
    });
    socketRef.current = socket;

    const upsert = (raw: unknown, fallback: QueueGroup) => {
      const item = normalize(raw, fallback, rosterRef.current);
      if (!item) return;
      setById((prev) => {
        const next = new Map(prev);
        next.set(item.id, item);
        return next;
      });
    };

    const onStatusChanged = (raw: unknown) => {
      const wrapped = (raw ?? {}) as RawEntry;
      const data = (wrapped.data ?? wrapped) as RawEntry;
      const status = pickString(data, ['status']);
      if (status && REMOVED_HINTS.some((hint) => status.toUpperCase().includes(hint))) {
        const item = normalize(raw, 'ready', rosterRef.current);
        if (item) {
          setById((prev) => {
            const next = new Map(prev);
            next.delete(item.id);
            return next;
          });
        }
        return;
      }
      upsert(raw, 'enRoute');
    };

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', () => setSocketConnected(false));
    socket.on('queue.entry.created', (raw: unknown) => upsert(raw, 'enRoute'));
    socket.on('queue.entry.status_changed', onStatusChanged);
    socket.on('student.called', (raw: unknown) => upsert(raw, 'ready'));

    return () => {
      cancelled = true;
      clearInterval(healthTimer);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [loadRoster]);

  const items = useMemo(() => Array.from(byId.values()), [byId]);
  const ready = useMemo(() => items.filter((i) => i.group === 'ready'), [items]);
  const enRoute = useMemo(() => items.filter((i) => i.group === 'enRoute'), [items]);

  return { items, ready, enRoute, socketConnected, apiOnline, retry };
}
