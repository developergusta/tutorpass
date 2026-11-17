import { Injectable } from '@nestjs/common';

// ETA ao vivo do tutor + fila ordenada por proximidade (painel da portaria).
// Lógica pura, in-memory como os demais serviços; persistência no Step 2.
// Inspiração (pesquisa frente c, ciclo 11): ReadyBell (ETA com chip + contagem
// regressiva, fila por urgência), Technothera (ordem automática
// Chegou → Pronto → Contagem regressiva), PickupFlow/SafePickApp (ETA em minutos
// por família), ClipEscola ("Estou Chegando": cores por raio, < 40 m = vermelho,
// "encaminhar já"), Escola Ágil/Cheguei (ETA em faixas de 2, 5 e 10 min).
//
// O ETA é uma ESTIMATIVA: distância em linha reta (haversine, vinda do
// GeofencingService) dividida pela velocidade. Não é tempo de rota com
// trânsito (ReadyBell usa MapKit p/ isso) — isso é fase 2, com provedor de
// rotas. O painel deve exibir "cerca de N min", nunca um horário exato.
// Posição do tutor nunca é persistida (minimização LGPD): o estado vive só
// em memória e some no `refresh()` após 5 min sem atualização.

export type EtaBand = 'HERE' | 'NOW' | 'SOON' | 'LATER' | 'FAR' | 'STALE';
export type TravelMode = 'CAR' | 'WALK';
/** Cor de urgência no painel (ClipEscola/Technothera). */
export type UrgencyColor = 'RED' | 'ORANGE' | 'YELLOW' | 'BLUE' | 'GRAY';

export const ARRIVAL_RADIUS_M = 250; // mesmo default do GeofencingService
export const STALE_AFTER_MS = 60_000; // sem atualização por 60 s → STALE
export const PURGE_AFTER_MS = 5 * 60_000; // sem atualização por 5 min → fora da fila
export const DEFAULT_SPEED_KMH: Record<TravelMode, number> = { CAR: 30, WALK: 5 };

export interface QueueEntry {
  schoolId: string;
  tutorId: string;
  distanceM: number;
  speedKmh: number;
  mode: TravelMode;
  /** ETA em minutos (arredondado p/ cima); null quando STALE. */
  etaMinutes: number | null;
  band: EtaBand;
  color: UrgencyColor;
  /** Quando o tutor chegou (geofence ARRIVAL ou botão "Estou aqui"). */
  arrivedAt: Date | null;
  updatedAt: Date;
  stale: boolean;
  /** Posição na fila (1 = próximo a ser chamado); preenchido por getQueue. */
  position?: number;
}

const BAND_COLOR: Record<EtaBand, UrgencyColor> = {
  HERE: 'RED', // "encaminhar já" — o aluno precisa sair agora
  NOW: 'ORANGE',
  SOON: 'YELLOW',
  LATER: 'BLUE',
  FAR: 'GRAY',
  STALE: 'GRAY',
};

function bandFor(etaMinutes: number): EtaBand {
  if (etaMinutes <= 2) return 'NOW';
  if (etaMinutes <= 5) return 'SOON';
  if (etaMinutes <= 10) return 'LATER';
  return 'FAR';
}

@Injectable()
export class EtaService {
  private entries = new Map<string, QueueEntry>();

  private key(schoolId: string, tutorId: string) {
    return `${schoolId}:${tutorId}`;
  }

  private compute(input: {
    schoolId: string;
    tutorId: string;
    distanceM: number;
    speedKmh: number;
    mode: TravelMode;
    arrivedAt: Date | null;
    updatedAt: Date;
  }): QueueEntry {
    const here =
      input.arrivedAt !== null || input.distanceM <= ARRIVAL_RADIUS_M;
    const etaMinutes = here
      ? 0
      : Math.ceil(input.distanceM / ((input.speedKmh * 1000) / 3600) / 60);
    const band: EtaBand = here ? 'HERE' : bandFor(etaMinutes);
    return {
      schoolId: input.schoolId,
      tutorId: input.tutorId,
      distanceM: Math.max(0, Math.round(input.distanceM)),
      speedKmh: input.speedKmh,
      mode: input.mode,
      etaMinutes,
      band,
      color: BAND_COLOR[band],
      arrivedAt: input.arrivedAt,
      updatedAt: input.updatedAt,
      stale: false, // frescor é avaliado em `view()` a cada leitura
    };
  }

  /** Vista de uma entrada num instante `now` (aplica STALE sem mutar o estado). */
  private view(entry: QueueEntry, now: Date): QueueEntry {
    if (entry.band === 'HERE') return { ...entry };
    const isStale = now.getTime() - entry.updatedAt.getTime() > STALE_AFTER_MS;
    if (!isStale) return { ...entry };
    return { ...entry, stale: true, band: 'STALE', color: 'GRAY', etaMinutes: null };
  }

