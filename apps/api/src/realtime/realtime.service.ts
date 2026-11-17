import { Injectable } from '@nestjs/common';
import { PickupGateway } from './pickup.gateway';
import { EventLogService } from './event-log.service';
// Único ponto de emissão: garante payload mínimo e room correta. Nunca broadcast global.
// Cada emissão recebe um seq por room (EventLogService) e sai como envelope { seq, data } —
// o cliente guarda o último seq visto e pede catch-up ao reconectar (ver event-log.service.ts).
@Injectable() export class RealtimeService {
  constructor(
    private readonly gw: PickupGateway,
    private readonly log: EventLogService,
  ) {}
  private emit(room: string, event: string, payload: unknown) {
    const ev = this.log.append(room, event, payload);
    this.gw.server?.to(room).emit(event, { seq: ev.seq, data: payload });
  }
  entryCreated(schoolId: string, classroomId: string, e: unknown) {
    this.emit(`school:${schoolId}:gate`, 'queue.entry.created', e);
    this.emit(`school:${schoolId}:classroom:${classroomId}`, 'student.called', e);
  }
  entryStatus(schoolId: string, classroomId: string, e: unknown) {
    this.emit(`school:${schoolId}:gate`, 'queue.entry.status_changed', e);
    this.emit(`school:${schoolId}:classroom:${classroomId}`, 'queue.entry.status_changed', e);
    this.emit(`school:${schoolId}:admin`, 'queue.entry.status_changed', e);
  }
}
