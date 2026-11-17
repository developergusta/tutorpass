import { IsString, MinLength } from 'class-validator';

export class DenyRequestDto {
  // Motivo da negação — obrigatório: o titular tem direito a saber por quê.
  @IsString()
  @MinLength(1)
  reason!: string;
}
