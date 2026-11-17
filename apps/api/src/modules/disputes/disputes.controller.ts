import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  UnrecognizedReleaseService,
  type ReleaseDisputeOutcome,
} from './release-dispute.service';
import { ReportReleaseDisputeDto } from './dto/report-release-dispute.dto';
import { ResolveReleaseDisputeDto } from './dto/resolve-release-dispute.dto';
import { AddDisputeNoteDto } from './dto/add-dispute-note.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { TenantGuard } from '../auth/tenant.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';

// REST /api/disputes/schools/:schoolId/* — superfície HTTP do
// UnrecognizedReleaseService (o serviço já é o contrato; o controller só
// traduz HTTP p/ os métodos dele, com tenant e papéis impostos pelos
// guards). Ordem dos guards: JwtAuthGuard (401) -> TenantGuard (a sessão é
// da escola da URL) -> RolesGuard (403). O schoolId NUNCA vem do body.
// Papéis por rota:
// - report (contestar): TUTOR — quem recebeu a notificação "seu filho saiu"
//   e não reconhece a saída. A rota `release-disputes/open` é registrada
//   ANTES de `release-disputes/:id` p/ o "open" não ser lido como id.
// - open (fila da secretaria/DPO), get, notes, events, verify-chain:
//   ADMIN/COORDINATOR — a apuração é da gestão; a portaria não apura
//   contestação sozinha.
// - resolve: ADMIN/COORDINATOR, com o user.sub do token como resolvedBy.
// - students/:studentId/release-disputes: TUTOR + staff da portaria/gestão
//   (o tutor acompanha as contestações do filho; a sala não precisa).
// Pendência Step 2 (mesma do PickupController): o vínculo usuário <->
// entidade Tutor ainda não existe no AuthService — o TUTOR hoje passa o
// tutorId no body do report e o guard só confere o papel. Quando a
// persistência entrar, o controller deve resolver o tutorId a partir de
// `user.sub` e recusar tutorId alheio (um tutor não pode contestar a saída
// do filho de outro tutor).
@Controller('disputes/schools/:schoolId')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class DisputesController {
  constructor(private readonly disputes: UnrecognizedReleaseService) {}

  @Roles('TUTOR')
  @Post('release-disputes')
  report(
    @Param('schoolId') schoolId: string,
    @Body() dto: ReportReleaseDisputeDto,
  ) {
    return this.disputes.report({
      schoolId,
      studentId: dto.studentId,
      releaseLogId: dto.releaseLogId,
      tutorId: dto.tutorId,
      note: dto.note,
    });
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Get('release-disputes/open')
  listOpen(@Param('schoolId') schoolId: string) {
    return this.disputes.listOpenForSchool(schoolId);
  }

  @Roles('TUTOR', 'GATE_AGENT', 'COORDINATOR', 'ADMIN')
  @Get('students/:studentId/release-disputes')
  listForStudent(
    @Param('schoolId') schoolId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.disputes.listForStudent(schoolId, studentId);
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Get('release-disputes/:id')
  getOne(@Param('id') id: string) {
    return this.disputes.get(id);
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Post('release-disputes/:id/resolve')
  resolve(
    @Param('id') id: string,
    @Body() dto: ResolveReleaseDisputeDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.disputes.resolve(
      id,
      user.sub,
      dto.outcome as ReleaseDisputeOutcome,
      dto.note,
    );
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Post('release-disputes/:id/notes')
  addNote(
    @Param('id') id: string,
    @Body() dto: AddDisputeNoteDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.disputes.addNote(id, user.sub, dto.note);
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Get('release-disputes/:id/events')
  listEvents(@Param('id') id: string) {
    return this.disputes.listEvents(id);
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Get('release-disputes/:id/verify-chain')
  verifyChain(@Param('id') id: string) {
    return this.disputes.verifyChain(id);
  }
}
