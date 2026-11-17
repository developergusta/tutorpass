import { Module } from '@nestjs/common';
import { EarlyDismissalService } from './early-dismissal.service';

@Module({
  providers: [EarlyDismissalService],
  exports: [EarlyDismissalService],
})
export class EarlyPickupModule {}
