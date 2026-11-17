import { BadRequestException } from '@nestjs/common';
import { DataSubjectRequestService } from './data-subject-request.service';
import { DataSubjectRequestController } from './data-subject-request.controller';
import type { AccessTokenPayload } from '../auth/auth.service';

// O controller é testado direto (sem HTTP): os guards (JwtAuthGuard /
// TenantGuard / RolesGuard) já têm spec próprio em auth/guards.spec.ts —
// aqui o contrato é a tradução HTTP -> DataSubjectRequestService (rotas,
// actorId = user.sub, erros do serviço propagados).
describe('DataSubjectRequestController (/api/data-subject-requests/schools/:schoolId/*)', () => {
  const SCHOOL = 'school-1';

  const STAFF: AccessTokenPayload = {
    sub: 'staff-1',
    email: 'dpo@escola.test',
    name: 'DPO',
    schoolId: SCHOOL,
    roles: ['ADMIN'],
    iss: 'tutorpass',
    aud: 'tutorpass-api',
    iat: 0,
    exp: 0,
    jti: 'jti-teste',
  };

  function controller() {
    const service = new DataSubjectRequestService();
    return { service, ctrl: new DataSubjectRequestController(service) };
  }

  it('open cria pedido OPEN com requestedBy = user.sub e prazo de 15 dias', () => {
    const { ctrl } = controller();
    const req = ctrl.open(
      SCHOOL,
      { subjectId: 'tutor-1', subjectType: 'TUTOR', type: 'ACCESS', details: 'Quais dados meus vocês guardam?' },
      STAFF,
    );
    expect(req.status).toBe('OPEN');
    expect(req.schoolId).toBe(SCHOOL);
    expect(req.requestedBy).toBe('staff-1');
    expect(req.channel).toBe('ADMIN_PANEL');
    expect(req.dueAt.getTime() - req.receivedAt.getTime()).toBe(15 * 86_400_000);
  });

  it('fluxo completo via controller: open → verify → simplified → start → fulfill', () => {
    const { ctrl } = controller();
    const req = ctrl.open(
      SCHOOL,
      { subjectId: 'tutor-1', subjectType: 'TUTOR', type: 'ACCESS', details: 'Acesso aos meus dados.' },
      STAFF,
    );
    const verified = ctrl.verifyIdentity(req.id, STAFF);
    expect(verified.status).toBe('IDENTITY_VERIFIED');
    const simplified = ctrl.provideSimplifiedAccess(
      req.id,
      { summary: 'Confirmado: nome, telefone e registros de retirada.' },
      STAFF,
    );
    expect(simplified.simplifiedAccessProvidedAt).not.toBeNull();
    const started = ctrl.startProcessing(req.id, STAFF);
    expect(started.status).toBe('IN_PROGRESS');
    const done = ctrl.fulfill(req.id, { outcome: 'FULL', note: 'Declaração completa entregue.' }, STAFF);
    expect(done.status).toBe('FULFILLED');
  });

  it('fulfill de ERASURE via controller → PARTIAL com retenção do art. 16', () => {
    const { ctrl } = controller();
    const req = ctrl.open(
      SCHOOL,
      { subjectId: 'tutor-1', subjectType: 'TUTOR', type: 'ERASURE', details: 'Apaguem meus dados.' },
      STAFF,
    );
    ctrl.verifyIdentity(req.id, STAFF);
    ctrl.startProcessing(req.id, STAFF);
    expect(() =>
      ctrl.fulfill(req.id, { outcome: 'FULL', note: 'Tudo apagado.' }, STAFF),
    ).toThrow(BadRequestException);
    const done = ctrl.fulfill(
      req.id,
      { outcome: 'PARTIAL', note: 'Cadastro apagado; logs mantidos por obrigação legal (art. 16, I).' },
      STAFF,
    );
    expect(done.status).toBe('PARTIALLY_FULFILLED');
    expect(done.retainedByLegalObligation).toContain('PICKUP_LOG');
  });

  it('listOverdue e listSimplifiedAccessPending devolvem as filas do DPO', () => {
    const { ctrl } = controller();
    ctrl.open(
      SCHOOL,
      { subjectId: 'tutor-1', subjectType: 'TUTOR', type: 'ACCESS', details: 'Acesso.' },
      STAFF,
    );
    expect(ctrl.listSimplifiedAccessPending()).toHaveLength(1);
    expect(ctrl.listOverdue()).toHaveLength(0);
    expect(ctrl.list(SCHOOL)).toHaveLength(1);
  });

  it('deny sem motivo → 400 (o titular tem direito a saber por quê)', () => {
    const { ctrl } = controller();
    const req = ctrl.open(
      SCHOOL,
      { subjectId: 'tutor-1', subjectType: 'TUTOR', type: 'PORTABILITY', details: 'Quero meus dados.' },
      STAFF,
    );
    // O DTO valida o motivo em HTTP; o serviço também recusa motivo vazio.
    expect(() => ctrl.deny(req.id, { reason: '  ' }, STAFF)).toThrow(BadRequestException);
    const denied = ctrl.deny(req.id, { reason: 'Pedido duplicado de outro canal.' }, STAFF);
    expect(denied.status).toBe('DENIED');
  });

  it('get e listEvents devolvem o pedido e o log com hash encadeado', () => {
    const { service, ctrl } = controller();
    const req = ctrl.open(
      SCHOOL,
      { subjectId: 'aluno-1', subjectType: 'STUDENT', type: 'CORRECTION', details: 'Corrigir o telefone do responsável.' },
      STAFF,
    );
    ctrl.addNote(req.id, { note: 'Responsável ligou confirmando o número novo.' }, STAFF);
    expect(ctrl.get(req.id).id).toBe(req.id);
    expect(ctrl.listEvents(req.id).map((e) => e.type)).toEqual(['OPENED', 'NOTE']);
    expect(service.verifyChain(req.id)).toBe(true);
  });
});
