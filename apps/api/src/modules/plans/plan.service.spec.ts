import { PlanService, PLAN_DEFINITIONS, TRIAL_DAYS } from './plan.service';

describe('PlanService — tier gratuito + trial sem cartão', () => {
  const day = 86_400_000;
  const now = new Date('2026-11-17T01:30:00-03:00');
  let service: PlanService;

  beforeEach(() => {
    service = new PlanService();
  });

  it('escola nova entra no FREE: 30 alunos, 5 staff, fila + QR + relatório diário', () => {
    const plan = service.createFree('school-1', now);
    expect(plan.tier).toBe('FREE');
    expect(plan.trialEndsAt).toBeNull();
    expect(PLAN_DEFINITIONS.FREE.maxStudents).toBe(30);
    expect(PLAN_DEFINITIONS.FREE.maxStaff).toBe(5);
    expect(service.hasFeature(plan, 'REALTIME_QUEUE', now)).toBe(true);
    expect(service.hasFeature(plan, 'DYNAMIC_QR', now)).toBe(true);
    expect(service.hasFeature(plan, 'DAILY_EMAIL_REPORT', now)).toBe(true);
    expect(service.hasFeature(plan, 'TV_MODE', now)).toBe(false);
    expect(service.hasFeature(plan, 'ETA_LIVE', now)).toBe(false);
    expect(service.monthlyPriceBRL(plan, 30, now)).toBe(0);
    expect(service.daysRemaining(plan, now)).toBeNull(); // FREE não expira
  });

  it('createFree é idempotente por escola', () => {
    const a = service.createFree('school-1', now);
    expect(service.createFree('school-1', now)).toBe(a);
    expect(service.list()).toHaveLength(1);
  });

  it('FREE: 30º aluno cabe, 31º é bloqueado com motivo de upgrade', () => {
    const plan = service.createFree('school-1', now);
    expect(service.canAddStudent(plan, 29, now).allowed).toBe(true);
    expect(service.canAddStudent(plan, 30, now).allowed).toBe(false);
    expect(service.canAddStudent(plan, 30, now).reason).toMatch(/Limite do plano FREE.*30 alunos/);
  });

  it('FREE: 5º staff cabe, 6º é bloqueado', () => {
    const plan = service.createFree('school-1', now);
    expect(service.canAddStaff(plan, 4, now).allowed).toBe(true);
    expect(service.canAddStaff(plan, 5, now).allowed).toBe(false);
    expect(service.canAddStaff(plan, 5, now).reason).toMatch(/5 staff/);
  });

  it('trial: 30 dias sem cartão, limites e features do PRO durante o trial', () => {
    const plan = service.startTrial('school-1', now);
    expect(plan.tier).toBe('TRIAL');
    expect(plan.trialUsed).toBe(true);
    expect(plan.trialEndsAt).toEqual(new Date(now.getTime() + TRIAL_DAYS * day));
    expect(service.daysRemaining(plan, now)).toBe(30);
    expect(service.canAddStudent(plan, 500, now).allowed).toBe(true);
    expect(service.hasFeature(plan, 'ETA_LIVE', now)).toBe(true);
    expect(service.hasFeature(plan, 'VAN_MODULE', now)).toBe(true);
    expect(service.monthlyPriceBRL(plan, 100, now)).toBe(0);
  });

  it('startTrial no trial ativo não estende o prazo (idempotente)', () => {
    const plan = service.startTrial('school-1', now);
    const again = service.startTrial('school-1', new Date(now.getTime() + 10 * day));
    expect(again).toBe(plan);
    expect(again.trialEndsAt).toEqual(new Date(now.getTime() + TRIAL_DAYS * day));
  });

  it('trial vencido conta como FREE até o refresh: perde features e limites do PRO', () => {
    const plan = service.startTrial('school-1', now);
    const after = new Date(now.getTime() + 31 * day);
    expect(service.effectiveTier(plan, after)).toBe('FREE');
    expect(service.daysRemaining(plan, after)).toBe(0);
    expect(service.hasFeature(plan, 'ETA_LIVE', after)).toBe(false);
    expect(service.canAddStudent(plan, 30, after).allowed).toBe(false);
    expect(service.monthlyPriceBRL(plan, 100, after)).toBe(0);
  });

  it('refresh downgradeia trial vencido p/ FREE e é idempotente', () => {
    const plan = service.startTrial('school-1', now);
    const after = new Date(now.getTime() + 31 * day);
    expect(service.refresh(plan, after)).toBe(true);
    expect(plan.tier).toBe('FREE');
    expect(plan.trialEndsAt).toBeNull();
    expect(plan.trialUsed).toBe(true); // histórico: não ganha outro trial
    expect(service.refresh(plan, after)).toBe(false);
  });

  it('refreshAll downgradeia só os trials vencidos', () => {
    service.startTrial('school-1', now);
    service.startTrial('school-2', new Date(now.getTime() + 20 * day)); // vence depois
    const after = new Date(now.getTime() + 31 * day);
    const downgraded = service.refreshAll(after);
    expect(downgraded).toHaveLength(1);
    expect(downgraded[0].schoolId).toBe('school-1');
    expect(service.get('school-2')!.tier).toBe('TRIAL');
  });

  it('2º trial na mesma escola é rejeitado (1 por escola)', () => {
    service.startTrial('school-1', now);
    const after = new Date(now.getTime() + 31 * day);
    service.refresh(service.get('school-1')!, after);
    expect(() => service.startTrial('school-1', after)).toThrow(/já utilizado/);
  });

  it('PRO: mensalidade fixa por faixa de alunos, sem expiração, todas as features', () => {
    const plan = service.createFree('school-1', now);
    plan.tier = 'PRO'; // upgrade via Stripe no Step 2; aqui só valida a definição
    expect(service.monthlyPriceBRL(plan, 1, now)).toBe(89);
    expect(service.monthlyPriceBRL(plan, 50, now)).toBe(89);
    expect(service.monthlyPriceBRL(plan, 51, now)).toBe(199);
    expect(service.monthlyPriceBRL(plan, 100, now)).toBe(199);
    expect(service.monthlyPriceBRL(plan, 200, now)).toBe(199);
    expect(service.monthlyPriceBRL(plan, 201, now)).toBe(349);
    expect(service.monthlyPriceBRL(plan, 2000, now)).toBe(349);
    expect(service.daysRemaining(plan, now)).toBeNull();
    expect(service.canAddStudent(plan, 1999, now).allowed).toBe(true);
    expect(service.canAddStudent(plan, 2000, now).allowed).toBe(false);
    expect(service.hasFeature(plan, 'ADVANCED_REPORTS', now)).toBe(true);
  });

  it('FREE e TRIAL não pagam mensalidade em nenhuma faixa', () => {
    const free = service.createFree('school-1', now);
    expect(service.monthlyPriceBRL(free, 30, now)).toBe(0);
    const trial = service.startTrial('school-2', now);
    expect(service.monthlyPriceBRL(trial, 500, now)).toBe(0);
  });

  it('escola PRO não volta p/ trial', () => {
    const plan = service.createFree('school-1', now);
    plan.tier = 'PRO';
    expect(() => service.startTrial('school-1', now)).toThrow(/já é PRO/);
  });
});
