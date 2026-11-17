import { BadRequestException, Injectable } from '@nestjs/common';

// Checklist de implantação em 1 dia + escola demo que zera — ver
// docs/product/IDEAS.md, frente d (ciclo 25):
// DismissPro (2026) começa em 4 passos — cadastro em ~1 min, subir a
// planilha (template CSV), compartilhar School ID + senha do staff, abrir
// no navegador sem instalar nada — e tem uma demo pública que zera toda
// manhã p/ experimentar sem medo. YESS (2026) abre a escola em 24 h em 5
// passos testados com escolas reais. Attendzy (2026): o setup é uma lista
// de 4 itens que some quando acaba — "guided setup that gets out of the
// way". Foundation Roster (2026): "a pior parte do software novo são os
// primeiros 5 minutos" — tela em branco mata a adoção; a escola demo com
// dados (seed) é o antídoto.
// Regras de produto:
// - A ordem é o contrato: conta -> roster (CSV) -> convite do staff ->
//   primeira saída. O checklist guia a escola nessa ordem e some quando
//   zera (nada de tela de configurações disfarçada de setup).
// - O passo só é marcado por quem fez (actorId = user.sub do token) e com
//   data/hora — o checklist é também a prova de que a implantação de 1 dia
//   aconteceu, não só um progresso de UI.
// - Marcar é idempotente (re-marcar não duplica evento); reabrir um passo
//   é explícito (a secretaria pode refazer o roster, por exemplo) e fica
//   registrado no rastro de eventos.
// - A escola demo é a única que zera: resetDemo recusa qualquer escola
//   que não esteja marcada como demo — zerar a escola errada apagaria o
//   progresso real de implantação de um cliente. O job diário (06:00,
//   Step 2) chama resetDemo na demo; aqui só existe o método + a guarda.
// - Nada aqui inventa estado: sem passo marcado, o checklist diz 0/4.
//   A integração automática (Step 2) marca os passos a partir dos
//   serviços — RosterService.importStudents -> ROSTER_IMPORTED,
//   AuthService.register de staff -> STAFF_INVITED,
//   PickupService.release -> FIRST_DISMISSAL_DONE — mas nunca por
//   adivinhação: sem o evento real, o passo fica aberto.
// Integração Step 2: persistir o checklist (modelo OnboardingChecklist no
// schema, com os eventos) e o job diário de reset da demo.

/** Um passo do checklist de implantação — ordem fixa, tempos do runbook. */
export interface OnboardingStepDefinition {
  id: OnboardingStepId;
  title: string;
  description: string;
  /** Minutos estimados p/ a escola executar o passo (runbook). */
  minutes: number;
}

export type OnboardingStepId =
  | 'ACCOUNT_CREATED'
  | 'ROSTER_IMPORTED'
  | 'STAFF_INVITED'
  | 'FIRST_DISMISSAL_DONE';

/** Os 4 passos, na ordem em que a escola os executa no dia 1. */
export const ONBOARDING_STEPS: readonly OnboardingStepDefinition[] = [
  {
    id: 'ACCOUNT_CREATED',
    title: 'Conta da escola criada',
    description:
      'Cadastro em ~3 min: nome, CNPJ e contato. O tenant já nasce com papéis, ano letivo e trial de 30 dias.',
    minutes: 3,
  },
  {
    id: 'ROSTER_IMPORTED',
    title: 'Alunos importados do CSV',
    description:
      'Baixar o template, preencher e importar; a prévia (dryRun) mostra os erros por linha antes de salvar.',
    minutes: 15,
  },
  {
    id: 'STAFF_INVITED',
    title: 'Equipe convidada',
    description:
      'Portaria, salas e coordenação com credencial. O ADMIN já tem 2FA obrigatório.',
    minutes: 5,
  },
  {
    id: 'FIRST_DISMISSAL_DONE',
    title: 'Primeira saída realizada',
    description:
      'Um tutor entra na fila, a portaria chama e libera. A fila, o telão e o log já funcionam de verdade.',
    minutes: 30,
  },
] as const;

export interface OnboardingStepState extends OnboardingStepDefinition {
  done: boolean;
  doneAt: Date | null;
  doneBy: string | null;
}

export interface OnboardingChecklist {
  schoolId: string;
  steps: OnboardingStepState[];
  doneCount: number;
  totalCount: number;
  /** 0–100, arredondado — sem passo feito, 0 (nunca "quase lá" inventado). */
  progressPercent: number;
  /** Primeiro passo aberto, na ordem do runbook — null quando zerou. */
  nextStep: OnboardingStepId | null;
  isComplete: boolean;
  estimatedMinutesTotal: number;
  estimatedMinutesRemaining: number;
  /** Escola demo: a única que o reset diário pode zerar. */
  isDemo: boolean;
}

