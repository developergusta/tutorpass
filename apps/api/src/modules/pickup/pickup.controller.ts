import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PickupService } from './pickup.service';
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
// - logs/verify-chain/block/unblock: ADMIN/COORDINATOR (auditoria é da
//   gestão; o bloqueio é decisão da secretaria).
// Pendência Step 2 (anotada aqui e no README do módulo): o vínculo
// usuário <-> entidade Tutor ainda não existe no AuthService — o TUTOR
// hoje passa o tutorId no body do join/cancel e o guard só confere o
// papel. Quando a persistência entrar, o controller deve resolver o
// tutorId a partir de `user.sub` e recusar tutorId alheio (um tutor não
// pode entrar na fila por outro tutor nem cancelar a retirada de outro).
@Controller('pickup/schools/:schoolId')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class PickupController {
  constructor(private readonly pickup: PickupService) {}

  @Roles('TUTOR', 'GATE_AGENT', 'COORDINATOR', 'ADMIN')
  @Post('queue/join')
  join(
    @Param('schoolId') schoolId: string,
    @Body() dto: JoinQueueDto,
  ) {
    return this.pickup.join({
      schoolId,
      studentId: dto.studentId,
      tutorId: dto.tutorId,
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
    @Param('entryId') entryId: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
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
