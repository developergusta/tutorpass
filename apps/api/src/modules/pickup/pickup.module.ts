import { Module } from '@nestjs/common';
import { QrModule } from '../qr/qr.module';
import { AuthModule } from '../auth/auth.module';
import { GateAlertsModule } from '../gate-alerts/gate-alerts.module';
import { RosterModule } from '../roster/roster.module';
import { RealtimeModule } from '../../realtime/realtime.module';
import { DismissalPlansModule } from '../dismissal-plans/dismissal-plans.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PickupService } from './pickup.service';
import { DayAttendanceService } from './day-attendance.service';
import { PickupController } from './pickup.controller';
import { TutorMeController } from './tutor-me.controller';

// RosterModule: o PickupService enriquece os eventos com nome/turma e
// os controllers resolvem o responsável a partir da sessão.
// RealtimeModule: é o que finalmente LIGA o tempo real — sem este
// import o PickupService não recebia o RealtimeService e nenhuma
// entrada chegava às telas (bug crítico achado em 17/11/2026).
@Module({
  imports: [
    QrModule,
    AuthModule,
    GateAlertsModule,
    RosterModule,
    RealtimeModule,
    DismissalPlansModule,
    NotificationsModule,
  ],
  controllers: [PickupController, TutorMeController],
  providers: [DayAttendanceService, PickupService],
  exports: [DayAttendanceService, PickupService],
})
export class PickupModule {}
