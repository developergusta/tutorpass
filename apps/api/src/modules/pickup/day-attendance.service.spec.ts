import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DismissalPlanService } from '../dismissal-plans/dismissal-plan.service';
import { NotificationService } from '../notifications/notification.service';
import { QrTokenService } from '../qr/qr-token.service';
import { RosterService } from '../roster/roster.service';
import {
  DayAttendanceService,
  PET_ARRIVED_NOTIFICATION_BODY,
} from './day-attendance.service';
import { PickupController } from './pickup.controller';
import { PickupService } from './pickup.service';
import type { AccessTokenPayload } from '../auth/auth.service';

describe('DayAttendanceService — Check-in da manhã & fechamento na retirada (Fase 2)', () => {
  const STAFF_ID = '11111111-1111-4111-8111-111111111111';
  const MORNING = new Date('2026-11-24T10:30:00.000Z'); // 07:30 em America/Sao_Paulo (terça, weekday=2)
  const AFTERNOON_JOIN = new Date('2026-11-24T20:10:00.000Z'); // 17:10 BRT
  const AFTERNOON_RELEASE = new Date('2026-11-24T20:14:00.000Z'); // 17:14 BRT
  const DATE_ISO = '2026-11-24';

  function setup() {
    const roster = new RosterService();
    const dismissalPlans = new DismissalPlanService();
    const notifications = new NotificationService();
    const qr = new QrTokenService();
    const attendance = new DayAttendanceService(
      undefined,
      roster,
      dismissalPlans,
      notifications,
      undefined,
    );
    const pickup = new PickupService(qr, undefined, undefined, roster, attendance);
    const controller = new PickupController(pickup, roster, attendance);

    const school = roster.createSchool({
      name: 'CantoPet — Creche e Hotel para Cães',
      timezone: 'America/Sao_Paulo',
    });
    const room = roster.createClassroom(school.id, {
      name: 'Pequenos & Calmos',
      academicYear: 2026,
    });
    const aurorinha = roster.createStudent(school.id, {
      name: 'Aurorinha',
      classroomId: room.id,
      enrollmentCode: 'CPET-001',
    });
    const tampinha = roster.createStudent(school.id, {
      name: 'Tampinha',
      classroomId: room.id,
      enrollmentCode: 'CPET-002',
    });
    const walkInPet = roster.createStudent(school.id, {
      name: 'Sol',
      classroomId: room.id,
      enrollmentCode: 'CPET-003',
    });

    const tutorAurora = roster.createTutor(school.id, {
      name: 'Camila (Exemplo)',
      phone: '11971001001',
    });
    roster.linkTutor(tutorAurora.id, aurorinha.id, 'GUARDIAN', { isPrimary: true });

    const tutorTampinha = roster.createTutor(school.id, {
      name: 'Rafael (Exemplo)',
      phone: '11971001002',
    });
    roster.linkTutor(tutorTampinha.id, tampinha.id, 'GUARDIAN', { isPrimary: true });

    // Aurorinha e Tampinha têm plano padrão p/ terça (weekday = 2); Sol não tem plano (walk-in)
    dismissalPlans.setDefault(
      {
        schoolId: school.id,
        studentId: aurorinha.id,
        weekday: 2,
        mode: 'CAR',
        pickupBy: 'Camila · 17:15',
        setBy: STAFF_ID,
        setByRole: 'STAFF',
      },
      MORNING,
    );
    dismissalPlans.setDefault(
      {
        schoolId: school.id,
        studentId: tampinha.id,
        weekday: 2,
        mode: 'CAR',
        pickupBy: 'Rafael · 17:30',
        setBy: STAFF_ID,
        setByRole: 'STAFF',
      },
      MORNING,
    );

    const STAFF_USER: AccessTokenPayload = {
      sub: STAFF_ID,
      email: 'portaria.cantopet@tutorpass.com.br',
      name: 'Recepção CantoPet',
      schoolId: school.id,
      roles: ['GATE_AGENT'],
      iss: 'tutorpass',
      aud: 'tutorpass-api',
      iat: 0,
      exp: 0,
      jti: 'jti-gate',
    };

    return {
      roster,
      dismissalPlans,
      notifications,
      qr,
      attendance,
      pickup,
      controller,
      school,
      aurorinha,
      tampinha,
      walkInPet,
      tutorAurora,
      tutorTampinha,
      STAFF_USER,
    };
  }

  it('checkIn cria DayAttendance (1 linha por pet por dia) e envia notificação "Seu pet chegou à creche 🐾"', async () => {
    const { attendance, notifications, school, aurorinha, tutorAurora } = setup();

    const res = await attendance.checkIn(
      {
        schoolId: school.id,
        studentId: aurorinha.id,
        checkInBy: STAFF_ID,
        date: DATE_ISO,
        checkInAt: MORNING,
      },
      MORNING,
    );

    expect(res.attendance.schoolId).toBe(school.id);
    expect(res.attendance.studentId).toBe(aurorinha.id);
    expect(res.attendance.date).toBe(DATE_ISO);
    expect(res.attendance.checkInAt).toEqual(MORNING);
    expect(res.attendance.checkInBy).toBe(STAFF_ID);
    expect(res.attendance.checkOutAt).toBeNull();
    expect(res.attendance.pickupLogId).toBeNull();

    // Verifica a notificação enviada ao tutor
    expect(res.notifications).toHaveLength(1);
    expect(res.notifications[0].recipientId).toBe(tutorAurora.id);
    expect(res.notifications[0].kind).toBe('PET_ARRIVED');
    expect(res.notifications[0].body).toBe(PET_ARRIVED_NOTIFICATION_BODY);

    const tutorUnread = notifications.listUnread(tutorAurora.id);
    expect(tutorUnread).toHaveLength(1);
    expect(tutorUnread[0].body).toBe('Seu pet chegou à creche 🐾');
  });

  it('impede segundo check-in do mesmo pet no mesmo dia (409 Conflict)', async () => {
    const { attendance, school, aurorinha } = setup();

    await attendance.checkIn(
      {
        schoolId: school.id,
        studentId: aurorinha.id,
        checkInBy: STAFF_ID,
        date: DATE_ISO,
        checkInAt: MORNING,
      },
      MORNING,
    );

    await expect(
      attendance.checkIn(
        {
          schoolId: school.id,
          studentId: aurorinha.id,
          checkInBy: STAFF_ID,
          date: DATE_ISO,
          checkInAt: new Date('2026-11-24T11:00:00.000Z'),
        },
        MORNING,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('permite check-in avulso (walk-in) de pet sem plano padrão para hoje e classifica arrived / expected / notArrived', async () => {
    const { attendance, school, aurorinha, tampinha, walkInPet } = setup();

    // Antes de qualquer chegada: 2 esperados do plano (Aurorinha, Tampinha) e 1 sem plano (Sol), total 3 não chegaram
    const before = attendance.getTodayArrivalsSummary(school.id, {
      date: DATE_ISO,
      now: MORNING,
    });
    expect(before.counts).toEqual({
      arrived: 0,
      checkedOut: 0,
      expected: 2,
      notArrived: 3,
      totalActiveStudents: 3,
    });
    expect(before.items.find((i) => i.studentId === aurorinha.id)?.status).toBe('EXPECTED');
    expect(before.items.find((i) => i.studentId === tampinha.id)?.status).toBe('EXPECTED');
    expect(before.items.find((i) => i.studentId === walkInPet.id)?.status).toBe('NOT_ARRIVED');

    // Registra chegada de Aurorinha (esperada) e de Sol (walk-in)
    await attendance.checkIn(
      {
        schoolId: school.id,
        studentId: aurorinha.id,
        checkInBy: STAFF_ID,
        date: DATE_ISO,
        checkInAt: MORNING,
      },
      MORNING,
    );
    await attendance.checkIn(
      {
        schoolId: school.id,
        studentId: walkInPet.id,
        checkInBy: STAFF_ID,
        date: DATE_ISO,
        checkInAt: new Date('2026-11-24T11:15:00.000Z'),
      },
      MORNING,
    );

    const after = attendance.getTodayArrivalsSummary(school.id, {
      date: DATE_ISO,
      now: MORNING,
    });
    expect(after.counts).toEqual({
      arrived: 2,
      checkedOut: 0,
      expected: 2,
      notArrived: 1,
      totalActiveStudents: 3,
    });
    expect(after.items.find((i) => i.studentId === aurorinha.id)?.status).toBe('ARRIVED');
    expect(after.items.find((i) => i.studentId === walkInPet.id)?.status).toBe('ARRIVED');
    expect(after.items.find((i) => i.studentId === tampinha.id)?.status).toBe('EXPECTED');
  });

  it('fecha automaticamente o DayAttendance (checkOutAt + pickupLogId) quando PickupService.release confirma a retirada', async () => {
    const { attendance, pickup, qr, school, aurorinha, tutorAurora } = setup();

    await attendance.checkIn(
      {
        schoolId: school.id,
        studentId: aurorinha.id,
        checkInBy: STAFF_ID,
        date: DATE_ISO,
        checkInAt: MORNING,
      },
      MORNING,
    );

    // Ciclo de retirada normal (sem mudar o comportamento do pickup)
    const entry = pickup.join(
      {
        schoolId: school.id,
        studentId: aurorinha.id,
        tutorId: tutorAurora.id,
        source: 'GEOFENCE',
      },
      AFTERNOON_JOIN,
    );
    pickup.call(entry.id, STAFF_ID, new Date(AFTERNOON_JOIN.getTime() + 60_000));
    const issued = qr.issue(school.id, tutorAurora.id);
    await pickup.validateQr(
      entry.id,
      issued.token,
      STAFF_ID,
      new Date(AFTERNOON_JOIN.getTime() + 120_000),
    );
    const released = pickup.release(entry.id, STAFF_ID, AFTERNOON_RELEASE);
    expect(released.status).toBe('RELEASED');

    const releaseLog = pickup
      .listLogs(school.id)
      .find((l) => l.queueEntryId === entry.id && l.eventType === 'RELEASED');
    expect(releaseLog).toBeDefined();

    const closedRecord = attendance.getForStudentOnDate(school.id, aurorinha.id, DATE_ISO);
    expect(closedRecord).not.toBeNull();
    expect(closedRecord?.checkInAt).toEqual(MORNING);
    expect(closedRecord?.checkOutAt).toEqual(AFTERNOON_RELEASE);
    expect(closedRecord?.pickupLogId).toBe(releaseLog?.id);

    const summary = attendance.getTodayArrivalsSummary(school.id, {
      date: DATE_ISO,
      now: AFTERNOON_RELEASE,
    });
    expect(summary.counts.arrived).toBe(1);
    expect(summary.counts.checkedOut).toBe(1);
    expect(summary.items.find((i) => i.studentId === aurorinha.id)?.status).toBe('CHECKED_OUT');
  });

  it('rotas do PickupController expõem GET attendance/today e POST attendance/check-in e validam tenant/aluno', async () => {
    const { controller, school, aurorinha, STAFF_USER } = setup();

    const checkInRes = await controller.checkIn(
      school.id,
      {
        studentId: aurorinha.id,
        date: DATE_ISO,
        checkInAt: MORNING.toISOString(),
      },
      STAFF_USER,
    );
    expect(checkInRes.attendance.studentId).toBe(aurorinha.id);

    const todayRes = controller.todayArrivals(school.id, DATE_ISO);
    expect(todayRes.counts.arrived).toBe(1);

    await expect(
      controller.checkIn(
        school.id,
        { studentId: 'student-inexistente', date: DATE_ISO },
        STAFF_USER,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(() => controller.todayArrivals(school.id, '24/11/2026')).toThrow(
      BadRequestException,
    );
  });
});
