import { Module } from '@nestjs/common';
import { DismissalReportService } from './dismissal-report.service';

@Module({ providers: [DismissalReportService], exports: [DismissalReportService] })
export class ReportsModule {}
