import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AccessTokenPayload, AuthService } from '../auth/auth.service';
import { RosterController } from './roster.controller';
import { RosterService } from './roster.service';

// Spec do controller com o RosterService REAL (em memória): o que está em
// jogo aqui é a fronteira HTTP — schoolId vindo da sessão, isolamento de
// tenant nos :id e delegação correta ao serviço.
describe('RosterController', () => {
  const roster = new RosterService();
  // Stub mínimo do AuthService: só o findUserByEmail do vínculo de conta.
  const auth = {
    findUserByEmail: (email: string) =>
      email === 'rita@escola.com' ? ({ id: 'user-rita' } as never) : null,
  } as unknown as AuthService;
  const controller = new RosterController(roster, auth);
  const schoolA = roster.createSchool({ name: 'Escola A' });
  const schoolB = roster.createSchool({ name: 'Escola B' });

  const adminA = {
    sub: 'user-a',
    email: 'a@escola.com',
    name: 'Admin A',
    schoolId: schoolA.id,
    roles: ['ADMIN'],
  } as unknown as AccessTokenPayload;
  const adminB = {
    ...adminA,
    sub: 'user-b',
    schoolId: schoolB.id,
  } as unknown as AccessTokenPayload;
  const semEscola = { ...adminA, schoolId: null } as unknown as AccessTokenPayload;

  it('cria e lista turmas usando o schoolId da sessão', () => {
    const turma = controller.createClassroom(adminA, {
      name: '3º B',
      academicYear: 2026,
    });
    expect(turma.schoolId).toBe(schoolA.id);
    expect(controller.listClassrooms(adminA)).toHaveLength(1);
    expect(controller.listClassrooms(adminB)).toHaveLength(0);
  });

  it('sessão sem escola é recusada com orientação', () => {
    expect(() => controller.listClassrooms(semEscola)).toThrow(BadRequestException);
  });

  it('aluno de outra escola responde 404 nas rotas por id (não vaza existência)', () => {
    const turma = controller.listClassrooms(adminA)[0];
    const aluno = controller.createStudent(adminA, {
      name: 'Alice Teste',
      classroomId: turma.id,
    });
    expect(() =>
      controller.updateStudent(adminB, aluno.id, { name: 'Invasão' }),
    ).toThrow(NotFoundException);
    expect(() =>
      controller.setStudentStatus(adminB, aluno.id, { status: 'INACTIVE' }),
    ).toThrow(NotFoundException);
    // E o dono consegue normalmente:
    expect(
      controller.updateStudent(adminA, aluno.id, { name: 'Alice M. Teste' }).name,
    ).toBe('Alice M. Teste');
  });

  it('vincula tutor ao aluno da mesma escola e lista pelo aluno', () => {
    const aluno = controller.listStudents(adminA)[0];
    const tutor = controller.createTutor(adminA, {
      name: 'Maria Teste',
      phone: '11987654321',
    });
    const link = controller.linkTutor(adminA, tutor.id, {
      studentId: aluno.id,
      relationship: 'MOTHER',
      isPrimary: true,
    });
    expect(link.tutorId).toBe(tutor.id);
    const doAluno = controller.tutorsOfStudent(adminA, aluno.id);
    expect(doAluno).toHaveLength(1);
    expect(doAluno[0].tutor.name).toBe('Maria Teste');
    expect(controller.unlinkTutor(adminA, tutor.id, aluno.id)).toEqual({
      removed: true,
    });
  });

  it('importação CSV cria alunos e turmas pelo relatório do serviço', () => {
    const csv = [
      'nome,turma,ano',
      'Bruno Importado,5º A,2026',
      'Carla Importada,5º A,2026',
    ].join('\n');
    const report = controller.importStudents(adminB, { csv });
    expect(report.created).toBe(2);
    expect(controller.listStudents(adminB)).toHaveLength(2);
    expect(controller.listClassrooms(adminB)).toHaveLength(1);
  });

  it('link-user vincula a conta ao responsável; e-mail sem conta → 404; unlink desfaz', () => {
    const tutor = controller.createTutor(adminA, {
      name: 'Rita Vínculo',
      phone: '11977776666',
    });
    const linked = controller.linkTutorUser(adminA, tutor.id, {
      email: 'rita@escola.com',
    });
    expect(linked.userId).toBe('user-rita');
    expect(roster.getTutorByUserId(schoolA.id, 'user-rita')?.id).toBe(tutor.id);
    expect(() =>
      controller.linkTutorUser(adminA, tutor.id, { email: 'ninguem@escola.com' }),
    ).toThrow(NotFoundException);
    const unlinked = controller.unlinkTutorUser(adminA, tutor.id);
    expect(unlinked.userId).toBeUndefined();
    expect(roster.getTutorByUserId(schoolA.id, 'user-rita')).toBeNull();
  });

  it('professor (TEACHER) lê turmas e alunos', () => {
    const teacher = {
      ...adminA,
      sub: 'prof-1',
      roles: ['TEACHER'],
    } as unknown as AccessTokenPayload;
    expect(controller.listClassrooms(teacher).length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(controller.listStudents(teacher))).toBe(true);
  });
});
