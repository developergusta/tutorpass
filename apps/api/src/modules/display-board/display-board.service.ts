import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UrgencyColor } from '../eta/eta.service';

// Modo telão/TV (portaria e sala) — o board que a escola pendura na parede.
// Lógica pura, in-memory como os demais serviços; persistência no Step 2.
// Inspiração (pesquisa frentes c/d, ciclo 12): PickupRoster (board ao vivo no
// navegador — cada sala, corredor e tela da escola atualiza ao mesmo tempo),
// Schoolhouse Driveline (nome do aluno + local de retirada por cor em
// smartboards/projetores/qualquer navegador), Dismissal Magic (pop-up em tela
// cheia + sino quando a turma é chamada; funciona em qualquer tela com
// navegador, sem instalar nada), Time To Dismiss (nomes grandes de alto
// contraste em TVs), "pickup." (telão com páginas ou lista rolante e
// destaques de embarque configuráveis) e Carline Hound (telão na área de
// embarque). Preço dos entrantes (frente d): Dismissal Magic US$ 149–249/
// escola/ano, PickupRoster US$ 150/mês (Car Line) — o telão é o motivo de
// a escola pagar por escola/ano em vez de por aluno; nosso TV_MODE já é
// feature do PRO (ver PlanService).
//
// O board é uma VISTA da fila — não uma fila nova: quem manda a ordem é o
// EtaService (`getQueue`), e o controller do Step 2 mapeia cada entrada da
// fila p/ um BoardStudent (tutor → alunos daquele carro). Duas colunas,
// sem rolagem: "Pronto p/ retirada" vs "A caminho" (ReadyBell/Technothera,
// ciclo 11). Quando não cabe na tela, o board pagina e vira a página
// sozinho (rotação automática); a TV da sala mostra só os alunos da sala.

export type BoardMode = 'GATE' | 'CLASSROOM' | 'HALLWAY';
/** Como o aluno chega ao board: READY = tutor chegado (banda HERE do ETA). */
export type BoardStudentStatus = 'READY' | 'EN_ROUTE';

export const DEFAULT_PAGE_SIZE = 8; // cartões por coluna que cabem numa TV sem rolar
export const MAX_PAGE_SIZE = 12;
export const DEFAULT_ROTATE_SECONDS = 15; // tempo de cada página no ar
export const CALL_HIGHLIGHT_MS = 20_000; // pop-up de chamada (Dismissal Magic)
export const DISPLAY_STALE_AFTER_MS = 10 * 60_000; // TV sem consultar há 10 min

export interface BoardStudent {
  schoolId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  classroomId: string;
  classroomName: string;
  status: BoardStudentStatus;
  /** Cor de urgência do ETA (EtaService). */
  color: UrgencyColor;
  /** ETA em minutos; null quando sem sinal (nunca inventado). */
  etaMinutes: number | null;
  /** Foto p/ reconhecimento em 1 s (DismissalFlow, frente c) — nunca no corredor. */
  photoUrl?: string;
}

export interface DisplayBoard {
  id: string;
  schoolId: string;
  mode: BoardMode;
  classroomId: string | null;
  pageSize: number;
  rotateSeconds: number;
  currentPage: number; // 1-based
  lastPageAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
}

export interface BoardCard {
  studentId: string;
  /** Nome exibido — no corredor, só 1º nome + inicial (LGPD, tela pública). */
  displayName: string;
  classroomName: string;
  color: UrgencyColor;
  etaLabel: string;
  /** Foto só em GATE e CLASSROOM; HALLWAY nunca mostra foto. */
  photoUrl?: string;
}

export interface CallBanner {
  studentId: string;
  displayName: string;
  classroomName: string;
  /** Segundos restantes do pop-up (p/ a contagem regressiva na tela). */
  secondsLeft: number;
}

export interface BoardSnapshot {
  displayId: string;
  schoolId: string;
  mode: BoardMode;
  generatedAt: Date;
  ready: BoardCard[];
  enRoute: BoardCard[];
  page: number;
  totalPages: number;
  rotateSeconds: number;
  /** Chamada ativa (pop-up em tela cheia) — null quando não há. */
  call: CallBanner | null;
  isEmpty: boolean;
}

