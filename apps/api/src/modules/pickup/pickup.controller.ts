import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PickupService } from './pickup.service';
import { RosterService } from '../roster/roster.service';
import { JoinQueueDto } from './dto/join-queue.dto';
import { ValidateQrDto } from './dto/validate-qr.dto';
import { BlockStudentDto } from './dto/block-student.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { TenantGuard } from '../auth/tenant.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';

// REST /api/pickup/schools/:schoolId/* — superfície HTTP do PickupService
// (o serviço já era o contrato; o controller só traduz HTTP p/ os métodos
// dele, com tenant e papéis impostos pelos guards). Ordem dos guards:
// JwtAuthGuard (401) -> TenantGuard (a sessão é da escola da URL) ->
// RolesGuard (403). O schoolId NUNCA vem do body — é o :schoolId da rota
// ou, quando a rota não tem, a escola da sessão.
// Papéis por rota:
// - join: TUTOR (o próprio tutor entra na fila) ou staff da portaria
//   (GATE_AGENT/COORDINATOR/ADMIN) no modo MANUAL.
// - call/validate-qr/release: só staff da portaria — ninguém se
//   auto-valida nem se auto-libera.
// - cancel: staff da portaria ou o próprio tutor (desistiu de buscar agora).
// - queue (fila ativa): staff da portaria + TEACHER (a sala vê a fila);
//   aceita ?gate= p/ filtrar a fila de UM portão. gates: portões com fila
//   ativa + contagem, p/ o painel montar as colunas por portão.
//   sibling-gate-conflicts: tutores com filhos ativos em portões
//   diferentes — o painel sinaliza o conflito (AuthExit, IDEAS.md c/24).
// - logs/verify-chain/block/unblock: ADMIN/COORDINATOR (auditoria é da
//   gestão; o bloqueio é decisão da secretaria).
// Vínculo usuário <-> Tutor (fechado em 17/11/2026): quem entra com
// papel TUTOR tem o tutorId RESOLVIDO da sessão (vínculo feito pela
// secretaria, RosterService.setTutorUserId) — o tutorId do body é
// ignorado p/ esse papel, então um tutor não entra na fila por outro
// nem cancela a retirada de outro. A equipe da portaria segue
// informando o tutorId (é ela que lança a entrada manual). A
// superfície própria do responsável é o TutorMeController (/me).
@Controller('pickup/schools/:schoolId')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class PickupController {
  constructor(
    private readonly pickup: PickupService,
    private readonly roster: RosterService,
  ) {}

  private isTutorOnly(user: AccessTokenPayload): boolean {
    return (
      user.roles.includes('TUTOR') &&
      !user.roles.some((r) => r === 'GATE_AGENT' || r === 'COORDINATOR' || r === 'ADMIN')
    );
  }

  private ownTutorId(schoolId: string, user: AccessTokenPayload): string {
    const tutor = this.roster.getTutorByUserId(schoolId, user.sub);
    if (!tutor) {
      throw new ForbiddenException(
        'Sua conta ainda não foi vinculada a um responsável desta escola. Peça à secretaria para vincular o seu e-mail na área da escola.',
      );
    }
    return tutor.id;
  }

  @Roles('TUTOR', 'GATE_AGENT', 'COORDINATOR', 'ADMIN')
  @Post('queue/join')
  join(
    @Param('schoolId') schoolId: string,
    @Body() dto: JoinQueueDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    const tutorId = this.isTutorOnly(user)
      ? this.ownTutorId(schoolId, user)
      : dto.tutorId;
    return this.pickup.join({
      schoolId,
      studentId: dto.studentId,
      tutorId,
      authorizationId: dto.authorizationId,
      source: dto.source,
      gate: dto.gate,
    });
  }

  @Roles('GATE_AGENT', 'COORDINATOR', 'ADMIN')
  @Post('queue/:entryId/call')
  call(
    @Param('entryId') entryId: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.pickup.call(entryId, user.sub);
  }

  @Roles('GATE_AGENT', 'COORDINATOR', 'ADMIN')
  @Post('queue/:entryId/validate-qr')
  async validateQr(
    @Param('entryId') entryId: string,
    @Body() dto: ValidateQrDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.pickup.validateQr(entryId, dto.token, user.sub);
  }

  @Roles('GATE_AGENT', 'COORDINATOR', 'ADMIN')
  @Post('queue/:entryId/release')
  release(
    @Param('entryId') entryId: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.pickup.release(entryId, user.sub);
  }

  @Roles('TUTOR', 'GATE_AGENT', 'COORDINATOR', 'ADMIN')
  @Post('queue/:entryId/cancel')
  cancel(
    @Param('schoolId') schoolId: string,
    @Param('entryId') entryId: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    if (this.isTutorOnly(user)) {
      const entry = this.pickup.getEntry(entryId);
      if (
        !entry ||
        entry.schoolId !== schoolId ||
        entry.tutorId !== this.ownTutorId(schoolId, user)
      ) {
        throw new NotFoundException('Entrada da fila não encontrada.');
      }
    }
    return this.pickup.cancel(entryId, user.sub);
  }

  @Roles('GATE_AGENT', 'COORDINATOR', 'ADMIN', 'TEACHER')
  @Get('queue')
  queue(@Param('schoolId') schoolId: string, @Query('gate') gate?: string) {
    return this.pickup.listActiveForSchool(schoolId, gate);
  }

  // Portões com fila ativa agora + contagem por portão — o painel da
  // portaria monta as colunas por portão (e a visão "toda a escola") a
  // partir daqui. TEACHER vê p/ saber p/ qual portão mandar o aluno.
  @Roles('GATE_AGENT', 'COORDINATOR', 'ADMIN', 'TEACHER')
  @Get('gates')
  gates(@Param('schoolId') schoolId: string) {
    return this.pickup.listGates(schoolId);
  }

  // Tutores com filhos ativos em portões diferentes — o painel sinaliza
  // o conflito p/ ninguém esperar no portão errado (o tutor vê o alerta
  // e a portaria decide p/ qual portão mandar os dois).
  @Roles('GATE_AGENT', 'COORDINATOR', 'ADMIN', 'TEACHER')
  @Get('sibling-gate-conflicts')
  siblingGateConflicts(@Param('schoolId') schoolId: string) {
    return this.pickup.listSiblingGateConflicts(schoolId);
  }

  @Roles('TUTOR', 'GATE_AGENT', 'COORDINATOR', 'ADMIN', 'TEACHER')
  @Get('students/:studentId/queue')
  studentQueue(
    @Param('schoolId') schoolId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.pickup.listForStudent(schoolId, studentId);
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Get('logs')
  logs(@Param('schoolId') schoolId: string) {
    return this.pickup.listLogs(schoolId);
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Get('logs/verify-chain')
  verifyChain(@Param('schoolId') schoolId: string) {
    return this.pickup.verifyChain(schoolId);
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Post('students/:studentId/block')
  block(
    @Param('schoolId') schoolId: string,
    @Param('studentId') studentId: string,
    @Body() dto: BlockStudentDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    this.pickup.block(schoolId, studentId, dto.reason, user.sub);
    return { ok: true, blocked: true };
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Post('students/:studentId/unblock')
  unblock(
    @Param('schoolId') schoolId: string,
    @Param('studentId') studentId: string,
  ) {
    this.pickup.unblock(schoolId, studentId);
    return { ok: true, blocked: false };
  }
}
