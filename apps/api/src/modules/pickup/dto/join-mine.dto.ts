import { IsOptional, IsString, MaxLength } from 'class-validator';

export class JoinMineDto {
  @IsString()
  studentId!: string;

  // Portão da retirada, como a escola chama ("Portão A", "Fundos").
  // Opcional; vazio = fila única.
  @IsOptional()
  @IsString()
  @MaxLength(40)
  gate?: string;
}
