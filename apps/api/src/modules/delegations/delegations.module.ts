import { Module } from '@nestjs/common';
import { PrintedTagService } from './printed-tag.service';
import { TemporaryAuthorizationService } from './temporary-authorization.service';

@Module({
  providers: [TemporaryAuthorizationService, PrintedTagService],
  exports: [TemporaryAuthorizationService, PrintedTagService],
})
export class DelegationsModule {}
