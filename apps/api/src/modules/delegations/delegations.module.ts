import { Module } from '@nestjs/common';
import { TemporaryAuthorizationService } from './temporary-authorization.service';

@Module({
  providers: [TemporaryAuthorizationService],
  exports: [TemporaryAuthorizationService],
})
export class DelegationsModule {}
