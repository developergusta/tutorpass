import { TemporaryAuthorizationService, CreateAuthorizationInput } from './temporary-authorization.service';

const BASE: Omit<CreateAuthorizationInput, 'duration'> = {
  schoolId: 'school-1',
  tutorId: 'tutor-1',
  delegateName: 'Avó Maria',
  delegateDocument: '123.456.789-00',
  delegateSelfieUrl: 'https://s3.exemplo/selfie.jpg',
  studentIds: ['student-1'],
};

const NOW = new Date('2026-11-17T08:00:00-03:00');

describe('TemporaryAuthorizationService', () => {
  let service: TemporaryAuthorizationService;

  beforeEach(() => {
    service = new TemporaryAuthorizationService();
  });

  it('ONE_DAY expira 1 dia após startsAt e é de uso único', () => {
    const auth = service.create({ ...BASE, duration: 'ONE_DAY' }, NOW);
    expect(auth.status).toBe('ACTIVE');
    expect(auth.singleUse).toBe(true);
    expect(auth.expiresAt).toEqual(new Date('2026-11-18T08:00:00-03:00'));
  });

  it('ONE_WEEK e ONE_MONTH são multiuso dentro da janela', () => {
    const week = service.create({ ...BASE, duration: 'ONE_WEEK' }, NOW);
    const month = service.create(
      { ...BASE, delegateDocument: '999.888.777-66', duration: 'ONE_MONTH' },
      NOW,
    );
    expect(week.expiresAt).toEqual(new Date('2026-11-24T08:00:00-03:00'));
    expect(month.expiresAt).toEqual(new Date('2026-12-17T08:00:00-03:00'));
    expect(week.singleUse).toBe(false);
    expect(month.singleUse).toBe(false);
  });

  it('startsAt futuro deixa a autorização PENDING e canPickup nega antes da janela', () => {
    const auth = service.create(
      { ...BASE, duration: 'ONE_WEEK', startsAt: new Date('2026-11-18T08:00:00-03:00') },
      NOW,
    );
    expect(auth.status).toBe('PENDING');
    expect(service.canPickup(auth, 'student-1', NOW).allowed).toBe(false);
    expect(service.canPickup(auth, 'student-1', new Date('2026-11-18T08:00:00-03:00')).allowed).toBe(true);
  });

  it('rejeita sem selfie (obrigatória p/ verificação visual na portaria)', () => {
    expect(() => service.create({ ...BASE, duration: 'ONE_DAY', delegateSelfieUrl: '' }, NOW)).toThrow(
      /Selfie/,
    );
  });

  it('rejeita sem aluno e com duração inválida', () => {
    expect(() => service.create({ ...BASE, duration: 'ONE_DAY', studentIds: [] }, NOW)).toThrow(
      /ao menos 1 aluno/,
    );
    expect(() =>
      service.create({ ...BASE, duration: 'ONE_YEAR' as never }, NOW),
    ).toThrow(/Duração inválida/);
  });

  it('canPickup nega aluno não coberto, vencida e revogada', () => {
    const auth = service.create({ ...BASE, duration: 'ONE_DAY' }, NOW);
    expect(service.canPickup(auth, 'student-2', NOW).allowed).toBe(false);
    expect(service.canPickup(auth, 'student-1', new Date('2026-11-18T08:00:01-03:00')).allowed).toBe(false);
    service.revoke(auth, NOW);
    expect(service.canPickup(auth, 'student-1', NOW).allowed).toBe(false);
  });

  it('ONE_DAY vira USED na 1ª retirada e a 2ª é negada', () => {
    const auth = service.create({ ...BASE, duration: 'ONE_DAY' }, NOW);
    service.use(auth, 'student-1', NOW);
    expect(auth.status).toBe('USED');
    expect(auth.useCount).toBe(1);
    expect(auth.usedAt).toEqual(NOW);
    expect(() => service.use(auth, 'student-1', NOW)).toThrow(/já utilizada/);
  });

  it('ONE_WEEK permite várias retiradas dentro da janela', () => {
    const auth = service.create({ ...BASE, duration: 'ONE_WEEK' }, NOW);
    service.use(auth, 'student-1', NOW);
    service.use(auth, 'student-1', new Date('2026-11-19T08:00:00-03:00'));
    expect(auth.status).toBe('ACTIVE');
    expect(auth.useCount).toBe(2);
  });

  it('revoke é idempotente e não revoga autorização já encerrada', () => {
    const auth = service.create({ ...BASE, duration: 'ONE_DAY' }, NOW);
    service.revoke(auth, NOW);
    expect(service.revoke(auth, NOW).status).toBe('REVOKED');
    const used = service.create(
      { ...BASE, delegateDocument: '111.222.333-44', duration: 'ONE_DAY' },
      NOW,
    );
    service.use(used, 'student-1', NOW);
    expect(() => service.revoke(used, NOW)).toThrow(/já encerrada/);
  });

  it('refresh marca EXPIRED após expiresAt e é idempotente', () => {
    const auth = service.create({ ...BASE, duration: 'ONE_DAY' }, NOW);
    expect(service.refresh(auth, NOW)).toBe(false);
    expect(service.refresh(auth, new Date('2026-11-18T08:00:00-03:00'))).toBe(true);
    expect(auth.status).toBe('EXPIRED');
    expect(service.refresh(auth, new Date('2026-11-19T08:00:00-03:00'))).toBe(false);
  });

  it('rejeita 2ª autorização sobreposta p/ mesmo delegado + aluno', () => {
    service.create({ ...BASE, duration: 'ONE_WEEK' }, NOW);
    expect(() =>
      service.create(
        { ...BASE, duration: 'ONE_DAY', startsAt: new Date('2026-11-20T08:00:00-03:00') },
        NOW,
      ),
    ).toThrow(/já tem autorização ativa/);
  });

  it('permite nova autorização após revogar a anterior', () => {
    const first = service.create({ ...BASE, duration: 'ONE_WEEK' }, NOW);
    service.revoke(first, NOW);
    const second = service.create({ ...BASE, duration: 'ONE_DAY' }, NOW);
    expect(second.status).toBe('ACTIVE');
  });

  it('listActiveForStudent só devolve as válidas agora p/ o aluno', () => {
    const active = service.create({ ...BASE, duration: 'ONE_WEEK' }, NOW);
    service.create(
      { ...BASE, delegateDocument: '555.666.777-88', duration: 'ONE_DAY' },
      new Date('2026-11-10T08:00:00-03:00'),
    );
    const list = service.listActiveForStudent('school-1', 'student-1', NOW);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(active.id);
    expect(service.listActiveForStudent('school-1', 'student-2', NOW)).toHaveLength(0);
  });
});
