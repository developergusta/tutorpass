import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AccessTokenPayload, AuthService } from './auth.service';

// Isolamento de tenant nas rotas com :schoolId (ex.: /schools/:schoolId/...):
// a sessão precisa pertencer à escola da URL — um ADMIN da escola A não lê
// nada da escola B nem passando o id no caminho. Rotas sem :schoolId passam
// direto (o tenant delas é a escola da sessão, conferida pelo RolesGuard ou
// pelo próprio serviço). Guard fino: delega ao AuthService.authorize.
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const payload = req.user as AccessTokenPayload | undefined;
    if (!payload) throw new UnauthorizedException('Sessão inválida');
    const schoolId = req.params?.schoolId as string | undefined;
    if (!schoolId) return true;
    this.auth.requireAuthorize(payload, schoolId);
    return true;
  }
}
