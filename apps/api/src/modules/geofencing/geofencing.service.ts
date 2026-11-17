import { Inject, Injectable, Optional } from '@nestjs/common';
import { EphemeralStore } from '../../infra/redis/ephemeral-store';
import { MemoryEphemeralStore } from '../../infra/redis/memory-ephemeral-store';
import { RedisService } from '../../infra/redis/redis.service';
export type Zone = 'OUTSIDE' | 'APPROACH' | 'ARRIVAL';
// Estado efêmero no store compartilhado (Redis quando configurado, memória
// quando não): `geo:{schoolId}:{tutorId}`, TTL 10 min. O valor guarda SÓ a
// zona derivada — nunca lat/lng: a posição do tutor continua sem ser
// persistida (RoPA: 0 dias; ver ComplianceReportService).
// Regras: accuracy > 65m descarta; histerese de saída +40m; ARRIVAL exige 2 pings consecutivos.
interface GeoState { zone: Zone; insideCount: number; confirmed: boolean; lastTs: number }
const DEFAULT_STATE: GeoState = { zone: 'OUTSIDE', insideCount: 0, confirmed: false, lastTs: 0 };
const GEO_TTL_S = 600; // 10 min sem ping: o tutor saiu da fila / fechou o app

@Injectable() export class GeofencingService {
  private readonly memory = new MemoryEphemeralStore();

  // @Optional: fora do Nest (teste com `new`) não há RedisService — usa memória.
  constructor(@Optional() @Inject(RedisService) private readonly redis?: RedisService) {}

  // Resolvido a cada chamada: o onModuleInit do RedisService roda depois
  // dos construtores, então só aqui o modo já é o final.
  private store(): EphemeralStore {
    return this.redis?.getStore() ?? this.memory;
  }

  static haversineM(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
    const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  private async loadState(key: string): Promise<GeoState> {
    const raw = await this.store().get(key);
    if (!raw) return { ...DEFAULT_STATE };
    try {
      const parsed = JSON.parse(raw) as Partial<GeoState>;
      if (parsed.zone !== 'OUTSIDE' && parsed.zone !== 'APPROACH' && parsed.zone !== 'ARRIVAL') return { ...DEFAULT_STATE };
      return {
        zone: parsed.zone,
        insideCount: typeof parsed.insideCount === 'number' ? parsed.insideCount : 0,
        confirmed: parsed.confirmed === true,
        lastTs: typeof parsed.lastTs === 'number' ? parsed.lastTs : 0,
      };
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  async ingest(p: { schoolId: string; tutorId: string; lat: number; lng: number; accuracy?: number; point?: { lat: number; lng: number; approachM?: number; arrivalM?: number } }) {
    if ((p.accuracy ?? 0) > 65) return { accepted: false, reason: 'LOW_ACCURACY' };
    const key = `geo:${p.schoolId}:${p.tutorId}`;
    const prev = await this.loadState(key);
    // Sem PickupPoint resolvido (Step 2 busca no banco), apenas registra o ping.
    if (!p.point) { await this.store().set(key, JSON.stringify({ ...prev, lastTs: Date.now() }), GEO_TTL_S); return { accepted: true, transition: null }; }
    const dist = GeofencingService.haversineM(p.lat, p.lng, p.point.lat, p.point.lng);
    const arrival = p.point.arrivalM ?? 250, approach = p.point.approachM ?? 800;
    let zone: Zone = dist <= arrival ? 'ARRIVAL' : dist <= approach ? 'APPROACH' : 'OUTSIDE';
    if (prev.zone === 'ARRIVAL' && dist <= arrival + 40) zone = 'ARRIVAL'; // histerese de saída
    const insideCount = zone === 'ARRIVAL' ? prev.insideCount + 1 : 0;
    // ARRIVAL exige 2 pings consecutivos: o 1º ping dentro do raio ainda não
    // confirma a chegada (transition null); só o 2º emite ENTER_ARRIVAL, uma
    // única vez por entrada (flag `confirmed`, zerada ao sair do raio).
    const confirmedArrival = zone === 'ARRIVAL' && insideCount >= 2 && !prev.confirmed;
    const confirmed = zone === 'ARRIVAL' ? prev.confirmed || confirmedArrival : false;
    const transition = confirmedArrival ? 'ENTER_ARRIVAL'
      : zone === 'ARRIVAL' ? null
      : zone !== prev.zone ? `ENTER_${zone}` : null;
    await this.store().set(key, JSON.stringify({ zone, insideCount, confirmed, lastTs: Date.now() }), GEO_TTL_S);
    return { accepted: true, distanceM: Math.round(dist), zone, transition };
  }
}
