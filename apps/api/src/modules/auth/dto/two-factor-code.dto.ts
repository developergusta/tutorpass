import { IsString, MaxLength, MinLength } from 'class-validator';

// Código do 2º fator: TOTP de 6 dígitos ou código de recuperação de 8.
// Aceita espaços/traços (o serviço normaliza antes de verificar).
export class TwoFactorCodeDto {
  @IsString()
  @MinLength(6)
  @MaxLength(12)
  code!: string;
}
