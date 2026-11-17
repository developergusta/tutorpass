import { Module } from '@nestjs/common';
import { RosterService } from './roster.service';

@Module({ providers: [RosterService], exports: [RosterService] })
export class RosterModule {}
