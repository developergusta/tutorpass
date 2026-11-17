import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { TenantGuard } from './tenant.guard';
import { Public } from './public.decorator';
import { Roles } from './roles.decorator';

const SECRET = 'segredo-de-teste-com-mais-de-32-caracteres-123456';
const SCHOOL_A = 'escola-a';
const SCHOOL_B = 'escola-b';

class OpenController {
  @Public()
  open() {
    return 'ok';
  }

  closed() {
    return 'ok';
  }
}

class AdminController {
  @Roles('ADMIN')
  adminOnly() {
    return 'ok';
  }

  @Roles('ADMIN', 'COORDINATOR')
  staff() {
    return 'ok';
  }

  free() {
    return 'ok';
  }
}

function fakeContext(handler: (...args: unknown[]) => unknown, klass: object, req: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => klass,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('Guards de auth (JwtAuthGuard + RolesGuard + TenantGuard)', () => {
  let service: AuthService;
  let reflector: Reflector;
  let jwtGuard: JwtAuthGuard;
  let rolesGuard: RolesGuard;
  let tenantGuard: TenantGuard;
  let adminToken: string;
  let agentToken: string;
  let noSchoolToken: string;

  beforeAll(() => {
    service = new AuthService(SECRET);
    reflector = new Reflector();
    jwtGuard = new JwtAuthGuard(service, reflector);
    rolesGuard = new RolesGuard(service, reflector);
    tenantGuard = new TenantGuard(service);

    const admin = service.register('admin@escola.test', 'Admin', 'SenhaForte1!');
    service.addMembership(admin.id, SCHOOL_A, 'ADMIN');
    adminToken = service.login('admin@escola.test', 'SenhaForte1!', SCHOOL_A).accessToken;

    const agent = service.register('portaria@escola.test', 'Portaria', 'SenhaForte2!');
    service.addMembership(agent.id, SCHOOL_A, 'GATE_AGENT');
    agentToken = service.login('portaria@escola.test', 'SenhaForte2!', SCHOOL_A).accessToken;

    const owner = service.register('dono@escola.test', 'Dono', 'SenhaForte3!');
    void owner;
    noSchoolToken = service.login('dono@escola.test', 'SenhaForte3!').accessToken;
  });

  const payloadOf = (token: string) => service.verifyAccessToken(token);

  describe('JwtAuthGuard', () => {
    it('rota @Public passa sem token', () => {
      const ctx = fakeContext(OpenController.prototype.open, OpenController, { headers: {} });
      expect(jwtGuard.canActivate(ctx)).toBe(true);
    });

    it('Bearer válido autentica e anexa o payload em req.user', () => {
      const req: Record<string, unknown> = { headers: { authorization: `Bearer ${adminToken}` } };
      const ctx = fakeContext(OpenController.prototype.closed, OpenController, req);
      expect(jwtGuard.canActivate(ctx)).toBe(true);
      expect((req.user as { sub: string }).sub).toBe(payloadOf(adminToken).sub);
      expect((req.user as { roles: string[] }).roles).toEqual(['ADMIN']);
    });

    it('sem header Authorization → 401', () => {
      const ctx = fakeContext(OpenController.prototype.closed, OpenController, { headers: {} });
      expect(() => jwtGuard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('esquema diferente de Bearer → 401', () => {
      const ctx = fakeContext(OpenController.prototype.closed, OpenController, {
        headers: { authorization: `Basic ${adminToken}` },
      });
      expect(() => jwtGuard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('token adulterado → 401', () => {
      const ctx = fakeContext(OpenController.prototype.closed, OpenController, {
        headers: { authorization: `Bearer ${adminToken.slice(0, -2)}xx` },
      });
      expect(() => jwtGuard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('token expirado → 401', () => {
      const user = service.register('velho@escola.test', 'Velho', 'SenhaForte4!');
      const expired = service.signAccessToken(user, null, [], new Date(Date.now() - 20 * 60_000));
      const ctx = fakeContext(OpenController.prototype.closed, OpenController, {
        headers: { authorization: `Bearer ${expired}` },
      });
      expect(() => jwtGuard.canActivate(ctx)).toThrow(UnauthorizedException);
    });
  });

  describe('RolesGuard', () => {
    it('rota sem @Roles passa p/ qualquer autenticado', () => {
      const ctx = fakeContext(AdminController.prototype.free, AdminController, {
        user: payloadOf(agentToken),
        params: {},
      });
      expect(rolesGuard.canActivate(ctx)).toBe(true);
    });

    it('ADMIN passa em @Roles(ADMIN)', () => {
      const ctx = fakeContext(AdminController.prototype.adminOnly, AdminController, {
        user: payloadOf(adminToken),
        params: {},
      });
      expect(rolesGuard.canActivate(ctx)).toBe(true);
    });

    it('GATE_AGENT em @Roles(ADMIN) → 403', () => {
      const ctx = fakeContext(AdminController.prototype.adminOnly, AdminController, {
        user: payloadOf(agentToken),
        params: {},
      });
      expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('GATE_AGENT passa em @Roles(ADMIN, COORDINATOR)? Não — 403; ADMIN passa', () => {
      const denied = fakeContext(AdminController.prototype.staff, AdminController, {
        user: payloadOf(agentToken),
        params: {},
      });
      expect(() => rolesGuard.canActivate(denied)).toThrow(ForbiddenException);
      const allowed = fakeContext(AdminController.prototype.staff, AdminController, {
        user: payloadOf(adminToken),
        params: {},
      });
      expect(rolesGuard.canActivate(allowed)).toBe(true);
    });

    it('sem req.user → 401 (guard de auth não rodou antes)', () => {
      const ctx = fakeContext(AdminController.prototype.adminOnly, AdminController, { params: {} });
      expect(() => rolesGuard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it(':schoolId de outra escola → 403 mesmo com o papel certo', () => {
      const ctx = fakeContext(AdminController.prototype.adminOnly, AdminController, {
        user: payloadOf(adminToken),
        params: { schoolId: SCHOOL_B },
      });
      expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('sessão sem escola em rota com @Roles e sem :schoolId → 403', () => {
      const ctx = fakeContext(AdminController.prototype.adminOnly, AdminController, {
        user: payloadOf(noSchoolToken),
        params: {},
      });
      expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });

  describe('TenantGuard', () => {
    it(':schoolId igual ao da sessão passa', () => {
      const ctx = fakeContext(OpenController.prototype.closed, OpenController, {
        user: payloadOf(adminToken),
        params: { schoolId: SCHOOL_A },
      });
      expect(tenantGuard.canActivate(ctx)).toBe(true);
    });

    it(':schoolId de outra escola → 403 (ADMIN da escola A não lê a B)', () => {
      const ctx = fakeContext(OpenController.prototype.closed, OpenController, {
        user: payloadOf(adminToken),
        params: { schoolId: SCHOOL_B },
      });
      expect(() => tenantGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('rota sem :schoolId passa (nada a isolar aqui)', () => {
      const ctx = fakeContext(OpenController.prototype.closed, OpenController, {
        user: payloadOf(adminToken),
        params: {},
      });
      expect(tenantGuard.canActivate(ctx)).toBe(true);
    });

    it('sem req.user → 401', () => {
      const ctx = fakeContext(OpenController.prototype.closed, OpenController, {
        params: { schoolId: SCHOOL_A },
      });
      expect(() => tenantGuard.canActivate(ctx)).toThrow(UnauthorizedException);
    });
  });
});
