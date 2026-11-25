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
    expect(aluno.tutorCount).toBe(0);
    const tutor = controller.createTutor(adminA, {
      name: 'Maria Teste',
      phone: '11987654321',
    });
    expect(controller.listTutors(adminA).find((t) => t.id === tutor.id)?.studentCount).toBe(0);
    const link = controller.linkTutor(adminA, tutor.id, {
      studentId: aluno.id,
      relationship: 'MOTHER',
      isPrimary: true,
    });
    expect(link.tutorId).toBe(tutor.id);
    expect(controller.listStudents(adminA)[0].tutorCount).toBe(1);
    expect(controller.listTutors(adminA).find((t) => t.id === tutor.id)?.studentCount).toBe(1);
    const doAluno = controller.tutorsOfStudent(adminA, aluno.id);
    expect(doAluno).toHaveLength(1);
    expect(doAluno[0].tutor.name).toBe('Maria Teste');
    expect(controller.unlinkTutor(adminA, tutor.id, aluno.id)).toEqual({
      removed: true,
    });
    expect(controller.listStudents(adminA)[0].tutorCount).toBe(0);
    expect(controller.listTutors(adminA).find((t) => t.id === tutor.id)?.studentCount).toBe(0);
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

  it('ficha do pet (PetProfile + PetVaccination) suporta CRUD completo, isolamento de tenant e cálculo de alertas clínicos', () => {
    const aluno = controller.listStudents(adminA)[0];
    const inicial = controller.getPetProfile(adminA, aluno.id);
    expect(inicial.profile).toBeNull();
    expect(inicial.vaccinations).toEqual([]);
    expect(inicial.clinicalAlerts.hasExpiredVaccination).toBe(false);
    expect(inicial.clinicalAlerts.hasDaycareMedication).toBe(false);

    // Salva a ficha do pet (1:1 com Student)
    const salvo = controller.upsertPetProfile(adminA, aluno.id, {
      breed: 'Spitz Alemão',
      size: 'PEQUENO',
      sex: 'Fêmea',
      weightKg: 3.4,
      isNeutered: true,
      behaviorNotes: 'Dócil e sociável com o grupo',
      restrictions: 'Sensibilidade a barulho alto',
      feedingFood: 'Ração Super Premium Mini',
      feedingPortionGrams: 55,
      feedingTimes: ['12:00', '16:30'],
      vetName: 'Dra. Helena',
      vetClinic: 'Clínica Vet Suzano',
      emergencyContactName: 'Camila',
      emergencyContactPhone: '11971001001',
      dewormingUpToDate: true,
      dewormingLastDate: '2026-10-15',
      fleaControlUpToDate: true,
      fleaControlLastDate: '2026-11-01',
      allergies: 'Nenhuma alergia conhecida',
      medicationName: 'Suplemento Articular',
      medicationDosage: '1/2 comprimido',
      medicationSchedule: '12:30 (após o almoço na creche)',
    });
    expect(salvo.breed).toBe('Spitz Alemão');
    expect(salvo.size).toBe('PEQUENO');
    expect(salvo.feedingTimes).toEqual(['12:00', '16:30']);

    // Adiciona vacina vencida e vacina em dia
    const v1 = controller.addPetVaccination(adminA, aluno.id, {
      vaccineName: 'Antirrábica',
      appliedAt: '2025-01-10',
      expiresAt: '2026-01-10',
      notes: 'Reforço anual pendente',
    });
    const v2 = controller.addPetVaccination(adminA, aluno.id, {
      vaccineName: 'V10',
      appliedAt: '2026-06-01',
      expiresAt: '2027-06-01',
    });
    expect(controller.listPetVaccinations(adminA, aluno.id)).toHaveLength(2);

    // Alerta clínico detecta vacina vencida + medicação durante o horário da creche (07:00–18:00)
    const ficha = controller.getPetProfile(adminA, aluno.id);
    expect(ficha.clinicalAlerts.hasExpiredVaccination).toBe(true);
    expect(ficha.clinicalAlerts.expiredVaccines).toEqual(['Antirrábica']);
    expect(ficha.clinicalAlerts.hasDaycareMedication).toBe(true);
    expect(ficha.clinicalAlerts.medicationSummary).toContain('Suplemento Articular');

    // Outra escola recebe 404
    expect(() => controller.getPetProfile(adminB, aluno.id)).toThrow(NotFoundException);
    expect(() =>
      controller.updatePetVaccination(adminB, aluno.id, v1.id, { vaccineName: 'V8' }),
    ).toThrow(NotFoundException);

    // Atualiza vacina vencida para data futura e remove a segunda
    controller.updatePetVaccination(adminA, aluno.id, v1.id, {
      expiresAt: '2027-08-10',
    });
    expect(controller.getPetProfile(adminA, aluno.id).clinicalAlerts.hasExpiredVaccination).toBe(
      false,
    );
    expect(controller.removePetVaccination(adminA, aluno.id, v2.id)).toEqual({
      removed: true,
    });
    expect(controller.listPetVaccinations(adminA, aluno.id)).toHaveLength(1);
  });
});
