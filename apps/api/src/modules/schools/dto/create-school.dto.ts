import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSchoolDto {
  @IsString()
  @MinLength(2)
  name!: string;

  // CNPJ (só dígitos ou formatado — o RosterService normaliza e valida 14).
  @IsOptional()
  @IsString()
  document?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
