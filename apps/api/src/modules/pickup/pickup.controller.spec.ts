import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PickupService } from './pickup.service';
import { PickupController } from './pickup.controller';
import { QrTokenService } from '../qr/qr-token.service';
import type { AccessTokenPayload } from '../auth/auth.service';

// O controller é testado direto (sem HTTP): os guards (JwtAuthGuard /
// TenantGuard / RolesGuard) já têm spec próprio em auth/guards.spec.ts —
// aqui o contrato é a tradução HTTP -> PickupService (rotas, papéis do
// decorator, staffId = user.sub, erros do serviço propagados).
describe('PickupController (/api/pickup/schools/:schoolId/*)', () => {
  const SCHOOL = 'school-1';
  const STUDENT = 'student-1';
  const TUTOR = 'tutor-1';
  const T0 = new Date('2026-11-17T15:00:00Z');

  const STAFF: AccessTokenPayload = {
    sub: 'staff-1',
    email: 'portaria@escola.test',
    name: 'Portaria',
    schoolId: SCHOOL,
    roles: ['GATE_AGENT'],
    iss: 'tutorpass',
    aud: 'tutorpass-api',
    iat: 0,
    exp: 0,
    jti: 'jti-teste',
  };

  function controller() {
    const qr = new QrTokenService();
    const service = new PickupService(qr);
    return { qr, service, ctrl: new PickupController(service) };
  }

  it('join cria entrada QUEUED e devolve a entrada', () => {
    const { ctrl } = controller();
    const entry = ctrl.join(SCHOOL, { studentId: STUDENT, tutorId: TUTOR });
    expect(entry.status).toBe('QUEUED');
    expect(entry.schoolId).toBe(SCHOOL);
    expect(entry.source).toBe('MANUAL');
  });

  it('join aceita source GEOFENCE/QR_GATE e authorizationId', () => {
    const { ctrl } = controller();
    const entry = ctrl.join(SCHOOL, {
      studentId: STUDENT,
      tutorId: TUTOR,
      authorizationId: 'auth-9',
      source: 'QR_GATE',
    });
    expect(entry.source).toBe('QR_GATE');
    expect(entry.authorizationId).toBe('auth-9');
  });

  it('segundo join do mesmo aluno → 400 (sem duplicata na fila)', () => {
    const { ctrl } = controller();
    ctrl.join(SCHOOL, { studentId: STUDENT, tutorId: TUTOR });
    expect(() =>
      ctrl.join(SCHOOL, { studentId: STUDENT, tutorId: TUTOR }),
    ).toThrow(BadRequestException);
  });

  it('fluxo completo: join → call → validate-qr → release com waitSeconds', async () => {
    const { qr, ctrl } = controller();
    const entry = ctrl.join(SCHOOL, { studentId: STUDENT, tutorId: TUTOR });
    const called = ctrl.call(entry.id, STAFF);
    expect(called.status).toBe('CALLED');
    expect(called.calledAt).not.toBeNull();
    const token = qr.issue(SCHOOL, TUTOR).token;
    const validated = await ctrl.validateQr(entry.id, { token }, STAFF);
    expect(validated.status).toBe('VALIDATED');
    const released = ctrl.release(entry.id, STAFF);
    expect(released.status).toBe('RELEASED');
    expect(released.waitSeconds).not.toBeNull();
    expect(released.waitSeconds).toBeGreaterThanOrEqual(0);
  });

  it('release sem validar → 400 (ninguém sai sem verificação)', () => {
    const { ctrl } = controller();
    const entry = ctrl.join(SCHOOL, { studentId: STUDENT, tutorId: TUTOR });
    ctrl.call(entry.id, STAFF);
    expect(() => ctrl.release(entry.id, STAFF)).toThrow(BadRequestException);
  });

  it('validate-qr com QR de outro tutor → 401 e QR_REJECTED no log', async () => {
    const { qr, service, ctrl } = controller();
    const entry = ctrl.join(SCHOOL, { studentId: STUDENT, tutorId: TUTOR });
    const token = qr.issue(SCHOOL, 'outro-tutor').token;
    await expect(ctrl.validateQr(entry.id, { token }, STAFF)).rejects.toThrow(
      UnauthorizedException,
    );
    const logs = service.listLogs(SCHOOL);
    expect(logs.some((l) => l.eventType === 'QR_REJECTED')).toBe(true);
    expect(service.listActiveForSchool(SCHOOL)[0].status).toBe('QUEUED');
  });

  it('cancel tira QUEUED da fila; cancelar liberado → 400', () => {
    const { ctrl } = controller();
    const entry = ctrl.join(SCHOOL, { studentId: STUDENT, tutorId: TUTOR });
    const cancelled = ctrl.cancel(entry.id, STAFF);
    expect(cancelled.status).toBe('CANCELLED');
    expect(ctrl.queue(SCHOOL)).toHaveLength(0);
    expect(() => ctrl.cancel(entry.id, STAFF)).toThrow(BadRequestException);
  });

  it('block impede o join (403) e tira a entrada ativa; unblock libera de novo', () => {
    const { ctrl } = controller();
    const entry = ctrl.join(SCHOOL, { studentId: STUDENT, tutorId: TUTOR });
    ctrl.block(SCHOOL, STUDENT, { reason: 'Pendência na secretaria' }, STAFF);
    expect(ctrl.queue(SCHOOL)).toHaveLength(0);
    expect(() =>
      ctrl.join(SCHOOL, { studentId: STUDENT, tutorId: TUTOR }),
    ).toThrow(ForbiddenException);
    const unblocked = ctrl.unblock(SCHOOL, STUDENT);
    expect(unblocked).toEqual({ ok: true, blocked: false });
    expect(
      ctrl.join(SCHOOL, { studentId: STUDENT, tutorId: TUTOR }).status,
    ).toBe('QUEUED');
    expect(entry.status).toBe('BLOCKED');
  });

  it('queue lista a fila ativa em FIFO; studentQueue traz o histórico', () => {
    const { ctrl } = controller();
    const e1 = ctrl.join(SCHOOL, { studentId: 'aluno-a', tutorId: TUTOR });
    ctrl.join(SCHOOL, { studentId: 'aluno-b', tutorId: TUTOR });
    ctrl.cancel(e1.id, STAFF);
    const active = ctrl.queue(SCHOOL);
    expect(active).toHaveLength(1);
    expect(active[0].studentId).toBe('aluno-b');
    const history = ctrl.studentQueue(SCHOOL, 'aluno-a');
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe('CANCELLED');
  });

  it('logs devolve a trilha e verify-chain confirma a cadeia íntegra', () => {
    const { service, ctrl } = controller();
    const entry = ctrl.join(SCHOOL, { studentId: STUDENT, tutorId: TUTOR });
    ctrl.call(entry.id, STAFF);
    expect(ctrl.logs(SCHOOL)).toHaveLength(2);
    expect(ctrl.verifyChain(SCHOOL)).toEqual({ valid: true, firstBadIndex: -1 });
    // Adulterar um evento quebra a cadeia a partir dele.
    const logs = service.listLogs(SCHOOL);
    logs[0].payload = { source: 'ADULTERADO' };
    expect(ctrl.verifyChain(SCHOOL).valid).toBe(false);
    expect(ctrl.verifyChain(SCHOOL).firstBadIndex).toBe(0);
  });

  it('call de entrada inexistente → 400', () => {
    const { ctrl } = controller();
    expect(() => ctrl.call('pq_inexistente', STAFF)).toThrow(BadRequestException);
  });

  it('join com gate; queue?gate= filtra a fila do portão; gates conta por portão', () => {
    const { ctrl } = controller();
    ctrl.join(SCHOOL, { studentId: 'aluno-a', tutorId: TUTOR, gate: 'Portão A' });
    ctrl.join(SCHOOL, { studentId: 'aluno-b', tutorId: TUTOR, gate: 'Fundos' });
    ctrl.join(SCHOOL, { studentId: 'aluno-c', tutorId: TUTOR });
    expect(ctrl.queue(SCHOOL)).toHaveLength(3);
    const gateA = ctrl.queue(SCHOOL, 'Portão A');
    expect(gateA).toHaveLength(1);
    expect(gateA[0].studentId).toBe('aluno-a');
    expect(gateA[0].gate).toBe('Portão A');
    expect(ctrl.gates(SCHOOL)).toEqual([
      { gate: 'Fundos', count: 1 },
      { gate: 'Portão A', count: 1 },
    ]);
  });

  it('sibling-gate-conflicts sinaliza o tutor com filhos em portões diferentes', () => {
    const { ctrl } = controller();
    ctrl.join(SCHOOL, { studentId: 'aluno-a', tutorId: TUTOR, gate: 'Portão A' });
    ctrl.join(SCHOOL, { studentId: 'aluno-b', tutorId: TUTOR, gate: 'Fundos' });
    ctrl.join(SCHOOL, { studentId: 'aluno-c', tutorId: 'tutor-2', gate: 'Portão A' });
    expect(ctrl.siblingGateConflicts(SCHOOL)).toEqual([
      {
        tutorId: TUTOR,
        studentIds: ['aluno-a', 'aluno-b'],
        gates: [
          { gate: 'Fundos', studentIds: ['aluno-b'] },
          { gate: 'Portão A', studentIds: ['aluno-a'] },
        ],
      },
    ]);
  });
});
