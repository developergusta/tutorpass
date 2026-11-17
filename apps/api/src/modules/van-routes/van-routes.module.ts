import { Module } from '@nestjs/common';
import { VanRouteService } from './van-route.service';

@Module({
  providers: [VanRouteService],
  exports: [VanRouteService],
})
export class VanRoutesModule {}
