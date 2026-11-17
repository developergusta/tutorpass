import { IsString, MinLength } from 'class-validator';

export class ValidateQrDto {
  // Token dinâmico do tutor (QrTokenService.issue — válido 30 s, uso único).
  @IsString()
  @MinLength(1)
  token!: string;
}
