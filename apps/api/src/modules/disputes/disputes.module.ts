import { Module } from '@nestjs/common';
import { PickupModule } from '../pickup/pickup.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { AuthModule } from '../auth/auth.module';
import { UnrecognizedReleaseService } from './release-dispute.service';
import { DisputesController } from './disputes.controller';

@Module({
  imports: [PickupModule, IncidentsModule, AuthModule],
  controllers: [DisputesController],
  providers: [UnrecognizedReleaseService],
  exports: [UnrecognizedReleaseService],
})
export class DisputesModule {}
