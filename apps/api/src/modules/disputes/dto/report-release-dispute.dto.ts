import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportReleaseDisputeDto {
  @IsString()
  studentId!: string;

  // Id do evento RELEASED no PickupLog que está sendo contestado.
  @IsString()
  releaseLogId!: string;

  @IsString()
  tutorId!: string;

  // Motivo da contestação, nas palavras do tutor — opcional (o susto não
  // espera formulário), máx. 500 caracteres.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
