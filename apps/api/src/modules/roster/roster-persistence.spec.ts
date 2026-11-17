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

// Fake mínimo do PrismaService (tabela de escolas + fila serial), no mesmo
// espírito do auth-persistence.spec: prova que a escola gravada em
// write-through reaparece numa instância nova via hidratação.
class FakePrisma {
  schools: FakeSchoolRow[] = [];
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
}

describe('RosterService — persistência de escolas (Step 2 parcial)', () => {
  it('escola criada é gravada com id UUID e reaparece após o "restart"', async () => {
    const prisma = new FakePrisma();
    const antes = new RosterService(prisma as unknown as PrismaService);
    await antes.onModuleInit();
    const school = antes.createSchool({ name: 'Escola Persistida' });
    expect(school.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    await prisma.flushWrites();
    expect(prisma.schools).toHaveLength(1);

    const depois = new RosterService(prisma as unknown as PrismaService);
    await depois.onModuleInit();
    expect(depois.getSchool(school.id)?.name).toBe('Escola Persistida');
    expect(depois.listSchools()).toHaveLength(1);
  });

  it('update e desativação também são gravados', async () => {
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
});
