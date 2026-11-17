import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DataSubjectRequestService } from './data-subject-request.service';
import { DataSubjectRequestController } from './data-subject-request.controller';

@Module({
  imports: [AuthModule],
  providers: [DataSubjectRequestService],
  controllers: [DataSubjectRequestController],
  exports: [DataSubjectRequestService],
})
export class DataSubjectRequestsModule {}
