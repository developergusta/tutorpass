import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';

// Autenticação (401 quando falta/inválido): verifica o Bearer token com o
// AuthService e anexa o payload em request.user p/ os guards seguintes e p/
// o @CurrentUser(). Roda SEMPRE antes do RolesGuard/TenantGuard (ordem do
// @UseGuards). Rotas @Public passam direto — sem elas, login seria impossível.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest();
    const header = String(req.headers?.authorization ?? '');
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Token ausente — faça login');
    }
    // verifyAccessToken lança UnauthorizedException p/ token inválido/expirado/
    // com alg diferente de HS256 — o guard só traduz p/ 401.
    req.user = this.auth.verifyAccessToken(token);
    return true;
  }
}
