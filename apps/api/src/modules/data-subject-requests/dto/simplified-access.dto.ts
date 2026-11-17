import { IsString, MinLength } from 'class-validator';

export class SimplifiedAccessDto {
  // Resumo do que foi confirmado no acesso simplificado (art. 19, I):
  // confirmação da existência do tratamento + acesso em formato simplificado.
  @IsString()
  @MinLength(1)
  summary!: string;
}
