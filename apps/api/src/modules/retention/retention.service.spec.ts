import { RetentionService, type RetainedItem } from './retention.service';

const day = 86_400_000;
const t0 = new Date('2026-11-17T00:00:00-03:00');

function item(overrides: Partial<RetainedItem> = {}): Omit<RetainedItem, 'id'> {
  return {
    schoolId: 'school-1',
    subjectId: 'tutor-1',
    purpose: 'DELEGATION_SELFIE',
    dataRef: 's3://tutorpass/selfies/abc.jpg',
    createdAt: t0,
    ...overrides,
  };
}

describe('RetentionService (expurgo automático LGPD)', () => {
  let svc: RetentionService;
  beforeEach(() => (svc = new RetentionService()));

  it('selfie: mantida antes de 30 dias, expurgada a partir do prazo', () => {
    svc.register(item());
    expect(svc.purgeExpired(new Date(t0.getTime() + 29 * day)).purged).toHaveLength(0);
    expect(svc.list()).toHaveLength(1);
    const report = svc.purgeExpired(new Date(t0.getTime() + 30 * day));
    expect(report.purged).toHaveLength(1);
    expect(report.purged[0].rule).toBe('RETENTION_EXPIRED');
    expect(report.remaining).toBe(0);
    expect(svc.list()).toHaveLength(0);
  });

  it('selfie: expurgo é idempotente (2ª rodada não expurga nada)', () => {
    svc.register(item());
    svc.purgeExpired(new Date(t0.getTime() + 31 * day));
    expect(svc.purgeExpired(new Date(t0.getTime() + 32 * day)).purged).toHaveLength(0);
    expect(svc.purgeLog()).toHaveLength(1);
  });

  it('foto do aluno: mantida enquanto matriculado, expurgada ao fim da matrícula', () => {
    svc.register(item({ purpose: 'STUDENT_PHOTO', subjectId: 'student-1', dataRef: 's3://tutorpass/photos/s1.jpg' }));
    expect(svc.purgeExpired(new Date(t0.getTime() + 365 * day)).purged).toHaveLength(0);
    svc.register(
      item({
        purpose: 'STUDENT_PHOTO',
        subjectId: 'student-2',
        dataRef: 's3://tutorpass/photos/s2.jpg',
        enrollmentEndsAt: new Date(t0.getTime() + 10 * day),
      }),
    );
    const report = svc.purgeExpired(new Date(t0.getTime() + 11 * day));
    expect(report.purged).toHaveLength(1);
    expect(report.purged[0].rule).toBe('ENROLLMENT_ENDED');
    expect(report.purged[0].subjectId).toBe('student-2');
    expect(report.remaining).toBe(1);
  });

  it('geolocalização (retenção 0 dias): ping registrado por engano some no próximo ciclo', () => {
    svc.register(item({ purpose: 'GUARDIAN_GEOLOCATION', dataRef: 'ping:lat,lon' }));
    const report = svc.purgeExpired(new Date(t0.getTime() + 60_000));
    expect(report.purged).toHaveLength(1);
    expect(report.purged[0].rule).toBe('ZERO_RETENTION');
  });

  it('push: token some quando o consentimento é revogado', () => {
    svc.register(
      item({ purpose: 'PUSH_NOTIFICATIONS', dataRef: 'expo-push-token:xyz', consentRevokedAt: new Date(t0.getTime() + 5 * day) }),
    );
    expect(svc.purgeExpired(new Date(t0.getTime() + 4 * day)).purged).toHaveLength(0);
    const report = svc.purgeExpired(new Date(t0.getTime() + 5 * day));
    expect(report.purged).toHaveLength(1);
    expect(report.purged[0].rule).toBe('CONSENT_REVOKED');
  });

  it('revogação antecipa o expurgo da selfie (antes dos 30 dias)', () => {
    svc.register(item({ consentRevokedAt: new Date(t0.getTime() + 2 * day) }));
    const report = svc.purgeExpired(new Date(t0.getTime() + 3 * day));
    expect(report.purged).toHaveLength(1);
    expect(report.purged[0].rule).toBe('CONSENT_REVOKED');
  });

  it('dryRun: prévia sem remover nada nem escrever no log', () => {
    svc.register(item());
    const preview = svc.dryRun(new Date(t0.getTime() + 31 * day));
    expect(preview).toHaveLength(1);
    expect(preview[0].rule).toBe('RETENTION_EXPIRED');
    expect(svc.list()).toHaveLength(1);
    expect(svc.purgeLog()).toHaveLength(0);
  });

  it('log de expurgo: hash encadeado verificável; adulteração quebra a cadeia', () => {
    svc.register(item());
    svc.register(item({ subjectId: 'tutor-2', dataRef: 's3://tutorpass/selfies/def.jpg' }));
    svc.purgeExpired(new Date(t0.getTime() + 31 * day));
    expect(svc.purgeLog()).toHaveLength(2);
    expect(svc.verifyChain()).toBe(true);
    const log = svc.purgeLog();
    (log[0] as { rule: string }).rule = 'ENROLLMENT_ENDED'; // adulteração
    expect(svc.verifyChain()).toBe(false);
  });

  it('log de expurgo guarda só a referência opaca, nunca o conteúdo do dado', () => {
    svc.register(item());
    const [event] = svc.purgeExpired(new Date(t0.getTime() + 31 * day)).purged;
    expect(Object.keys(event).sort()).toEqual(
      ['dataRef', 'hash', 'id', 'itemId', 'prevHash', 'purgedAt', 'purpose', 'rule', 'schoolId', 'subjectId'].sort(),
    );
    expect(event.dataRef).toBe('s3://tutorpass/selfies/abc.jpg');
  });

  it('isolamento por escola: revogação na school-1 não expurga dado da school-2', () => {
    svc.register(item({ consentRevokedAt: new Date(t0.getTime() + 1 * day) }));
    svc.register(item({ schoolId: 'school-2', subjectId: 'tutor-9' }));
    const report = svc.purgeExpired(new Date(t0.getTime() + 2 * day));
    expect(report.purged).toHaveLength(1);
    expect(report.purged[0].schoolId).toBe('school-1');
    expect(svc.list()).toHaveLength(1);
    expect(svc.list()[0].schoolId).toBe('school-2');
  });

  it('retentionDeadlineFor: selfie 30d, geolocalização 0d, foto sem matrícula null', () => {
    const selfie = svc.register(item());
    expect(svc.retentionDeadlineFor(selfie)!.getTime()).toBe(t0.getTime() + 30 * day);
    const ping = svc.register(item({ purpose: 'GUARDIAN_GEOLOCATION' }));
    expect(svc.retentionDeadlineFor(ping)!.getTime()).toBe(t0.getTime());
    const photo = svc.register(item({ purpose: 'STUDENT_PHOTO' }));
    expect(svc.retentionDeadlineFor(photo)).toBeNull();
  });
});
