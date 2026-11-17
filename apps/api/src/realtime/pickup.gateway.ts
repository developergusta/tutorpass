import { WebSocketGateway, WebSocketServer, SubscribeMessage, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GeofencingService } from '../modules/geofencing/geofencing.service';
import { EventLogService } from './event-log.service';
// Namespace único; rooms: school:{id}:gate | school:{id}:classroom:{id} | school:{id}:admin | tutor:{id}
// Auth: JWT no handshake (socket.handshake.auth.token) — validar no handleConnection em prod (TODO Step 2: JwtService).
@WebSocketGateway({ namespace: '/pickup', cors: { origin: '*' } })
export class PickupGateway {
  @WebSocketServer() server!: Server;
  constructor(
    private readonly geo: GeofencingService,
    private readonly log: EventLogService,
  ) {}
  async handleConnection(client: Socket) {
    const { schoolId, classroomId, role, tutorId } = client.handshake.auth as any;
    if (!schoolId) return client.disconnect();
    if (role === 'GATE_AGENT' || role === 'COORDINATOR') client.join(`school:${schoolId}:gate`);
    if (role === 'ADMIN' || role === 'COORDINATOR') client.join(`school:${schoolId}:admin`);
    if (role === 'TEACHER' && classroomId) client.join(`school:${schoolId}:classroom:${classroomId}`);
    if (role === 'TUTOR' && tutorId) client.join(`tutor:${tutorId}`);
    // Snapshot inicial só da room do cliente é emitido pelo PickupService no join (ver docs/03).
  }
  @SubscribeMessage('tutor.location.update')
  async onLocation(@ConnectedSocket() client: Socket, @MessageBody() body: { lat: number; lng: number; accuracy?: number; ts?: number }) {
    const { schoolId, tutorId } = client.handshake.auth as any;
    // O gateway NÃO retransmite GPS: só devolve a transição, se houver. Emissão p/ rooms é do PickupService.
    return this.geo.ingest({ schoolId, tutorId, ...body });
  }
  // Catch-up após reconexão: o cliente manda o último seq que viu na room e recebe
  // só o que perdeu. Só vale para rooms que o próprio socket entrou (client.rooms);
  // hasGap=true significa que o pedido é mais antigo que o buffer — aí o cliente
  // pede snapshot completo em vez de aplicar os eventos.
  @SubscribeMessage('events.catch_up')
  async onCatchUp(@ConnectedSocket() client: Socket, @MessageBody() body: { room: string; lastSeenSeq?: number }) {
    const room = body?.room;
    if (!room || typeof room !== 'string' || !client.rooms.has(room)) {
      return { ok: false, error: 'ROOM_NOT_JOINED' };
    }
    const lastSeen = typeof body.lastSeenSeq === 'number' && body.lastSeenSeq >= 0 ? Math.floor(body.lastSeenSeq) : 0;
    return { ok: true, room, ...(await this.log.getSince(room, lastSeen)) };
  }
}
