import { Module } from '@nestjs/common';
import { QrTokenService } from './qr-token.service';
import { RedisModule } from '../../infra/redis/redis.module';

@Module({ imports: [RedisModule], providers: [QrTokenService], exports: [QrTokenService] })
export class QrModule {}
