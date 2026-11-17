import { Module } from '@nestjs/common';
import { GateAlertService, type NtfyConfig } from './gate-alert.service';

@Module({
  providers: [
    GateAlertService,
    // Config do ntfy a partir do ambiente (compose de produção injeta
    // NTFY_BASE_URL=http://ntfy:80 — rede interna — e o NTFY_TOKEN do
    // usuário publicador). Sem as variáveis, o serviço nasce desligado.
    {
      provide: 'NTFY_CONFIG',
      useFactory: (): NtfyConfig => ({
        baseUrl: process.env.NTFY_BASE_URL,
        token: process.env.NTFY_TOKEN,
        topicPrefix: process.env.NTFY_TOPIC_PREFIX,
      }),
    },
  ],
  exports: [GateAlertService],
})
export class GateAlertsModule {}
