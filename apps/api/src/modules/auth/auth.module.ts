import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { TenantGuard } from './tenant.guard';
import { TwoFactorModule } from '../two-factor/two-factor.module';
import { PasswordResetService } from './password-reset.service';

@Module({
  imports: [TwoFactorModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordResetService,
    JwtAuthGuard,
    RolesGuard,
    TenantGuard,
    // Segredo do access token p/ o DI — o AuthService lê process.env como
    // fallback, então o provider só espelha o env (testes podem sobrescrevê-lo).
    { provide: 'JWT_ACCESS_SECRET', useFactory: () => process.env.JWT_ACCESS_SECRET ?? '' },
  ],
  exports: [AuthService, JwtAuthGuard, RolesGuard, TenantGuard],
})
export class AuthModule {}
