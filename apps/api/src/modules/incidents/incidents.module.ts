import { Module } from '@nestjs/common';
import { SecurityIncidentService } from './security-incident.service';

@Module({ providers: [SecurityIncidentService], exports: [SecurityIncidentService] })
export class IncidentsModule {}
