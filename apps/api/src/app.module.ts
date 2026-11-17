import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RedisModule } from './infra/redis/redis.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { GeofencingModule } from './modules/geofencing/geofencing.module';
import { QrModule } from './modules/qr/qr.module';
import { PickupModule } from './modules/pickup/pickup.module';
import { ConsentModule } from './modules/consent/consent.module';
import { RetentionModule } from './modules/retention/retention.module';
import { PlanModule } from './modules/plans/plan.module';
import { DelegationsModule } from './modules/delegations/delegations.module';
import { EarlyPickupModule } from './modules/early-pickup/early-pickup.module';
import { DismissalPlansModule } from './modules/dismissal-plans/dismissal-plans.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { EtaModule } from './modules/eta/eta.module';
import { DisplayBoardModule } from './modules/display-board/display-board.module';
import { VanRoutesModule } from './modules/van-routes/van-routes.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuthModule } from './modules/auth/auth.module';
import { RosterModule } from './modules/roster/roster.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
@Module({ imports: [RedisModule, PrismaModule, RealtimeModule, GeofencingModule, QrModule, PickupModule, ConsentModule, RetentionModule, PlanModule, DelegationsModule, EarlyPickupModule, DismissalPlansModule, NotificationsModule, IncidentsModule, EtaModule, DisplayBoardModule, VanRoutesModule, ReportsModule, AuthModule, RosterModule, ComplianceModule, OnboardingModule], controllers: [HealthController] })
export class AppModule {}
