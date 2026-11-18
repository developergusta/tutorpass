import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PickupService, type PickupQueueEntry } from './pickup.service';
import { RosterService, type TutorRecord } from '../roster/roster.service';
import { QrTokenService } from '../qr/qr-token.service';
import { JoinMineDto } from './dto/join-mine.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { TenantGuard } from '../auth/tenant.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';

// A área do responsável (17/11/2026): até aqui a conta TUTOR entrava e
// não via NADA — o cadastro do responsável não tinha vínculo com a
// conta e o join exigia um tutorId no body (qualquer um). Aqui o
// tutor é resolvido da SESSÃO (vínculo RosterService.setTutorUserId,
// feito pela secretaria): o responsável só vê os próprios filhos,
// só entra na fila por eles e só cancela as próprias entradas.
@Controller('pickup/schools/:schoolId/me')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('TUTOR')
export class TutorMeController {
  constructor(
    private readonly pickup: PickupService,
    private readonly roster: RosterService,
    private readonly qr: QrTokenService,
  ) {}

  private linkedTutor(schoolId: string, user: AccessTokenPayload): TutorRecord {
    const tutor = this.roster.getTutorByUserId(schoolId, user.sub);
    if (!tutor) {
      throw new ForbiddenException(
        'Sua conta ainda não foi vinculada a um responsável desta escola. Peça à secretaria para vincular o seu e-mail na área da escola.',
      );
    }
    return tutor;
  }

  private activeEntry(schoolId: string, studentId: string): PickupQueueEntry | null {
    return (
      this.pickup
        .listForStudent(schoolId, studentId)
        .find((e) => e.status === 'QUEUED' || e.status === 'CALLED' || e.status === 'VALIDATED') ??
      null
    );
  }

  /** Quem sou eu + meus filhos + a entrada ativa de cada um. Sem
   * vínculo, devolve tutor: null (a tela explica) em vez de erro. */
  @Get()
  me(@Param('schoolId') schoolId: string, @CurrentUser() user: AccessTokenPayload) {
    const tutor = this.roster.getTutorByUserId(schoolId, user.sub);
    if (!tutor) return { tutor: null, students: [] };
    const students = this.roster.listStudentsOfTutor(tutor.id).map((link) => {
      const classroom = this.roster
        .listClassrooms(schoolId, { includeInactive: true })
        .find((c) => c.id === link.student.classroomId);
      return {
        student: link.student,
        classroomName: classroom?.name ?? null,
        relationship: link.relationship,
        isPrimary: link.isPrimary,
        canPickup: link.canPickup,
        activeEntry: this.activeEntry(schoolId, link.studentId),
      };
    });
    return { tutor, students };
  }

  /** "Estou chegando": entra na fila pelo meu filho. */
  @Post('join')
  join(
    @Param('schoolId') schoolId: string,
    @Body() dto: JoinMineDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    const tutor = this.linkedTutor(schoolId, user);
    if (tutor.isBlocked) {
      throw new ForbiddenException(
        `Retirada bloqueada para este responsável: ${tutor.blockReason ?? 'procure a secretaria'}`,
      );
    }
    const link = this.roster
      .listStudentsOfTutor(tutor.id)
      .find((l) => l.studentId === dto.studentId);
    if (!link) {
      throw new NotFoundException('Aluno não encontrado entre os seus filhos.');
    }
    if (!link.canPickup) {
      throw new ForbiddenException(
        'Você está cadastrado como contato, mas sem autorização para retirar este aluno. Procure a secretaria.',
      );
    }
    if (link.student.pickupBlocked) {
      throw new ForbiddenException(
        `Retirada bloqueada: ${link.student.blockReason ?? 'procure a secretaria'}`,
      );
    }
    return this.pickup.join({
      schoolId,
      studentId: dto.studentId,
      tutorId: tutor.id,
      source: 'MANUAL',
      gate: dto.gate,
    });
  }

  /** Desistir de buscar agora — só a MINHA entrada. */
  @Post('entries/:entryId/cancel')
  cancel(
    @Param('schoolId') schoolId: string,
    @Param('entryId') entryId: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    const tutor = this.linkedTutor(schoolId, user);
    const entry = this.pickup.getEntry(entryId);
    if (!entry || entry.schoolId !== schoolId || entry.tutorId !== tutor.id) {
      throw new NotFoundException('Entrada da fila não encontrada.');
    }
    return this.pickup.cancel(entryId, user.sub);
  }

  /** O QR dinâmico (30 s) p/ apresentar na portaria. */
  @Get('qr-token')
  qrToken(@Param('schoolId') schoolId: string, @CurrentUser() user: AccessTokenPayload) {
    const tutor = this.linkedTutor(schoolId, user);
    return this.qr.issue(schoolId, tutor.id);
  }
}
