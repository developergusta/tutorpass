import { Injectable } from '@nestjs/common';
import { PickupGateway } from './pickup.gateway';
import { EventLogService } from './event-log.service';
// Único ponto de emissão: garante payload mínimo e room correta. Nunca broadcast global.
// Cada emissão recebe um seq por room (EventLogService) e sai como envelope { seq, data } —
// o cliente guarda o último seq visto e pede catch-up ao reconectar (ver event-log.service.ts).
// A emissão é async porque o log pode viver em Redis Streams: o `await` antes do emit
// garante que o seq do envelope é o mesmo que ficou gravado — sem ele, uma segunda
// emissão podia sair com o seq antes da primeira ter sido persistida.
@Injectable() export class RealtimeService {
  constructor(
    private readonly gw: PickupGateway,
    private readonly log: EventLogService,
  ) {}
  private async emit(room: string, event: string, payload: unknown) {
    const ev = await this.log.append(room, event, payload);
    this.gw.server?.to(room).emit(event, { seq: ev.seq, data: payload });
  }
  async entryCreated(schoolId: string, classroomId: string, e: unknown) {
    await this.emit(`school:${schoolId}:gate`, 'queue.entry.created', e);
    await this.emit(`school:${schoolId}:classroom:${classroomId}`, 'student.called', e);
  }
  async entryStatus(schoolId: string, classroomId: string, e: unknown) {
    await this.emit(`school:${schoolId}:gate`, 'queue.entry.status_changed', e);
    await this.emit(`school:${schoolId}:classroom:${classroomId}`, 'queue.entry.status_changed', e);
    await this.emit(`school:${schoolId}:admin`, 'queue.entry.status_changed', e);
  }
}