interface ActiveCall {
  schoolId: string;
  studentId: string;
  displayName: string;
  classroomName: string;
  calledBy: string;
  calledAt: Date;
}

@Injectable()
export class DisplayBoardService {
  private seq = 0;
  private displays = new Map<string, DisplayBoard>();
  /** Uma chamada ativa por escola (a mais recente vence — pop-up único). */
  private calls = new Map<string, ActiveCall>();

  registerDisplay(
    input: {
      schoolId: string;
      mode: BoardMode;
      classroomId?: string;
      pageSize?: number;
      rotateSeconds?: number;
    },
    now: Date = new Date(),
  ): DisplayBoard {
    if (!input.schoolId?.trim()) {
      throw new BadRequestException('schoolId é obrigatório.');
    }
    if (input.mode === 'CLASSROOM' && !input.classroomId?.trim()) {
      throw new BadRequestException(
        'CLASSROOM exige classroomId: a TV da sala mostra só os alunos da sala.',
      );
    }
    const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
      throw new BadRequestException(
        `pageSize deve ser inteiro entre 1 e ${MAX_PAGE_SIZE} (o que cabe na TV sem rolar).`,
      );
    }
    const rotateSeconds = input.rotateSeconds ?? DEFAULT_ROTATE_SECONDS;
    if (!Number.isInteger(rotateSeconds) || rotateSeconds < 5 || rotateSeconds > 120) {
      throw new BadRequestException('rotateSeconds deve ser inteiro entre 5 e 120.');
    }
    const display: DisplayBoard = {
      id: `board-${++this.seq}`,
      schoolId: input.schoolId,
      mode: input.mode,
      classroomId: input.classroomId ?? null,
      pageSize,
      rotateSeconds,
      currentPage: 1,
      lastPageAt: now,
      lastSeenAt: now,
      createdAt: now,
    };
    this.displays.set(display.id, display);
    return { ...display };
  }

  getDisplay(displayId: string): DisplayBoard {
    const display = this.displays.get(displayId);
    if (!display) throw new NotFoundException('Tela não encontrada.');
    return { ...display };
  }

  listDisplays(schoolId: string): DisplayBoard[] {
    return [...this.displays.values()]
      .filter((d) => d.schoolId === schoolId)
      .map((d) => ({ ...d }));
  }

  removeDisplay(displayId: string): boolean {
    return this.displays.delete(displayId);
  }

  /** Avanço manual de página (controle do staff) — volta p/ a 1ª no fim. */
  nextPage(displayId: string, totalPages: number, now: Date = new Date()): number {
    const display = this.displays.get(displayId);
    if (!display) throw new NotFoundException('Tela não encontrada.');
    if (!Number.isInteger(totalPages) || totalPages < 1) {
      throw new BadRequestException('totalPages deve ser inteiro >= 1.');
    }
    display.currentPage = (display.currentPage % totalPages) + 1;
    display.lastPageAt = now;
    return display.currentPage;
  }

  /**
   * Chama um aluno (a portaria toca o sino): o board mostra o pop-up em
   * tela cheia por 20 s. A chamada mais recente vence — um pop-up por vez.
   * O nome guardado aqui é o da chamada; o snapshot só exibe o banner se o
   * aluno ainda estiver na fila (se já foi retirado, não há o que chamar).
   */
  callStudent(
    input: {
      schoolId: string;
      studentId: string;
      displayName: string;
      classroomName: string;
      calledBy: string;
    },
    now: Date = new Date(),
  ): ActiveCall {
    if (!input.studentId?.trim() || !input.displayName?.trim()) {
      throw new BadRequestException('studentId e displayName são obrigatórios.');
    }
    if (!input.calledBy?.trim()) {
      throw new BadRequestException('calledBy é obrigatório (quem chamou, p/ auditoria).');
    }
    const call: ActiveCall = { ...input, calledAt: now };
    this.calls.set(input.schoolId, call);
    return { ...call };
  }

  /** Cancela o pop-up de chamada (ex.: aluno já saiu pela porta). */
  clearCall(schoolId: string): boolean {
    return this.calls.delete(schoolId);
  }

  private displayNameFor(mode: BoardMode, s: BoardStudent): string {
    if (mode === 'HALLWAY') {
      // Tela pública (corredor/entrada): 1º nome + inicial do sobrenome —
      // o suficiente p/ a família se reconhecer, sem expor nome completo.
      const initial = s.lastName.trim().charAt(0);
      return initial ? `${s.firstName} ${initial}.` : s.firstName;
    }
    return `${s.firstName} ${s.lastName}`.trim();
  }

  private toCard(mode: BoardMode, s: BoardStudent): BoardCard {
    const etaLabel =
      s.status === 'READY'
        ? s.color === 'RED'
          ? 'ENCAMINHAR JÁ'
          : 'Pronto'
        : s.etaMinutes !== null
          ? `chega em ~${s.etaMinutes} min`
          : 'sem sinal';
    return {
      studentId: s.studentId,
      displayName: this.displayNameFor(mode, s),
      classroomName: s.classroomName,
      color: s.color,
      etaLabel,
      // Foto ajuda a reconhecer em 1 s — mas nunca numa tela pública.
      photoUrl: mode === 'HALLWAY' ? undefined : s.photoUrl,
    };
  }

  /**
   * O snapshot que a TV consulta (poll a cada poucos segundos). Pagina as
   * duas colunas sem rolar e vira a página sozinho quando o tempo de
   * rotação vence. A ordem dentro de cada coluna é a que o chamador passou
   * (a fila do EtaService, já ordenada p/ chamar).
   */
  snapshot(displayId: string, students: BoardStudent[], now: Date = new Date()): BoardSnapshot {
    const display = this.displays.get(displayId);
    if (!display) throw new NotFoundException('Tela não encontrada.');
    display.lastSeenAt = now;

    const visible = students.filter(
      (s) =>
        s.schoolId === display.schoolId &&
        (display.mode !== 'CLASSROOM' || s.classroomId === display.classroomId),
    );
    const ready = visible
      .filter((s) => s.status === 'READY')
      .map((s) => this.toCard(display.mode, s));
    const enRoute = visible
      .filter((s) => s.status === 'EN_ROUTE')
      .map((s) => this.toCard(display.mode, s));

    const totalPages = Math.max(
      Math.ceil(ready.length / display.pageSize),
      Math.ceil(enRoute.length / display.pageSize),
      1,
    );
    // Rotação automática: a página vira sozinha quando o tempo vence.
    if (
      totalPages > 1 &&
      now.getTime() - display.lastPageAt.getTime() >= display.rotateSeconds * 1000
    ) {
      display.currentPage = (display.currentPage % totalPages) + 1;
      display.lastPageAt = now;
    }
    if (display.currentPage > totalPages) display.currentPage = totalPages;
    const page = display.currentPage;
    const start = (page - 1) * display.pageSize;

    const call = this.activeCallBanner(display, visible, now);
    return {
      displayId: display.id,
      schoolId: display.schoolId,
      mode: display.mode,
      generatedAt: now,
      ready: ready.slice(start, start + display.pageSize),
      enRoute: enRoute.slice(start, start + display.pageSize),
      page,
      totalPages,
      rotateSeconds: display.rotateSeconds,
      call,
      isEmpty: ready.length === 0 && enRoute.length === 0,
    };
  }

  private activeCallBanner(
    display: DisplayBoard,
    visible: BoardStudent[],
    now: Date,
  ): CallBanner | null {
    const call = this.calls.get(display.schoolId);
    if (!call) return null;
    const elapsedMs = now.getTime() - call.calledAt.getTime();
    if (elapsedMs >= CALL_HIGHLIGHT_MS) return null;
    const student = visible.find((s) => s.studentId === call.studentId);
    if (!student) return null; // já retirado — não há o que chamar
    return {
      studentId: call.studentId,
      displayName: this.displayNameFor(display.mode, student),
      classroomName: call.classroomName,
      secondsLeft: Math.ceil((CALL_HIGHLIGHT_MS - elapsedMs) / 1000),
    };
  }

  /** Job periódico (junto aos demais refreshes): remove telas sem consulta há 10 min. Idempotente. */
  refresh(now: Date = new Date()): { removed: number } {
    let removed = 0;
    for (const [id, display] of this.displays) {
      if (now.getTime() - display.lastSeenAt.getTime() > DISPLAY_STALE_AFTER_MS) {
        this.displays.delete(id);
        removed++;
      }
    }
    return { removed };
  }
}
