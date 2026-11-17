import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConsentService, type ConsentPurpose } from './consent.service';

const base = {
  schoolId: 'school-1',
  subjectId: 'tutor-1',
  grantedByUserId: 'guardian-1',
  grantedByRole: 'GUARDIAN' as const,
  explicit: true,
  noticeVersion: 'aviso-v1.0',
  subjectUnder12: false,
};

describe('ConsentService (LGPD art. 14)', () => {
  let svc: ConsentService;
  beforeEach(() => (svc = new ConsentService()));

  it('grant + isConsented: consentimento ativo após conceder', () => {
    svc.grant({ ...base, purpose: 'GUARDIAN_GEOLOCATION' });
    expect(svc.isConsented('school-1', 'tutor-1', 'GUARDIAN_GEOLOCATION')).toBe(true);
  });

  it('sem consentimento: isConsented false e requireConsent lança 403', () => {
    expect(svc.isConsented('school-1', 'tutor-1', 'PUSH_NOTIFICATIONS')).toBe(false);
    expect(() => svc.requireConsent('school-1', 'tutor-1', 'PUSH_NOTIFICATIONS')).toThrow(ForbiddenException);
  });

  it('revoke: revogação vale imediatamente e fica no histórico', () => {
    svc.grant({ ...base, purpose: 'PUSH_NOTIFICATIONS' });
    svc.revoke({ schoolId: 'school-1', subjectId: 'tutor-1', purpose: 'PUSH_NOTIFICATIONS', revokedByUserId: 'guardian-1' });
    expect(svc.isConsented('school-1', 'tutor-1', 'PUSH_NOTIFICATIONS')).toBe(false);
    expect(svc.exportSubjectEvents('school-1', 'tutor-1')).toHaveLength(2);
    expect(svc.verifyChain()).toBe(true);
  });

  it('re-grant após revoke reativa o consentimento', () => {
    svc.grant({ ...base, purpose: 'STUDENT_PHOTO', subjectId: 'student-1' });
    svc.revoke({ schoolId: 'school-1', subjectId: 'student-1', purpose: 'STUDENT_PHOTO', revokedByUserId: 'guardian-1' });
    svc.grant({ ...base, purpose: 'STUDENT_PHOTO', subjectId: 'student-1' });
    expect(svc.isConsented('school-1', 'student-1', 'STUDENT_PHOTO')).toBe(true);
  });

  it('dado sensível (selfie): exige consentimento explícito', () => {
    expect(() => svc.grant({ ...base, purpose: 'DELEGATION_SELFIE', explicit: false })).toThrow(BadRequestException);
    svc.grant({ ...base, purpose: 'DELEGATION_SELFIE', explicit: true });
    expect(svc.isConsented('school-1', 'tutor-1', 'DELEGATION_SELFIE')).toBe(true);
  });

  it('criança < 12: só responsável legal + explícito', () => {
    const child = { ...base, purpose: 'STUDENT_PHOTO' as ConsentPurpose, subjectId: 'student-1', subjectUnder12: true };
    expect(() => svc.grant({ ...child, grantedByRole: 'SELF' })).toThrow(ForbiddenException);
    expect(() => svc.grant({ ...child, explicit: false })).toThrow(ForbiddenException);
    svc.grant(child);
    expect(svc.isConsented('school-1', 'student-1', 'STUDENT_PHOTO')).toBe(true);
  });

  it('consentimento informado: exige versão do aviso de privacidade', () => {
    expect(() => svc.grant({ ...base, purpose: 'PUSH_NOTIFICATIONS', noticeVersion: '  ' })).toThrow(BadRequestException);
  });

  it('isolamento por escola e por finalidade', () => {
    svc.grant({ ...base, purpose: 'GUARDIAN_GEOLOCATION' });
    expect(svc.isConsented('school-2', 'tutor-1', 'GUARDIAN_GEOLOCATION')).toBe(false);
    expect(svc.isConsented('school-1', 'tutor-1', 'PUSH_NOTIFICATIONS')).toBe(false);
  });

  it('retenção: geolocalização 0 dias (não persistir posição); selfie 30 dias', () => {
    const geo = svc.grant({ ...base, purpose: 'GUARDIAN_GEOLOCATION' });
    expect(svc.retentionDeadline(geo)?.getTime()).toBe(geo.createdAt.getTime());
    const selfie = svc.grant({ ...base, purpose: 'DELEGATION_SELFIE' });
    expect(svc.retentionDeadline(selfie)!.getTime()).toBe(selfie.createdAt.getTime() + 30 * 86_400_000);
    const photo = svc.grant({ ...base, purpose: 'STUDENT_PHOTO' });
    expect(svc.retentionDeadline(photo)).toBeNull();
  });

  it('isUnder12: borda dos 12 anos', () => {
    expect(ConsentService.isUnder12(new Date('2015-11-16'), new Date('2026-11-16'))).toBe(true); // 11 anos
    expect(ConsentService.isUnder12(new Date('2014-11-17'), new Date('2026-11-16'))).toBe(true); // 11 anos e 364 dias
    expect(ConsentService.isUnder12(new Date('2014-11-16'), new Date('2026-11-16'))).toBe(false); // fez 12 hoje
  });

  it('verifyChain detecta adulteração no histórico de consentimentos', () => {
    svc.grant({ ...base, purpose: 'PUSH_NOTIFICATIONS' });
    svc.grant({ ...base, purpose: 'STUDENT_PHOTO' });
    expect(svc.verifyChain()).toBe(true);
    (svc as unknown as { events: { purpose: string }[] }).events[0].purpose = 'GUARDIAN_GEOLOCATION';
    expect(svc.verifyChain()).toBe(false);
  });

  it('exportSubjectEvents: só eventos do sujeito (direito de acesso, art. 18)', () => {
    svc.grant({ ...base, purpose: 'PUSH_NOTIFICATIONS' });
    svc.grant({ ...base, purpose: 'PUSH_NOTIFICATIONS', subjectId: 'tutor-2' });
    expect(svc.exportSubjectEvents('school-1', 'tutor-1')).toHaveLength(1);
  });
});
