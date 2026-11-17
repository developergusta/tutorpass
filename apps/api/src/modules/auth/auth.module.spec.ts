import { Test } from '@nestjs/testing';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { TenantGuard } from './tenant.guard';

// Fiação do AuthModule: o Nest resolve controller + guards (Reflector vem do core).
describe('AuthModule (fiação DI)', () => {
  it('resolve AuthController, AuthService e os 3 guards', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AuthModule] }).compile();
    expect(moduleRef.get(AuthController)).toBeInstanceOf(AuthController);
    expect(moduleRef.get(AuthService)).toBeInstanceOf(AuthService);
    expect(moduleRef.get(JwtAuthGuard)).toBeInstanceOf(JwtAuthGuard);
    expect(moduleRef.get(RolesGuard)).toBeInstanceOf(RolesGuard);
    expect(moduleRef.get(TenantGuard)).toBeInstanceOf(TenantGuard);
    await moduleRef.close();
  });
});
