// Valida o conteúdo do seed demo SEM banco: estrutura, vínculos e a senha demo.
import { buildDemoSeedData, DEMO_PASSWORD, DEMO_SCHOOL_SLUG } from './seed';
import { AuthService } from '../src/modules/auth/auth.service';

describe('Seed da escola demo (buildDemoSeedData)', () => {
  it('escola + plano TRIAL de 30 dias', () => {
    const data = buildDemoSeedData(new Date('2026-11-17T06:54:00-03:00'));
    expect(data.school.slug).toBe(DEMO_SCHOOL_SLUG);
    expect(data.school.timezone).toBe('America/Sao_Paulo');
    expect(data.plan.tier).toBe('TRIAL');
    expect(data.plan.trialDays).toBe(30);
  });

  it('6 usuários com e-mails únicos e papéis válidos', () => {
    const data = buildDemoSeedData();
    const emails = data.users.map((u) => u.email);
    expect(new Set(emails).size).toBe(emails.length);
    for (const email of emails) {
      expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    }
    const roles = data.users.map((u) => u.role).sort();
    expect(roles).toEqual(['ADMIN', 'COORDINATOR', 'GATE_AGENT', 'TEACHER', 'TUTOR', 'TUTOR']);
    // Toda conta demo usa a senha documentada.
    expect(Object.values(data.passwordByEmail)).toEqual(
      expect.arrayContaining([DEMO_PASSWORD]),
    );
    expect(Object.keys(data.passwordByEmail).sort()).toEqual(emails.sort());
  });

  it('alunos referenciam salas existentes; tutores cobrem todos os alunos', () => {
    const data = buildDemoSeedData();
    const roomNames = new Set(data.classrooms.map((c) => c.name));
    for (const student of data.students) {
      expect(roomNames.has(student.classroomName)).toBe(true);
    }
    const studentCodes = new Set(data.students.map((s) => s.enrollmentCode));
    const linked = new Set<string>();
    for (const user of data.users) {
      for (const link of user.studentLinks ?? []) {
        expect(studentCodes.has(link.code)).toBe(true);
        linked.add(link.code);
      }
    }
    expect(linked).toEqual(studentCodes);
    // A professora está vinculada à sala 3º A.
    const teacher = data.users.find((u) => u.role === 'TEACHER');
    expect(teacher?.classroomName).toBe('3º A');
  });

  it('a senha demo passa na validação do AuthService (não está na blocklist)', () => {
    expect(DEMO_PASSWORD.length).toBeGreaterThanOrEqual(8);
    const service = new AuthService('segredo-de-teste-com-mais-de-32-caracteres-123456');
    const user = service.register('demo@escola.test', 'Demo', DEMO_PASSWORD);
    expect(service.login('demo@escola.test', DEMO_PASSWORD).user.id).toBe(user.id);
  });

  it('duas chamadas geram a mesma estrutura (o seed é determinístico no conteúdo)', () => {
    const a = buildDemoSeedData();
    const b = buildDemoSeedData();
    expect(a.users.map((u) => u.email)).toEqual(b.users.map((u) => u.email));
    expect(a.students).toEqual(b.students);
    expect(a.classrooms).toEqual(b.classrooms);
  });
});
