import { Module } from '@nestjs/common';
import { PickupGateway } from './pickup.gateway';
import { RealtimeService } from './realtime.service';
import { EventLogService } from './event-log.service';
import { GeofencingModule } from '../modules/geofencing/geofencing.module';

// GeofencingModule: o PickupGateway injeta GeofencingService (p/ validar a
// posição no `tutor.location.update`) — sem o import, o AppModule nem subia
// ("Nest can't resolve dependencies of the PickupGateway").
@Module({
  imports: [GeofencingModule],
  providers: [PickupGateway, RealtimeService, EventLogService],
  exports: [RealtimeService, EventLogService],
})
export class RealtimeModule {}
