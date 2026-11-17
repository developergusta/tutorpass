import { Module } from '@nestjs/common';
import { ConsentModule } from '../consent/consent.module';
import { RetentionModule } from '../retention/retention.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { ComplianceReportService } from './compliance-report.service';

@Module({
  imports: [ConsentModule, RetentionModule, IncidentsModule],
  providers: [ComplianceReportService],
  exports: [ComplianceReportService],
})
export class ComplianceModule {}
