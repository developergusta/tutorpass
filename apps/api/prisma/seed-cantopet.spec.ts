import {
  buildCantoPetSeedBlueprint,
  CANTOPET_SCHOOL_NAME,
  CANTOPET_SCHOOL_SLUG,
  CANTOPET_SHARED_PASSWORD,
  deterministicUuid,
  generateCantoPetDomainArtifacts,
} from './seed-cantopet';
import { AuthService } from '../src/modules/auth/auth.service';

describe('Seed do tenant demo CantoPet (seed-cantopet)', () => {
  it('define a escola CantoPet com os 4 pets reais do documento e 3 turmas adaptadas', () => {
    const bp = buildCantoPetSeedBlueprint(new Date('2026-11-24T17:35:00-03:00'));
    expect(bp.school.name).toBe(CANTOPET_SCHOOL_NAME);
    expect(bp.school.slug).toBe(CANTOPET_SCHOOL_SLUG);
    expect(bp.school.timezone).toBe('America/Sao_Paulo');
    expect(bp.classrooms.map((c) => c.name)).toEqual([
      'Pequenos & Calmos',
      'Ativos & Brincalhões',
      'Hotel — Pernoite',
    ]);
    // Nomes reais estritos do documento: Aurorinha, Tampinha, Sol, Minduim
    expect(bp.pets.map((p) => p.name)).toEqual([
      'Aurorinha',
      'Tampinha',
      'Sol',
      'Minduim',
    ]);

    // Ficha do pet (Fase 1): Spitz Alemão para ao menos 2 pets (Aurorinha e Tampinha),
    // vacinas, alimentação, vermífugo/antipulgas e medicação programada na creche.
    const spitzPets = bp.pets.filter((p) => p.fichaExample.breed.includes('Spitz'));
    expect(spitzPets.length).toBeGreaterThanOrEqual(2);
    for (const pet of bp.pets) {
      expect(pet.fichaExample.vaccinations.length).toBeGreaterThanOrEqual(2);
      expect(pet.fichaExample.feedingPortionGrams).toBeGreaterThan(0);
      expect(pet.fichaExample.feedingTimes.length).toBeGreaterThan(0);
    }
  });

  it('cria os 8 usuários no padrão <role>.cantopet@tutorpass.com.br com uma única senha compartilhada', () => {
    const bp = buildCantoPetSeedBlueprint();
    expect(bp.users).toHaveLength(8);
    for (const u of bp.users) {
      expect(u.email).toMatch(/\.cantopet@tutorpass\.com\.br$/);
      expect(bp.passwordByEmail[u.email]).toBe(CANTOPET_SHARED_PASSWORD);
    }
    const roles = bp.users.map((u) => u.role);
    expect(roles.filter((r) => r === 'ADMIN')).toHaveLength(1);
    expect(roles.filter((r) => r === 'GATE_AGENT')).toHaveLength(1);
    expect(roles.filter((r) => r === 'TEACHER')).toHaveLength(2);
    expect(roles.filter((r) => r === 'TUTOR')).toHaveLength(4);

    // Senha válida no AuthService (fora da blocklist NIST)
    const auth = new AuthService('segredo-de-teste-com-mais-de-32-caracteres-123456');
    const created = auth.register(bp.users[0].email, bp.users[0].name, CANTOPET_SHARED_PASSWORD);
    expect(auth.login(bp.users[0].email, CANTOPET_SHARED_PASSWORD).user.id).toBe(created.id);
  });

  it('gera planos padrão (17:00–18:00), delegados, histórico de 5 dias úteis e fila ativa de hoje com cadeia SHA-256 íntegra', async () => {
    const now = new Date('2026-11-24T17:38:00-03:00');
    const bp = buildCantoPetSeedBlueprint(now);
    const studentIdByCode = new Map(
      bp.pets.map((p) => [p.enrollmentCode, deterministicUuid(`student:${p.enrollmentCode}`)]),
    );
    const tutorIdByCode = new Map(
      bp.pets.map((p) => [p.enrollmentCode, deterministicUuid(`tutor:${p.enrollmentCode}`)]),
    );

    const artifacts = await generateCantoPetDomainArtifacts({
      schoolId: deterministicUuid('school:cantopet-suzano'),
      adminUserId: deterministicUuid('user:admin'),
      gateAgentUserId: deterministicUuid('user:gate'),
      studentIdByCode,
      tutorIdByCode,
      now,
    });

    // 4 pets × 5 dias úteis da semana (seg..sex) = 20 planos padrão entre 17:00 e 18:00
    expect(artifacts.defaultPlans).toHaveLength(20);
    for (const plan of artifacts.defaultPlans) {
      expect(plan.pickupBy).toMatch(/17:(15|30|45|50)/);
    }

    // 1 autorização de segundo responsável por pet (4 autorizações ativas)
    expect(artifacts.authorizations).toHaveLength(4);

    // 5 dias úteis × 4 pets = 20 retiradas históricas + 4 entradas de hoje (2 já liberadas + 2 na fila agora) = 24 entradas
    expect(artifacts.queueEntries).toHaveLength(24);

    const activeToday = artifacts.queueEntries.filter(
      (e) => e.status === 'QUEUED' || e.status === 'CALLED',
    );
    expect(activeToday).toHaveLength(2);
    expect(activeToday.map((e) => e.source).sort()).toEqual(['GEOFENCE', 'QR_GATE']);

    // Cadeia SHA-256 gerada pelo PickupService e validada por verifyChain
    expect(artifacts.chainValid).toBe(true);
    expect(artifacts.pickupLogs.length).toBeGreaterThanOrEqual(90);

    // Check-in da manhã (Fase 2): os 4 pets com check-in entre 07:00 e 08:30 de hoje;
    // os 2 que já foram liberados hoje (Aurorinha e Minduim) têm checkOutAt e pickupLogId preenchidos;
    // os 2 que ainda estão na fila ativa (Tampinha e Sol) seguem com checkOutAt = null.
    expect(artifacts.todayAttendances).toHaveLength(4);
    for (const att of artifacts.todayAttendances) {
      const checkInBrtHour = (att.checkInAt.getUTCHours() + 24 - 3) % 24;
      const checkInBrtMinutes = checkInBrtHour * 60 + att.checkInAt.getUTCMinutes();
      expect(checkInBrtMinutes).toBeGreaterThanOrEqual(7 * 60);
      expect(checkInBrtMinutes).toBeLessThanOrEqual(8 * 60 + 30);
    }
    const checkedOutToday = artifacts.todayAttendances.filter((a) => a.checkOutAt !== null);
    const stillAtDaycare = artifacts.todayAttendances.filter((a) => a.checkOutAt === null);
    expect(checkedOutToday).toHaveLength(2);
    expect(stillAtDaycare).toHaveLength(2);
    for (const closed of checkedOutToday) {
      expect(closed.pickupLogId).toBeTruthy();
      expect(
        artifacts.pickupLogs.some(
          (l) => l.id === closed.pickupLogId && l.eventType === 'RELEASED',
        ),
      ).toBe(true);
    }
  });
});
