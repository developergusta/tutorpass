import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import type {
  DataSubjectRequestType,
  DataSubjectType,
} from '../data-subject-request.service';

export class OpenDataSubjectRequestDto {
  @IsString()
  subjectId!: string;

  @IsEnum(['STUDENT', 'TUTOR', 'STAFF'])
  subjectType!: DataSubjectType;

  // Tipo do direito exercido (art. 18): ACCESS, CORRECTION, ANONYMIZATION,
  // BLOCKING, ERASURE, PORTABILITY, SHARING_INFO ou CONSENT_REVOCATION.
  @IsEnum([
    'ACCESS',
    'CORRECTION',
    'ANONYMIZATION',
    'BLOCKING',
    'ERASURE',
    'PORTABILITY',
    'SHARING_INFO',
    'CONSENT_REVOCATION',
  ])
  type!: DataSubjectRequestType;

  // O que o titular pede — sem dado sensível além do necessário p/ atender.
  @IsString()
  @MinLength(1)
  details!: string;

  // De onde o pedido nasceu (ADMIN_PANEL = secretaria abriu pelo painel;
  // SUBJECT_APP = o próprio titular abriu no app). Default ADMIN_PANEL.
  @IsOptional()
  @IsEnum(['ADMIN_PANEL', 'SUBJECT_APP'])
  channel?: 'ADMIN_PANEL' | 'SUBJECT_APP';
}
