import {
  ComplianceReportService,
  TREATMENT_ACTIVITIES,
} from './compliance-report.service';
import { ConsentService } from '../consent/consent.service';
import { RetentionService } from '../retention/retention.service';
import { SecurityIncidentService } from '../incidents/security-incident.service';

const day = 86_400_000;
const t0 = new Date('2026-11-17T10:00:00-03:00');

function build() {
  const consent = new ConsentService();
  const retention = new RetentionService();
  const incidents = new SecurityIncidentService();
  const svc = new ComplianceReportService(consent, retention, incidents);
  return { svc, consent, retention, incidents };
}

function grant(consent: ConsentService, subjectId: string, purpose: 'GUARDIAN_GEOLOCATION' | 'STUDENT_PHOTO' = 'GUARDIAN_GEOLOCATION') {
  return consent.grant({
    schoolId: 'school-1',
    subjectId,
    purpose,
    grantedByUserId: 'secretaria-1',
    grantedByRole: 'GUARDIAN',
    explicit: true,
    noticeVersion: 'v3',
    subjectUnder12: true,
  });
}

describe('ComplianceReportService (relatório de conformidade LGPD)', () => {
  it('RoPA: 8 atividades, todas com base legal, retenção e titulares', () => {
    expect(TREATMENT_ACTIVITIES).toHaveLength(8);
    for (const t of TREATMENT_ACTIVITIES) {
      expect(t.legalBasis.length).toBeGreaterThan(0);
      expect(t.retention.length).toBeGreaterThan(0);
      expect(t.subjects.length).toBeGreaterThan(0);
      expect(t.dataCategories.length).toBeGreaterThan(0);
    }
  });

  it('RoPA: selfie é sensível com base no art. 11; geolocalização nunca persiste; push transfere p/ fora', () => {
    const selfie = TREATMENT_ACTIVITIES.find((t) => t.id === 'DELEGATION_SELFIE')!;
    expect(selfie.sensitive).toBe(true);
    expect(selfie.legalBasis).toContain('art. 11');
    expect(selfie.retention).toContain('30 dias');
    const geo = TREATMENT_ACTIVITIES.find((t) => t.id === 'GUARDIAN_GEOLOCATION')!;
    expect(geo.retention).toContain('0 dias');
    expect(geo.retention).toContain('NUNCA');
    const push = TREATMENT_ACTIVITIES.find((t) => t.id === 'PUSH_NOTIFICATIONS')!;
    expect(push.internationalTransfer).toBe(true);
    expect(push.subProcessors).toContain('Expo (push notifications)');
    const others = TREATMENT_ACTIVITIES.filter((t) => t.id !== 'PUSH_NOTIFICATIONS');
    expect(others.every((t) => !t.internationalTransfer)).toBe(true);
  });

  it('escola vazia: DPO e aviso PENDENTES, resto OK, RIPD pendente; sem dado, tudo zero', () => {
    const { svc } = build();
    const r = svc.generate({ schoolId: 'school-1', schoolName: 'Colégio Exemplo' }, t0);
    expect(r.controller).toBe('Colégio Exemplo');
    expect(r.operator).toContain('operadora');
    expect(r.checks.find((c) => c.id === 'dpo')!.status).toBe('PENDENTE');
    expect(r.checks.find((c) => c.id === 'aviso-privacidade')!.status).toBe('PENDENTE');
    expect(r.checks.find((c) => c.id === 'expurgo')!.status).toBe('OK');
    expect(r.checks.find((c) => c.id === 'incidentes')!.status).toBe('OK');
    expect(r.checks.find((c) => c.id === 'auditoria')!.status).toBe('OK');
    expect(r.checks.find((c) => c.id === 'transferencia-internacional')!.status).toBe('OK');
    expect(r.checks.find((c) => c.id === 'ripd')!.status).toBe('PENDENTE');
    expect(r.summary).toEqual({ ok: 4, atencao: 0, pendente: 3 });
    expect(r.gaps).toHaveLength(3);
    expect(r.consents.every((c) => c.activeSubjects === 0 && c.revokedSubjects === 0)).toBe(true);
    expect(r.incidents).toEqual({ total: 0, open: 0, overdue: 0, overdueIds: [] });
  });

  it('com DPO e aviso cadastrados, só o RIPD fica pendente', () => {
    const { svc } = build();
    const r = svc.generate(
      { schoolId: 'school-1', schoolName: 'Colégio Exemplo', dpoName: 'Maria Silva', dpoContact: 'dpo@exemplo.com.br', noticeVersion: 'v3' },
      t0,
    );
    expect(r.checks.find((c) => c.id === 'dpo')!.status).toBe('OK');
    expect(r.checks.find((c) => c.id === 'aviso-privacidade')!.status).toBe('OK');
    expect(r.summary).toEqual({ ok: 6, atencao: 0, pendente: 1 });
    expect(r.gaps).toHaveLength(1);
    expect(r.gaps[0]).toContain('RIPD');
  });

  it('consentimentos: conta ativos vs revogados pelo último evento, por finalidade', () => {
    const { svc, consent } = build();
    grant(consent, 'tutor-1');
    grant(consent, 'tutor-2');
    consent.revoke({ schoolId: 'school-1', subjectId: 'tutor-2', purpose: 'GUARDIAN_GEOLOCATION', revokedByUserId: 'secretaria-1' });
    grant(consent, 'student-1', 'STUDENT_PHOTO');
    const r = svc.generate({ schoolId: 'school-1', schoolName: 'Colégio Exemplo' }, t0);
    const geo = r.consents.find((c) => c.purpose === 'GUARDIAN_GEOLOCATION')!;
    expect(geo.activeSubjects).toBe(1);
    expect(geo.revokedSubjects).toBe(1);
    expect(geo.noticeVersions).toEqual(['v3']);
    const photo = r.consents.find((c) => c.purpose === 'STUDENT_PHOTO')!;
    expect(photo.activeSubjects).toBe(1);
    expect(photo.revokedSubjects).toBe(0);
  });

  it('retenção: selfie vencida vira ATENCAO; após o expurgo, volta a OK', () => {
    const { svc, retention } = build();
    retention.register({
      schoolId: 'school-1',
      subjectId: 'delegado-1',
      purpose: 'DELEGATION_SELFIE',
      dataRef: 's3://tutorpass/selfies/abc.jpg',
      createdAt: new Date(t0.getTime() - 40 * day),
    });
    const before = svc.generate({ schoolId: 'school-1', schoolName: 'Colégio Exemplo' }, t0);
    expect(before.retention.pendingPurge).toBe(1);
    expect(before.checks.find((c) => c.id === 'expurgo')!.status).toBe('ATENCAO');
    retention.purgeExpired(t0);
    const after = svc.generate({ schoolId: 'school-1', schoolName: 'Colégio Exemplo' }, t0);
    expect(after.retention.pendingPurge).toBe(0);
    expect(after.retention.purgedTotal).toBe(1);
    expect(after.checks.find((c) => c.id === 'expurgo')!.status).toBe('OK');
  });

  it('incidentes: comunicação vencida (3 dias úteis) vira ATENCAO com o id no gap', () => {
    const { svc, incidents } = build();
    const inc = incidents.report(
      {
        schoolId: 'school-1',
        title: 'Arquivo p/ família errada',
        description: 'Lista de alunos enviada p/ e-mail errado.',
        category: 'WRONG_RECIPIENT',
        dataCategories: ['STUDENT_NAME'],
        affectedCount: 12,
        relevantRisk: true,
        detectedAt: new Date('2026-11-13T10:00:00-03:00'), // sexta — vencimento: qua 18/11
        reportedBy: 'secretaria-1',
      },
      t0,
    );
    const onTime = svc.generate({ schoolId: 'school-1', schoolName: 'Colégio Exemplo' }, t0);
    expect(onTime.incidents.overdue).toBe(0);
    expect(onTime.checks.find((c) => c.id === 'incidentes')!.status).toBe('OK');
    const late = svc.generate({ schoolId: 'school-1', schoolName: 'Colégio Exemplo' }, new Date('2026-11-19T10:00:00-03:00'));
    expect(late.incidents).toEqual({ total: 1, open: 1, overdue: 1, overdueIds: [inc.id] });
    expect(late.checks.find((c) => c.id === 'incidentes')!.status).toBe('ATENCAO');
    expect(late.gaps.join(' ')).toContain(inc.id);
  });

  it('isolamento por escola: dado de outra escola não entra no relatório', () => {
    const { svc, consent, retention } = build();
    grant(consent, 'tutor-outra');
    // o grant acima foi p/ school-1; cria um evento p/ outra escola direto
    consent.grant({
      schoolId: 'school-2',
      subjectId: 'tutor-9',
      purpose: 'GUARDIAN_GEOLOCATION',
      grantedByUserId: 'secretaria-2',
      grantedByRole: 'GUARDIAN',
      explicit: true,
      noticeVersion: 'v1',
      subjectUnder12: false,
    });
    retention.register({
      schoolId: 'school-2',
      subjectId: 'delegado-9',
      purpose: 'DELEGATION_SELFIE',
      dataRef: 's3://tutorpass/selfies/zzz.jpg',
      createdAt: new Date(t0.getTime() - 40 * day),
    });
    const r = svc.generate({ schoolId: 'school-1', schoolName: 'Colégio Exemplo' }, t0);
    const geo = r.consents.find((c) => c.purpose === 'GUARDIAN_GEOLOCATION')!;
    expect(geo.activeSubjects).toBe(1); // só o tutor da school-1; o da school-2 não entra
    expect(r.retention.pendingPurge).toBe(0);
  });

  it('markdown: tem as seções e o nome da escola; NÃO vaza subjectId nem nome de titular', () => {
    const { svc, consent } = build();
    grant(consent, 'tutor-1');
    const r = svc.generate(
      { schoolId: 'school-1', schoolName: 'Colégio Exemplo', dpoName: 'Maria Silva', dpoContact: 'dpo@exemplo.com.br', noticeVersion: 'v3' },
      t0,
    );
    const md = svc.toMarkdown(r);
    expect(md).toContain('# Relatório de conformidade LGPD — Colégio Exemplo');
    expect(md).toContain('## Checklist de conformidade');
    expect(md).toContain('## Registro das operações de tratamento (RoPA — art. 37)');
    expect(md).toContain('## Consentimentos por finalidade');
    expect(md).toContain('## Incidentes de segurança');
    expect(md).toContain('Expo');
    expect(md).toContain('RIPD');
    expect(md).not.toContain('tutor-1');
    expect(md).not.toContain('secretaria-1');
  });
});
