import { Module } from '@nestjs/common';
import { QrModule } from '../qr/qr.module';
import { AuthModule } from '../auth/auth.module';
import { PickupService } from './pickup.service';
import { PickupController } from './pickup.controller';
@Module({ imports: [QrModule, AuthModule], controllers: [PickupController], providers: [PickupService], exports: [PickupService] }) export class PickupModule {}
