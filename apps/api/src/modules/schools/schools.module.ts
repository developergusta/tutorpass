import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RosterModule } from '../roster/roster.module';
import { SchoolMembersController } from './school-members.controller';
import { SchoolsController } from './schools.controller';

@Module({
  imports: [AuthModule, RosterModule],
  controllers: [SchoolsController, SchoolMembersController],
})
export class SchoolsModule {}
