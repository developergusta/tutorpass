import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  // Mínimo de 8 caracteres (NIST SP 800-63B) — o AuthService ainda bloqueia
  // as senhas mais comuns; a validação aqui é só o piso.
  @IsString()
  @MinLength(8)
  password!: string;
}
