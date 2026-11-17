import { IsEmail, IsString, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(10)
  token!: string;

  // A política completa (tamanho mínimo, senhas comuns) é do AuthService.
  @IsString()
  @MinLength(1)
  newPassword!: string;
}
