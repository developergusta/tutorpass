import { GeofencingService } from './geofencing.service';
import { MemoryEphemeralStore } from '../../infra/redis/memory-ephemeral-store';
import type { RedisService } from '../../infra/redis/redis.service';

// Escola fictícia (São Paulo): 1° de latitude ≈ 111.320 m.
const SCHOOL = { lat: -23.5505, lng: -46.6333, approachM: 800, arrivalM: 250 };
const north = (meters: number) => ({ lat: SCHOOL.lat + meters / 111320, lng: SCHOOL.lng });

describe('GeofencingService', () => {
  let svc: GeofencingService;

  beforeEach(() => {
    svc = new GeofencingService();
  });

  describe('haversineM', () => {
    it('mede ~100 m para 0,000898° de latitude', () => {
      const d = GeofencingService.haversineM(SCHOOL.lat, SCHOOL.lng, SCHOOL.lat + 0.000898, SCHOOL.lng);
      expect(d).toBeGreaterThan(95);
      expect(d).toBeLessThan(105);
    });

    it('retorna 0 para o mesmo ponto', () => {
      expect(GeofencingService.haversineM(SCHOOL.lat, SCHOOL.lng, SCHOOL.lat, SCHOOL.lng)).toBe(0);
    });
  });

  describe('ingest', () => {
    it('descarta ping com accuracy > 65 m', async () => {
      const r = await svc.ingest({ schoolId: 's1', tutorId: 't1', ...north(100), accuracy: 66, point: SCHOOL });
      expect(r.accepted).toBe(false);
      expect(r.reason).toBe('LOW_ACCURACY');
    });

    it('aceita ping sem ponto resolvido, sem transição', async () => {
      const r = await svc.ingest({ schoolId: 's1', tutorId: 't1', ...north(100), accuracy: 10 });
      expect(r.accepted).toBe(true);
      expect(r.transition).toBeNull();
    });

    it('emite ENTER_APPROACH ao entrar no raio de 800 m', async () => {
      const r = await svc.ingest({ schoolId: 's1', tutorId: 't1', ...north(500), accuracy: 10, point: SCHOOL });
      expect(r.accepted).toBe(true);
      expect(r.zone).toBe('APPROACH');
      expect(r.transition).toBe('ENTER_APPROACH');
      expect(r.distanceM).toBeGreaterThan(450);
      expect(r.distanceM).toBeLessThan(550);
    });

    it('não confirma ARRIVAL no 1º ping dentro do raio de 250 m', async () => {
      const r = await svc.ingest({ schoolId: 's1', tutorId: 't1', ...north(100), accuracy: 10, point: SCHOOL });
      expect(r.zone).toBe('ARRIVAL');
      // Regra documentada: ARRIVAL exige 2 pings consecutivos.
      expect(r.transition).toBeNull();
    });

    it('confirma ARRIVAL (ENTER_ARRIVAL) no 2º ping consecutivo', async () => {
      await svc.ingest({ schoolId: 's1', tutorId: 't1', ...north(100), accuracy: 10, point: SCHOOL });
      const r = await svc.ingest({ schoolId: 's1', tutorId: 't1', ...north(120), accuracy: 10, point: SCHOOL });
      expect(r.zone).toBe('ARRIVAL');
      expect(r.transition).toBe('ENTER_ARRIVAL');
    });

    it('não reemite ENTER_ARRIVAL no 3º ping dentro do raio', async () => {
      await svc.ingest({ schoolId: 's1', tutorId: 't1', ...north(100), accuracy: 10, point: SCHOOL });
      await svc.ingest({ schoolId: 's1', tutorId: 't1', ...north(100), accuracy: 10, point: SCHOOL });
      const r = await svc.ingest({ schoolId: 's1', tutorId: 't1', ...north(100), accuracy: 10, point: SCHOOL });
      expect(r.zone).toBe('ARRIVAL');
      expect(r.transition).toBeNull();
    });

    it('mantém ARRIVAL com histerese de +40 m (270 m ainda é chegada)', async () => {
      await svc.ingest({ schoolId: 's1', tutorId: 't1', ...north(100), accuracy: 10, point: SCHOOL });
      await svc.ingest({ schoolId: 's1', tutorId: 't1', ...north(100), accuracy: 10, point: SCHOOL });
      const r = await svc.ingest({ schoolId: 's1', tutorId: 't1', ...north(270), accuracy: 10, point: SCHOOL });
      expect(r.zone).toBe('ARRIVAL');
    });

    it('sai de ARRIVAL para APPROACH a 400 m (fora da histerese)', async () => {
      await svc.ingest({ schoolId: 's1', tutorId: 't1', ...north(100), accuracy: 10, point: SCHOOL });
      await svc.ingest({ schoolId: 's1', tutorId: 't1', ...north(100), accuracy: 10, point: SCHOOL });
      const r = await svc.ingest({ schoolId: 's1', tutorId: 't1', ...north(400), accuracy: 10, point: SCHOOL });
      expect(r.zone).toBe('APPROACH');
      expect(r.transition).toBe('ENTER_APPROACH');
    });

    it('zera a contagem de pings ao sair do raio de chegada', async () => {
      await svc.ingest({ schoolId: 's1', tutorId: 't1', ...north(100), accuracy: 10, point: SCHOOL });
      await svc.ingest({ schoolId: 's1', tutorId: 't1', ...north(500), accuracy: 10, point: SCHOOL });
      const r = await svc.ingest({ schoolId: 's1', tutorId: 't1', ...north(100), accuracy: 10, point: SCHOOL });
      expect(r.transition).toBeNull(); // precisa de 2 pings de novo
    });

    it('isola o estado por tutor/escola', async () => {
      await svc.ingest({ schoolId: 's1', tutorId: 't1', ...north(100), accuracy: 10, point: SCHOOL });
      const r = await svc.ingest({ schoolId: 's1', tutorId: 't2', ...north(100), accuracy: 10, point: SCHOOL });
      expect(r.transition).toBeNull(); // tutor t2 ainda está no 1º ping
    });

    it('compartilha o estado entre instâncias com o mesmo store (multi-instância)', async () => {
      // Duas instâncias do serviço compartilhando UM store (o papel do Redis):
      // o 1º ping chega na instância A e o 2º na B — a chegada precisa ser
      // confirmada mesmo assim (antes, cada instância tinha seu próprio Map).
      const shared = new MemoryEphemeralStore();
      const fakeRedis = { getStore: () => shared } as unknown as RedisService;
      const svcA = new GeofencingService(fakeRedis);
      const svcB = new GeofencingService(fakeRedis);
      const first = await svcA.ingest({ schoolId: 's1', tutorId: 't1', ...north(100), accuracy: 10, point: SCHOOL });
      expect(first.transition).toBeNull(); // 1º ping: ainda não confirma
      const second = await svcB.ingest({ schoolId: 's1', tutorId: 't1', ...north(120), accuracy: 10, point: SCHOOL });
      expect(second.zone).toBe('ARRIVAL');
      expect(second.transition).toBe('ENTER_ARRIVAL');
    });
  });
});
