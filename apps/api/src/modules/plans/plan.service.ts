import { BadRequestException, Injectable } from '@nestjs/common';
// Tier gratuito limitado + trial sem cartão (aquisição — ver docs/product/IDEAS.md, frentes a/b).
// Benchmark (nov/2026): Skolar (BR) publica R$ 179–379/mês por faixa de alunos (até 20/100/200),
// 30 dias grátis sem cartão, PIX, sem fidelidade; gringos cobram US$ 4–12/aluno/ano
// (maioria US$ 6–8) e quase todos são "sob consulta" — preço publicado em R$ é diferencial.
// Preço de lançamento TutorPass (modelo de faixas CONFIRMADO pelo usuário em 17/11/2026):
// - FREE: R$ 0 p/ sempre, até 30 alunos e 5 staff, fila realtime + QR dinâmico + relatório diário.
// - TRIAL: 30 dias sem cartão, limites e features do PRO; 1 trial por escola (não renova).
// - PRO: mensalidade FIXA por faixa de alunos (não é por aluno): até 50 alunos R$ 89/mês;
//   51–200 alunos R$ 199/mês; acima de 200 alunos R$ 349/mês (acima de 1.000, sob consulta).
//   Até 2.000 alunos e 50 staff, todas as features. Faixa fixa é o modelo das suítes BR
//   (Skolar publica R$ 179–379/mês por faixa) — a escola sabe quanto paga sem fazer conta.
// Step 2: trocar o store in-memory por Prisma (SchoolPlan, já no schema) e cobrar via Stripe
// (o checkout Stripe já foi aprovado p/ o MinducoLabs — mesmo fluxo de conexão).

export type PlanTier = 'FREE' | 'TRIAL' | 'PRO';

export type PlanFeature =
  | 'REALTIME_QUEUE'
  | 'DYNAMIC_QR'
  | 'DAILY_EMAIL_REPORT'
  | 'EARLY_PICKUP'
  | 'TV_MODE'
  | 'VAN_MODULE'
  | 'ETA_LIVE'
  | 'PRIORITY_QUEUE'
  | 'ADVANCED_REPORTS';

export const TRIAL_DAYS = 30;

/** Faixas do PRO: mensalidade fixa por nº de alunos (confirmado pelo usuário em 17/11/2026). */
export const PRO_PRICE_BANDS_BRL: { maxStudents: number; monthlyBRL: number }[] = [
  { maxStudents: 50, monthlyBRL: 89 },
  { maxStudents: 200, monthlyBRL: 199 },
  { maxStudents: Number.POSITIVE_INFINITY, monthlyBRL: 349 },
];

/** Mensalidade do PRO p/ um nº de alunos (pela faixa; 0 alunos cai na 1ª faixa). */
export function proMonthlyPriceBRL(studentCount: number): number {
  const band = PRO_PRICE_BANDS_BRL.find((b) => studentCount <= b.maxStudents);
  return band ? band.monthlyBRL : PRO_PRICE_BANDS_BRL[PRO_PRICE_BANDS_BRL.length - 1].monthlyBRL;
}

const ALL_FEATURES: PlanFeature[] = [
  'REALTIME_QUEUE',
  'DYNAMIC_QR',
  'DAILY_EMAIL_REPORT',
  'EARLY_PICKUP',
  'TV_MODE',
  'VAN_MODULE',
  'ETA_LIVE',
  'PRIORITY_QUEUE',
  'ADVANCED_REPORTS',
];

export interface PlanDefinition {
  tier: PlanTier;
  maxStudents: number;
  maxStaff: number;
  features: PlanFeature[];
}

export const PLAN_DEFINITIONS: Record<PlanTier, PlanDefinition> = {
  FREE: {
    tier: 'FREE',
    maxStudents: 30,
    maxStaff: 5,
    features: ['REALTIME_QUEUE', 'DYNAMIC_QR', 'DAILY_EMAIL_REPORT'],
  },
  TRIAL: {
    tier: 'TRIAL',
    maxStudents: 2000,
    maxStaff: 50,
    features: [...ALL_FEATURES],
  },
  PRO: {
    tier: 'PRO',
    maxStudents: 2000,
    maxStaff: 50,
    features: [...ALL_FEATURES],
  },
};

export interface SchoolPlan {
  id: string;
  schoolId: string;
  tier: PlanTier;
  trialEndsAt: Date | null;
  trialUsed: boolean;
  startedAt: Date;
  updatedAt: Date;
}

export interface LimitCheck {
  allowed: boolean;
  reason?: string;
}

let seq = 0;

@Injectable()
export class PlanService {
  private plans: SchoolPlan[] = [];

