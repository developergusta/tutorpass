// Seed da escola demo — `pnpm prisma db seed` (apps/api) ou `npx prisma db seed`.
// Idempotente (só upsert, nunca delete): rodar 2× não duplica nada.
// SÓ desenvolvimento: em produção o script recusa rodar (dados demo com senha
// conhecida não podem existir em produção). Padrão 2026 (Prisma seed + CedarJS):
// defaults de produção e dados demo separados; aqui só há dados demo.
// O PrismaClient só é instanciado dentro de main() — o módulo pode ser
// importado pelos testes (buildDemoSeedData) sem conectar no banco.
import { PrismaClient, Relationship, Role } from '@prisma/client';
import { randomBytes } from 'crypto';
import { hashPassword } from '../src/modules/auth/auth.service';

export const DEMO_SCHOOL_SLUG = 'escola-demo';
export const DEMO_PASSWORD = 'Demo2026!'; // senha demo — SÓ p/ desenvolvimento, nunca em produção
export const DEMO_TRIAL_DAYS = 30;

export interface DemoUserSeed {
  email: string;
  name: string;
  role: Role;
  classroomName?: string; // TEACHER vinculada à sala
  // TUTOR: alunos que ele busca (pelo código de matrícula) + parentesco.
  studentLinks?: Array<{ code: string; relationship: Relationship; isPrimary: boolean }>;
}

export interface DemoSeedData {
  school: { name: string; slug: string; timezone: string };
  plan: { tier: 'TRIAL'; trialDays: number };
  classrooms: Array<{ name: string; grade: string; academicYear: number }>;
  students: Array<{ name: string; enrollmentCode: string; classroomName: string }>;
  users: DemoUserSeed[];
  // Senhas em claro SÓ aqui, p/ imprimir no fim do seed — o banco guarda o hash.
  passwordByEmail: Record<string, string>;
}

