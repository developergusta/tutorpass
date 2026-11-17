import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ART16_RETAINED_CATEGORIES,
  DataSubjectRequestService,
  FULL_DECLARATION_DAYS,
  type OpenRequestInput,
} from './data-subject-request.service';

// Exercício de direitos do titular (arts. 18/19 LGPD): dois prazos, verificação
// de identidade antes de entregar dado, retenção do art. 16 na eliminação.
describe('DataSubjectRequestService (LGPD arts. 18/19)', () => {
  const SCHOOL = 'school-1';
  const SUBJECT = 'tutor-1';
  const T0 = new Date('2026-11-17T10:00:00Z');

  function base(overrides: Partial<OpenRequestInput> = {}): OpenRequestInput {
    return {
      schoolId: SCHOOL,
      subjectId: SUBJECT,
      subjectType: 'TUTOR',
      requestedBy: 'staff-1',
      type: 'ACCESS',
      details: 'Quero saber quais dados meus a escola guarda.',
      ...overrides,
    };
  }

  it('open cria pedido OPEN com prazo de 15 dias corridos (art. 19, §2º)', () => {
    const svc = new DataSubjectRequestService();
    const req = svc.open(base(), T0);
    expect(req.status).toBe('OPEN');
    expect(req.dueAt.getTime() - req.receivedAt.getTime()).toBe(
      FULL_DECLARATION_DAYS * 86_400_000,
    );
    expect(req.simplifiedAccessProvidedAt).toBeNull();
    expect(req.identityVerifiedAt).toBeNull();
  });

  it('open rejeita tipo de pedido e tipo de titular inválidos', () => {
    const svc = new DataSubjectRequestService();
    expect(() => svc.open(base({ type: 'DELETE_ALL' as never }))).toThrow(BadRequestException);
    expect(() => svc.open(base({ subjectType: 'DOG' as never }))).toThrow(BadRequestException);
    expect(() => svc.open(base({ subjectId: '  ' }))).toThrow(BadRequestException);
    expect(() => svc.open(base({ details: '' }))).toThrow(BadRequestException);
  });

  it('open rejeita segundo pedido ativo do mesmo titular + tipo', () => {
    const svc = new DataSubjectRequestService();
    svc.open(base(), T0);
    expect(() => svc.open(base(), T0)).toThrow(BadRequestException);
  });

  it('segundo pedido do mesmo tipo é permitido após o primeiro ser finalizado', () => {
    const svc = new DataSubjectRequestService();
    const req = svc.open(base(), T0);
    svc.deny(req.id, 'staff-1', 'Identidade não confirmada.', T0);
    expect(() => svc.open(base(), T0)).not.toThrow();
  });

  it('tipos diferentes do mesmo titular podem correr em paralelo', () => {
    const svc = new DataSubjectRequestService();
    svc.open(base(), T0);
    expect(() => svc.open(base({ type: 'CORRECTION' }), T0)).not.toThrow();
  });

  it('get de pedido inexistente → 404', () => {
    const svc = new DataSubjectRequestService();
    expect(() => svc.get('dsr-inexistente')).toThrow(NotFoundException);
  });

  it('verifyIdentity: OPEN → IDENTITY_VERIFIED, sem ela o pedido não anda', () => {
    const svc = new DataSubjectRequestService();
    const req = svc.open(base(), T0);
    expect(() => svc.startProcessing(req.id, 'staff-1', T0)).toThrow(BadRequestException);
    const verified = svc.verifyIdentity(req.id, 'staff-1', T0);
    expect(verified.status).toBe('IDENTITY_VERIFIED');
    expect(verified.identityVerifiedAt).toEqual(T0);
    expect(verified.verifiedBy).toBe('staff-1');
    expect(() => svc.verifyIdentity(req.id, 'staff-1', T0)).toThrow(BadRequestException);
  });

  it('verifyIdentity exige quem verificou', () => {
    const svc = new DataSubjectRequestService();
    const req = svc.open(base(), T0);
    expect(() => svc.verifyIdentity(req.id, '  ', T0)).toThrow(BadRequestException);
  });

  it('fluxo completo de ACCESS: verify → simplified → start → fulfill FULL', () => {
    const svc = new DataSubjectRequestService();
    const req = svc.open(base(), T0);
    svc.verifyIdentity(req.id, 'staff-1', T0);
    const withSimplified = svc.provideSimplifiedAccess(
      req.id,
      'staff-1',
      'Confirmado: guardamos nome, telefone e registros de retirada.',
      T0,
    );
    expect(withSimplified.simplifiedAccessProvidedAt).toEqual(T0);
    svc.startProcessing(req.id, 'staff-1', T0);
    const done = svc.fulfill(req.id, 'staff-1', { outcome: 'FULL', note: 'Declaração completa entregue.' }, T0);
    expect(done.status).toBe('FULFILLED');
    expect(done.outcome).toBe('FULL');
    expect(done.fulfilledAt).toEqual(T0);
  });

  it('ACCESS não pode ser atendido sem o acesso simplificado (art. 19, I)', () => {
    const svc = new DataSubjectRequestService();
    const req = svc.open(base(), T0);
    svc.verifyIdentity(req.id, 'staff-1', T0);
    svc.startProcessing(req.id, 'staff-1', T0);
    expect(() =>
      svc.fulfill(req.id, 'staff-1', { outcome: 'FULL', note: 'Declaração entregue.' }, T0),
    ).toThrow(BadRequestException);
  });

  it('provideSimplifiedAccess só existe p/ ACCESS e só após verificação', () => {
    const svc = new DataSubjectRequestService();
    const correction = svc.open(base({ type: 'CORRECTION' }), T0);
    svc.verifyIdentity(correction.id, 'staff-1', T0);
    expect(() => svc.provideSimplifiedAccess(correction.id, 'staff-1', 'resumo', T0)).toThrow(
      BadRequestException,
    );
    const access = svc.open(base({ subjectId: 'tutor-2' }), T0);
    expect(() => svc.provideSimplifiedAccess(access.id, 'staff-1', 'resumo', T0)).toThrow(
      BadRequestException,
    );
  });

  it('fulfill exige nota (é a resposta que o titular recebe)', () => {
    const svc = new DataSubjectRequestService();
    const req = svc.open(base({ type: 'CORRECTION' }), T0);
    svc.verifyIdentity(req.id, 'staff-1', T0);
    svc.startProcessing(req.id, 'staff-1', T0);
    expect(() => svc.fulfill(req.id, 'staff-1', { outcome: 'FULL', note: '  ' }, T0)).toThrow(
      BadRequestException,
    );
  });

  it('ERASURE nunca é FULL: retém as categorias do art. 16 e vira PARTIAL', () => {
    const svc = new DataSubjectRequestService();
    const req = svc.open(base({ type: 'ERASURE', details: 'Apaguem todos os meus dados.' }), T0);
    svc.verifyIdentity(req.id, 'staff-1', T0);
    svc.startProcessing(req.id, 'staff-1', T0);
    expect(() =>
      svc.fulfill(req.id, 'staff-1', { outcome: 'FULL', note: 'Tudo apagado.' }, T0),
    ).toThrow(BadRequestException);
    const done = svc.fulfill(
      req.id,
      'staff-1',
      {
        outcome: 'PARTIAL',
        note: 'Dados de cadastro apagados. Mantidos por obrigação legal (art. 16, I): registro de retirada, logs de auditoria, consentimentos e incidentes.',
      },
      T0,
    );
    expect(done.status).toBe('PARTIALLY_FULFILLED');
    expect(done.retainedByLegalObligation).toEqual([...ART16_RETAINED_CATEGORIES]);
  });

  it('ANONYMIZATION também retém o art. 16; outros tipos não retêm nada', () => {
    const svc = new DataSubjectRequestService();
    const anon = svc.open(base({ type: 'ANONYMIZATION' }), T0);
    svc.verifyIdentity(anon.id, 'staff-1', T0);
    svc.startProcessing(anon.id, 'staff-1', T0);
    const doneAnon = svc.fulfill(anon.id, 'staff-1', { outcome: 'PARTIAL', note: 'Anonimizado; logs mantidos.' }, T0);
    expect(doneAnon.retainedByLegalObligation.length).toBe(ART16_RETAINED_CATEGORIES.length);

    const correction = svc.open(base({ type: 'CORRECTION', subjectId: 'tutor-2' }), T0);
    svc.verifyIdentity(correction.id, 'staff-1', T0);
    svc.startProcessing(correction.id, 'staff-1', T0);
    const doneCorrection = svc.fulfill(
      correction.id,
      'staff-1',
      { outcome: 'FULL', note: 'Telefone corrigido.' },
      T0,
    );
    expect(doneCorrection.retainedByLegalObligation).toEqual([]);
  });

  it('deny exige motivo e finaliza o pedido', () => {
    const svc = new DataSubjectRequestService();
    const req = svc.open(base(), T0);
    expect(() => svc.deny(req.id, 'staff-1', '  ', T0)).toThrow(BadRequestException);
    const denied = svc.deny(req.id, 'staff-1', 'Identidade não confirmada após 2 tentativas.', T0);
    expect(denied.status).toBe('DENIED');
    expect(denied.denialReason).toContain('Identidade');
    expect(() => svc.cancel(req.id, 'staff-1', T0)).toThrow(BadRequestException);
  });

  it('cancel funciona até o atendimento; pedido finalizado não aceita nota', () => {
    const svc = new DataSubjectRequestService();
    const req = svc.open(base(), T0);
    const cancelled = svc.cancel(req.id, 'tutor-1', T0);
    expect(cancelled.status).toBe('CANCELLED');
    expect(() => svc.addNote(req.id, 'staff-1', 'nota', T0)).toThrow(BadRequestException);
  });

  it('addNote registra evento sem mudar o status', () => {
    const svc = new DataSubjectRequestService();
    const req = svc.open(base(), T0);
    svc.addNote(req.id, 'staff-1', 'Titular ligou pedindo urgência.', T0);
    expect(svc.get(req.id).status).toBe('OPEN');
    expect(svc.listEvents(req.id).map((e) => e.type)).toEqual(['OPENED', 'NOTE']);
  });

  it('daysRemaining: 15 no recebimento, negativo após o vencimento', () => {
    const svc = new DataSubjectRequestService();
    const req = svc.open(base(), T0);
    expect(svc.daysRemaining(req.id, T0)).toBe(15);
    expect(
      svc.daysRemaining(req.id, new Date('2026-12-03T10:00:00Z')),
    ).toBe(-1);
  });

  it('listOverdue: só não-finalizados após dueAt, ordenados pelo prazo', () => {
    const svc = new DataSubjectRequestService();
    const late = svc.open(base(), T0);
    const ok = svc.open(base({ subjectId: 'tutor-2' }), new Date('2026-11-16T10:00:00Z'));
    svc.verifyIdentity(ok.id, 'staff-1', T0);
    svc.startProcessing(ok.id, 'staff-1', T0);
    svc.provideSimplifiedAccess(ok.id, 'staff-1', 'resumo', T0);
    svc.fulfill(ok.id, 'staff-1', { outcome: 'FULL', note: 'Entregue.' }, T0);
    const overdue = svc.listOverdue(new Date('2026-12-03T10:00:00Z'));
    expect(overdue.map((r) => r.id)).toEqual([late.id]);
  });

  it('listSimplifiedAccessPending: ACCESS sem acesso simplificado, na ordem de chegada', () => {
    const svc = new DataSubjectRequestService();
    const pending = svc.open(base(), T0);
    const withSimplified = svc.open(base({ subjectId: 'tutor-2' }), T0);
    svc.verifyIdentity(withSimplified.id, 'staff-1', T0);
    svc.provideSimplifiedAccess(withSimplified.id, 'staff-1', 'resumo', T0);
    const correction = svc.open(base({ type: 'CORRECTION', subjectId: 'tutor-3' }), T0);
    expect(svc.listSimplifiedAccessPending().map((r) => r.id)).toEqual([pending.id]);
    expect(correction.id).not.toBeUndefined();
  });

  it('verifyChain: cadeia íntegra após o fluxo; adulteração é detectada', () => {
    const svc = new DataSubjectRequestService();
    const req = svc.open(base(), T0);
    svc.verifyIdentity(req.id, 'staff-1', T0);
    expect(svc.verifyChain(req.id)).toBe(true);
    const events = svc.listEvents(req.id);
    (events[0] as { note: string | null }).note = 'adulterado';
    expect(svc.verifyChain(req.id)).toBe(false);
  });
});
