import { RosterService } from './roster.service';

describe('RosterService', () => {
  let service: RosterService;
  let schoolId: string;
  const now = new Date('2026-11-17T07:30:00-03:00');

  beforeEach(() => {
    service = new RosterService();
    schoolId = service.createSchool({ name: 'Escola Demo' }, now).id;
  });

  const classroom = (name = '3º A', year = 2026) =>
    service.createClassroom(schoolId, { name, academicYear: year }, now);

  // --------------------------------------------------------------- escolas

  it('cria escola com slug gerado do nome', () => {
    const school = service.createSchool({ name: 'Colégio São José' }, now);
    expect(school.slug).toBe('colegio-sao-jose');
    expect(school.timezone).toBe('America/Sao_Paulo');
    expect(school.isActive).toBe(true);
  });

  it('rejeita slug duplicado e CNPJ com tamanho errado', () => {
    expect(() => service.createSchool({ name: 'Escola Demo' }, now)).toThrow(
      /Slug .* já usado/,
    );
    expect(() =>
      service.createSchool({ name: 'Outra', document: '123' }, now),
    ).toThrow(/CNPJ inválido/);
  });

  it('atualiza nome sem mudar o slug e desativa/reativa', () => {
    const updated = service.updateSchool(schoolId, { name: 'Escola Nova' }, now);
    expect(updated.name).toBe('Escola Nova');
    expect(updated.slug).toBe('escola-demo');
    expect(service.deactivateSchool(schoolId, now).isActive).toBe(false);
    expect(() => classroom()).toThrow(/desativada/);
    expect(service.reactivateSchool(schoolId, now).isActive).toBe(true);
  });

  // --------------------------------------------------------------- turmas

  it('cria turma e rejeita duplicata (nome + ano) na mesma escola', () => {
    classroom();
    expect(() => classroom('3º a')).toThrow(/já existe/);
    expect(service.listClassrooms(schoolId)).toHaveLength(1);
    expect(service.listClassrooms(schoolId, { academicYear: 2025 })).toHaveLength(0);
  });

  it('renomeia turma e bloqueia renomear p/ nome existente', () => {
    const a = classroom('3º A');
    classroom('3º B');
    expect(service.renameClassroom(a.id, '3º C', now).name).toBe('3º C');
    expect(() => service.renameClassroom(a.id, '3º B', now)).toThrow(/Já existe/);
  });

  it('turma desativada não recebe novos alunos', () => {
    const room = classroom();
    service.deactivateClassroom(room.id, now);
    expect(() =>
      service.createStudent(schoolId, { name: 'Ana', classroomId: room.id }, now),
    ).toThrow(/desativada/);
  });

  // --------------------------------------------------------------- alunos

  it('cria aluno com matrícula única por escola e valida nascimento', () => {
    const room = classroom();
    const student = service.createStudent(
      schoolId,
      { name: 'Ana Silva', classroomId: room.id, enrollmentCode: '2026001', birthDate: '12/03/2018' },
      now,
    );
    expect(student.birthDate).toBe('2018-03-12');
    expect(() =>
      service.createStudent(
        schoolId,
        { name: 'Outro', classroomId: room.id, enrollmentCode: '2026001' },
        now,
      ),
    ).toThrow(/Matrícula .* já cadastrada/);
    expect(() =>
      service.createStudent(
        schoolId,
        { name: 'Futuro', classroomId: room.id, birthDate: '01/01/2030' },
        now,
      ),
    ).toThrow(/no futuro/);
    expect(() =>
      service.createStudent(
        schoolId,
        { name: 'Data ruim', classroomId: room.id, birthDate: '31/02/2018' },
        now,
      ),
    ).toThrow(/inexistente/);
  });

  it('transfere aluno de turma e muda status', () => {
    const a = classroom('3º A');
    const b = classroom('3º B');
    const student = service.createStudent(
      schoolId,
      { name: 'Ana', classroomId: a.id },
      now,
    );
    expect(service.transferStudent(student.id, b.id, now).classroomId).toBe(b.id);
    expect(service.setStudentStatus(student.id, 'TRANSFERRED', now).status).toBe(
      'TRANSFERRED',
    );
    expect(service.listStudents(schoolId, { status: 'ACTIVE' })).toHaveLength(0);
  });

  it('bloqueio de retirada exige motivo e pode ser desfeito', () => {
    const room = classroom();
    const student = service.createStudent(
      schoolId,
      { name: 'Ana', classroomId: room.id },
      now,
    );
    expect(() => service.blockPickup(student.id, 'ok', now)).toThrow(/Motivo/);
    const blocked = service.blockPickup(student.id, 'Ordem judicial', now);
    expect(blocked.pickupBlocked).toBe(true);
    expect(blocked.blockReason).toBe('Ordem judicial');
    expect(service.unblockPickup(student.id, now).pickupBlocked).toBe(false);
  });

  it('respeita o teto de alunos do plano', () => {
    const room = classroom();
    service.setStudentLimit(schoolId, 1);
    service.createStudent(schoolId, { name: 'Ana', classroomId: room.id }, now);
    expect(() =>
      service.createStudent(schoolId, { name: 'Beto', classroomId: room.id }, now),
    ).toThrow(/Limite de alunos atingido/);
  });

  it('busca aluno por nome ignorando acento e maiúscula', () => {
    const room = classroom();
    service.createStudent(schoolId, { name: 'João Silva', classroomId: room.id }, now);
    expect(service.listStudents(schoolId, { search: 'joao' })).toHaveLength(1);
    expect(service.listStudents(schoolId, { search: 'maria' })).toHaveLength(0);
  });

  // -------------------------------------------------------------- tutores

  it('cria tutor com telefone único por escola e bloqueia vínculo de bloqueado', () => {
    const room = classroom();
    const tutor = service.createTutor(
      schoolId,
      { name: 'Maria', phone: '(11) 98765-4321' },
      now,
    );
    expect(tutor.phone).toBe('11987654321');
    expect(() =>
      service.createTutor(schoolId, { name: 'Outra', phone: '11987654321' }, now),
    ).toThrow(/telefone/);
    const student = service.createStudent(
      schoolId,
      { name: 'Ana', classroomId: room.id },
      now,
    );
    service.blockTutor(tutor.id, 'Suspeita de fraude', now);
    expect(() => service.linkTutor(tutor.id, student.id, 'MOTHER', {}, now)).toThrow(
      /bloqueado/,
    );
    service.unblockTutor(tutor.id, now);
    expect(service.linkTutor(tutor.id, student.id, 'MOTHER', { isPrimary: true }, now).isPrimary).toBe(true);
  });

  it('só um tutor primário por aluno: o novo derruba o anterior', () => {
    const room = classroom();
    const t1 = service.createTutor(schoolId, { name: 'Maria', phone: '11987654321' }, now);
    const t2 = service.createTutor(schoolId, { name: 'João', phone: '11987654322' }, now);
    const student = service.createStudent(
      schoolId,
      { name: 'Ana', classroomId: room.id },
      now,
    );
    service.linkTutor(t1.id, student.id, 'MOTHER', { isPrimary: true }, now);
    service.linkTutor(t2.id, student.id, 'FATHER', { isPrimary: true }, now);
    const links = service.listTutorsOfStudent(student.id);
    expect(links.find((l) => l.tutorId === t1.id)?.isPrimary).toBe(false);
    expect(links.find((l) => l.tutorId === t2.id)?.isPrimary).toBe(true);
    expect(service.unlinkTutor(t1.id, student.id)).toBe(true);
    expect(service.unlinkTutor(t1.id, student.id)).toBe(false);
  });

  // ------------------------------------------------------- importação CSV

  const csv = [
    'nome;turma;matricula;nascimento;responsavel;telefone;parentesco',
    'Ana Silva;3º A;2026001;12/03/2018;Maria Silva;(11) 98765-4321;mãe',
    'Bruno Costa;3º A;2026002;25/07/2018;João Costa;11987654322;pai',
    'Cecília Lima;3º B;2026003;01/01/2019;;;',
  ].join('\n');

  it('importa CSV criando turmas, alunos e tutores com vínculo primário', () => {
    const report = service.importStudents(schoolId, csv, {}, now);
    expect(report.errors).toEqual([]);
    expect(report.created).toBe(3);
    expect(report.tutorsCreated).toBe(2);
    expect(report.tutorsLinked).toBe(2);
    expect(report.classroomsCreated).toEqual(['3º A', '3º B']);
    expect(service.listStudents(schoolId)).toHaveLength(3);
    const ana = service.listStudents(schoolId, { search: 'ana' })[0];
    const links = service.listTutorsOfStudent(ana.id);
    expect(links).toHaveLength(1);
    expect(links[0].isPrimary).toBe(true);
    expect(links[0].relationship).toBe('MOTHER');
  });

  it('re-importar atualiza por matrícula e não duplica', () => {
    service.importStudents(schoolId, csv, {}, now);
    const again = service.importStudents(schoolId, csv, {}, now);
    expect(again.created).toBe(0);
    expect(again.updated).toBe(3);
    expect(again.skippedDuplicates).toBe(0);
    expect(service.listStudents(schoolId)).toHaveLength(3);
  });

  it('sem matrícula, duplicata por nome + turma é pulada e relatada', () => {
    const noCode = [
      'nome,turma',
      'Ana Silva,3º A',
      'Ana Silva,3º A',
      'Ana Silva,3º B',
    ].join('\n');
    const report = service.importStudents(schoolId, noCode, {}, now);
    expect(report.created).toBe(2); // 3º A e 3º B
    expect(report.skippedDuplicates).toBe(1);
    expect(report.errors).toEqual([]);
  });

  it('linhas ruins viram erro com nº da linha e o resto do arquivo segue', () => {
    const bad = [
      'nome;turma;matricula;nascimento',
      'Ana Silva;3º A;2026001;12/03/2018',
      ';3º A;2026002;12/03/2018',
      'Beto;3º A;2026003;99/99/2018',
      'Ceci;3º A;2026001;12/03/2018',
    ].join('\n');
    const report = service.importStudents(schoolId, bad, {}, now);
    expect(report.created).toBe(1);
    // Ceci reusa a matrícula da Ana NO MESMO arquivo: é duplicata (pulada),
    // não atualização — atualizar seria renomear a Ana em silêncio.
    expect(report.updated).toBe(0);
    expect(report.skippedDuplicates).toBe(1);
    expect(report.errors[0].line).toBe(3);
    expect(report.errors[1].line).toBe(4);
    expect(service.listStudents(schoolId)).toHaveLength(1);
  });

  it('dryRun valida tudo sem gravar nada', () => {
    const report = service.importStudents(schoolId, csv, { dryRun: true }, now);
    expect(report.dryRun).toBe(true);
    expect(report.created).toBe(3);
    expect(report.tutorsCreated).toBe(2);
    expect(service.listStudents(schoolId)).toHaveLength(0);
    expect(service.listClassrooms(schoolId)).toHaveLength(0);
    expect(service.listTutors(schoolId)).toHaveLength(0);
  });

  it('dryRun repetido não acumula duplicata fantasma', () => {
    service.importStudents(schoolId, csv, { dryRun: true }, now);
    const second = service.importStudents(schoolId, csv, { dryRun: true }, now);
    expect(second.created).toBe(3);
    expect(second.skippedDuplicates).toBe(0);
  });

  it('respeita o teto do plano na importação e rejeita cabeçalho inválido', () => {
    service.setStudentLimit(schoolId, 2);
    const report = service.importStudents(schoolId, csv, {}, now);
    expect(report.created).toBe(2);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].message).toMatch(/limite de alunos/i);
    expect(() => service.importStudents(schoolId, 'foo;bar\n1;2', {}, now)).toThrow(
      /Cabeçalho inválido/,
    );
  });

  it('template e export do cadastro batem com o formato de importação', () => {
    const template = service.rosterTemplateCsv();
    expect(template.split('\n')[0]).toBe(
      'nome;turma;matricula;nascimento;responsavel;telefone;parentesco',
    );
    service.importStudents(schoolId, csv, {}, now);
    const exported = service.exportRosterCsv(schoolId);
    const reimported = service.importStudents(schoolId, exported, {}, now);
    expect(reimported.errors).toEqual([]);
    expect(reimported.updated).toBe(3);
    expect(reimported.created).toBe(0);
  });

  it('responsável incompleto (só nome) vira erro na linha, sem criar o aluno', () => {
    const bad = [
      'nome;turma;responsavel;telefone',
      'Ana Silva;3º A;Maria Silva;',
    ].join('\n');
    const report = service.importStudents(schoolId, bad, {}, now);
    expect(report.created).toBe(0);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].message).toMatch(/responsável incompleto/);
  });

  it('com createClassrooms=false, turma inexistente vira erro na linha', () => {
    const report = service.importStudents(
      schoolId,
      csv,
      { createClassrooms: false },
      now,
    );
    expect(report.created).toBe(0);
    expect(report.errors).toHaveLength(3);
  });
});