// Dados puros (sem Prisma): testável sem banco. A senha é hasheada com o MESMO
// formato do AuthService (scrypt) — o login demo funciona sem ajuste.
export function buildDemoSeedData(now: Date = new Date()): DemoSeedData {
  const users: DemoUserSeed[] = [
    { email: 'admin@demo.tutorpass.app', name: 'Ana Administradora', role: 'ADMIN' },
    { email: 'secretaria@demo.tutorpass.app', name: 'Bruno Secretaria', role: 'COORDINATOR' },
    { email: 'portaria@demo.tutorpass.app', name: 'Carlos Portaria', role: 'GATE_AGENT' },
    {
      email: 'professora@demo.tutorpass.app',
      name: 'Daniela Professora',
      role: 'TEACHER',
      classroomName: '3º A',
    },
    {
      email: 'mae.marina@demo.tutorpass.app',
      name: 'Marina Mãe',
      role: 'TUTOR',
      studentLinks: [
        { code: 'DEMO-001', relationship: 'MOTHER', isPrimary: true },
        { code: 'DEMO-002', relationship: 'MOTHER', isPrimary: true },
      ],
    },
    {
      email: 'pai.pedro@demo.tutorpass.app',
      name: 'Pedro Pai',
      role: 'TUTOR',
      studentLinks: [
        { code: 'DEMO-003', relationship: 'FATHER', isPrimary: true },
        { code: 'DEMO-004', relationship: 'FATHER', isPrimary: true },
      ],
    },
  ];
  return {
    school: {
      name: 'Escola Demo — TutorPass',
      slug: DEMO_SCHOOL_SLUG,
      timezone: 'America/Sao_Paulo',
    },
    plan: { tier: 'TRIAL', trialDays: DEMO_TRIAL_DAYS },
    classrooms: [
      { name: '3º A', grade: '3º ano', academicYear: now.getFullYear() },
      { name: '3º B', grade: '3º ano', academicYear: now.getFullYear() },
    ],
    students: [
      { name: 'Alice Silva', enrollmentCode: 'DEMO-001', classroomName: '3º A' },
      { name: 'Bruno Silva', enrollmentCode: 'DEMO-002', classroomName: '3º A' },
      { name: 'Carla Souza', enrollmentCode: 'DEMO-003', classroomName: '3º B' },
      { name: 'Diego Souza', enrollmentCode: 'DEMO-004', classroomName: '3º B' },
    ],
    users,
    passwordByEmail: Object.fromEntries(users.map((u) => [u.email, DEMO_PASSWORD])),
  };
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    // eslint-disable-next-line no-console
    console.log('[seed] NODE_ENV=production — seed demo recusado (dados de teste não vão p/ produção).');
    return;
  }
  const prisma = new PrismaClient();
  try {
    const data = buildDemoSeedData();
    const now = new Date();

    const school = await prisma.school.upsert({
      where: { slug: data.school.slug },
      update: { name: data.school.name },
      create: data.school,
    });

    await prisma.schoolPlan.upsert({
      where: { schoolId: school.id },
      update: { tier: data.plan.tier },
      create: {
        schoolId: school.id,
        tier: data.plan.tier,
        trialEndsAt: new Date(now.getTime() + data.plan.trialDays * 86_400_000),
        trialUsed: true,
      },
    });

    const classroomIds = new Map<string, string>();
    for (const room of data.classrooms) {
      const created = await prisma.classroom.upsert({
        where: {
          schoolId_name_academicYear: {
            schoolId: school.id,
            name: room.name,
            academicYear: room.academicYear,
          },
        },
        update: { grade: room.grade },
        create: { ...room, schoolId: school.id },
      });
      classroomIds.set(room.name, created.id);
    }

    const studentIds = new Map<string, string>();
    for (const student of data.students) {
      const classroomId = classroomIds.get(student.classroomName);
      if (!classroomId) throw new Error(`Sala ${student.classroomName} não criada`);
      const created = await prisma.student.upsert({
        where: {
          schoolId_enrollmentCode: {
            schoolId: school.id,
            enrollmentCode: student.enrollmentCode,
          },
        },
        update: { name: student.name, classroomId },
        create: {
          name: student.name,
          enrollmentCode: student.enrollmentCode,
          schoolId: school.id,
          classroomId,
        },
      });
      studentIds.set(student.enrollmentCode, created.id);
    }

    for (const demoUser of data.users) {
      const passwordHash = hashPassword(DEMO_PASSWORD);
      const user = await prisma.user.upsert({
        where: { email: demoUser.email },
        update: { name: demoUser.name },
        create: {
          email: demoUser.email,
          name: demoUser.name,
          passwordHash,
        },
      });

      await prisma.schoolMember.upsert({
        where: {
          schoolId_userId_role: {
            schoolId: school.id,
            userId: user.id,
            role: demoUser.role,
          },
        },
        update: {},
        create: {
          schoolId: school.id,
          userId: user.id,
          role: demoUser.role,
          classroomId: demoUser.classroomName
            ? classroomIds.get(demoUser.classroomName) ?? null
            : null,
        },
      });

      if (demoUser.role === 'TUTOR') {
        const tutor = await prisma.tutor.upsert({
          where: { userId: user.id },
          update: {},
          create: {
            schoolId: school.id,
            userId: user.id,
            qrSecret: randomBytes(32).toString('hex'),
          },
        });
        for (const link of demoUser.studentLinks ?? []) {
          const studentId = studentIds.get(link.code);
          if (!studentId) throw new Error(`Aluno ${link.code} não criado`);
          await prisma.tutorStudent.upsert({
            where: { tutorId_studentId: { tutorId: tutor.id, studentId } },
            update: { relationship: link.relationship, isPrimary: link.isPrimary },
            create: {
              tutorId: tutor.id,
              studentId,
              relationship: link.relationship,
              isPrimary: link.isPrimary,
            },
          });
        }
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `[seed] Escola demo pronta: ${school.name} (${school.slug}) — ` +
        `login admin@demo.tutorpass.app / ${DEMO_PASSWORD} (TRIAL ${DEMO_TRIAL_DAYS} dias, ` +
        `${data.classrooms.length} salas, ${data.students.length} alunos, ${data.users.length} usuários).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Só roda ao executar o arquivo direto (`prisma db seed` / `node dist/prisma/seed.js`).
// Importar o módulo (ex.: no seed.spec.ts) NÃO toca no banco.
if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seed] Falhou:', err);
    process.exit(1);
  });
}
