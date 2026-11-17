import { IsEnum, IsString, MinLength } from 'class-validator';

export class FulfillRequestDto {
  // FULL = atendido por completo; PARTIAL = atendido em parte.
  // ERASURE e ANONYMIZATION nunca são FULL: os registros do art. 16
  // (PickupLog, logs de auditoria, consentimentos e incidentes) são sempre
  // mantidos — o serviço recusa FULL p/ esses tipos.
  @IsEnum(['FULL', 'PARTIAL'])
  outcome!: 'FULL' | 'PARTIAL';

  // Resposta ao titular — obrigatória: o que foi feito e, se parcial,
  // o que ficou de fora e por quê (com o fundamento do art. 16, quando for o caso).
  @IsString()
  @MinLength(1)
  note!: string;
}
