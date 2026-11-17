import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import type { PickupSource } from '../pickup.service';

export class JoinQueueDto {
  @IsString()
  studentId!: string;

  @IsString()
  tutorId!: string;

  @IsOptional()
  @IsString()
  authorizationId?: string;

  // Origem da entrada: MANUAL (portaria), GEOFENCE (chegada detectada) ou
  // QR_GATE (tutor escaneou o QR do portão). Default MANUAL.
  @IsOptional()
  @IsEnum(['GEOFENCE', 'MANUAL', 'QR_GATE'])
  source?: PickupSource;

  // Portão da retirada, como a escola chama ("Portão A", "Fundos",
  // "Car Loop"). Opcional; vazio = fila única, sem separação por portão.
  // Máx. 40 caracteres — o nome aparece no painel e no telão.
  @IsOptional()
  @IsString()
  @MaxLength(40)
  gate?: string;
}
