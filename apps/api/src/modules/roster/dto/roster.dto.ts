import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import type { PetSize, Relationship, StudentStatus } from '../roster.service';

export class CreateClassroomDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsInt()
  @Min(2000)
  academicYear!: number;

  @IsOptional()
  @IsString()
  roomLocation?: string;
}

export class RenameClassroomDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

export class CreateStudentDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(1)
  classroomId!: string;

  @IsOptional()
  @IsString()
  enrollmentCode?: string;

  // YYYY-MM-DD — o formato é validado no RosterService (parseBirthDate).
  @IsOptional()
  @IsString()
  birthDate?: string;
}

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  // null limpa o campo (o RosterService trata null como "remover").
  @IsOptional()
  enrollmentCode?: string | null;

  @IsOptional()
  birthDate?: string | null;
}

export class SetStudentStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE', 'TRANSFERRED'])
  status!: StudentStatus;
}

export class CreateTutorDto {
  @IsString()
  @MinLength(2)
  name!: string;

  // Telefone com DDD (só dígitos ou formatado — o serviço normaliza).
  @IsString()
  @MinLength(8)
  phone!: string;

  @IsOptional()
  @IsString()
  document?: string;
}

export class LinkTutorDto {
  @IsString()
  @MinLength(1)
  studentId!: string;

  @IsIn(['FATHER', 'MOTHER', 'GRANDPARENT', 'SIBLING', 'GUARDIAN', 'OTHER'])
  relationship!: Relationship;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  canPickup?: boolean;
}

export class LinkTutorUserDto {
  // E-mail da CONTA de login do responsável (a conta precisa existir —
  // é ela que a secretaria criou na aba Equipe). O vínculo liga a
  // conta ao cadastro do responsável e destrava a área dele.
  @IsString()
  @MinLength(3)
  email!: string;
}

export class ImportStudentsDto {
  // O CSV inteiro como texto (a interface cola ou lê o arquivo e manda
  // o conteúdo; o RosterService faz parse, valida e relata por linha).
  @IsString()
  @MinLength(1)
  csv!: string;

  @IsOptional()
  @IsInt()
  @Min(2000)
  academicYear?: number;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class UpsertPetProfileDto {
  @IsOptional()
  @IsString()
  breed?: string | null;

  @IsOptional()
  @IsIn(['PEQUENO', 'MEDIO', 'GRANDE'])
  size?: PetSize | null;

  @IsOptional()
  @IsString()
  sex?: string | null;

  @IsOptional()
  @IsNumber()
  weightKg?: number | null;

  @IsOptional()
  @IsBoolean()
  isNeutered?: boolean | null;

  @IsOptional()
  @IsString()
  behaviorNotes?: string | null;

  @IsOptional()
  @IsString()
  restrictions?: string | null;

  @IsOptional()
  @IsString()
  feedingFood?: string | null;

  @IsOptional()
  @IsInt()
  feedingPortionGrams?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  feedingTimes?: string[] | null;

  @IsOptional()
  @IsString()
  vetName?: string | null;

  @IsOptional()
  @IsString()
  vetClinic?: string | null;

  @IsOptional()
  @IsString()
  emergencyContactName?: string | null;

  @IsOptional()
  @IsString()
  emergencyContactPhone?: string | null;

  @IsOptional()
  @IsBoolean()
  dewormingUpToDate?: boolean | null;

  @IsOptional()
  @IsString()
  dewormingLastDate?: string | null;

  @IsOptional()
  @IsBoolean()
  fleaControlUpToDate?: boolean | null;

  @IsOptional()
  @IsString()
  fleaControlLastDate?: string | null;

  @IsOptional()
  @IsString()
  allergies?: string | null;

  @IsOptional()
  @IsString()
  medicationName?: string | null;

  @IsOptional()
  @IsString()
  medicationDosage?: string | null;

  @IsOptional()
  @IsString()
  medicationSchedule?: string | null;
}

export class CreatePetVaccinationDto {
  @IsString()
  @MinLength(2)
  vaccineName!: string;

  @IsOptional()
  @IsString()
  appliedAt?: string | null;

  @IsOptional()
  @IsString()
  expiresAt?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class UpdatePetVaccinationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  vaccineName?: string;

  @IsOptional()
  @IsString()
  appliedAt?: string | null;

  @IsOptional()
  @IsString()
  expiresAt?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class SetDefaultPlanDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @IsIn(['CAR', 'WALK', 'BUS', 'AFTER_SCHOOL'])
  mode!: 'CAR' | 'WALK' | 'BUS' | 'AFTER_SCHOOL';

  @IsOptional()
  @IsString()
  busLine?: string;

  @IsOptional()
  @IsString()
  pickupBy?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  copyToWeekdays?: boolean;
}

