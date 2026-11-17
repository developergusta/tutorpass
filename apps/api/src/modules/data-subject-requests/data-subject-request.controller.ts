import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { DataSubjectRequestService } from './data-subject-request.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { TenantGuard } from '../auth/tenant.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { OpenDataSubjectRequestDto } from './dto/open-request.dto';
import { FulfillRequestDto } from './dto/fulfill-request.dto';
import { DenyRequestDto } from './dto/deny-request.dto';
import { RequestNoteDto } from './dto/request-note.dto';
import { SimplifiedAccessDto } from './dto/simplified-access.dto';

// REST /api/data-subject-requests/schools/:schoolId/* — superfície HTTP do
// DataSubjectRequestService (o serviço já é o contrato; o controller só
// traduz HTTP p/ os métodos dele, com tenant e papéis impostos pelos guards).
// Ordem dos guards: JwtAuthGuard (401) -> TenantGuard (a sessão é da
// escola da URL) -> RolesGuard (403). O schoolId NUNCA vem do body — é
// o :schoolId da rota; o actorId de cada ação é o user.sub do token.
// Papéis por rota: só ADMIN/COORDINATOR — o pedido é decisão do DPO e da
// secretaria (a escola é a controladora; o TutorPass é a operadora e nunca
// decide sozinho sobre dado de aluno). A portaria e a sala não abrem,
// verificam nem atendem pedidos de direitos do titular.
// Rotas de fila p/ o DPO: GET overdue (declaração completa vencida) e
// GET simplified-access-pending (o "imediato" do art. 19, I, ainda pendente).
@Controller('data-subject-requests/schools/:schoolId')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class DataSubjectRequestController {
  constructor(private readonly requests: DataSubjectRequestService) {}

  @Roles('ADMIN', 'COORDINATOR')
  @Post()
  open(
    @Param('schoolId') schoolId: string,
    @Body() dto: OpenDataSubjectRequestDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.requests.open({
      schoolId,
      subjectId: dto.subjectId,
      subjectType: dto.subjectType,
      requestedBy: user.sub,
      channel: dto.channel,
      type: dto.type,
      details: dto.details,
    });
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Get()
  list(@Param('schoolId') schoolId: string) {
    return this.requests.listForSchool(schoolId);
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Get('overdue')
  listOverdue() {
    return this.requests.listOverdue();
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Get('simplified-access-pending')
  listSimplifiedAccessPending() {
    return this.requests.listSimplifiedAccessPending();
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Get(':id')
  get(@Param('id') id: string) {
    return this.requests.get(id);
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Get(':id/events')
  listEvents(@Param('id') id: string) {
    return this.requests.listEvents(id);
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Post(':id/verify-identity')
  verifyIdentity(@Param('id') id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.requests.verifyIdentity(id, user.sub);
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Post(':id/simplified-access')
  provideSimplifiedAccess(
    @Param('id') id: string,
    @Body() dto: SimplifiedAccessDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.requests.provideSimplifiedAccess(id, user.sub, dto.summary);
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Post(':id/start')
  startProcessing(@Param('id') id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.requests.startProcessing(id, user.sub);
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Post(':id/fulfill')
  fulfill(
    @Param('id') id: string,
    @Body() dto: FulfillRequestDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.requests.fulfill(id, user.sub, { outcome: dto.outcome, note: dto.note });
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Post(':id/deny')
  deny(
    @Param('id') id: string,
    @Body() dto: DenyRequestDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.requests.deny(id, user.sub, dto.reason);
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.requests.cancel(id, user.sub);
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Post(':id/note')
  addNote(
    @Param('id') id: string,
    @Body() dto: RequestNoteDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.requests.addNote(id, user.sub, dto.note);
  }
}
