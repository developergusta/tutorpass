import { IsOptional, IsString } from 'class-validator';

export class RefreshDto {
  // Fallback p/ clientes que não enviam cookie (ex.: app mobile sem
  // cookie jar): o caminho principal é o cookie httpOnly setado no login.
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
