import { BadRequestException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';

describe('OnboardingService (checklist de implantação em 1 dia)', () => {
  const SCHOOL = 'school-1';
  const OTHER = 'school-2';
  const ADMIN = 'admin-1';

  function service() {
    return new OnboardingService();
  }

  it('checklist novo: 0/4, 0%, próximo passo é a conta, 53 min estimados', () => {
    const checklist = service().getChecklist(SCHOOL);
    expect(checklist.schoolId).toBe(SCHOOL);
    expect(checklist.doneCount).toBe(0);
    expect(checklist.totalCount).toBe(4);
    expect(checklist.progressPercent).toBe(0);
    expect(checklist.nextStep).toBe('ACCOUNT_CREATED');
    expect(checklist.isComplete).toBe(false);
    expect(checklist.estimatedMinutesTotal).toBe(53);
    expect(checklist.estimatedMinutesRemaining).toBe(53);
    expect(checklist.isDemo).toBe(false);
    expect(checklist.steps.map((s) => s.done)).toEqual([false, false, false, false]);
  });

  it('marcar os 4 passos na ordem zera o checklist: 100%, sem próximo passo', () => {
    const svc = service();
    svc.completeStep(SCHOOL, 'ACCOUNT_CREATED', ADMIN);
    let checklist = svc.completeStep(SCHOOL, 'ROSTER_IMPORTED', ADMIN);
    expect(checklist.doneCount).toBe(2);
    expect(checklist.progressPercent).toBe(50);
    expect(checklist.nextStep).toBe('STAFF_INVITED');
    expect(checklist.estimatedMinutesRemaining).toBe(35); // 5 + 30

    checklist = svc.completeStep(SCHOOL, 'STAFF_INVITED', ADMIN);
    checklist = svc.completeStep(SCHOOL, 'FIRST_DISMISSAL_DONE', ADMIN);
    expect(checklist.doneCount).toBe(4);
    expect(checklist.progressPercent).toBe(100);
    expect(checklist.nextStep).toBeNull();
    expect(checklist.isComplete).toBe(true);
    expect(checklist.estimatedMinutesRemaining).toBe(0);
    const first = checklist.steps[0];
    expect(first.doneAt).toBeInstanceOf(Date);
    expect(first.doneBy).toBe(ADMIN);
  });

  it('marcar fora de ordem vale, mas o próximo passo é o primeiro aberto', () => {
    const svc = service();
    const checklist = svc.completeStep(SCHOOL, 'FIRST_DISMISSAL_DONE', ADMIN);
    expect(checklist.doneCount).toBe(1);
    expect(checklist.progressPercent).toBe(25);
    // A primeira saída foi feita, mas a conta/roster/staff seguem abertos.
    expect(checklist.nextStep).toBe('ACCOUNT_CREATED');
    expect(checklist.isComplete).toBe(false);
  });

  it('marcar 2× o mesmo passo é idempotente: não duplica o evento', () => {
    const svc = service();
    svc.completeStep(SCHOOL, 'ACCOUNT_CREATED', ADMIN);
    svc.completeStep(SCHOOL, 'ACCOUNT_CREATED', 'admin-2');
    const checklist = svc.getChecklist(SCHOOL);
    expect(checklist.doneCount).toBe(1);
    expect(checklist.steps[0].doneBy).toBe(ADMIN); // o 1º registro vence
    expect(svc.listEvents(SCHOOL)).toHaveLength(1);
  });

  it('passo desconhecido vira 400 com a lista de passos válidos', () => {
    expect(() => service().completeStep(SCHOOL, 'PAGAMENTO', ADMIN)).toThrow(
      BadRequestException,
    );
    expect(() => service().completeStep(SCHOOL, 'PAGAMENTO', ADMIN)).toThrow(
      /ACCOUNT_CREATED/,
    );
  });

  it('reabrir um passo derruba o progresso e registra o evento', () => {
    const svc = service();
    svc.completeStep(SCHOOL, 'ACCOUNT_CREATED', ADMIN);
    svc.completeStep(SCHOOL, 'ROSTER_IMPORTED', ADMIN);
    const checklist = svc.reopenStep(SCHOOL, 'ROSTER_IMPORTED', ADMIN);
    expect(checklist.doneCount).toBe(1);
    expect(checklist.progressPercent).toBe(25);
    expect(checklist.nextStep).toBe('ROSTER_IMPORTED');
    expect(svc.listEvents(SCHOOL).map((e) => e.action)).toEqual([
      'COMPLETED',
      'COMPLETED',
      'REOPENED',
    ]);
  });

  it('reabrir passo já aberto não faz nada (sem evento novo)', () => {
    const svc = service();
    svc.reopenStep(SCHOOL, 'ACCOUNT_CREATED', ADMIN);
    expect(svc.getChecklist(SCHOOL).doneCount).toBe(0);
    expect(svc.listEvents(SCHOOL)).toHaveLength(0);
  });

  it('reset da demo recusa escola que não é demo', () => {
    const svc = service();
    svc.completeStep(SCHOOL, 'ACCOUNT_CREATED', ADMIN);
    expect(() => svc.resetDemo(SCHOOL, ADMIN)).toThrow(BadRequestException);
    expect(() => svc.resetDemo(SCHOOL, ADMIN)).toThrow(/demo/);
    // Nada foi zerado pelo reset recusado.
    expect(svc.getChecklist(SCHOOL).doneCount).toBe(1);
  });

  it('escola demo: marca, completa, zera e volta a 0/4 mantendo isDemo', () => {
    const svc = service();
    svc.markAsDemo(SCHOOL, ADMIN);
    svc.completeStep(SCHOOL, 'ACCOUNT_CREATED', ADMIN);
    svc.completeStep(SCHOOL, 'ROSTER_IMPORTED', ADMIN);
    const reset = svc.resetDemo(SCHOOL, ADMIN);
    expect(reset.doneCount).toBe(0);
    expect(reset.progressPercent).toBe(0);
    expect(reset.nextStep).toBe('ACCOUNT_CREATED');
    expect(reset.isComplete).toBe(false);
    expect(reset.isDemo).toBe(true);
    expect(svc.listEvents(SCHOOL).map((e) => e.action)).toEqual([
      'DEMO_MARKED',
      'COMPLETED',
      'COMPLETED',
      'DEMO_RESET',
    ]);
  });

  it('marcar demo 2× é idempotente; eventos não vazam p/ outra escola', () => {
    const svc = service();
    svc.markAsDemo(SCHOOL, ADMIN);
    svc.markAsDemo(SCHOOL, ADMIN);
    svc.completeStep(SCHOOL, 'ACCOUNT_CREATED', ADMIN);
    expect(svc.listEvents(SCHOOL)).toHaveLength(2);
    expect(svc.listEvents(OTHER)).toHaveLength(0);
    expect(svc.getChecklist(OTHER).doneCount).toBe(0);
    expect(svc.getChecklist(OTHER).isDemo).toBe(false);
  });
});
