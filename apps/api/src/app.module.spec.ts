import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { AuthService } from './modules/auth/auth.service';
import { NotificationService } from './modules/notifications/notification.service';
import { QrTokenService } from './modules/qr/qr-token.service';
import { PlanService } from './modules/plans/plan.service';
import { GeofencingService } from './modules/geofencing/geofencing.service';
import { EventLogService } from './realtime/event-log.service';
import { PickupGateway } from './realtime/pickup.gateway';
import { RedisService } from './infra/redis/redis.service';

// Regressão (ciclo 16): 3 bugs de DI impediam o AppModule de subir e só
// apareceriam no boot — nenhum teste unitário os pegava, porque cada serviço
// era instanciado com `new` direto:
// 1. AuthService(secret?: string) — o DI tentava resolver `String`;
// 2. NotificationService(pushSender?: PushSender) — tentava resolver `Object`;
// 3. PickupGateway injeta GeofencingService, mas o RealtimeModule não
//    importava o GeofencingModule.
// Este teste compila o AppModule e resolve os serviços de lógica pura —
// sem conectar em banco/Redis (nada aqui chama onModuleInit).
describe('AppModule (fiação DI)', () => {
  it('compila e resolve os serviços de lógica pura', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    expect(moduleRef.get(AuthService)).toBeInstanceOf(AuthService);
    expect(moduleRef.get(NotificationService)).toBeInstanceOf(NotificationService);
    expect(moduleRef.get(QrTokenService)).toBeInstanceOf(QrTokenService);
    expect(moduleRef.get(PlanService)).toBeInstanceOf(PlanService);
    expect(moduleRef.get(GeofencingService)).toBeInstanceOf(GeofencingService);
    expect(moduleRef.get(EventLogService)).toBeInstanceOf(EventLogService);
    expect(moduleRef.get(PickupGateway)).toBeInstanceOf(PickupGateway);
    // Redis sem conectar: só compila (onModuleInit não roda aqui).
    expect(moduleRef.get(RedisService)).toBeInstanceOf(RedisService);
    await moduleRef.close();
  });
});
