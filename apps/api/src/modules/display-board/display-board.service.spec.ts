import { DisplayBoardService, type BoardStudent } from './display-board.service';

describe('DisplayBoardService — modo telão/TV (portaria e sala)', () => {
  const now = new Date('2026-11-17T05:00:00-03:00');
  const at = (ms: number) => new Date(now.getTime() + ms);
  const school = 'school-1';

  const student = (over: Partial<BoardStudent> & { studentId: string }): BoardStudent => ({
    schoolId: school,
    firstName: 'Ana',
    lastName: 'Silva',
    classroomId: 'class-1',
    classroomName: '1º A',
    status: 'EN_ROUTE',
    color: 'YELLOW',
    etaMinutes: 5,
    photoUrl: 'https://cdn.tutorpass.test/ana.jpg',
    ...over,
  });

  function boardWith(
    students: BoardStudent[],
    opts: { mode?: 'GATE' | 'CLASSROOM' | 'HALLWAY'; classroomId?: string; pageSize?: number; rotateSeconds?: number } = {},
  ) {
    const s = new DisplayBoardService();
    const display = s.registerDisplay(
      { schoolId: school, mode: opts.mode ?? 'GATE', classroomId: opts.classroomId, pageSize: opts.pageSize, rotateSeconds: opts.rotateSeconds },
      now,
    );
    return { s, display, snap: (t: Date = now) => s.snapshot(display.id, students, t) };
  }

  it('registro com defaults: 8 cartões/coluna, rotação de 15 s, página 1', () => {
    const s = new DisplayBoardService();
    const d = s.registerDisplay({ schoolId: school, mode: 'GATE' }, now);
    expect(d.pageSize).toBe(8);
    expect(d.rotateSeconds).toBe(15);
    expect(d.currentPage).toBe(1);
    expect(d.classroomId).toBeNull();
  });

  it('CLASSROOM sem classroomId é rejeitado (a TV da sala precisa da sala)', () => {
    const s = new DisplayBoardService();
    expect(() => s.registerDisplay({ schoolId: school, mode: 'CLASSROOM' }, now)).toThrow(
      'CLASSROOM exige classroomId',
    );
  });

  it('pageSize fora de 1..12 é rejeitado (só cabe na TV sem rolar)', () => {
    const s = new DisplayBoardService();
    expect(() => s.registerDisplay({ schoolId: school, mode: 'GATE', pageSize: 0 }, now)).toThrow(
      'pageSize deve ser inteiro entre 1 e 12',
    );
    expect(() => s.registerDisplay({ schoolId: school, mode: 'GATE', pageSize: 13 }, now)).toThrow(
      'pageSize deve ser inteiro entre 1 e 12',
    );
  });

  it('snapshot separa Pronto vs A caminho, mantendo a ordem da fila do ETA', () => {
    const students = [
      student({ studentId: 's1', status: 'READY', color: 'RED', etaMinutes: 0, firstName: 'Bia' }),
      student({ studentId: 's2', status: 'EN_ROUTE', firstName: 'Caio' }),
      student({ studentId: 's3', status: 'READY', color: 'ORANGE', etaMinutes: 0, firstName: 'Davi' }),
    ];
    const { snap } = boardWith(students);
    const b = snap();
    expect(b.ready.map((c) => c.studentId)).toEqual(['s1', 's3']);
    expect(b.enRoute.map((c) => c.studentId)).toEqual(['s2']);
    expect(b.totalPages).toBe(1);
    expect(b.isEmpty).toBe(false);
  });

  it('READY com cor RED mostra "ENCAMINHAR JÁ"; EN_ROUTE com ETA mostra "chega em ~5 min"', () => {
    const students = [
      student({ studentId: 's1', status: 'READY', color: 'RED', etaMinutes: 0 }),
      student({ studentId: 's2', status: 'EN_ROUTE', etaMinutes: 5 }),
      student({ studentId: 's3', status: 'EN_ROUTE', etaMinutes: null, color: 'GRAY' }),
    ];
    const { snap } = boardWith(students);
    const b = snap();
    expect(b.ready[0].etaLabel).toBe('ENCAMINHAR JÁ');
    expect(b.enRoute[0].etaLabel).toBe('chega em ~5 min');
    expect(b.enRoute[1].etaLabel).toBe('sem sinal');
  });

  it('paginação: 10 prontos com pageSize 4 → 3 páginas; nextPage avança e volta p/ 1', () => {
    const students = Array.from({ length: 10 }, (_, i) =>
      student({ studentId: `s${i}`, status: 'READY', color: 'RED', etaMinutes: 0, firstName: `Aluno${i}` }),
    );
    const { s, display, snap } = boardWith(students, { pageSize: 4 });
    expect(snap().totalPages).toBe(3);
    expect(snap().ready).toHaveLength(4);
    expect(s.nextPage(display.id, 3, now)).toBe(2);
    expect(snap().page).toBe(2);
    expect(snap().ready).toHaveLength(4);
    expect(s.nextPage(display.id, 3, now)).toBe(3);
    expect(snap().ready).toHaveLength(2);
    expect(s.nextPage(display.id, 3, now)).toBe(1);
  });

  it('rotação automática: a página vira sozinha após rotateSeconds', () => {
    const students = Array.from({ length: 6 }, (_, i) =>
      student({ studentId: `s${i}`, status: 'READY', color: 'RED', etaMinutes: 0 }),
    );
    const { snap } = boardWith(students, { pageSize: 4, rotateSeconds: 15 });
    expect(snap(now).page).toBe(1);
    expect(snap(at(14_000)).page).toBe(1); // ainda não venceu
    expect(snap(at(15_000)).page).toBe(2); // virou
    expect(snap(at(29_000)).page).toBe(2);
    expect(snap(at(30_000)).page).toBe(1); // voltou p/ 1ª
  });

  it('HALLWAY mascara o nome (1º nome + inicial) e nunca mostra foto', () => {
    const students = [student({ studentId: 's1', firstName: 'Ana', lastName: 'Silva' })];
    const { snap } = boardWith(students, { mode: 'HALLWAY' });
    const b = snap();
    expect(b.enRoute[0].displayName).toBe('Ana S.');
    expect(b.enRoute[0].photoUrl).toBeUndefined();
  });

  it('GATE mostra nome completo e foto; CLASSROOM mostra só os alunos da sala', () => {
    const students = [
      student({ studentId: 's1', classroomId: 'class-1' }),
      student({ studentId: 's2', classroomId: 'class-2', firstName: 'Bia' }),
    ];
    const { snap } = boardWith(students);
    expect(snap().enRoute[0].displayName).toBe('Ana Silva');
    expect(snap().enRoute[0].photoUrl).toBe('https://cdn.tutorpass.test/ana.jpg');

    const room = boardWith(students, { mode: 'CLASSROOM', classroomId: 'class-2' });
    const b = room.snap();
    expect(b.enRoute.map((c) => c.studentId)).toEqual(['s2']);
  });

  it('chamada: banner por 20 s com contagem regressiva; depois expira', () => {
    const students = [student({ studentId: 's1', firstName: 'Ana', lastName: 'Silva' })];
    const { s, snap } = boardWith(students);
    s.callStudent(
      { schoolId: school, studentId: 's1', displayName: 'Ana Silva', classroomName: '1º A', calledBy: 'staff-1' },
      now,
    );
    const b = snap(at(5_000));
    expect(b.call).not.toBeNull();
    expect(b.call?.studentId).toBe('s1');
    expect(b.call?.secondsLeft).toBe(15);
    expect(snap(at(20_000)).call).toBeNull();
    expect(snap(at(25_000)).call).toBeNull();
  });

  it('chamada de aluno fora da fila não aparece (já retirado)', () => {
    const students = [student({ studentId: 's1' })];
    const { s, snap } = boardWith(students);
    s.callStudent(
      { schoolId: school, studentId: 's9', displayName: 'Fora', classroomName: '1º A', calledBy: 'staff-1' },
      now,
    );
    expect(snap().call).toBeNull();
  });

  it('a chamada mais recente vence (um pop-up por vez)', () => {
    const students = [
      student({ studentId: 's1', firstName: 'Ana' }),
      student({ studentId: 's2', firstName: 'Bia' }),
    ];
    const { s, snap } = boardWith(students);
    s.callStudent({ schoolId: school, studentId: 's1', displayName: 'Ana', classroomName: '1º A', calledBy: 'staff-1' }, now);
    s.callStudent({ schoolId: school, studentId: 's2', displayName: 'Bia', classroomName: '1º A', calledBy: 'staff-1' }, at(1_000));
    expect(snap(at(2_000)).call?.studentId).toBe('s2');
    expect(s.clearCall(school)).toBe(true);
    expect(snap(at(3_000)).call).toBeNull();
  });

  it('board vazio: isEmpty true e colunas vazias (tela calma, não em branco)', () => {
    const { snap } = boardWith([]);
    const b = snap();
    expect(b.isEmpty).toBe(true);
    expect(b.ready).toEqual([]);
    expect(b.enRoute).toEqual([]);
    expect(b.totalPages).toBe(1);
  });

  it('isolamento por escola: alunos de outra escola não entram no board', () => {
    const students = [
      student({ studentId: 's1' }),
      student({ studentId: 's2', schoolId: 'school-2', firstName: 'Outro' }),
    ];
    const { snap } = boardWith(students);
    expect(snap().enRoute.map((c) => c.studentId)).toEqual(['s1']);
  });

  it('snapshot de tela desconhecida dá 404', () => {
    const s = new DisplayBoardService();
    expect(() => s.snapshot('board-inexistente', [], now)).toThrow('Tela não encontrada.');
  });

  it('refresh remove telas sem consulta há 10 min; snapshot recente mantém a tela', () => {
    const s = new DisplayBoardService();
    const d1 = s.registerDisplay({ schoolId: school, mode: 'GATE' }, now);
    const d2 = s.registerDisplay({ schoolId: school, mode: 'HALLWAY' }, now);
    s.snapshot(d1.id, [], at(2 * 60_000)); // d1 consultada aos 2 min
    const r = s.refresh(at(11 * 60_000)); // d1 há 9 min (mantém), d2 há 11 min (remove)
    expect(r.removed).toBe(1); // d2 nunca consultou
    expect(s.listDisplays(school).map((d) => d.id)).toEqual([d1.id]);
    expect(s.refresh(at(12 * 60_000)).removed).toBe(0); // idempotente
    void d2;
  });
});
