import { IsString, MaxLength, MinLength } from 'class-validator';
import { TwoFactorCodeDto } from './two-factor-code.dto';

// Verificação do desafio de 2FA: o token opaco que o login devolveu quando
// a senha passou mas o 2FA está ativo + o código do autenticador.
export class TwoFactorVerifyDto extends TwoFactorCodeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  twoFactorToken!: string;
}
