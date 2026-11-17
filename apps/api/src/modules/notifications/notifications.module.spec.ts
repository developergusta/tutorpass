import { Test } from '@nestjs/testing';
import { NotificationsModule } from './notifications.module';
import { NotificationService } from './notification.service';

// Regressão (ciclo 16): o construtor `pushSender?: PushSender` sem @Optional()
// @Inject fazia o DI tentar resolver `Object` como provider e o módulo nem
// subia — o AppModule inteiro falhava no boot.
describe('NotificationsModule (fiação DI)', () => {
  it('resolve NotificationService sem sender vinculado', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [NotificationsModule],
    }).compile();
    expect(moduleRef.get(NotificationService)).toBeInstanceOf(NotificationService);
    await moduleRef.close();
  });
});