  /**
   * Recebe a posição mais recente do tutor. A distância vem do
   * GeofencingService (haversine até o ponto da escola); a velocidade, do
   * GPS quando disponível — sem ela, usa o default do modo (30 km/h carro,
   * 5 km/h a pé). Velocidade inválida (<= 0) também cai no default.
   */
  updatePosition(
    input: {
      schoolId: string;
      tutorId: string;
      distanceM: number;
      speedKmh?: number;
      mode?: TravelMode;
    },
    now: Date = new Date(),
  ): QueueEntry {
    const mode = input.mode ?? 'CAR';
    const prev = this.entries.get(this.key(input.schoolId, input.tutorId));
    const speedKmh =
      input.speedKmh !== undefined && input.speedKmh > 0
        ? Math.min(input.speedKmh, 130)
        : DEFAULT_SPEED_KMH[mode];
    // Histerese de saída (mesma do geofence, +40 m): um tutor marcado como
    // chegado só "des-chega" se o GPS o colocar bem fora do raio — evita
    // o vai-e-volta por imprecisão do GPS na porta da escola.
    const arrivedAt =
      prev?.arrivedAt && input.distanceM > ARRIVAL_RADIUS_M + 40
        ? null
        : prev?.arrivedAt ?? null;
    const entry = this.compute({
      ...input,
      speedKmh,
      mode,
      arrivedAt,
      updatedAt: now,
    });
    this.entries.set(this.key(input.schoolId, input.tutorId), entry);
    return this.view(entry, now);
  }

  /**
   * Botão "Estou aqui" (RIS ONE / PickupFlow): fallback manual quando o GPS
   * falha ou o tutor está a pé sem localização. Marca o tutor como chegado
   * mesmo sem posição recente — cria a entrada se ainda não existir.
   */
  markArrived(
    schoolId: string,
    tutorId: string,
    mode: TravelMode = 'CAR',
    now: Date = new Date(),
  ): QueueEntry {
    const prev = this.entries.get(this.key(schoolId, tutorId));
    const entry = this.compute({
      schoolId,
      tutorId,
      distanceM: prev?.distanceM ?? 0,
      speedKmh: prev?.speedKmh ?? DEFAULT_SPEED_KMH[mode],
      mode: prev?.mode ?? mode,
      arrivedAt: now,
      updatedAt: now,
    });
    this.entries.set(this.key(schoolId, tutorId), entry);
    return { ...entry };
  }

  /** Retirada concluída (ou tutor desistiu): sai da fila. */
  removeTutor(schoolId: string, tutorId: string): boolean {
    return this.entries.delete(this.key(schoolId, tutorId));
  }

  getEntry(schoolId: string, tutorId: string, now: Date = new Date()): QueueEntry | null {
    const entry = this.entries.get(this.key(schoolId, tutorId));
    return entry ? this.view(entry, now) : null;
  }

  /**
   * A fila da portaria, ordenada p/ chamar: primeiro quem já chegou (pela
   * ordem de chegada), depois por ETA crescente (desempate: menor distância),
   * por último os STALE (sem posição há > 60 s — o painel mostra "sem sinal",
   * nunca um ETA inventado).
   */
  getQueue(schoolId: string, now: Date = new Date()): QueueEntry[] {
    const list = [...this.entries.values()]
      .filter((e) => e.schoolId === schoolId)
      .map((e) => this.view(e, now));
    const rank = (e: QueueEntry): [number, number, number, number] => {
      if (e.band === 'STALE') return [2, 0, 0, e.updatedAt.getTime()];
      if (e.band === 'HERE')
        return [0, 0, 0, e.arrivedAt?.getTime() ?? e.updatedAt.getTime()];
      return [1, e.etaMinutes ?? Number.MAX_SAFE_INTEGER, e.distanceM, e.updatedAt.getTime()];
    };
    list.sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
      return 0;
    });
    return list.map((e, i) => ({ ...e, position: i + 1 }));
  }

  count(schoolId: string): number {
    return [...this.entries.values()].filter((e) => e.schoolId === schoolId).length;
  }

  /** Job periódico (junto aos demais refreshes): tira da fila quem não atualiza há 5 min. Idempotente. */
  refresh(now: Date = new Date()): { removed: number } {
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (now.getTime() - entry.updatedAt.getTime() > PURGE_AFTER_MS) {
        this.entries.delete(key);
        removed++;
      }
    }
    return { removed };
  }
}
