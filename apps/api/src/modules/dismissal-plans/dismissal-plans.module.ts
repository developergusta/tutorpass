import { Module } from '@nestjs/common';
import { DismissalPlanService } from './dismissal-plan.service';
@Module({ providers: [DismissalPlanService], exports: [DismissalPlanService] })
export class DismissalPlansModule {}
