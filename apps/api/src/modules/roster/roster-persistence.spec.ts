import type { PrismaService } from '../../prisma/prisma.service';
import { RosterService } from './roster.service';

interface FakeSchoolRow {
  id: string;
  name: string;
  slug: string;
  document: string | null;
  timezone: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type AnyRow = Record<string, unknown> & { id?: string };

// Tabela fake genérica (upsert por id) — turmas, alunos e tutores são
// gravados pelo RosterService via upsert de estado completo.
function fakeTable() {
  const rows: AnyRow[] = [];
  return {
    rows,
    findMany: async (): Promise<AnyRow[]> => [...rows],
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { id: string };
      create: AnyRow;
      update: AnyRow;
    }): Promise<AnyRow> => {
      const i = rows.findIndex((r) => r.id === where.id);
      if (i === -1) {
        rows.push({ ...create });
        return create;
      }
      Object.assign(rows[i], update);
      return rows[i];
    },
  };
}

// Fake mínimo do PrismaService (escolas em create/update + tabelas do
// cadastro em upsert + fila serial), no mesmo espírito do
// auth-persistence.spec: prova que o que é gravado em write-through
// reaparece numa instância nova via hidratação.
class FakePrisma {
  schools: FakeSchoolRow[] = [];
  classroom = fakeTable();
  student = fakeTable();
  tutor = fakeTable();
  tutorStudentRows: AnyRow[] = [];
  private chain: Promise<unknown> = Promise.resolve();

  enqueueWrite(op: () => Promise<unknown>): void {
    this.chain = this.chain.then(op).catch(() => undefined);
  }

  async flushWrites(): Promise<void> {
    await this.chain;
  }

