import { SetMetadata } from '@nestjs/common';
import type { Role } from './auth.service';

// Papéis exigidos pela rota — lido pelo RolesGuard (getAllAndOverride: o valor do
// método vence o da classe). Sem @Roles, qualquer usuário autenticado passa;
// com @Roles, só quem tem ao menos um dos papéis listados (na escola da sessão
// ou da rota :schoolId). Padrão 2026 (NestJS 10: SetMetadata; no Nest 11,
// Reflector.createDecorator): o decorator só rotula, quem impõe é o guard.
export const ROLES_KEY = 'tutorpass:roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
