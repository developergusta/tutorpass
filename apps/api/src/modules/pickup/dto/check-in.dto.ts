import { IsISO8601, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CheckInDto {
  @IsString()
  @MinLength(1)
  studentId!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Data inválida — use o formato YYYY-MM-DD.',
  })
  date?: string;

  @IsOptional()
  @IsISO8601()
  checkInAt?: string;
}
