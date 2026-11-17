import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AccessTokenPayload } from './auth.service';

// Acesso tipado ao payload do access token que o JwtAuthGuard anexou em
// request.user — evita `req.user as any` espalhado pelos controllers.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessTokenPayload => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AccessTokenPayload;
  },
);
