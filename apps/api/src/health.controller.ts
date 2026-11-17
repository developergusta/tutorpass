import { Controller, Get, Inject, Optional } from '@nestjs/common';
import { RedisService } from './infra/redis/redis.service';

@Controller('health')
export class HealthController {
  // @Optional: o controller existe mesmo sem o RedisModule (o modo vira 'disabled').
  constructor(@Optional() @Inject(RedisService) private readonly redis?: RedisService) {}

  @Get()
  health() {
    return {
      status: 'ok',
      service: 'tutorpass-api',
      // disabled = sem REDIS_URL; memory = URL sem Redis (degradação);
      // redis = conectado (estado compartilhado entre instâncias).
      redis: this.redis?.mode ?? 'disabled',
      ts: new Date().toISOString(),
    };
  }
}
