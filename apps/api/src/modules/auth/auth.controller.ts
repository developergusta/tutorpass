import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  AccessTokenPayload,
  AuthService,
  REFRESH_TTL_DAYS,
} from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { TwoFactorCodeDto } from './dto/two-factor-code.dto';
import { TwoFactorVerifyDto } from './dto/two-factor-verify.dto';
import { TwoFactorService } from '../two-factor/two-factor.service';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { PasswordResetService } from './password-reset.service';

// REST /auth/* — primeira superfície HTTP do Step 2 sobre o AuthService.
// O refresh token NUNCA vai no corpo da resposta: ele sai em cookie httpOnly
// + Secure (só em produção) + SameSite=strict, com path restrito a
// /api/auth/refresh (o prefixo global 'api' do main.ts) — nunca localStorage
// (contrato do README do módulo, OAuth 2.1 / RFC 9700). O access token vai no
// corpo (o cliente o guarda em memória e o manda como Bearer).
// Sem cookie-parser no projeto: o cookie de entrada é lido do header `cookie`
// (parseCookies); trocar por cookie-parser no Step 2 sem mudar a API.
// Rotas protegidas usam JwtAuthGuard; as públicas, @Public.

const REFRESH_COOKIE = 'tutorpass_refresh';
const REFRESH_COOKIE_PATH = '/api/auth/refresh';

// Tipos mínimos da resposta/pedido HTTP — sem @types/express no projeto.
type CookieResponse = {
  cookie(name: string, value: string, options: Record<string, unknown>): void;
  clearCookie(name: string, options?: Record<string, unknown>): void;
};
type CookieRequest = { headers: { cookie?: string } };

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

