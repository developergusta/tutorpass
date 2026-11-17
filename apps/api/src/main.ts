import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './realtime/redis-io.adapter';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: (process.env.CORS_ORIGINS ?? '').split(','), credentials: true });
  // Socket.io multi-instância: com REDIS_URL e Redis alcançável, o
  // broadcast passa pelo adapter Redis; senão, segue o adapter em
  // memória (1 instância) — o boot nunca quebra por falta de Redis.
  // Multi-instância exige sticky sessions no balanceador (ver
  // src/infra/redis/README.md).
  const redisUrl = (process.env.REDIS_URL ?? '').trim();
  if (redisUrl) {
    const adapter = new RedisIoAdapter(app);
    const ok = await adapter.connectToRedis(redisUrl);
    if (ok) app.useWebSocketAdapter(adapter);
    else Logger.warn('Redis inalcançável — Socket.io segue com adapter em memória (1 instância)', 'bootstrap');
  }
  await app.listen(process.env.PORT ?? 3333);
}
bootstrap();
