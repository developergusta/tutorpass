import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RosterController } from './roster.controller';
import { RosterModule } from './roster.module';

// Camada HTTP do cadastro (controller + guards) separada do RosterModule
// (que só provê o serviço) — mesmo desenho do SchoolsModule, sem ciclo:
// AuthModule não importa RosterApiModule.
@Module({
  imports: [AuthModule, RosterModule],
  controllers: [RosterController],
})
export class RosterApiModule {}
