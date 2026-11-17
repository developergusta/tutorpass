import { BadRequestException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';
import type { AccessTokenPayload } from '../auth/auth.service';

// O controller é testado direto (sem HTTP): os guards (JwtAuthGuard /
// TenantGuard / RolesGuard) já têm spec próprio em auth/guards.spec.ts —
// aqui o contrato é a tradução HTTP -> OnboardingService (rotas, actorId
// = user.sub, erros do serviço propagados).
describe('OnboardingController (/api/onboarding/schools/:schoolId/*)', () => {
  const SCHOOL = 'school-1';

  const ADMIN: AccessTokenPayload = {
    sub: 'admin-1',
    email: 'admin@escola.test',
    name: 'Admin',
    schoolId: SCHOOL,
    roles: ['ADMIN'],
    iss: 'tutorpass',
    aud: 'tutorpass-api',
    iat: 0,
    exp: 0,
    jti: 'jti-teste',
  };

  function controller() {
    const service = new OnboardingService();
    return { service, ctrl: new OnboardingController(service) };
  }

  it('checklist devolve 0/4 p/ escola nova', () => {
    const { ctrl } = controller();
    const checklist = ctrl.checklist(SCHOOL);
    expect(checklist.doneCount).toBe(0);
    expect(checklist.nextStep).toBe('ACCOUNT_CREATED');
  });

  it('complete marca o passo com o actorId do token e avança o progresso', () => {
    const { ctrl } = controller();
    const checklist = ctrl.completeStep(SCHOOL, 'ACCOUNT_CREATED', ADMIN);
    expect(checklist.doneCount).toBe(1);
    expect(checklist.progressPercent).toBe(25);
    expect(checklist.steps[0].doneBy).toBe('admin-1');
    expect(checklist.nextStep).toBe('ROSTER_IMPORTED');
  });

  it('complete com passo desconhecido propaga o 400 do serviço', () => {
    const { ctrl } = controller();
    expect(() => ctrl.completeStep(SCHOOL, 'PAGAMENTO', ADMIN)).toThrow(
      BadRequestException,
    );
  });

  it('reopen derruba o passo marcado', () => {
    const { ctrl } = controller();
    ctrl.completeStep(SCHOOL, 'ACCOUNT_CREATED', ADMIN);
    const checklist = ctrl.reopenStep(SCHOOL, 'ACCOUNT_CREATED', ADMIN);
    expect(checklist.doneCount).toBe(0);
    expect(checklist.nextStep).toBe('ACCOUNT_CREATED');
  });

  it('demo/reset recusa escola não-demo e zera a demo marcada', () => {
    const { ctrl } = controller();
    ctrl.completeStep(SCHOOL, 'ACCOUNT_CREATED', ADMIN);
    expect(() => ctrl.resetDemo(SCHOOL, ADMIN)).toThrow(BadRequestException);

    ctrl.markAsDemo(SCHOOL, ADMIN);
    const reset = ctrl.resetDemo(SCHOOL, ADMIN);
    expect(reset.doneCount).toBe(0);
    expect(reset.isDemo).toBe(true);
  });
});