  school = {
    findMany: async (): Promise<FakeSchoolRow[]> => [...this.schools],
    create: async ({ data }: { data: FakeSchoolRow }): Promise<FakeSchoolRow> => {
      this.schools.push({ ...data });
      return data;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<FakeSchoolRow>;
    }): Promise<FakeSchoolRow> => {
      const row = this.schools.find((s) => s.id === where.id);
      if (!row) throw new Error('school não encontrada no fake');
      Object.assign(row, data);
      return row;
    },
  };

  tutorStudent = {
    findMany: async (): Promise<AnyRow[]> => [...this.tutorStudentRows],
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { tutorId_studentId: { tutorId: string; studentId: string } };
      create: AnyRow;
      update: AnyRow;
    }): Promise<AnyRow> => {
      const key = where.tutorId_studentId;
      const i = this.tutorStudentRows.findIndex(
        (r) => r.tutorId === key.tutorId && r.studentId === key.studentId,
      );
      if (i === -1) {
        this.tutorStudentRows.push({ ...create });
        return create;
      }
      Object.assign(this.tutorStudentRows[i], update);
      return this.tutorStudentRows[i];
    },
    delete: async ({
      where,
    }: {
      where: { tutorId_studentId: { tutorId: string; studentId: string } };
    }): Promise<AnyRow> => {
      const key = where.tutorId_studentId;
      const i = this.tutorStudentRows.findIndex(
        (r) => r.tutorId === key.tutorId && r.studentId === key.studentId,
      );
      if (i === -1) throw new Error('vínculo não encontrado no fake');
      return this.tutorStudentRows.splice(i, 1)[0];
    },
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('RosterService — persistência (Step 2)', () => {
  it('escola criada é gravada com id UUID e reaparece após o "restart"', async () => {
    const prisma = new FakePrisma();
    const antes = new RosterService(prisma as unknown as PrismaService);
    await antes.onModuleInit();
    const school = antes.createSchool({ name: 'Escola Persistida' });
    expect(school.id).toMatch(UUID_RE);
    await prisma.flushWrites();
    expect(prisma.schools).toHaveLength(1);

    const depois = new RosterService(prisma as unknown as PrismaService);
    await depois.onModuleInit();
    expect(depois.getSchool(school.id)?.name).toBe('Escola Persistida');
    expect(depois.listSchools()).toHaveLength(1);
  });

  it('update e desativação de escola também são gravados', async () => {
    const prisma = new FakePrisma();
    const svc = new RosterService(prisma as unknown as PrismaService);
    await svc.onModuleInit();
    const school = svc.createSchool({ name: 'Escola Editável' });
    svc.updateSchool(school.id, { name: 'Escola Editada' });
    svc.deactivateSchool(school.id);
    await prisma.flushWrites();
    expect(prisma.schools[0].name).toBe('Escola Editada');
    expect(prisma.schools[0].isActive).toBe(false);
  });

  it('cadastro inteiro (turma, aluno, tutor, vínculo e conta) sobrevive ao restart', async () => {
    const prisma = new FakePrisma();
    const antes = new RosterService(prisma as unknown as PrismaService);
    await antes.onModuleInit();
    const school = antes.createSchool({ name: 'Escola Completa' });
    const turma = antes.createClassroom(school.id, {
      name: '3º B',
      academicYear: 2026,
    });
    const aluno = antes.createStudent(school.id, {
      name: 'Alice Persistida',
      classroomId: turma.id,
      birthDate: '2018-05-10',
    });
    const tutor = antes.createTutor(school.id, {
      name: 'Maria Persistida',
      phone: '11966665555',
    });
    antes.linkTutor(tutor.id, aluno.id, 'MOTHER', { isPrimary: true });
    antes.setTutorUserId(tutor.id, 'user-maria');
    expect(turma.id).toMatch(UUID_RE);
    expect(aluno.id).toMatch(UUID_RE);
    expect(tutor.id).toMatch(UUID_RE);
    await prisma.flushWrites();
    expect(prisma.classroom.rows).toHaveLength(1);
    expect(prisma.student.rows).toHaveLength(1);
    expect(prisma.tutor.rows).toHaveLength(1);
    expect(prisma.tutorStudentRows).toHaveLength(1);

    const depois = new RosterService(prisma as unknown as PrismaService);
    await depois.onModuleInit();
    expect(depois.listClassrooms(school.id)[0]?.name).toBe('3º B');
    const alunoDepois = depois.getStudent(aluno.id);
    expect(alunoDepois?.name).toBe('Alice Persistida');
    expect(alunoDepois?.birthDate).toBe('2018-05-10');
    const tutorDepois = depois.getTutorByUserId(school.id, 'user-maria');
    expect(tutorDepois?.id).toBe(tutor.id);
    const filhos = depois.listStudentsOfTutor(tutor.id);
    expect(filhos).toHaveLength(1);
    expect(filhos[0].student.name).toBe('Alice Persistida');
    expect(filhos[0].isPrimary).toBe(true);
  });

  it('mutações posteriores (status, bloqueio, desvincular) também são gravadas', async () => {
    const prisma = new FakePrisma();
    const svc = new RosterService(prisma as unknown as PrismaService);
    await svc.onModuleInit();
    const school = svc.createSchool({ name: 'Escola Mutável' });
    const turma = svc.createClassroom(school.id, {
      name: '1º A',
      academicYear: 2026,
    });
    const aluno = svc.createStudent(school.id, {
      name: 'Bruno Mutável',
      classroomId: turma.id,
    });
    const tutor = svc.createTutor(school.id, {
      name: 'João Mutável',
      phone: '11955554444',
    });
    svc.linkTutor(tutor.id, aluno.id, 'FATHER');
    svc.blockPickup(aluno.id, 'Ordem judicial');
    svc.unlinkTutor(tutor.id, aluno.id);
    await prisma.flushWrites();
    expect(prisma.student.rows[0].pickupBlocked).toBe(true);
    expect(prisma.tutorStudentRows).toHaveLength(0);

    const depois = new RosterService(prisma as unknown as PrismaService);
    await depois.onModuleInit();
    expect(depois.getStudent(aluno.id)?.pickupBlocked).toBe(true);
    expect(depois.listStudentsOfTutor(tutor.id)).toHaveLength(0);
  });
});
