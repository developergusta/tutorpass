import { PickupService } from '../pickup/pickup.service';
import { QrTokenService } from '../qr/qr-token.service';
import { SecurityIncidentService } from '../incidents/security-incident.service';
import {
  DISPUTE_WINDOW_HOURS,
  UnrecognizedReleaseService,
} from './release-dispute.service';

describe('UnrecognizedReleaseService.chainHash', () => {
  it('é determinístico para o mesmo hash anterior e payload', () => {
    const a = UnrecognizedReleaseService.chainHash('abc123', { type: 'REPORTED' });
    const b = UnrecognizedReleaseService.chainHash('abc123', { type: 'REPORTED' });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('muda quando o payload ou o hash anterior muda', () => {
    const base = UnrecognizedReleaseService.chainHash('prev-1', { type: 'REPORTED' });
    expect(UnrecognizedReleaseService.chainHash('prev-1', { type: 'NOTE' })).not.toBe(base);
    expect(UnrecognizedReleaseService.chainHash('prev-2', { type: 'REPORTED' })).not.toBe(base);
  });
});

describe('UnrecognizedReleaseService — contestação de saída', () => {
  const SCHOOL = 'school-1';
  const STUDENT = 'student-1';
  const TUTOR = 'tutor-1';
  const OTHER_TUTOR = 'tutor-2';
  const STAFF = 'staff-1';
  const T0 = new Date('2026-11-17T15:00:00Z');
  const T1 = new Date('2026-11-17T15:05:00Z');
  const T2 = new Date('2026-11-17T16:05:00Z'); // 1 h após a liberação

  function setup() {
    const qr = new QrTokenService();
    const pickup = new PickupService(qr);
    const incidents = new SecurityIncidentService();
    const svc = new UnrecognizedReleaseService(pickup, incidents);
    return { qr, pickup, incidents, svc };
  }

  /** Libera o aluno e devolve o id do log RELEASED. */
  async function releaseStudent(
    ctx: ReturnType<typeof setup>,
    opts: { student?: string; tutor?: string; gate?: string } = {},
  ) {
    const entry = ctx.pickup.join(
      {
        schoolId: SCHOOL,
        studentId: opts.student ?? STUDENT,
        tutorId: opts.tutor ?? TUTOR,
        gate: opts.gate,
      },
      T0,
    );
    const { token } = ctx.qr.issue(SCHOOL, opts.tutor ?? TUTOR);
    await ctx.pickup.validateQr(entry.id, token, STAFF, T0);
    ctx.pickup.release(entry.id, STAFF, T1);
    const log = ctx.pickup
      .listLogs(SCHOOL)
      .find((l) => l.eventType === 'RELEASED' && l.queueEntryId === entry.id);
    expect(log).toBeDefined();
    return { entry, logId: log!.id };
  }

  function reportInput(logId: string, opts: { student?: string; tutor?: string; note?: string } = {}) {
    return {
      schoolId: SCHOOL,
      studentId: opts.student ?? STUDENT,
      releaseLogId: logId,
      tutorId: opts.tutor ?? OTHER_TUTOR,
      note: opts.note,
    };
  }

  it('contesta a liberação: OPEN, snapshot da saída e incidente aberto', async () => {
    const ctx = setup();
    const { logId } = await releaseStudent(ctx, { gate: 'Portão A' });
    const dispute = ctx.svc.report(reportInput(logId, { note: 'Não reconheço quem buscou.' }), T2);
    expect(dispute.status).toBe('OPEN');
    expect(dispute.releaseLogId).toBe(logId);
    expect(dispute.studentId).toBe(STUDENT);
    expect(dispute.releasedTutorId).toBe(TUTOR);
    expect(dispute.releasedAt).toEqual(T1);
    expect(dispute.gate).toBe('Portão A');
    expect(dispute.reportedByTutorId).toBe(OTHER_TUTOR);
    expect(dispute.note).toBe('Não reconheço quem buscou.');
    expect(dispute.incidentId).toBeTruthy();
    const incident = ctx.incidents.get(dispute.incidentId);
    expect(incident.category).toBe('UNAUTHORIZED_ACCESS');
    expect(incident.relevantRisk).toBe(true);
    expect(incident.status).toBe('OPEN');
    expect(incident.affectedCount).toBe(1);
    // Relógio ANPD: 3 dias úteis a partir da detecção (seg 17/11 -> qui 20/11).
    expect(incident.communicationDueAt).toEqual(new Date('2026-11-20T16:05:00.000Z'));
    const events = ctx.svc.listEvents(dispute.id);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('REPORTED');
    expect(ctx.svc.verifyChain(dispute.id).valid).toBe(true);
  });

  it('rejeita contestar log que não é RELEASED', async () => {
    const ctx = setup();
    const { entry } = await releaseStudent(ctx);
    void entry;
    const joined = ctx.pickup.listLogs(SCHOOL).find((l) => l.eventType === 'QUEUE_JOINED');
    expect(joined).toBeDefined();
    expect(() => ctx.svc.report(reportInput(joined!.id), T2)).toThrow(
      'Só é possível contestar uma liberação',
    );
  });

  it('rejeita log desconhecido e liberação de outro aluno', async () => {
    const ctx = setup();
    const { logId } = await releaseStudent(ctx);
    expect(() => ctx.svc.report(reportInput('pl_inexistente'), T2)).toThrow(
      'Liberação não encontrada',
    );
    expect(() => ctx.svc.report(reportInput(logId, { student: 'student-9' }), T2)).toThrow(
      'não é deste aluno',
    );
  });

  it(`rejeita contestação após a janela de ${DISPUTE_WINDOW_HOURS} h`, async () => {
    const ctx = setup();
    const { logId } = await releaseStudent(ctx);
    const late = new Date(T1.getTime() + DISPUTE_WINDOW_HOURS * 60 * 60 * 1000 + 1000);
    expect(() => ctx.svc.report(reportInput(logId), late)).toThrow('24 h');
  });

  it('aceita contestar dentro da janela (23 h após a liberação)', async () => {
    const ctx = setup();
    const { logId } = await releaseStudent(ctx);
    const inside = new Date(T1.getTime() + 23 * 60 * 60 * 1000);
    const dispute = ctx.svc.report(reportInput(logId), inside);
    expect(dispute.status).toBe('OPEN');
  });

  it('rejeita segunda contestação da mesma liberação', async () => {
    const ctx = setup();
    const { logId } = await releaseStudent(ctx);
    ctx.svc.report(reportInput(logId), T2);
    expect(() => ctx.svc.report(reportInput(logId, { tutor: TUTOR }), T2)).toThrow(
      'já foi contestada',
    );
  });

  it('rejeita motivo com mais de 500 caracteres', async () => {
    const ctx = setup();
    const { logId } = await releaseStudent(ctx);
    expect(() => ctx.svc.report(reportInput(logId, { note: 'x'.repeat(501) }), T2)).toThrow(
      '500 caracteres',
    );
  });

  it('resolve como LEGITIMATE: apura, anota no incidente e some da fila', async () => {
    const ctx = setup();
    const { logId } = await releaseStudent(ctx);
    const dispute = ctx.svc.report(reportInput(logId), T2);
    const resolved = ctx.svc.resolve(dispute.id, STAFF, 'LEGITIMATE', 'Era a avó, autorizada no plano.', T2);
    expect(resolved.status).toBe('RESOLVED_LEGITIMATE');
    expect(resolved.resolutionNote).toBe('Era a avó, autorizada no plano.');
    expect(resolved.resolvedBy).toBe(STAFF);
    expect(resolved.resolvedAt).toEqual(T2);
    expect(ctx.svc.listOpenForSchool(SCHOOL)).toHaveLength(0);
    const incident = ctx.incidents.get(dispute.incidentId);
    expect(incident.status).toBe('OPEN'); // o incidente segue o ciclo próprio do DPO
    const events = ctx.svc.listEvents(dispute.id);
    expect(events.map((e) => e.type)).toEqual(['REPORTED', 'RESOLVED_LEGITIMATE']);
    expect(ctx.svc.verifyChain(dispute.id).valid).toBe(true);
  });

  it('resolve como UNRECOGNIZED: escala e o incidente segue aberto p/ o DPO', async () => {
    const ctx = setup();
    const { logId } = await releaseStudent(ctx);
    const dispute = ctx.svc.report(reportInput(logId), T2);
    const resolved = ctx.svc.resolve(dispute.id, STAFF, 'UNRECOGNIZED', 'Ninguém na escola reconhece quem retirou.', T2);
    expect(resolved.status).toBe('ESCALATED');
    expect(ctx.svc.listOpenForSchool(SCHOOL)).toHaveLength(0);
    const events = ctx.svc.listEvents(dispute.id);
    expect(events.map((e) => e.type)).toEqual(['REPORTED', 'ESCALATED']);
    expect(ctx.svc.verifyChain(dispute.id).valid).toBe(true);
  });

  it('resolve rejeita contestação já apurada, resultado inválido e nota vazia', async () => {
    const ctx = setup();
    const { logId } = await releaseStudent(ctx);
    const dispute = ctx.svc.report(reportInput(logId), T2);
    expect(() => ctx.svc.resolve(dispute.id, STAFF, 'LEGITIMATE', '   ', T2)).toThrow(
      'exige uma nota',
    );
    expect(() =>
      ctx.svc.resolve(dispute.id, STAFF, 'MAYBE' as never, 'nota', T2),
    ).toThrow('Resultado inválido');
    ctx.svc.resolve(dispute.id, STAFF, 'LEGITIMATE', 'Ok.', T2);
    expect(() => ctx.svc.resolve(dispute.id, STAFF, 'LEGITIMATE', 'De novo.', T2)).toThrow(
      'contestação aberta',
    );
  });

  it('addNote registra NOTE e recusa anotar contestação apurada', async () => {
    const ctx = setup();
    const { logId } = await releaseStudent(ctx);
    const dispute = ctx.svc.report(reportInput(logId), T2);
    ctx.svc.addNote(dispute.id, STAFF, 'Ligamos p/ a mãe, confirmou.', T2);
    expect(ctx.svc.listEvents(dispute.id).map((e) => e.type)).toEqual(['REPORTED', 'NOTE']);
    ctx.svc.resolve(dispute.id, STAFF, 'LEGITIMATE', 'Confirmado por telefone.', T2);
    expect(() => ctx.svc.addNote(dispute.id, STAFF, 'Tarde demais.', T2)).toThrow(
      'não aceita anotações',
    );
  });

  it('listOpenForSchool devolve só as abertas, da mais antiga p/ a mais nova', async () => {
    const ctx = setup();
    const first = await releaseStudent(ctx, { student: 'student-a' });
    const second = await releaseStudent(ctx, { student: 'student-b' });
    const d1 = ctx.svc.report(reportInput(first.logId, { student: 'student-a' }), T2);
    const d2 = ctx.svc.report(
      reportInput(second.logId, { student: 'student-b' }),
      new Date('2026-11-17T17:00:00Z'),
    );
    const open = ctx.svc.listOpenForSchool(SCHOOL);
    expect(open.map((d) => d.id)).toEqual([d1.id, d2.id]);
    expect(ctx.svc.listOpenForSchool('school-2')).toHaveLength(0);
    const byStudent = ctx.svc.listForStudent(SCHOOL, 'student-b');
    expect(byStudent.map((d) => d.id)).toEqual([d2.id]);
  });

  it('get e listEvents rejeitam contestação desconhecida', () => {
    const ctx = setup();
    expect(() => ctx.svc.get('dispute-inexistente')).toThrow('não encontrada');
    expect(() => ctx.svc.listEvents('dispute-inexistente')).toThrow('não encontrada');
  });

  it('verifyChain detecta adulteração num evento', async () => {
    const ctx = setup();
    const { logId } = await releaseStudent(ctx);
    const dispute = ctx.svc.report(reportInput(logId), T2);
    const events = ctx.svc.listEvents(dispute.id);
    (events[0] as { note: string | null }).note = 'adulterado';
    const result = ctx.svc.verifyChain(dispute.id);
    expect(result.valid).toBe(false);
    expect(result.firstBadIndex).toBe(0);
  });
});
