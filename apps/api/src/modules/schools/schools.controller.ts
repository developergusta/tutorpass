import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/auth.service';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RosterService } from '../roster/roster.service';
import { CreateSchoolDto } from './dto/create-school.dto';

// Criação de escola (o passo que faltava no cadastro self-service):
// POST /api/schools com o access token de uma sessão "sem escola" (recém-
// registrada) cria a escola e vincula o criador como ADMIN. Sem
// TenantGuard/RolesGuard de propósito: a rota NÃO é de uma escola — ela
// CRIA a escola; o único requisito é estar autenticado (JwtAuthGuard).
// O cliente, em seguida, faz login de novo COM o schoolId p/ receber a
// sessão da escola (access + cookie de refresh pelo fluxo normal do
// AuthController — nada de sessão especial aqui).
@Controller('schools')
@UseGuards(JwtAuthGuard)
export class SchoolsController {
  constructor(
    private readonly roster: RosterService,
    private readonly auth: AuthService,
  ) {}

  @Post()
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateSchoolDto) {
    const school = this.roster.createSchool({
      name: dto.name,
      document: dto.document,
      timezone: dto.timezone,
    });
    this.auth.addMembership(user.sub, school.id, 'ADMIN');
    return {
      id: school.id,
      name: school.name,
      slug: school.slug,
      timezone: school.timezone,
      createdAt: school.createdAt,
    };
  }
}
