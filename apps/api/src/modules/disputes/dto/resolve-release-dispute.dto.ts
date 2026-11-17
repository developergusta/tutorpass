import { IsEnum, IsString, MinLength } from 'class-validator';
import type { ReleaseDisputeOutcome } from '../release-dispute.service';

export class ResolveReleaseDisputeDto {
  // LEGITIMATE = a saída era legítima (engano/esquecimento); UNRECOGNIZED =
  // confirmado — a contestação escala e o incidente segue aberto p/ o DPO.
  @IsEnum(['LEGITIMATE', 'UNRECOGNIZED'])
  outcome!: ReleaseDisputeOutcome;

  // O que foi verificado — obrigatório: é a resposta registrada p/ a família.
  @IsString()
  @MinLength(1)
  note!: string;
}