export type OnboardingEventAction =
  | 'COMPLETED'
  | 'REOPENED'
  | 'DEMO_MARKED'
  | 'DEMO_RESET';

/** Rastro de quem marcou/reabriu/zerou o quê — só ids, sem dado pessoal. */
export interface OnboardingEvent {
  schoolId: string;
  step: OnboardingStepId | 'DEMO';
  action: OnboardingEventAction;
  actorId: string;
  at: Date;
}

interface SchoolOnboardingState {
  steps: Map<OnboardingStepId, { doneAt: Date; doneBy: string }>;
  isDemo: boolean;
}

@Injectable()
export class OnboardingService {
  private readonly states = new Map<string, SchoolOnboardingState>();
  private readonly events: OnboardingEvent[] = [];

  getChecklist(schoolId: string): OnboardingChecklist {
    const state = this.stateFor(schoolId);
    const steps: OnboardingStepState[] = ONBOARDING_STEPS.map((def) => {
      const done = state.steps.get(def.id);
      return {
        ...def,
        done: Boolean(done),
        doneAt: done ? done.doneAt : null,
        doneBy: done ? done.doneBy : null,
      };
    });
    const doneCount = steps.filter((s) => s.done).length;
    const totalCount = steps.length;
    const next = steps.find((s) => !s.done);
    return {
      schoolId,
      steps,
      doneCount,
      totalCount,
      progressPercent: Math.round((doneCount / totalCount) * 100),
      nextStep: next ? next.id : null,
      isComplete: doneCount === totalCount,
      estimatedMinutesTotal: ONBOARDING_STEPS.reduce((n, s) => n + s.minutes, 0),
      estimatedMinutesRemaining: steps
        .filter((s) => !s.done)
        .reduce((n, s) => n + s.minutes, 0),
      isDemo: state.isDemo,
    };
  }

  completeStep(
    schoolId: string,
    stepId: string,
    actorId: string,
  ): OnboardingChecklist {
    const step = this.requireStep(stepId);
    const state = this.stateFor(schoolId);
    // Idempotente: re-marcar um passo já feito não duplica o evento.
    if (!state.steps.has(step.id)) {
      state.steps.set(step.id, { doneAt: new Date(), doneBy: actorId });
      this.events.push({
        schoolId,
        step: step.id,
        action: 'COMPLETED',
        actorId,
        at: new Date(),
      });
    }
    return this.getChecklist(schoolId);
  }

  reopenStep(
    schoolId: string,
    stepId: string,
    actorId: string,
  ): OnboardingChecklist {
    const step = this.requireStep(stepId);
    const state = this.stateFor(schoolId);
    if (state.steps.delete(step.id)) {
      this.events.push({
        schoolId,
        step: step.id,
        action: 'REOPENED',
        actorId,
        at: new Date(),
      });
    }
    return this.getChecklist(schoolId);
  }

  markAsDemo(schoolId: string, actorId: string): OnboardingChecklist {
    const state = this.stateFor(schoolId);
    if (!state.isDemo) {
      state.isDemo = true;
      this.events.push({
        schoolId,
        step: 'DEMO',
        action: 'DEMO_MARKED',
        actorId,
        at: new Date(),
      });
    }
    return this.getChecklist(schoolId);
  }

  /** Zera o checklist da escola demo (job diário das 06:00, Step 2). */
  resetDemo(schoolId: string, actorId: string): OnboardingChecklist {
    const state = this.stateFor(schoolId);
    if (!state.isDemo) {
      throw new BadRequestException(
        'Só a escola demo pode ser zerada — marque a escola como demo antes de resetar.',
      );
    }
    state.steps.clear();
    this.events.push({
      schoolId,
      step: 'DEMO',
      action: 'DEMO_RESET',
      actorId,
      at: new Date(),
    });
    return this.getChecklist(schoolId);
  }

  listEvents(schoolId: string): OnboardingEvent[] {
    return this.events.filter((e) => e.schoolId === schoolId);
  }

  private stateFor(schoolId: string): SchoolOnboardingState {
    let state = this.states.get(schoolId);
    if (!state) {
      state = { steps: new Map(), isDemo: false };
      this.states.set(schoolId, state);
    }
    return state;
  }

  private requireStep(stepId: string): OnboardingStepDefinition {
    const step = ONBOARDING_STEPS.find((s) => s.id === stepId);
    if (!step) {
      throw new BadRequestException(
        `Passo de onboarding desconhecido: ${stepId}. Passos válidos: ${ONBOARDING_STEPS.map((s) => s.id).join(', ')}.`,
      );
    }
    return step;
  }
}
