import { NotFoundException } from '@nestjs/common';
import { PickupService } from '../pickup/pickup.service';
import { QrTokenService } from '../qr/qr-token.service';
import { SecurityIncidentService } from '../incidents/security-incident.service';
import { UnrecognizedReleaseService } from './release-dispute.service';
import { DisputesController } from './disputes.controller';
import type { AccessTokenPayload } from '../auth/auth.service';

// O controller é testado direto (sem HTTP): os guards (JwtAuthGuard /
// TenantGuard / RolesGuard) já têm spec próprio em auth/guards.spec.ts —
// aqui o contrato é a tradução HTTP -> UnrecognizedReleaseService (rotas,
// resolvedBy = user.sub, erros do serviço propagados).
describe('DisputesController (/api/disputes/schools/:schoolId/*)', () => {
  const SCHOOL = 'school-1';
  const STUDENT = 'student-1';
  const TUTOR = 'tutor-1';
  const OTHER_TUTOR = 'tutor-2';

  const STAFF: AccessTokenPayload = {
    sub: 'staff-1',
    email: 'secretaria@escola.test',
    name: 'Secretaria',
    schoolId: SCHOOL,
    roles: ['COORDINATOR'],
    iss: 'tutorpass',
    aud: 'tutorpass-api',
    iat: 0,
    exp: 0,
    jti: 'jti-teste',
  };

  function setup() {
    const qr = new QrTokenService();
    const pickup = new PickupService(qr);
    const incidents = new SecurityIncidentService();
    const service = new UnrecognizedReleaseService(pickup, incidents);
    return { qr, pickup, incidents, service, ctrl: new DisputesController(service) };
  }

  /** Libera o aluno agora (tempo real) e devolve o id do log RELEASED. */
  async function releaseStudent(ctx: ReturnType<typeof setup>) {
    const now = new Date();
    const entry = ctx.pickup.join(
      { schoolId: SCHOOL, studentId: STUDENT, tutorId: TUTOR },
      now,
    );
    const { token } = ctx.qr.issue(SCHOOL, TUTOR);
    await ctx.pickup.validateQr(entry.id, token, STAFF.sub, now);
    ctx.pickup.release(entry.id, STAFF.sub, now);
    const log = ctx.pickup
      .listLogs(SCHOOL)
      .find((l) => l.eventType === 'RELEASED' && l.queueEntryId === entry.id);
    expect(log).toBeDefined();
    return log!.id;
  }

  it('report contesta a liberação e devolve a contestação OPEN', async () => {
    const ctx = setup();
    const logId = await releaseStudent(ctx);
    const dispute = ctx.ctrl.report(SCHOOL, {
      studentId: STUDENT,
      releaseLogId: logId,
      tutorId: OTHER_TUTOR,
      note: 'Não reconheço quem buscou.',
    });
    expect(dispute.status).toBe('OPEN');
    expect(dispute.releaseLogId).toBe(logId);
    expect(dispute.incidentId).toBeTruthy();
  });

  it('report com log desconhecido → 404', () => {
    const ctx = setup();
    expect(() =>
      ctx.ctrl.report(SCHOOL, {
        studentId: STUDENT,
        releaseLogId: 'pl_inexistente',
        tutorId: OTHER_TUTOR,
      }),
    ).toThrow(NotFoundException);
  });

  it('fluxo completo: report → open → resolve LEGITIMATE com resolvedBy do token', async () => {
    const ctx = setup();
    const logId = await releaseStudent(ctx);
    const dispute = ctx.ctrl.report(SCHOOL, {
      studentId: STUDENT,
      releaseLogId: logId,
      tutorId: OTHER_TUTOR,
    });
    expect(ctx.ctrl.listOpen(SCHOOL)).toHaveLength(1);
    expect(ctx.ctrl.listForStudent(SCHOOL, STUDENT)).toHaveLength(1);
    const resolved = ctx.ctrl.resolve(
      dispute.id,
      { outcome: 'LEGITIMATE', note: 'Era a avó, autorizada.' },
      STAFF,
    );
    expect(resolved.status).toBe('RESOLVED_LEGITIMATE');
    expect(resolved.resolvedBy).toBe(STAFF.sub);
    expect(ctx.ctrl.listOpen(SCHOOL)).toHaveLength(0);
    expect(ctx.ctrl.verifyChain(dispute.id).valid).toBe(true);
  });

  it('resolve UNRECOGNIZED escala a contestação', async () => {
    const ctx = setup();
    const logId = await releaseStudent(ctx);
    const dispute = ctx.ctrl.report(SCHOOL, {
      studentId: STUDENT,
      releaseLogId: logId,
      tutorId: OTHER_TUTOR,
    });
    const resolved = ctx.ctrl.resolve(
      dispute.id,
      { outcome: 'UNRECOGNIZED', note: 'Ninguém reconhece quem retirou.' },
      STAFF,
    );
    expect(resolved.status).toBe('ESCALATED');
    expect(ctx.ctrl.listEvents(dispute.id).map((e) => e.type)).toEqual([
      'REPORTED',
      'ESCALATED',
    ]);
  });

  it('segunda contestação da mesma liberação → 409', async () => {
    const ctx = setup();
    const logId = await releaseStudent(ctx);
    ctx.ctrl.report(SCHOOL, {
      studentId: STUDENT,
      releaseLogId: logId,
      tutorId: OTHER_TUTOR,
    });
    expect(() =>
      ctx.ctrl.report(SCHOOL, {
        studentId: STUDENT,
        releaseLogId: logId,
        tutorId: TUTOR,
      }),
    ).toThrow('já foi contestada');
  });

  it('addNote registra NOTE; get devolve a contestação', async () => {
    const ctx = setup();
    const logId = await releaseStudent(ctx);
    const dispute = ctx.ctrl.report(SCHOOL, {
      studentId: STUDENT,
      releaseLogId: logId,
      tutorId: OTHER_TUTOR,
    });
    ctx.ctrl.addNote(dispute.id, { note: 'Ligamos p/ a mãe.' }, STAFF);
    expect(ctx.ctrl.getOne(dispute.id).id).toBe(dispute.id);
    expect(ctx.ctrl.listEvents(dispute.id).map((e) => e.type)).toEqual([
      'REPORTED',
      'NOTE',
    ]);
  });
});
