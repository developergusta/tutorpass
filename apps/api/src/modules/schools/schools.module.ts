import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RosterModule } from '../roster/roster.module';
import { SchoolsController } from './schools.controller';

@Module({
  imports: [AuthModule, RosterModule],
  controllers: [SchoolsController],
})
export class SchoolsModule {}