  /** Escola nova entra no FREE (sem cartão, sem expiração). Idempotente por escola. */
  createFree(schoolId: string, now: Date = new Date()): SchoolPlan {
    const existing = this.plans.find((p) => p.schoolId === schoolId);
    if (existing) return existing;
    const plan: SchoolPlan = {
      id: `plan-${++seq}-${Date.now()}`,
      schoolId,
      tier: 'FREE',
      trialEndsAt: null,
      trialUsed: false,
      startedAt: now,
      updatedAt: now,
    };
    this.plans.push(plan);
    return plan;
  }

  /**
   * Inicia o trial de 30 dias sem cartão. Regras: só 1 trial por escola; escola PRO não
   * volta p/ trial; trial ativo não estende o prazo (idempotente). Cria o plano FREE antes
   * se a escola ainda não tiver plano.
   */
  startTrial(schoolId: string, now: Date = new Date()): SchoolPlan {
    const plan = this.createFree(schoolId, now);
    if (plan.tier === 'PRO') {
      throw new BadRequestException('Escola já é PRO — trial não se aplica a assinante pagante');
    }
    if (plan.tier === 'TRIAL' && plan.trialEndsAt && now < plan.trialEndsAt) return plan;
    if (plan.trialUsed) {
      throw new BadRequestException('Trial de 30 dias já utilizado por esta escola (1 por escola)');
    }
    plan.tier = 'TRIAL';
    plan.trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 86_400_000);
    plan.trialUsed = true;
    plan.updatedAt = now;
    return plan;
  }

  /** Tier que vale agora: trial vencido conta como FREE (o downgrade é feito por refresh()). */
  effectiveTier(plan: SchoolPlan, now: Date = new Date()): PlanTier {
    if (plan.tier === 'TRIAL' && plan.trialEndsAt && now >= plan.trialEndsAt) return 'FREE';
    return plan.tier;
  }

  /** Dias restantes de trial (null = sem expiração: FREE p/ sempre ou PRO ativo). */
  daysRemaining(plan: SchoolPlan, now: Date = new Date()): number | null {
    if (plan.tier !== 'TRIAL' || !plan.trialEndsAt) return null;
    return Math.max(0, Math.ceil((plan.trialEndsAt.getTime() - now.getTime()) / 86_400_000));
  }

  /**
   * Aplica o downgrade de trial vencido p/ FREE. Idempotente — devolve true só quando mudou
   * algo. No Step 2 vira job diário (@nestjs/schedule, ex.: 03:00, junto ao expurgo LGPD).
   */
  refresh(plan: SchoolPlan, now: Date = new Date()): boolean {
    if (this.effectiveTier(plan, now) !== plan.tier) {
      plan.tier = 'FREE';
      plan.trialEndsAt = null;
      plan.updatedAt = now;
      return true;
    }
    return false;
  }

  /** Downgrade de todos os trials vencidos; devolve só os que mudaram. */
  refreshAll(now: Date = new Date()): SchoolPlan[] {
    return this.plans.filter((p) => this.refresh(p, now));
  }

  private definition(plan: SchoolPlan, now: Date): PlanDefinition {
    return PLAN_DEFINITIONS[this.effectiveTier(plan, now)];
  }

  /** Pode cadastrar mais um aluno? (limite do tier efetivo — trial vencido usa o FREE). */
  canAddStudent(plan: SchoolPlan, currentStudents: number, now: Date = new Date()): LimitCheck {
    const def = this.definition(plan, now);
    if (currentStudents < def.maxStudents) return { allowed: true };
    return {
      allowed: false,
      reason: `Limite do plano ${def.tier} atingido (${def.maxStudents} alunos) — faça upgrade p/ PRO`,
    };
  }

  /** Pode convidar mais um staff? */
  canAddStaff(plan: SchoolPlan, currentStaff: number, now: Date = new Date()): LimitCheck {
    const def = this.definition(plan, now);
    if (currentStaff < def.maxStaff) return { allowed: true };
    return {
      allowed: false,
      reason: `Limite do plano ${def.tier} atingido (${def.maxStaff} staff) — faça upgrade p/ PRO`,
    };
  }

  /** Feature liberada no tier efetivo? */
  hasFeature(plan: SchoolPlan, feature: PlanFeature, now: Date = new Date()): boolean {
    return this.definition(plan, now).features.includes(feature);
  }

  /** Mensalidade em R$ (FREE e TRIAL: 0; PRO: valor fixo da faixa do nº de alunos). */
  monthlyPriceBRL(plan: SchoolPlan, studentCount: number, now: Date = new Date()): number {
    if (this.effectiveTier(plan, now) !== 'PRO') return 0;
    return proMonthlyPriceBRL(studentCount);
  }

  get(schoolId: string): SchoolPlan | undefined {
    return this.plans.find((p) => p.schoolId === schoolId);
  }

  list(): SchoolPlan[] {
    return [...this.plans];
  }
}