function refreshCookieOptions(): Record<string, unknown> {
  // `secure` acompanha o protocolo da origem pública: com HTTPS, cookie
  // Secure; na era do IP (HTTP puro), Secure faria o navegador recusar o
  // cookie e o refresh nunca funcionaria. A flag vira sozinha quando o
  // domínio com HTTPS entrar (CORS_ORIGINS passa a ser https://...).
  const firstOrigin = (process.env.CORS_ORIGINS ?? '').split(',')[0]?.trim();
  const secure = firstOrigin
    ? firstOrigin.startsWith('https://')
    : process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TTL_DAYS * 86_400_000,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly twoFactor: TwoFactorService,
    private readonly passwordResets: PasswordResetService,
  ) {}

  // "Esqueci minha senha": a resposta é SEMPRE { ok: true } — exista ou
  // não conta com o e-mail (não vaza quem é usuário). A entrega do link
  // na v1 é pelo admin da escola (GET /password-resets abaixo).
  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    this.passwordResets.request(dto.email);
    return { ok: true };
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    this.passwordResets.reset(dto.token, dto.newPassword);
    return { ok: true };
  }

  // Entrega v1 dos links de redefinição: só ADMIN, só da própria escola.
  @UseGuards(JwtAuthGuard)
  @Get('password-resets')
  passwordResetsList(@CurrentUser() user: AccessTokenPayload) {
    if (!user.roles.includes('ADMIN') || !user.schoolId) {
      throw new ForbiddenException(
        'Só administradores da escola veem os pedidos de redefinição.',
      );
    }
    return this.passwordResets.listPendingForSchool(user.schoolId);
  }

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    const user = this.auth.register(dto.email, dto.name, dto.password);
    // Nunca devolver passwordHash.
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: CookieResponse) {
    // Passo 1: senha + vínculo, sem emitir tokens ainda.
    const step1 = this.auth.loginStep1(dto.email, dto.password, dto.schoolId ?? null);
    const user = {
      id: step1.user.id,
      email: step1.user.email,
      name: step1.user.name,
    };
    // 2FA ativo: a sessão só nasce após o código (desafio opaco de 5 min).
    if (this.twoFactor.isEnabled(step1.user.id)) {
      const challenge = this.twoFactor.createChallenge(
        step1.user.id,
        step1.schoolId,
        step1.roles,
      );
      return {
        requires2fa: true,
        twoFactorToken: challenge.token,
        user,
        schoolId: step1.schoolId,
        roles: step1.roles,
      };
    }
    // Passo 2: emite a sessão. Quem é obrigado a usar 2FA (ex.: ADMIN) mas
    // ainda não cadastrou recebe a flag p/ o cliente levar à tela de
    // Segurança (período de carência — ver TwoFactorService).
    const result = this.auth.issueSession(step1.user.id, step1.schoolId, step1.roles);
    res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
    const { refreshToken: _refreshToken, ...rest } = result;
    return {
      ...rest,
      twoFactorSetupRequired: this.twoFactor.isRequiredByPolicy(step1.roles, step1.schoolId),
    };
  }

  // 2FA ---------------------------------------------------------------------

  @Public()
  @Post('2fa/verify')
  verify2fa(@Body() dto: TwoFactorVerifyDto, @Res({ passthrough: true }) res: CookieResponse) {
    const ctx = this.twoFactor.consumeChallenge(dto.twoFactorToken, dto.code);
    const result = this.auth.issueSession(ctx.userId, ctx.schoolId, ctx.roles);
    res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
    const { refreshToken: _refreshToken, ...rest } = result;
    return rest;
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  setup2fa(@CurrentUser() user: AccessTokenPayload) {
    const account = this.auth.getPublicUser(user.sub);
    return this.twoFactor.beginSetup(user.sub, account.email);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/confirm')
  confirm2fa(@CurrentUser() user: AccessTokenPayload, @Body() dto: TwoFactorCodeDto) {
    // Devolve os códigos de recuperação em texto claro UMA vez — o cliente
    // precisa exibi-los e avisar que não poderão ser lidos de novo.
    return this.twoFactor.confirmSetup(user.sub, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('2fa/status')
  status2fa(@CurrentUser() user: AccessTokenPayload) {
    return this.twoFactor.status(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  disable2fa(@CurrentUser() user: AccessTokenPayload, @Body() dto: TwoFactorCodeDto) {
    // Os papéis são os da sessão atual (vindos do token, nunca do body).
    this.twoFactor.disable(user.sub, dto.code, user.roles, user.schoolId);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/recovery-codes')
  regenerateRecoveryCodes(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: TwoFactorCodeDto,
  ) {
    return this.twoFactor.regenerateRecoveryCodes(user.sub, dto.code);
  }

  @Public()
  @Post('refresh')
  refresh(
    @Body() dto: RefreshDto,
    @Req() req: CookieRequest,
    @Res({ passthrough: true }) res: CookieResponse,
  ) {
    const token =
      parseCookies(req.headers.cookie)[REFRESH_COOKIE] ?? dto.refreshToken;
    if (!token) {
      throw new UnauthorizedException('Sessão inválida — faça login novamente');
    }
    const result = this.auth.refresh(token);
    res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
    const { refreshToken: _refreshToken, ...rest } = result;
    return rest;
  }

  @Public()
  @Post('logout')
  logout(
    @Body() dto: RefreshDto,
    @Req() req: CookieRequest,
    @Res({ passthrough: true }) res: CookieResponse,
  ) {
    const token =
      parseCookies(req.headers.cookie)[REFRESH_COOKIE] ?? dto.refreshToken;
    // Idempotente: token desconhecido ou já revogado não dá erro.
    if (token) this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AccessTokenPayload) {
    return {
      id: user.sub,
      email: user.email,
      name: user.name,
      schoolId: user.schoolId,
      roles: user.roles,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  sessions(@CurrentUser() user: AccessTokenPayload) {
    return this.auth.listSessions(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    this.auth.changePassword(user.sub, dto.currentPassword, dto.newPassword);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('revoke-all-sessions')
  revokeAll(
    @CurrentUser() user: AccessTokenPayload,
    @Res({ passthrough: true }) res: CookieResponse,
  ) {
    this.auth.revokeAllForUser(user.sub);
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
    return { ok: true };
  }
}
