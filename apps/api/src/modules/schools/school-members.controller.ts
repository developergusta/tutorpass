import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/auth.service';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AddMemberDto } from './dto/add-member.dto';

// Equipe da escola (17/11/2026 — pedido do usuário p/ ter um login de
// cada perfil): até aqui o ÚNICO vínculo criado por HTTP era o do
// criador da escola (ADMIN); não existia como dar papel a outra
// conta. Agora o ADMIN vincula uma conta EXISTENTE (pelo e-mail) a
// um papel da escola dele, e ADMIN/COORDINATOR listam a equipe.
// O schoolId vem SEMPRE da sessão — nunca do body.
@Controller('schools/members')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchoolMembersController {
  constructor(private readonly auth: AuthService) {}

  private schoolId(user: AccessTokenPayload): string {
    if (!user.schoolId) {
      throw new ForbiddenException('Esta rota exige uma escola na sessão');
    }
    return user.schoolId;
  }

  @Get()
  @Roles('ADMIN', 'COORDINATOR')
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.auth.listSchoolMembers(this.schoolId(user));
  }

  @Post()
  @Roles('ADMIN')
  add(@CurrentUser() user: AccessTokenPayload, @Body() dto: AddMemberDto) {
    const schoolId = this.schoolId(user);
    const target = this.auth.findUserByEmail(dto.email);
    if (!target) {
      throw new NotFoundException(
        'Conta não encontrada — a pessoa precisa criar a conta antes de entrar para a equipe',
      );
    }
    const already = this.auth
      .listMemberships(target.id)
      .some(
        (m) => m.schoolId === schoolId && m.role === dto.role && m.status === 'ACTIVE',
      );
    if (already) {
      throw new ConflictException('Esta pessoa já tem este papel nesta escola');
    }
    const membership = this.auth.addMembership(target.id, schoolId, dto.role);
    return {
      userId: target.id,
      name: target.name,
      email: target.email,
      role: membership.role,
      status: membership.status,
      schoolId,
    };
  }
}
