import { Module } from '@nestjs/common';
import { PickupGateway } from './pickup.gateway';
import { RealtimeService } from './realtime.service';
import { EventLogService } from './event-log.service';
import { GeofencingModule } from '../modules/geofencing/geofencing.module';
import { RedisModule } from '../infra/redis/redis.module';

// GeofencingModule: o PickupGateway injeta GeofencingService (p/ validar a
// posição no `tutor.location.update`) — sem o import, o AppModule nem subia
// ("Nest can't resolve dependencies of the PickupGateway").
// RedisModule: o EventLogService usa o cliente Redis p/ o log em Streams
// quando conectado (sem ele, o @Optional() vira undefined e o log fica em
// memória — ver event-log.service.ts).
@Module({
  imports: [GeofencingModule, RedisModule],
  providers: [PickupGateway, RealtimeService, EventLogService],
  exports: [RealtimeService, EventLogService],
})
export class RealtimeModule {}
