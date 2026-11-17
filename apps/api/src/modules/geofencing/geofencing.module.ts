import { Module } from '@nestjs/common';
import { GeofencingService } from './geofencing.service';
import { RedisModule } from '../../infra/redis/redis.module';

@Module({ imports: [RedisModule], providers: [GeofencingService], exports: [GeofencingService] })
export class GeofencingModule {}
