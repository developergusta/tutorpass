import { IsEmail, IsIn } from 'class-validator';
import type { Role } from '../../auth/auth.service';

export const MEMBER_ROLES: Role[] = [
  'ADMIN',
  'COORDINATOR',
  'GATE_AGENT',
  'TEACHER',
  'TUTOR',
];

export class AddMemberDto {
  // E-mail da conta que já existe — a pessoa cria a conta dela antes
  // (cadastro normal) e o admin só vincula o papel à escola.
  @IsEmail()
  email!: string;

  @IsIn(MEMBER_ROLES)
  role!: Role;
}
