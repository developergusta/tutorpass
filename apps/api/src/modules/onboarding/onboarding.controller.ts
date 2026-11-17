import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { TenantGuard } from '../auth/tenant.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';

// REST /api/onboarding/schools/:schoolId/* — superfície HTTP do
// OnboardingService (o serviço já é o contrato; o controller só traduz
// HTTP p/ os métodos dele, com tenant e papéis impostos pelos guards).
// Ordem dos guards: JwtAuthGuard (401) -> TenantGuard (a sessão é da
// escola da URL) -> RolesGuard (403). O schoolId NUNCA vem do body — é
// o :schoolId da rota; o actorId de cada ação é o user.sub do token.
// Papéis por rota:
// - checklist (GET): gestão + portaria + sala — todo mundo que trabalha
//   na implantação precisa ver o que falta.
// - steps/:step/complete e reopen: ADMIN/COORDINATOR (a implantação é
//   decisão da secretaria; a portaria executa a saída, não o setup).
// - demo/mark e demo/reset: só ADMIN — zerar a demo errada apaga o
//   progresso real de implantação de um cliente (o serviço recusa o
//   reset de escola não-demo, mas a rota nem chega a ser chamada).
@Controller('onboarding/schools/:schoolId')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Roles('ADMIN', 'COORDINATOR', 'GATE_AGENT', 'TEACHER')
  @Get('checklist')
  checklist(@Param('schoolId') schoolId: string) {
    return this.onboarding.getChecklist(schoolId);
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Post('steps/:step/complete')
  completeStep(
    @Param('schoolId') schoolId: string,
    @Param('step') step: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.onboarding.completeStep(schoolId, step, user.sub);
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Post('steps/:step/reopen')
  reopenStep(
    @Param('schoolId') schoolId: string,
    @Param('step') step: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.onboarding.reopenStep(schoolId, step, user.sub);
  }

  @Roles('ADMIN')
  @Post('demo/mark')
  markAsDemo(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.onboarding.markAsDemo(schoolId, user.sub);
  }

  @Roles('ADMIN')
  @Post('demo/reset')
  resetDemo(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.onboarding.resetDemo(schoolId, user.sub);
  }
}
