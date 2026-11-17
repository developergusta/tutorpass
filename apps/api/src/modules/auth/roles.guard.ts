import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessTokenPayload, AuthService, Role } from './auth.service';
import { ROLES_KEY } from './roles.decorator';

// Autorização por papel (403 quando o usuário autenticado não tem o papel).
// Guard fino: delega a decisão ao AuthService.authorize (mesma regra do
// Step 2 com Prisma). O tenant é o :schoolId da rota quando existe, senão a
// escola da sessão — o schoolId NUNCA vem do body (docs/01-arquitetura.md).
// Sem @Roles na rota, qualquer usuário autenticado passa.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = ctx.switchToHttp().getRequest();
    const payload = req.user as AccessTokenPayload | undefined;
    if (!payload) throw new UnauthorizedException('Sessão inválida');
    const schoolId =
      (req.params?.schoolId as string | undefined) ?? payload.schoolId;
    if (!schoolId) {
      throw new ForbiddenException('Esta rota exige uma escola na sessão');
    }
    this.auth.requireAuthorize(payload, schoolId, required);
    return true;
  }
}
