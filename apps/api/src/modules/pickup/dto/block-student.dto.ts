import { IsString, MinLength } from 'class-validator';

export class BlockStudentDto {
  // Motivo obrigatório — fica no PickupLog (BLOCKED) e na mensagem do join
  // recusado; sem motivo, nem a secretaria sabe por que o aluno não sai.
  @IsString()
  @MinLength(1)
  reason!: string;
}
