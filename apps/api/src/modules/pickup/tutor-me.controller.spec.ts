import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TutorMeController } from './tutor-me.controller';
import { PickupService } from './pickup.service';
import { RosterService } from '../roster/roster.service';
import { QrTokenService } from '../qr/qr-token.service';
import type { AccessTokenPayload } from '../auth/auth.service';

// A área do responsável com os serviços REAIS (em memória): o contrato
// é a resolução pela sessão — o tutor só vê/age sobre os próprios
// filhos, e a conta sem vínculo recebe a explicação, não um erro seco.
describe('TutorMeController (/pickup/schools/:schoolId/me)', () => {
  function setup() {
    const roster = new RosterService();
    const school = roster.createSchool({ name: 'Escola da Rita' });
    const turma = roster.createClassroom(school.id, {
      name: '3º B',
      academicYear: 2026,
    });
    const theo = roster.createStudent(school.id, {
      name: 'Theo Responsável',
      classroomId: turma.id,
    });
    const outro = roster.createStudent(school.id, {
      name: 'Aluno Alheio',
      classroomId: turma.id,
    });
    const rita = roster.createTutor(school.id, {
      name: 'Rita Responsável',
      phone: '11988887777',
    });
    roster.linkTutor(rita.id, theo.id, 'MOTHER', { isPrimary: true });
    roster.setTutorUserId(rita.id, 'user-rita');
    const qr = new QrTokenService();
    const pickup = new PickupService(qr);
    const ctrl = new TutorMeController(pickup, roster, qr);
    const RITA: AccessTokenPayload = {
      sub: 'user-rita',
      email: 'rita@escola.test',
      name: 'Rita',
      schoolId: school.id,
      roles: ['TUTOR'],
      iss: 'tutorpass',
      aud: 'tutorpass-api',
      iat: 0,
      exp: 0,
      jti: 'jti-rita',
    };
    return { roster, school, turma, theo, outro, rita, pickup, ctrl, RITA };
  }

  it('me devolve a tutora e os filhos dela (só os dela)', () => {
    const { ctrl, school, RITA, theo } = setup();
    const me = ctrl.me(school.id, RITA);
    expect(me.tutor?.name).toBe('Rita Responsável');
    expect(me.students).toHaveLength(1);
    expect(me.students[0].student.id).toBe(theo.id);
    expect(me.students[0].classroomName).toBe('3º B');
    expect(me.students[0].activeEntry).toBeNull();
  });

  it('conta sem vínculo: me devolve tutor null; join/qr dão 403 com orientação', () => {
    const { ctrl, school, RITA } = setup();
    const orfao = { ...RITA, sub: 'user-orfao' };
    expect(ctrl.me(school.id, orfao)).toEqual({ tutor: null, students: [] });
    expect(() => ctrl.qrToken(school.id, orfao)).toThrow(ForbiddenException);
  });

  it('join entra na fila pelo filho; aluno alheio → 404; me reflete a entrada ativa', () => {
    const { ctrl, school, RITA, theo, outro } = setup();
    const entry = ctrl.join(school.id, { studentId: theo.id }, RITA);
    expect(entry.status).toBe('QUEUED');
    expect(entry.tutorId).toBeDefined();
    expect(() => ctrl.join(school.id, { studentId: outro.id }, RITA)).toThrow(
      NotFoundException,
    );
    const me = ctrl.me(school.id, RITA);
    expect(me.students[0].activeEntry?.id).toBe(entry.id);
  });

  it('cancel só cancela a própria entrada', () => {
    const { ctrl, pickup, school, RITA, theo, outro } = setup();
    const minha = ctrl.join(school.id, { studentId: theo.id }, RITA);
    const alheia = pickup.join({
      schoolId: school.id,
      studentId: outro.id,
      tutorId: 'tutor-alheio',
    });
    expect(() => ctrl.cancel(school.id, alheia.id, RITA)).toThrow(NotFoundException);
    expect(ctrl.cancel(school.id, minha.id, RITA).status).toBe('CANCELLED');
  });

  it('qr-token é do tutor da sessão e valida contra a entrada dele', async () => {
    const { ctrl, pickup, school, RITA, theo, rita } = setup();
    const entry = ctrl.join(school.id, { studentId: theo.id }, RITA);
    const { token, expiresIn } = ctrl.qrToken(school.id, RITA);
    expect(expiresIn).toBe(30);
    const validated = await pickup.validateQr(entry.id, token, 'staff-1');
    expect(validated.status).toBe('VALIDATED');
    expect(entry.tutorId).toBe(rita.id);
  });

  it('vínculo sem canPickup → 403; aluno com retirada bloqueada → 403', () => {
    const { ctrl, roster, school, RITA, outro, rita } = setup();
    roster.linkTutor(rita.id, outro.id, 'OTHER', { canPickup: false });
    expect(() => ctrl.join(school.id, { studentId: outro.id }, RITA)).toThrow(
      ForbiddenException,
    );
    roster.unlinkTutor(rita.id, outro.id);
    roster.linkTutor(rita.id, outro.id, 'OTHER', { canPickup: true });
    roster.blockPickup(outro.id, 'Ordem judicial');
    expect(() => ctrl.join(school.id, { studentId: outro.id }, RITA)).toThrow(
      ForbiddenException,
    );
  });
});
