import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';

const SECRET = 'segredo-de-teste-com-mais-de-32-caracteres-123456';
const SCHOOL_ID = '11111111-1111-4111-8111-111111111111';

interface FakeUserRow {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  isActive: boolean;
  createdAt: Date;
}

interface FakeMemberRow {
  schoolId: string;
  userId: string;
  role: string;
  status: string;
  classroomId: string | null;
}

// Fake mínimo do PrismaService: tabelas em arrays + a mesma fila serial de
// escrita do serviço real. Não é um mock do comportamento — é o "banco" que
// duas instâncias do AuthService compartilham p/ provar a sobrevivência a
// um restart (hidratação de uma instância nova a partir do que a anterior
// gravou em write-through).
class FakePrisma {
  users: FakeUserRow[] = [];
  members: FakeMemberRow[] = [];
  private chain: Promise<unknown> = Promise.resolve();

  enqueueWrite(op: () => Promise<unknown>): void {
    this.chain = this.chain.then(op).catch(() => undefined);
  }

  async flushWrites(): Promise<void> {
    await this.chain;
  }

  user = {
    findMany: async (): Promise<FakeUserRow[]> => [...this.users],
    create: async ({ data }: { data: FakeUserRow }): Promise<FakeUserRow> => {
      this.users.push({ ...data });
      return data;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<FakeUserRow>;
    }): Promise<FakeUserRow> => {
      const row = this.users.find((u) => u.id === where.id);
      if (!row) throw new Error('user não encontrado no fake');
      Object.assign(row, data);
      return row;
    },
  };

  schoolMember = {
    findMany: async (): Promise<FakeMemberRow[]> => [...this.members],
    upsert: async ({
      where,
      create,
    }: {
      where: { schoolId_userId_role: { schoolId: string; userId: string; role: string } };
      create: FakeMemberRow;
    }): Promise<FakeMemberRow> => {
      const key = where.schoolId_userId_role;
      const found = this.members.find(
        (m) => m.schoolId === key.schoolId && m.userId === key.userId && m.role === key.role,
      );
      if (!found) this.members.push({ ...create });
      return found ?? create;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: { schoolId: string; userId: string; role: string };
      data: Partial<FakeMemberRow>;
    }): Promise<{ count: number }> => {
      let count = 0;
      for (const m of this.members) {
        if (m.schoolId === where.schoolId && m.userId === where.userId && m.role === where.role) {
          Object.assign(m, data);
          count += 1;
        }
      }
      return { count };
    },
  };
}

describe('AuthService — persistência no Postgres (Step 2 parcial)', () => {
  it('usuário e vínculo sobrevivem a um "restart" (nova instância hidratada)', async () => {
    const prisma = new FakePrisma();
    const antes = new AuthService(SECRET, prisma as unknown as PrismaService);
    await antes.onModuleInit();
    const user = antes.register('maria@escola.test', 'Maria', 'SenhaForte1!');
    antes.addMembership(user.id, SCHOOL_ID, 'ADMIN');
    await prisma.flushWrites();
    expect(prisma.users).toHaveLength(1);
    expect(prisma.members).toHaveLength(1);

    // "Restart": instância nova, memória vazia, mesmo banco.
    const depois = new AuthService(SECRET, prisma as unknown as PrismaService);
    await depois.onModuleInit();
    const login = depois.login('maria@escola.test', 'SenhaForte1!', SCHOOL_ID);
    expect(login.roles).toContain('ADMIN');
    expect(() =>
      depois.register('maria@escola.test', 'Outra Maria', 'SenhaForte1!'),
    ).toThrow(ConflictException);
  });

  it('sem PrismaService, segue 100% em memória (comportamento dos testes antigos)', async () => {
    const svc = new AuthService(SECRET);
    await svc.onModuleInit();
    const user = svc.register('a@b.test', 'Ab', 'SenhaForte1!');
    expect(user.email).toBe('a@b.test');
    await svc.onModuleDestroy();
  });
});
