import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  // Escola da sessão: sem ela, o login devolve access sem schoolId/roles
  // (sessão "sem escola", p/ criar a escola); com ela, o AuthService exige
  // vínculo ativo e o token já carrega os papéis.
  @IsOptional()
  @IsString()
  schoolId?: string;
}
