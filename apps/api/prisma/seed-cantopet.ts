// Seed idempotente do tenant de demonstração CantoPet (Suzano/SP):
//   - Criar/atualizar (idempotente):
//     `pnpm --filter @tutorpass/api seed:cantopet`
//     (ou `npx tsc -p apps/api/tsconfig.json && node apps/api/dist/prisma/seed-cantopet.js`)
//   - Remover completamente o tenant CantoPet (sem tocar em nenhum outro tenant):
//     `pnpm --filter @tutorpass/api seed:cantopet:remove`
//     (ou `node apps/api/dist/prisma/seed-cantopet.js --remove`)
//
// Fonte única de verdade: adaptacao-cantopet.md (@cantopetsuzano).
// - Nomes reais dos 4 pets: Aurorinha, Tampinha, Sol, Minduim.
// - Nomes dos donos (tutores) e delegados: exemplos claramente identificados
//   como placeholder (as legendas do Instagram não nomeiam os donos).
// - Horário de funcionamento da creche: 07:00–18:00 (entregas entre 17:00 e 18:00).
// - Hashes do PickupLog e transições de fila gerados pelos serviços de domínio
//   reais (PickupService, QrTokenService, DismissalPlanService,
//   TemporaryAuthorizationService), nunca escritos à mão furando a regra.
// - Suporta execução direta no Prisma (DATABASE_URL) e sincronização HTTP
//   idempotente com a API em execução (API_BASE_URL, ex.: http://localhost:3333
//   ou http://187.53.122.5) para alimentar a fila ao vivo da portaria e do telão.

import {
  DismissalMode,
  PetSize,
  PickupEventType,
  Prisma,
  PrismaClient,
  QueueStatus,
  Relationship,
  Role,
} from '@prisma/client';
import { randomBytes, createHash } from 'crypto';
import { hashPassword } from '../src/modules/auth/auth.service';
import { TemporaryAuthorizationService } from '../src/modules/delegations/temporary-authorization.service';
import { DismissalPlanService } from '../src/modules/dismissal-plans/dismissal-plan.service';
import { NotificationService } from '../src/modules/notifications/notification.service';
import {
  DayAttendanceRecord,
  DayAttendanceService,
  formatIsoDateInTimezone,
} from '../src/modules/pickup/day-attendance.service';
import {
  PickupLogEntry,
  PickupQueueEntry,
  PickupService,
  PickupSource,
} from '../src/modules/pickup/pickup.service';
import { QrTokenService } from '../src/modules/qr/qr-token.service';

export const CANTOPET_SCHOOL_SLUG = 'cantopet-suzano';
export const CANTOPET_SCHOOL_NAME = 'CantoPet — Creche e Hotel para Cães';
export const CANTOPET_SHARED_PASSWORD = 'CantoPet#2026!';
export const CANTOPET_BUSINESS_HOURS = '07:00–18:00';
export const CANTOPET_RECEPTION_GATE = 'Recepção Principal';

export interface CantoPetClassroomSeed {
  name: string;
  grade: string;
  roomLocation: string;
  academicYear: number;
}

export interface CantoPetVaccinationSeed {
  vaccineName: string;
  appliedAt: string; // YYYY-MM-DD
  expiresAt: string; // YYYY-MM-DD
  notes?: string;
}

export interface CantoPetProfileSeed {
  breed: string;
  size: PetSize;
  sex: string;
  weightKg: number;
  isNeutered: boolean;
  behaviorNotes: string;
  restrictions: string;
  feedingFood: string;
  feedingPortionGrams: number;
  feedingTimes: string[];
  vetName: string;
  vetClinic: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  dewormingUpToDate: boolean;
  dewormingLastDate: string; // YYYY-MM-DD
  fleaControlUpToDate: boolean;
  fleaControlLastDate: string; // YYYY-MM-DD
  allergies?: string;
  medicationName?: string;
  medicationDosage?: string;
  medicationSchedule?: string;
  vaccinations: CantoPetVaccinationSeed[];
}

export interface CantoPetPetSeed {
  name: string;
  enrollmentCode: string;
  classroomName: string;
  ownerEmail: string;
  usualPickupTime: string;
  defaultPickupBy: string;
  defaultNote: string;
  delegateName: string;
  delegateRelationLabel: string;
  delegateDocument: string;
  delegateSelfieUrl: string;
  /** Horário de check-in da manhã hoje (entre 07:00 e 08:30, fuso America/Sao_Paulo). */
  morningCheckInTime: string;
  fichaExample: CantoPetProfileSeed;
  todayDemoState:
    | { kind: 'RELEASED_TODAY'; hour: number; minute: number; waitMinutes: number; source: PickupSource }
    | { kind: 'IN_QUEUE_NOW'; source: 'GEOFENCE' | 'QR_GATE'; called: boolean; minutesAgo: number };
}

export interface CantoPetUserSeed {
  email: string;
  name: string;
  role: Role;
  phone?: string;
  document?: string;
  classroomName?: string;
  petCode?: string;
  relationship?: Relationship;
  isPlaceholderOwner?: boolean;
}

export interface CantoPetHistoricalRun {
  businessDaysAgo: number;
  dateIso: string; // YYYY-MM-DD
  petCode: string;
  source: PickupSource;
  joinedAt: Date;
  calledAt: Date;
  validatedAt: Date;
  releasedAt: Date;
  usedDelegation: boolean;
}

export interface CantoPetSeedBlueprint {
  school: {
    name: string;
    slug: string;
    timezone: string;
    businessHours: string;
  };
  plan: { tier: 'PRO'; trialDays: number };
  classrooms: CantoPetClassroomSeed[];
  pets: CantoPetPetSeed[];
  users: CantoPetUserSeed[];
  passwordByEmail: Record<string, string>;
}

/**
 * Calcula os últimos N dias úteis (seg–sex) anteriores à data de referência.
 * Retorna do mais antigo para o mais recente.
 */
export function getLastBusinessDays(reference: Date, count: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()),
  );
  while (days.length < count) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      days.unshift(new Date(cursor));
    }
  }
  return days;
}

/**
 * Gera UUID v5-like determinístico a partir de uma chave textual para que
 * `PickupQueueEntry` e `PickupLog` possam usar `upsert` idempotente sem
 * duplicar registros ao rodar o seed múltiplas vezes.
 */
export function deterministicUuid(key: string): string {
  const hex = createHash('sha256').update(`cantopet:${key}`).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `a${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

export function buildCantoPetSeedBlueprint(now: Date = new Date()): CantoPetSeedBlueprint {
  const year = now.getUTCFullYear();

  const classrooms: CantoPetClassroomSeed[] = [
    {
      name: 'Pequenos & Calmos',
      grade: 'Creche · Funcionamento 07:00–18:00',
      roomLocation: 'Gramado Natural & Área Interna A',
      academicYear: year,
    },
    {
      name: 'Ativos & Brincalhões',
      grade: 'Creche · Socialização & Enriquecimento (07:00–18:00)',
      roomLocation: 'Pátio da Piscina & Gramado B',
      academicYear: year,
    },
    {
      name: 'Hotel — Pernoite',
      grade: 'Hospedagem · Quartos Individuais Arejados',
      roomLocation: 'Ala Nova do Hotel (Quartos Individuais)',
      academicYear: year,
    },
  ];

  const isoDateOffset = (daysDelta: number) =>
    new Date(now.getTime() + daysDelta * 86_400_000).toISOString().slice(0, 10);

  const pets: CantoPetPetSeed[] = [
    {
      name: 'Aurorinha',
      enrollmentCode: 'CPET-001',
      classroomName: 'Pequenos & Calmos',
      ownerEmail: 'tutor.aurorinha.cantopet@tutorpass.com.br',
      usualPickupTime: '17:15',
      defaultPickupBy: 'Camila (Tutora — Exemplo)',
      defaultNote: 'Horário habitual de retirada: 17:15 (creche 07:00–18:00). Verificar armário individual.',
      delegateName: 'Roberto (Cônjuge — Exemplo)',
      delegateRelationLabel: 'Cônjuge autorizado (Exemplo)',
      delegateDocument: '28491037801',
      delegateSelfieUrl: 'https://demo.tutorpass.app/selfies/cantopet-delegado-roberto.jpg',
      morningCheckInTime: '07:15',
      fichaExample: {
        breed: 'Spitz Alemão (Exemplo)',
        size: 'PEQUENO',
        sex: 'Fêmea (Exemplo)',
        weightKg: 3.4,
        isNeutered: true,
        behaviorNotes: 'Dócil e sociável (aprovada na avaliação comportamental — Exemplo). Adora o gramado natural.',
        restrictions: 'Pelagem dupla: escovação suave, evitar coleira de pescoço (usar peitoral — Exemplo).',
        feedingFood: 'Ração Super Premium Mini Spitz (Exemplo)',
        feedingPortionGrams: 45,
        feedingTimes: ['12:00', '16:30'],
        vetName: 'Dra. Fernanda Lima (Exemplo)',
        vetClinic: 'Clínica Veterinária Suzano Pet (Exemplo)',
        emergencyContactName: 'Camila / Roberto (Exemplo)',
        emergencyContactPhone: '11971001001',
        dewormingUpToDate: true,
        dewormingLastDate: isoDateOffset(-25),
        fleaControlUpToDate: true,
        fleaControlLastDate: isoDateOffset(-15),
        allergies: 'Sensibilidade a petiscos com corante artificial (Exemplo)',
        vaccinations: [
          {
            vaccineName: 'V10 (Múltipla)',
            appliedAt: isoDateOffset(-160),
            expiresAt: isoDateOffset(205),
            notes: 'Em dia — carteira conferida na recepção (Exemplo)',
          },
          {
            vaccineName: 'Antirrábica',
            appliedAt: isoDateOffset(-345),
            expiresAt: isoDateOffset(20),
            notes: 'Vence em menos de 30 dias — avisar tutora p/ reforço (Exemplo)',
          },
        ],
      },
      todayDemoState: {
        kind: 'RELEASED_TODAY',
        hour: 17,
        minute: 14,
        waitMinutes: 3,
        source: 'GEOFENCE',
      },
    },
    {
      name: 'Tampinha',
      enrollmentCode: 'CPET-002',
      classroomName: 'Ativos & Brincalhões',
      ownerEmail: 'tutor.tampinha.cantopet@tutorpass.com.br',
      usualPickupTime: '17:30',
      defaultPickupBy: 'Rafael (Tutor — Exemplo)',
      defaultNote: 'Horário habitual de retirada: 17:30 (creche 07:00–18:00). Rotina completa com treino e almocinho.',
      delegateName: 'Helena (Avó — Exemplo)',
      delegateRelationLabel: 'Familiar autorizada (Exemplo)',
      delegateDocument: '19384756802',
      delegateSelfieUrl: 'https://demo.tutorpass.app/selfies/cantopet-delegada-helena.jpg',
      morningCheckInTime: '07:40',
      fichaExample: {
        breed: 'Spitz Alemão (Exemplo)',
        size: 'PEQUENO',
        sex: 'Macho (Exemplo)',
        weightKg: 4.1,
        isNeutered: true,
        behaviorNotes: 'Muito participativo no enriquecimento ambiental, treino e soneca pós-almocinho (Exemplo).',
        restrictions: 'Secar bem as patinhas após atividade no gramado (Exemplo).',
        feedingFood: 'Ração Super Premium Cães Pequenos (Exemplo)',
        feedingPortionGrams: 55,
        feedingTimes: ['12:15'],
        vetName: 'Dr. Marcelo Prado (Exemplo)',
        vetClinic: 'Centro Veterinário Central Suzano (Exemplo)',
        emergencyContactName: 'Rafael / Helena (Exemplo)',
        emergencyContactPhone: '11971001002',
        dewormingUpToDate: true,
        dewormingLastDate: isoDateOffset(-20),
        fleaControlUpToDate: true,
        fleaControlLastDate: isoDateOffset(-10),
        allergies: 'Nenhuma alergia relatada (Exemplo)',
        medicationName: 'Condroprotetor Articular + Ômega 3 (Exemplo)',
        medicationDosage: '1 cápsula palatável (Exemplo)',
        medicationSchedule: '12:30 (logo após o almocinho na creche — Exemplo)',
        vaccinations: [
          {
            vaccineName: 'V10 (Múltipla)',
            appliedAt: isoDateOffset(-120),
            expiresAt: isoDateOffset(245),
            notes: 'Reforço anual em dia (Exemplo)',
          },
          {
            vaccineName: 'Antirrábica',
            appliedAt: isoDateOffset(-120),
            expiresAt: isoDateOffset(245),
            notes: 'Reforço anual em dia (Exemplo)',
          },
          {
            vaccineName: 'Gripe Canina (Tosse dos Canis)',
            appliedAt: isoDateOffset(-90),
            expiresAt: isoDateOffset(275),
            notes: 'Obrigatória p/ socialização em creche (Exemplo)',
          },
        ],
      },
      todayDemoState: {
        kind: 'IN_QUEUE_NOW',
        source: 'GEOFENCE',
        called: true,
        minutesAgo: 4,
      },
    },
    {
      name: 'Sol',
      enrollmentCode: 'CPET-003',
      classroomName: 'Ativos & Brincalhões',
      ownerEmail: 'tutor.sol.cantopet@tutorpass.com.br',
      usualPickupTime: '17:45',
      defaultPickupBy: 'Juliana (Tutora — Exemplo)',
      defaultNote: 'Horário habitual de retirada: 17:45 (creche 07:00–18:00). Conferir guia no portão antes de abrir.',
      delegateName: 'Marcos (Irmão — Exemplo)',
      delegateRelationLabel: 'Irmão autorizado (Exemplo)',
      delegateDocument: '37482910803',
      delegateSelfieUrl: 'https://demo.tutorpass.app/selfies/cantopet-delegado-marcos.jpg',
      morningCheckInTime: '08:05',
      fichaExample: {
        breed: 'Golden Retriever (Exemplo)',
        size: 'GRANDE',
        sex: 'Fêmea (Exemplo)',
        weightKg: 26.5,
        isNeutered: true,
        behaviorNotes: 'Extremamente dócil e brincalhona; adora a piscina da creche (Exemplo).',
        restrictions: 'Pelagem longa na barba e orelhas: atenção redobrada com resíduos e umidade pós-piscina (Exemplo).',
        feedingFood: 'Ração Super Premium Raças Grandes (Exemplo)',
        feedingPortionGrams: 180,
        feedingTimes: ['12:00', '17:00'],
        vetName: 'Dra. Patrícia Nogueira (Exemplo)',
        vetClinic: 'Hospital Veterinário Alto Tietê (Exemplo)',
        emergencyContactName: 'Juliana / Marcos (Exemplo)',
        emergencyContactPhone: '11971001003',
        dewormingUpToDate: true,
        dewormingLastDate: isoDateOffset(-35),
        fleaControlUpToDate: true,
        fleaControlLastDate: isoDateOffset(-18),
        allergies: 'Shampoo comum — usar linha hipoalergênica/terapêutica no banho (Exemplo)',
        vaccinations: [
          {
            vaccineName: 'V10 (Múltipla)',
            appliedAt: isoDateOffset(-190),
            expiresAt: isoDateOffset(175),
            notes: 'Em dia (Exemplo)',
          },
          {
            vaccineName: 'Antirrábica',
            appliedAt: isoDateOffset(-380),
            expiresAt: isoDateOffset(-15),
            notes: 'Vencida há 15 dias — cobrar comprovante atualizado na recepção (Exemplo)',
          },
        ],
      },
      todayDemoState: {
        kind: 'IN_QUEUE_NOW',
        source: 'QR_GATE',
        called: false,
        minutesAgo: 2,
      },
    },
    {
      name: 'Minduim',
      enrollmentCode: 'CPET-004',
      classroomName: 'Hotel — Pernoite',
      ownerEmail: 'tutor.minduim.cantopet@tutorpass.com.br',
      usualPickupTime: '17:50',
      defaultPickupBy: 'Lucas (Tutor — Exemplo)',
      defaultNote: 'Horário habitual de retirada/check-out: 17:50 (janela 07:00–18:00). Quarto individual do Hotel.',
      delegateName: 'Patrícia (Cônjuge — Exemplo)',
      delegateRelationLabel: 'Cônjuge autorizada (Exemplo)',
      delegateDocument: '48592011804',
      delegateSelfieUrl: 'https://demo.tutorpass.app/selfies/cantopet-delegada-patricia.jpg',
      morningCheckInTime: '08:20',
      fichaExample: {
        breed: 'Pug (Exemplo)',
        size: 'PEQUENO',
        sex: 'Macho (Exemplo)',
        weightKg: 7.8,
        isNeutered: false,
        behaviorNotes: 'Calmo e sociável; primeira adaptação na casa concluída com sucesso (Exemplo).',
        restrictions: 'Braquicefálico: evitar exercício intenso nos horários mais quentes; manter em quarto arejado (Exemplo).',
        feedingFood: 'Ração Super Premium Pequeno Porte Sensitive (Exemplo)',
        feedingPortionGrams: 75,
        feedingTimes: ['08:30', '12:30', '17:15'],
        vetName: 'Dr. Henrique Bastos (Exemplo)',
        vetClinic: 'Clínica Veterinária Suzano Pet (Exemplo)',
        emergencyContactName: 'Lucas / Patrícia (Exemplo)',
        emergencyContactPhone: '11971001004',
        dewormingUpToDate: true,
        dewormingLastDate: isoDateOffset(-12),
        fleaControlUpToDate: true,
        fleaControlLastDate: isoDateOffset(-12),
        allergies: 'Limpeza das dobrinhas faciais apenas com solução fisiológica (Exemplo)',
        vaccinations: [
          {
            vaccineName: 'V10 (Múltipla)',
            appliedAt: isoDateOffset(-60),
            expiresAt: isoDateOffset(305),
            notes: 'Conferida na entrada do Hotel (Exemplo)',
          },
          {
            vaccineName: 'Antirrábica',
            appliedAt: isoDateOffset(-60),
            expiresAt: isoDateOffset(305),
            notes: 'Conferida na entrada do Hotel (Exemplo)',
          },
        ],
      },
      todayDemoState: {
        kind: 'RELEASED_TODAY',
        hour: 17,
        minute: 22,
        waitMinutes: 4,
        source: 'QR_GATE',
      },
    },
  ];

  const users: CantoPetUserSeed[] = [
    {
      email: 'admin.cantopet@tutorpass.com.br',
      name: 'Administração CantoPet',
      role: 'ADMIN',
      phone: '11940820896',
    },
    {
      email: 'portaria.cantopet@tutorpass.com.br',
      name: 'Recepção CantoPet',
      role: 'GATE_AGENT',
      phone: '11940820897',
    },
    {
      email: 'monitor.pequenos.cantopet@tutorpass.com.br',
      name: 'Monitoria — Pequenos',
      role: 'TEACHER',
      classroomName: 'Pequenos & Calmos',
      phone: '11940820898',
    },
    {
      email: 'monitor.ativos.cantopet@tutorpass.com.br',
      name: 'Monitoria — Ativos',
      role: 'TEACHER',
      classroomName: 'Ativos & Brincalhões',
      phone: '11940820899',
    },
    {
      email: 'tutor.aurorinha.cantopet@tutorpass.com.br',
      name: 'Camila (Tutora da Aurorinha — Exemplo)',
      role: 'TUTOR',
      phone: '11971001001',
      document: '51029384701',
      petCode: 'CPET-001',
      relationship: 'GUARDIAN',
      isPlaceholderOwner: true,
    },
    {
      email: 'tutor.tampinha.cantopet@tutorpass.com.br',
      name: 'Rafael (Tutor do Tampinha — Exemplo)',
      role: 'TUTOR',
      phone: '11971001002',
      document: '51029384702',
      petCode: 'CPET-002',
      relationship: 'GUARDIAN',
      isPlaceholderOwner: true,
    },
    {
      email: 'tutor.sol.cantopet@tutorpass.com.br',
      name: 'Juliana (Tutora do Sol — Exemplo)',
      role: 'TUTOR',
      phone: '11971001003',
      document: '51029384703',
      petCode: 'CPET-003',
      relationship: 'GUARDIAN',
      isPlaceholderOwner: true,
    },
    {
      email: 'tutor.minduim.cantopet@tutorpass.com.br',
      name: 'Lucas (Tutor do Minduim — Exemplo)',
      role: 'TUTOR',
      phone: '11971001004',
      document: '51029384704',
      petCode: 'CPET-004',
      relationship: 'GUARDIAN',
      isPlaceholderOwner: true,
    },
  ];

  return {
    school: {
      name: CANTOPET_SCHOOL_NAME,
      slug: CANTOPET_SCHOOL_SLUG,
      timezone: 'America/Sao_Paulo',
      businessHours: CANTOPET_BUSINESS_HOURS,
    },
    plan: { tier: 'PRO', trialDays: 30 },
    classrooms,
    pets,
    users,
    passwordByEmail: Object.fromEntries(users.map((u) => [u.email, CANTOPET_SHARED_PASSWORD])),
  };
}

/**
 * Executa a simulação completa pelos serviços de domínio reais:
 * - DismissalPlanService: planos padrão de segunda a sexta (1..5) entre 17:00 e 18:00
 * - TemporaryAuthorizationService: autorizações de retirada para segundos responsáveis
 * - QrTokenService + PickupService: histórico dos últimos 5 dias úteis por pet +
 *   operação do dia de hoje (2 pets já retirados hoje + 2 pets ativos na fila agora:
 *   Tampinha via GEOFENCE já chamado, Sol via QR_GATE na fila).
 *
 * Todos os hashes do PickupLog são gerados por PickupService e verificados com
 * `pickupService.verifyChain(schoolId)`.
 */
export async function generateCantoPetDomainArtifacts(params: {
  schoolId: string;
  adminUserId: string;
  gateAgentUserId: string;
  studentIdByCode: Map<string, string>;
  tutorIdByCode: Map<string, string>;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const blueprint = buildCantoPetSeedBlueprint(now);

  const dismissalPlans = new DismissalPlanService();
  const delegations = new TemporaryAuthorizationService();
  const qrService = new QrTokenService();
  const notifications = new NotificationService();
  const attendanceService = new DayAttendanceService(
    undefined,
    undefined,
    dismissalPlans,
    notifications,
    undefined,
  );
  const pickupService = new PickupService(
    qrService,
    undefined,
    undefined,
    undefined,
    attendanceService,
  );

  // 1. DismissalDefaultPlan (segunda a sexta = 1..5) usando DismissalPlanService
  for (const pet of blueprint.pets) {
    const studentId = params.studentIdByCode.get(pet.enrollmentCode);
    if (!studentId) throw new Error(`Pet ${pet.enrollmentCode} sem studentId`);
    dismissalPlans.setDefault(
      {
        schoolId: params.schoolId,
        studentId,
        weekday: 1,
        mode: 'CAR',
        pickupBy: `${pet.defaultPickupBy} · ${pet.usualPickupTime}`,
        note: pet.defaultNote,
        setBy: params.adminUserId,
        setByRole: 'STAFF',
      },
      now,
    );
    dismissalPlans.copyDefault(
      params.schoolId,
      studentId,
      1,
      [2, 3, 4, 5],
      params.adminUserId,
      now,
    );
  }

  // 2. PickupAuthorization (segundo responsável autorizado por pet) usando TemporaryAuthorizationService
  const authIdByPetCode = new Map<string, string>();
  const startsAt = new Date(now.getTime() - 10 * 86_400_000);
  for (const pet of blueprint.pets) {
    const studentId = params.studentIdByCode.get(pet.enrollmentCode);
    const tutorId = params.tutorIdByCode.get(pet.enrollmentCode);
    if (!studentId || !tutorId) throw new Error(`Vínculo ausente para ${pet.enrollmentCode}`);

    const auth = delegations.create(
      {
        schoolId: params.schoolId,
        tutorId,
        delegateName: `${pet.delegateName} — ${pet.delegateRelationLabel}`,
        delegateDocument: pet.delegateDocument,
        delegateSelfieUrl: pet.delegateSelfieUrl,
        studentIds: [studentId],
        duration: 'ONE_MONTH',
        startsAt,
      },
      startsAt,
    );
    const deterministicAuthId = deterministicUuid(`auth:${pet.enrollmentCode}`);
    auth.id = deterministicAuthId;
    authIdByPetCode.set(pet.enrollmentCode, deterministicAuthId);
  }

  // 3. Histórico dos últimos 5 dias úteis (4 pets × 5 dias = 20 ciclos completos de retirada)
  const businessDays = getLastBusinessDays(now, 5);
  const historicalSources: PickupSource[] = ['GEOFENCE', 'QR_GATE', 'GEOFENCE', 'MANUAL', 'GEOFENCE'];

  for (let dayIdx = 0; dayIdx < businessDays.length; dayIdx++) {
    const dayDate = businessDays[dayIdx];
    const y = dayDate.getUTCFullYear();
    const m = dayDate.getUTCMonth();
    const d = dayDate.getUTCDate();

    for (let petIdx = 0; petIdx < blueprint.pets.length; petIdx++) {
      const pet = blueprint.pets[petIdx];
      const studentId = params.studentIdByCode.get(pet.enrollmentCode)!;
      const tutorId = params.tutorIdByCode.get(pet.enrollmentCode)!;
      const [usualHour, usualMin] = pet.usualPickupTime.split(':').map(Number);

      // Variação realista de 1–4 min em torno do horário habitual (17:00–18:00, fuso -03:00 -> UTC +3h)
      const offsetMin = ((dayIdx + petIdx) % 4) - 1;
      const joinUtc = new Date(Date.UTC(y, m, d, usualHour + 3, usualMin + offsetMin, 10));
      const callUtc = new Date(joinUtc.getTime() + (65 + petIdx * 15) * 1000);
      const validUtc = new Date(callUtc.getTime() + (75 + dayIdx * 12) * 1000);
      const releaseUtc = new Date(validUtc.getTime() + 35 * 1000);

      const useDelegate = dayIdx === 2 && (petIdx === 0 || petIdx === 1);
      const source = historicalSources[(dayIdx + petIdx) % historicalSources.length];

      const entry = pickupService.join(
        {
          schoolId: params.schoolId,
          studentId,
          tutorId,
          authorizationId: useDelegate ? authIdByPetCode.get(pet.enrollmentCode) : undefined,
          source,
          gate: CANTOPET_RECEPTION_GATE,
        },
        joinUtc,
      );
      pickupService.call(entry.id, params.gateAgentUserId, callUtc);
      const issuedQr = qrService.issue(params.schoolId, tutorId);
      await pickupService.validateQr(entry.id, issuedQr.token, params.gateAgentUserId, validUtc);
      pickupService.release(entry.id, params.gateAgentUserId, releaseUtc);
    }
  }

  // 4. Operação de HOJE:
  //    - Check-in da manhã (Fase 2) para os 4 pets entre 07:00 e 08:30 (fuso -03:00 -> UTC +3h).
  //    - Aurorinha e Minduim já foram entregues hoje entre 17:14 e 17:22 (o release fecha o DayAttendance com checkOutAt e pickupLogId).
  //    - Tampinha (GEOFENCE, já chamado — aparece em "Pronto para retirada" no /telao e /portaria; DayAttendance segue aberto na creche).
  //    - Sol (QR_GATE, na fila — aparece em "A caminho" / fila da portaria; DayAttendance segue aberto na creche).
  const todayBrt = formatIsoDateInTimezone(now, 'America/Sao_Paulo');
  const [ty, tmOneBased, td] = todayBrt.split('-').map(Number);
  const tm = tmOneBased - 1;

  for (const pet of blueprint.pets) {
    const studentId = params.studentIdByCode.get(pet.enrollmentCode)!;
    const [checkInHour, checkInMin] = pet.morningCheckInTime.split(':').map(Number);
    const checkInUtc = new Date(Date.UTC(ty, tm, td, checkInHour + 3, checkInMin, 0));
    await attendanceService.checkIn(
      {
        schoolId: params.schoolId,
        studentId,
        checkInBy: params.gateAgentUserId,
        date: todayBrt,
        checkInAt: checkInUtc,
      },
      checkInUtc,
    );
  }

  for (const pet of blueprint.pets) {
    const studentId = params.studentIdByCode.get(pet.enrollmentCode)!;
    const tutorId = params.tutorIdByCode.get(pet.enrollmentCode)!;
    const state = pet.todayDemoState;

    if (state.kind === 'RELEASED_TODAY') {
      const joinUtc = new Date(Date.UTC(ty, tm, td, state.hour + 3, state.minute, 0));
      const callUtc = new Date(joinUtc.getTime() + 60 * 1000);
      const validUtc = new Date(joinUtc.getTime() + (state.waitMinutes * 60 - 25) * 1000);
      const releaseUtc = new Date(joinUtc.getTime() + state.waitMinutes * 60 * 1000);

      const entry = pickupService.join(
        {
          schoolId: params.schoolId,
          studentId,
          tutorId,
          source: state.source,
          gate: CANTOPET_RECEPTION_GATE,
        },
        joinUtc,
      );
      pickupService.call(entry.id, params.gateAgentUserId, callUtc);
      const issuedQr = qrService.issue(params.schoolId, tutorId);
      await pickupService.validateQr(entry.id, issuedQr.token, params.gateAgentUserId, validUtc);
      pickupService.release(entry.id, params.gateAgentUserId, releaseUtc);
    } else {
      const joinUtc = new Date(now.getTime() - state.minutesAgo * 60 * 1000);
      const entry = pickupService.join(
        {
          schoolId: params.schoolId,
          studentId,
          tutorId,
          source: state.source,
          gate: CANTOPET_RECEPTION_GATE,
        },
        joinUtc,
      );
      if (state.called) {
        const callUtc = new Date(joinUtc.getTime() + 45 * 1000);
        pickupService.call(entry.id, params.gateAgentUserId, callUtc);
      }
    }
  }

  // Confere matematicamente que toda a cadeia SHA-256 gerada pelo PickupService é íntegra
  const verification = pickupService.verifyChain(params.schoolId);
  if (!verification.valid) {
    throw new Error(
      `Falha na verificação da cadeia SHA-256 do PickupService no índice ${verification.firstBadIndex}`,
    );
  }

  // Coleta todas as entradas da fila (históricas + ativas) na ordem de criação
  const allEntries: PickupQueueEntry[] = [];
  for (const pet of blueprint.pets) {
    const studentId = params.studentIdByCode.get(pet.enrollmentCode)!;
    allEntries.push(...pickupService.listForStudent(params.schoolId, studentId));
  }
  allEntries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const allLogs: PickupLogEntry[] = pickupService.listLogs(params.schoolId);
  const todayAttendances: DayAttendanceRecord[] = attendanceService.listForSchoolOnDate(
    params.schoolId,
    todayBrt,
  );

  return {
    defaultPlans: dismissalPlans.listDefaultsForSchool(params.schoolId),
    authorizations: delegations.list(),
    queueEntries: allEntries,
    pickupLogs: allLogs,
    todayAttendances,
    chainValid: verification.valid,
  };
}

/**
 * Remove completamente o tenant CantoPet e os usuários `*.cantopet@tutorpass.com.br`
 * do banco PostgreSQL, sem tocar em nenhum outro tenant ou conta existente.
 */
export async function removeCantoPetFromDatabase(prisma: PrismaClient): Promise<{
  removedSchool: boolean;
  removedUsers: number;
}> {
  const school = await prisma.school.findUnique({
    where: { slug: CANTOPET_SCHOOL_SLUG },
  });

  if (school) {
    // Tabelas cujo FK para School não possui onDelete: Cascade explícito no schema
    await prisma.dayAttendance.deleteMany({ where: { schoolId: school.id } });
    await prisma.pickupLog.deleteMany({ where: { schoolId: school.id } });
    await prisma.pickupQueueEntry.deleteMany({ where: { schoolId: school.id } });
    await prisma.auditLog.deleteMany({ where: { schoolId: school.id } });
    await prisma.consentRecord.deleteMany({ where: { schoolId: school.id } });
    await prisma.schoolPlan.deleteMany({ where: { schoolId: school.id } });
    await prisma.petVaccination.deleteMany({ where: { schoolId: school.id } });
    await prisma.petProfile.deleteMany({ where: { schoolId: school.id } });
    await prisma.pickupAuthorization.deleteMany({ where: { schoolId: school.id } });
    await prisma.dismissalDefaultPlan.deleteMany({ where: { schoolId: school.id } });
    await prisma.dismissalException.deleteMany({ where: { schoolId: school.id } });
    await prisma.tutor.deleteMany({ where: { schoolId: school.id } });
    await prisma.student.deleteMany({ where: { schoolId: school.id } });
    await prisma.schoolMember.deleteMany({ where: { schoolId: school.id } });
    await prisma.classroom.deleteMany({ where: { schoolId: school.id } });
    await prisma.school.delete({ where: { id: school.id } });
  }

  const blueprint = buildCantoPetSeedBlueprint();
  const emails = blueprint.users.map((u) => u.email);
  const deletedUsers = await prisma.user.deleteMany({
    where: { email: { in: emails } },
  });

  return {
    removedSchool: Boolean(school),
    removedUsers: deletedUsers.count,
  };
}

/**
 * Popula/atualiza de forma idempotente o tenant CantoPet no PostgreSQL via Prisma.
 */
export async function seedCantoPetDatabase(
  prisma: PrismaClient,
  now: Date = new Date(),
) {
  const blueprint = buildCantoPetSeedBlueprint(now);

  // 1. Tenant (School) + SchoolPlan
  const school = await prisma.school.upsert({
    where: { slug: blueprint.school.slug },
    update: {
      name: blueprint.school.name,
      timezone: blueprint.school.timezone,
      isActive: true,
    },
    create: {
      name: blueprint.school.name,
      slug: blueprint.school.slug,
      timezone: blueprint.school.timezone,
      isActive: true,
    },
  });

  await prisma.schoolPlan.upsert({
    where: { schoolId: school.id },
    update: { tier: blueprint.plan.tier },
    create: {
      schoolId: school.id,
      tier: blueprint.plan.tier,
      trialEndsAt: new Date(now.getTime() + blueprint.plan.trialDays * 86_400_000),
      trialUsed: true,
    },
  });

  // 2. PickupPoint (Recepção Principal em Suzano/SP)
  const receptionPointId = deterministicUuid(`pickup-point:${school.slug}`);
  await prisma.pickupPoint.upsert({
    where: { id: receptionPointId },
    update: {
      name: CANTOPET_RECEPTION_GATE,
      approachRadiusM: 600,
      arrivalRadiusM: 180,
      isActive: true,
    },
    create: {
      id: receptionPointId,
      schoolId: school.id,
      name: CANTOPET_RECEPTION_GATE,
      latitude: new Prisma.Decimal('-23.5428000'),
      longitude: new Prisma.Decimal('-46.3108000'),
      approachRadiusM: 600,
      arrivalRadiusM: 180,
      isActive: true,
    },
  });

  // 3. Classrooms (Turmas da creche e hotel)
  const classroomIdByName = new Map<string, string>();
  for (const room of blueprint.classrooms) {
    const saved = await prisma.classroom.upsert({
      where: {
        schoolId_name_academicYear: {
          schoolId: school.id,
          name: room.name,
          academicYear: room.academicYear,
        },
      },
      update: {
        grade: room.grade,
        roomLocation: room.roomLocation,
        isActive: true,
      },
      create: {
        schoolId: school.id,
        name: room.name,
        grade: room.grade,
        roomLocation: room.roomLocation,
        academicYear: room.academicYear,
        isActive: true,
      },
    });
    classroomIdByName.set(room.name, saved.id);
  }

  // 4. Students (Os 4 pets reais: Aurorinha, Tampinha, Sol, Minduim)
  const studentIdByCode = new Map<string, string>();
  for (const pet of blueprint.pets) {
    const classroomId = classroomIdByName.get(pet.classroomName);
    if (!classroomId) throw new Error(`Turma ${pet.classroomName} não encontrada`);
    const saved = await prisma.student.upsert({
      where: {
        schoolId_enrollmentCode: {
          schoolId: school.id,
          enrollmentCode: pet.enrollmentCode,
        },
      },
      update: {
        name: pet.name,
        classroomId,
        status: 'ACTIVE',
        pickupBlocked: false,
      },
      create: {
        schoolId: school.id,
        classroomId,
        name: pet.name,
        enrollmentCode: pet.enrollmentCode,
        status: 'ACTIVE',
      },
    });
    studentIdByCode.set(pet.enrollmentCode, saved.id);

    // 4b. Ficha do Pet (PetProfile 1:1 + PetVaccination 1:N — dados clínicos de EXEMPLO)
    const f = pet.fichaExample;
    await prisma.petProfile.upsert({
      where: { studentId: saved.id },
      update: {
        breed: f.breed,
        size: f.size,
        sex: f.sex,
        weightKg: f.weightKg,
        isNeutered: f.isNeutered,
        behaviorNotes: f.behaviorNotes,
        restrictions: f.restrictions,
        feedingFood: f.feedingFood,
        feedingPortionGrams: f.feedingPortionGrams,
        feedingTimes: f.feedingTimes,
        vetName: f.vetName,
        vetClinic: f.vetClinic,
        emergencyContactName: f.emergencyContactName,
        emergencyContactPhone: f.emergencyContactPhone,
        dewormingUpToDate: f.dewormingUpToDate,
        dewormingLastDate: new Date(`${f.dewormingLastDate}T00:00:00.000Z`),
        fleaControlUpToDate: f.fleaControlUpToDate,
        fleaControlLastDate: new Date(`${f.fleaControlLastDate}T00:00:00.000Z`),
        allergies: f.allergies ?? null,
        medicationName: f.medicationName ?? null,
        medicationDosage: f.medicationDosage ?? null,
        medicationSchedule: f.medicationSchedule ?? null,
      },
      create: {
        id: deterministicUuid(`pet-profile:${pet.enrollmentCode}`),
        schoolId: school.id,
        studentId: saved.id,
        breed: f.breed,
        size: f.size,
        sex: f.sex,
        weightKg: f.weightKg,
        isNeutered: f.isNeutered,
        behaviorNotes: f.behaviorNotes,
        restrictions: f.restrictions,
        feedingFood: f.feedingFood,
        feedingPortionGrams: f.feedingPortionGrams,
        feedingTimes: f.feedingTimes,
        vetName: f.vetName,
        vetClinic: f.vetClinic,
        emergencyContactName: f.emergencyContactName,
        emergencyContactPhone: f.emergencyContactPhone,
        dewormingUpToDate: f.dewormingUpToDate,
        dewormingLastDate: new Date(`${f.dewormingLastDate}T00:00:00.000Z`),
        fleaControlUpToDate: f.fleaControlUpToDate,
        fleaControlLastDate: new Date(`${f.fleaControlLastDate}T00:00:00.000Z`),
        allergies: f.allergies ?? null,
        medicationName: f.medicationName ?? null,
        medicationDosage: f.medicationDosage ?? null,
        medicationSchedule: f.medicationSchedule ?? null,
      },
    });

    await prisma.petVaccination.deleteMany({ where: { studentId: saved.id } });
    for (let vIdx = 0; vIdx < f.vaccinations.length; vIdx++) {
      const v = f.vaccinations[vIdx];
      await prisma.petVaccination.create({
        data: {
          id: deterministicUuid(`pet-vac:${pet.enrollmentCode}:${vIdx}:${v.vaccineName}`),
          schoolId: school.id,
          studentId: saved.id,
          vaccineName: v.vaccineName,
          appliedAt: new Date(`${v.appliedAt}T00:00:00.000Z`),
          expiresAt: new Date(`${v.expiresAt}T00:00:00.000Z`),
          notes: v.notes ?? null,
        },
      });
    }
  }

  // 5. Users + SchoolMembers + Tutors + TutorStudent
  const userIdByEmail = new Map<string, string>();
  const tutorIdByCode = new Map<string, string>();
  const sharedHash = hashPassword(CANTOPET_SHARED_PASSWORD);

  for (const u of blueprint.users) {
    const savedUser = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        phone: u.phone ?? null,
        passwordHash: sharedHash,
        isActive: true,
      },
      create: {
        email: u.email,
        name: u.name,
        phone: u.phone ?? null,
        passwordHash: sharedHash,
        isActive: true,
      },
    });
    userIdByEmail.set(u.email, savedUser.id);

    const classroomId = u.classroomName ? (classroomIdByName.get(u.classroomName) ?? null) : null;
    await prisma.schoolMember.upsert({
      where: {
        schoolId_userId_role: {
          schoolId: school.id,
          userId: savedUser.id,
          role: u.role,
        },
      },
      update: {
        status: 'ACTIVE',
        classroomId,
      },
      create: {
        schoolId: school.id,
        userId: savedUser.id,
        role: u.role,
        status: 'ACTIVE',
        classroomId,
      },
    });

    if (u.role === 'TUTOR' && u.petCode) {
      const savedTutor = await prisma.tutor.upsert({
        where: { userId: savedUser.id },
        update: {
          schoolId: school.id,
          name: u.name,
          phone: u.phone ?? null,
          document: u.document ?? null,
          isBlocked: false,
        },
        create: {
          schoolId: school.id,
          userId: savedUser.id,
          name: u.name,
          phone: u.phone ?? null,
          document: u.document ?? null,
          qrSecret: randomBytes(32).toString('hex'),
        },
      });
      tutorIdByCode.set(u.petCode, savedTutor.id);

      const studentId = studentIdByCode.get(u.petCode);
      if (!studentId) throw new Error(`Pet ${u.petCode} não encontrado`);
      await prisma.tutorStudent.upsert({
        where: {
          tutorId_studentId: {
            tutorId: savedTutor.id,
            studentId,
          },
        },
        update: {
          relationship: u.relationship ?? 'GUARDIAN',
          isPrimary: true,
          canPickup: true,
        },
        create: {
          tutorId: savedTutor.id,
          studentId,
          relationship: u.relationship ?? 'GUARDIAN',
          isPrimary: true,
          canPickup: true,
        },
      });
    }
  }

  const adminUserId = userIdByEmail.get('admin.cantopet@tutorpass.com.br')!;
  const gateAgentUserId = userIdByEmail.get('portaria.cantopet@tutorpass.com.br')!;

  // 6. Gera planos padrão, autorizações de delegados, fila e logs encadeados pelos serviços de domínio
  const artifacts = await generateCantoPetDomainArtifacts({
    schoolId: school.id,
    adminUserId,
    gateAgentUserId,
    studentIdByCode,
    tutorIdByCode,
    now,
  });

  // 7. Persiste DismissalDefaultPlan (idempotente via studentId_weekday)
  for (const plan of artifacts.defaultPlans) {
    await prisma.dismissalDefaultPlan.upsert({
      where: {
        studentId_weekday: {
          studentId: plan.studentId,
          weekday: plan.weekday,
        },
      },
      update: {
        mode: plan.mode as DismissalMode,
        pickupBy: plan.pickupBy,
        note: plan.note,
        setBy: plan.setBy,
        setByRole: plan.setByRole,
      },
      create: {
        schoolId: school.id,
        studentId: plan.studentId,
        weekday: plan.weekday,
        mode: plan.mode as DismissalMode,
        pickupBy: plan.pickupBy,
        note: plan.note,
        setBy: plan.setBy,
        setByRole: plan.setByRole,
      },
    });
  }

  // 8. Persiste PickupAuthorization + PickupAuthorizationStudent (idempotente por UUID determinístico)
  for (const auth of artifacts.authorizations) {
    await prisma.pickupAuthorization.upsert({
      where: { id: auth.id },
      update: {
        delegateName: auth.delegateName,
        delegateDocument: auth.delegateDocument,
        delegateSelfieUrl: auth.delegateSelfieUrl,
        startsAt: auth.startsAt,
        expiresAt: auth.expiresAt,
        status: auth.status,
      },
      create: {
        id: auth.id,
        schoolId: school.id,
        tutorId: auth.tutorId,
        delegateName: auth.delegateName,
        delegateDocument: auth.delegateDocument,
        delegateSelfieUrl: auth.delegateSelfieUrl,
        startsAt: auth.startsAt,
        expiresAt: auth.expiresAt,
        status: auth.status,
      },
    });
    for (const studentId of auth.studentIds) {
      await prisma.pickupAuthorizationStudent.upsert({
        where: {
          authorizationId_studentId: {
            authorizationId: auth.id,
            studentId,
          },
        },
        update: {},
        create: {
          authorizationId: auth.id,
          studentId,
        },
      });
    }
  }

  // 9. Limpa e recria de forma idempotente as entradas de fila, PickupLogs e DayAttendance da CantoPet
  //    preservando exatamente os ids e a cadeia SHA-256 gerada pelo PickupService
  await prisma.dayAttendance.deleteMany({ where: { schoolId: school.id } });
  await prisma.pickupLog.deleteMany({ where: { schoolId: school.id } });
  await prisma.pickupQueueEntry.deleteMany({ where: { schoolId: school.id } });

  const dbQueueIdByDomainId = new Map<string, string>();
  for (const entry of artifacts.queueEntries) {
    const dbEntryId = deterministicUuid(`queue:${school.id}:${entry.id}`);
    dbQueueIdByDomainId.set(entry.id, dbEntryId);
    await prisma.pickupQueueEntry.create({
      data: {
        id: dbEntryId,
        schoolId: school.id,
        studentId: entry.studentId,
        tutorId: entry.tutorId,
        authorizationId: entry.authorizationId,
        pickupPointId: receptionPointId,
        gate: entry.gate,
        status: entry.status as QueueStatus,
        source: entry.source,
        joinedAt: entry.joinedAt,
        calledAt: entry.calledAt,
        validatedAt: entry.validatedAt,
        releasedAt: entry.releasedAt,
        waitSeconds: entry.waitSeconds,
        createdAt: entry.createdAt,
      },
    });
  }

  // Como PickupLog.queueEntryId é @unique no schema Prisma (1 log final consolidado
  // por PickupQueueEntry no banco, ou múltiplos logs sem FKs colidentes), vinculamos
  // queueEntryId ao evento terminal de cada entrada e mantemos queueEntryId no payload
  // canônico exatamente como o PickupService calcula o chainHash.
  const latestLogIdByQueueEntry = new Map<string, string>();
  for (const log of artifacts.pickupLogs) {
    if (log.queueEntryId) {
      latestLogIdByQueueEntry.set(log.queueEntryId, log.id);
    }
  }

  for (const log of artifacts.pickupLogs) {
    const isTerminalForEntry =
      log.queueEntryId != null && latestLogIdByQueueEntry.get(log.queueEntryId) === log.id;
    const dbQueueId =
      isTerminalForEntry && log.queueEntryId
        ? (dbQueueIdByDomainId.get(log.queueEntryId) ?? null)
        : null;

    await prisma.pickupLog.create({
      data: {
        id: deterministicUuid(`log:${school.id}:${log.id}`),
        schoolId: school.id,
        studentId: log.studentId,
        queueEntryId: dbQueueId,
        eventType: log.eventType as PickupEventType,
        actorUserId: log.actorUserId,
        tutorId: log.tutorId,
        payload: {
          ...log.payload,
          domainQueueEntryId: log.queueEntryId,
        } as Prisma.InputJsonValue,
        prevHash: log.prevHash,
        hash: log.hash,
        createdAt: log.createdAt,
      },
    });
  }

  // 10. Persiste DayAttendance de hoje (com checkOutAt e pickupLogId preenchidos para os pets já liberados)
  for (const att of artifacts.todayAttendances) {
    const dbPickupLogId = att.pickupLogId
      ? deterministicUuid(`log:${school.id}:${att.pickupLogId}`)
      : null;
    await prisma.dayAttendance.create({
      data: {
        id: deterministicUuid(`attendance:${school.id}:${att.studentId}:${att.date}`),
        schoolId: school.id,
        studentId: att.studentId,
        date: new Date(`${att.date}T00:00:00.000Z`),
        checkInAt: att.checkInAt,
        checkInBy: att.checkInBy,
        checkOutAt: att.checkOutAt,
        pickupLogId: dbPickupLogId,
        createdAt: att.createdAt,
        updatedAt: att.updatedAt,
      },
    });
  }

  return {
    school,
    classroomsCount: blueprint.classrooms.length,
    petsCount: blueprint.pets.length,
    usersCount: blueprint.users.length,
    defaultPlansCount: artifacts.defaultPlans.length,
    authorizationsCount: artifacts.authorizations.length,
    queueEntriesCount: artifacts.queueEntries.length,
    activeQueueCount: artifacts.queueEntries.filter(
      (e) => e.status === 'QUEUED' || e.status === 'CALLED' || e.status === 'VALIDATED',
    ).length,
    todayAttendancesCount: artifacts.todayAttendances.length,
    pickupLogsCount: artifacts.pickupLogs.length,
    chainValid: artifacts.chainValid,
  };
}

/**
 * Sincroniza de forma idempotente o tenant CantoPet com uma instância da API
 * em execução via HTTP (ex.: http://localhost:3333 ou http://187.53.122.5),
 * garantindo que tanto o Postgres (via write-through da API) quanto a fila em
 * memória do PickupService fiquem prontos e vivos para demonstração imediata
 * nas telas `/escola`, `/portaria`, `/sala`, `/responsavel` e `/telao`.
 */
export async function syncCantoPetViaHttpApi(apiBaseUrl: string) {
  const base = apiBaseUrl.replace(/\/+$/, '').replace(/\/api$/, '');
  const blueprint = buildCantoPetSeedBlueprint();

  async function request<T>(
    path: string,
    options: { method?: string; token?: string; body?: unknown } = {},
  ): Promise<{ status: number; data: T }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    const res = await fetch(`${base}/api${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const data = (await res.json().catch(() => null)) as T;
    return { status: res.status, data };
  }

  // 1. Registra as 8 contas da CantoPet caso ainda não existam (409 = já existe, idempotente)
  for (const u of blueprint.users) {
    const reg = await request('/auth/register', {
      method: 'POST',
      body: { email: u.email, name: u.name, password: CANTOPET_SHARED_PASSWORD },
    });
    if (reg.status !== 201 && reg.status !== 409) {
      throw new Error(`Falha ao registrar ${u.email}: HTTP ${reg.status}`);
    }
  }

  // 2. Faz login com o ADMIN para verificar se a escola já está vinculada
  const adminEmail = 'admin.cantopet@tutorpass.com.br';
  let loginRes = await request<{
    accessToken: string;
    schoolId: string | null;
    roles: string[];
  }>('/auth/login', {
    method: 'POST',
    body: { email: adminEmail, password: CANTOPET_SHARED_PASSWORD },
  });
  if (loginRes.status !== 201 || !loginRes.data?.accessToken) {
    throw new Error(`Falha no login de ${adminEmail}: HTTP ${loginRes.status}`);
  }

  let schoolId = loginRes.data.schoolId;
  if (!schoolId) {
    const createdSchool = await request<{ id: string }>('/schools', {
      method: 'POST',
      token: loginRes.data.accessToken,
      body: {
        name: blueprint.school.name,
        timezone: blueprint.school.timezone,
      },
    });
    if (createdSchool.status !== 201 || !createdSchool.data?.id) {
      throw new Error(`Falha ao criar escola CantoPet via API: HTTP ${createdSchool.status}`);
    }
    schoolId = createdSchool.data.id;
    loginRes = await request('/auth/login', {
      method: 'POST',
      body: { email: adminEmail, password: CANTOPET_SHARED_PASSWORD, schoolId },
    });
  }

  const adminToken = loginRes.data.accessToken;

  // 3. Vincula todos os membros da equipe e tutores à escola CantoPet (409 = já vinculado)
  for (const u of blueprint.users) {
    if (u.email === adminEmail) continue;
    const memberRes = await request('/schools/members', {
      method: 'POST',
      token: adminToken,
      body: { email: u.email, role: u.role },
    });
    if (memberRes.status !== 201 && memberRes.status !== 409) {
      throw new Error(`Falha ao vincular membro ${u.email}: HTTP ${memberRes.status}`);
    }
  }

  // 4. Garante as 3 turmas (Pequenos & Calmos, Ativos & Brincalhões, Hotel — Pernoite)
  const existingClassroomsRes = await request<Array<{ id: string; name: string }>>(
    '/roster/classrooms?includeInactive=true',
    { token: adminToken },
  );
  const classroomIdByName = new Map<string, string>(
    (existingClassroomsRes.data ?? []).map((c) => [c.name, c.id]),
  );

  for (const room of blueprint.classrooms) {
    if (!classroomIdByName.has(room.name)) {
      const created = await request<{ id: string; name: string }>('/roster/classrooms', {
        method: 'POST',
        token: adminToken,
        body: room,
      });
      if (created.status === 201 && created.data?.id) {
        classroomIdByName.set(room.name, created.data.id);
      }
    }
  }

  // 5. Garante os 4 pets (Aurorinha, Tampinha, Sol, Minduim)
  const existingStudentsRes = await request<
    Array<{ id: string; name: string; enrollmentCode?: string }>
  >('/roster/students', { token: adminToken });
  const studentIdByCode = new Map<string, string>();
  for (const s of existingStudentsRes.data ?? []) {
    if (s.enrollmentCode) studentIdByCode.set(s.enrollmentCode, s.id);
  }

  for (const pet of blueprint.pets) {
    if (!studentIdByCode.has(pet.enrollmentCode)) {
      const classroomId = classroomIdByName.get(pet.classroomName)!;
      const created = await request<{ id: string }>('/roster/students', {
        method: 'POST',
        token: adminToken,
        body: {
          name: pet.name,
          classroomId,
          enrollmentCode: pet.enrollmentCode,
        },
      });
      if (created.status === 201 && created.data?.id) {
        studentIdByCode.set(pet.enrollmentCode, created.data.id);
      }
    }

    // 5b. Sincroniza Ficha do Pet (PetProfile + PetVaccination) via API HTTP (idempotente)
    const studentId = studentIdByCode.get(pet.enrollmentCode);
    if (studentId) {
      const f = pet.fichaExample;
      await request(`/roster/students/${studentId}/pet-profile`, {
        method: 'PUT',
        token: adminToken,
        body: {
          breed: f.breed,
          size: f.size,
          sex: f.sex,
          weightKg: f.weightKg,
          isNeutered: f.isNeutered,
          behaviorNotes: f.behaviorNotes,
          restrictions: f.restrictions,
          feedingFood: f.feedingFood,
          feedingPortionGrams: f.feedingPortionGrams,
          feedingTimes: f.feedingTimes,
          vetName: f.vetName,
          vetClinic: f.vetClinic,
          emergencyContactName: f.emergencyContactName,
          emergencyContactPhone: f.emergencyContactPhone,
          dewormingUpToDate: f.dewormingUpToDate,
          dewormingLastDate: f.dewormingLastDate,
          fleaControlUpToDate: f.fleaControlUpToDate,
          fleaControlLastDate: f.fleaControlLastDate,
          allergies: f.allergies,
          medicationName: f.medicationName,
          medicationDosage: f.medicationDosage,
          medicationSchedule: f.medicationSchedule,
        },
      });

      const existingVacsRes = await request<Array<{ id: string; vaccineName: string }>>(
        `/roster/students/${studentId}/vaccinations`,
        { token: adminToken },
      );
      if (existingVacsRes.status === 200 && Array.isArray(existingVacsRes.data)) {
        const existingByName = new Map(
          existingVacsRes.data.map((v) => [v.vaccineName, v.id]),
        );
        for (const vac of f.vaccinations) {
          const existingId = existingByName.get(vac.vaccineName);
          if (existingId) {
            await request(`/roster/students/${studentId}/vaccinations/${existingId}`, {
              method: 'PATCH',
              token: adminToken,
              body: vac,
            });
          } else {
            await request(`/roster/students/${studentId}/vaccinations`, {
              method: 'POST',
              token: adminToken,
              body: vac,
            });
          }
        }
      }

      // 5c. Sincroniza DismissalDefaultPlan via API HTTP (idempotente)
      await request(`/roster/students/${studentId}/default-plans`, {
        method: 'PUT',
        token: adminToken,
        body: {
          weekday: 1,
          mode: 'CAR',
          pickupBy: `${pet.defaultPickupBy} · ${pet.usualPickupTime}`,
          note: pet.defaultNote,
          copyToWeekdays: true,
        },
      });
    }
  }

  // 6. Garante os 4 tutores (donos exemplo), vínculo TutorStudent e vínculo com a conta de login
  const existingTutorsRes = await request<
    Array<{ id: string; name: string; phone: string; userId?: string }>
  >('/roster/tutors', { token: adminToken });
  const tutorByPhone = new Map<string, { id: string; userId?: string }>(
    (existingTutorsRes.data ?? []).map((t) => [t.phone, { id: t.id, userId: t.userId }]),
  );
  const tutorIdByCode = new Map<string, string>();

  for (const u of blueprint.users) {
    if (u.role !== 'TUTOR' || !u.petCode || !u.phone) continue;
    let tutorId = tutorByPhone.get(u.phone)?.id;
    if (!tutorId) {
      const created = await request<{ id: string }>('/roster/tutors', {
        method: 'POST',
        token: adminToken,
        body: {
          name: u.name,
          phone: u.phone,
          document: u.document,
        },
      });
      if (created.status === 201 && created.data?.id) {
        tutorId = created.data.id;
      }
    }
    if (!tutorId) throw new Error(`Não foi possível criar/obter tutor para ${u.email}`);
    tutorIdByCode.set(u.petCode, tutorId);

    const studentId = studentIdByCode.get(u.petCode)!;
    await request(`/roster/tutors/${tutorId}/link`, {
      method: 'POST',
      token: adminToken,
      body: {
        studentId,
        relationship: u.relationship ?? 'GUARDIAN',
        isPrimary: true,
        canPickup: true,
      },
    });

    await request(`/roster/tutors/${tutorId}/link-user`, {
      method: 'POST',
      token: adminToken,
      body: { email: u.email },
    });
  }

  // 7. Verifica logs e fila na API para popular o histórico e a fila de HOJE sem duplicar
  const logsRes = await request<PickupLogEntry[]>(`/pickup/schools/${schoolId}/logs`, {
    token: adminToken,
  });
  const activeQueueRes = await request<PickupQueueEntry[]>(`/pickup/schools/${schoolId}/queue`, {
    token: adminToken,
  });

  // Login da recepção (GATE_AGENT) para operar chamadas, validações de QR e liberações
  const gateLogin = await request<{ accessToken: string }>('/auth/login', {
    method: 'POST',
    body: {
      email: 'portaria.cantopet@tutorpass.com.br',
      password: CANTOPET_SHARED_PASSWORD,
      schoolId,
    },
  });
  const gateToken = gateLogin.data?.accessToken ?? adminToken;

  // 7b. Registra o check-in da manhã (Fase 2) para os 4 pets entre 07:00 e 08:30 de hoje
  //     ANTES das entregas de hoje, para que o release de Aurorinha e Minduim feche o DayAttendance
  const todayBrt = formatIsoDateInTimezone(new Date(), 'America/Sao_Paulo');
  const [ty, tmOneBased, td] = todayBrt.split('-').map(Number);
  const tm = tmOneBased - 1;
  for (const pet of blueprint.pets) {
    const studentId = studentIdByCode.get(pet.enrollmentCode);
    if (!studentId) continue;
    const [checkInHour, checkInMin] = pet.morningCheckInTime.split(':').map(Number);
    const checkInUtc = new Date(Date.UTC(ty, tm, td, checkInHour + 3, checkInMin, 0));
    await request(`/pickup/schools/${schoolId}/attendance/check-in`, {
      method: 'POST',
      token: gateToken,
      body: {
        studentId,
        date: todayBrt,
        checkInAt: checkInUtc.toISOString(),
      },
    });
  }

  // Se o histórico de PickupLog ainda não foi populado nesta instância da API,
  // executa ciclos reais (join -> call -> issue QR -> validate-qr -> release)
  if ((logsRes.data ?? []).length < 20) {
    // Limpa qualquer entrada ativa residual antes de rodar a sequência histórica
    for (const active of activeQueueRes.data ?? []) {
      await request(`/pickup/schools/${schoolId}/queue/${active.id}/cancel`, {
        method: 'POST',
        token: gateToken,
      });
    }

    const sources: PickupSource[] = ['GEOFENCE', 'QR_GATE', 'GEOFENCE', 'MANUAL', 'GEOFENCE'];
    for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
      for (let petIdx = 0; petIdx < blueprint.pets.length; petIdx++) {
        const pet = blueprint.pets[petIdx];
        const studentId = studentIdByCode.get(pet.enrollmentCode)!;
        const tutorId = tutorIdByCode.get(pet.enrollmentCode)!;
        const source = sources[(dayIdx + petIdx) % sources.length];

        const joined = await request<{ id: string }>(`/pickup/schools/${schoolId}/queue/join`, {
          method: 'POST',
          token: gateToken,
          body: {
            studentId,
            tutorId,
            source,
            gate: CANTOPET_RECEPTION_GATE,
          },
        });
        if (joined.status !== 201 || !joined.data?.id) continue;
        const entryId = joined.data.id;

        await request(`/pickup/schools/${schoolId}/queue/${entryId}/call`, {
          method: 'POST',
          token: gateToken,
        });

        // Login do tutor dono do pet para emitir um QR HMAC real de 30s e validá-lo na recepção
        const tutorLogin = await request<{ accessToken: string }>('/auth/login', {
          method: 'POST',
          body: {
            email: pet.ownerEmail,
            password: CANTOPET_SHARED_PASSWORD,
            schoolId,
          },
        });
        const qrRes = await request<{ token: string }>(
          `/pickup/schools/${schoolId}/me/qr-token`,
          { token: tutorLogin.data.accessToken },
        );
        await request(`/pickup/schools/${schoolId}/queue/${entryId}/validate-qr`, {
          method: 'POST',
          token: gateToken,
          body: { token: qrRes.data.token },
        });
        await request(`/pickup/schools/${schoolId}/queue/${entryId}/release`, {
          method: 'POST',
          token: gateToken,
        });
      }
    }

    // Registra também as 2 entregas já concluídas de HOJE (Aurorinha e Minduim)
    for (const pet of blueprint.pets) {
      if (pet.todayDemoState.kind !== 'RELEASED_TODAY') continue;
      const studentId = studentIdByCode.get(pet.enrollmentCode)!;
      const tutorId = tutorIdByCode.get(pet.enrollmentCode)!;
      const joined = await request<{ id: string }>(`/pickup/schools/${schoolId}/queue/join`, {
        method: 'POST',
        token: gateToken,
        body: {
          studentId,
          tutorId,
          source: pet.todayDemoState.source,
          gate: CANTOPET_RECEPTION_GATE,
        },
      });
      if (joined.status !== 201 || !joined.data?.id) continue;
      const entryId = joined.data.id;
      await request(`/pickup/schools/${schoolId}/queue/${entryId}/call`, {
        method: 'POST',
        token: gateToken,
      });
      const tutorLogin = await request<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: {
          email: pet.ownerEmail,
          password: CANTOPET_SHARED_PASSWORD,
          schoolId,
        },
      });
      const qrRes = await request<{ token: string }>(
        `/pickup/schools/${schoolId}/me/qr-token`,
        { token: tutorLogin.data.accessToken },
      );
      await request(`/pickup/schools/${schoolId}/queue/${entryId}/validate-qr`, {
        method: 'POST',
        token: gateToken,
        body: { token: qrRes.data.token },
      });
      await request(`/pickup/schools/${schoolId}/queue/${entryId}/release`, {
        method: 'POST',
        token: gateToken,
      });
    }
  }

  // 8. Garante que os 2 pets de HOJE estejam na fila ativa agora:
  //    - Tampinha: source GEOFENCE, status CALLED (aparece em "Pronto para retirada" no /telao e /portaria)
  //    - Sol: source QR_GATE, status QUEUED (aparece em "A caminho" no /telao e /portaria)
  const currentQueueRes = await request<PickupQueueEntry[]>(`/pickup/schools/${schoolId}/queue`, {
    token: gateToken,
  });
  const activeByStudent = new Map<string, PickupQueueEntry>(
    (currentQueueRes.data ?? []).map((e) => [e.studentId, e]),
  );

  for (const pet of blueprint.pets) {
    if (pet.todayDemoState.kind !== 'IN_QUEUE_NOW') continue;
    const studentId = studentIdByCode.get(pet.enrollmentCode)!;
    const tutorId = tutorIdByCode.get(pet.enrollmentCode)!;
    let entry = activeByStudent.get(studentId);
    if (!entry) {
      const joined = await request<PickupQueueEntry>(`/pickup/schools/${schoolId}/queue/join`, {
        method: 'POST',
        token: gateToken,
        body: {
          studentId,
          tutorId,
          source: pet.todayDemoState.source,
          gate: CANTOPET_RECEPTION_GATE,
        },
      });
      if (joined.status === 201 && joined.data) {
        entry = joined.data;
      }
    }
    if (entry && pet.todayDemoState.called && entry.status === 'QUEUED') {
      await request(`/pickup/schools/${schoolId}/queue/${entry.id}/call`, {
        method: 'POST',
        token: gateToken,
      });
    }
  }

  // 9. Marca os 4 passos do checklist de implantação como concluídos para a demo
  for (const step of [
    'ACCOUNT_CREATED',
    'ROSTER_IMPORTED',
    'STAFF_INVITED',
    'FIRST_DISMISSAL_DONE',
  ]) {
    await request(`/onboarding/schools/${schoolId}/steps/${step}/complete`, {
      method: 'POST',
      token: adminToken,
      body: {},
    });
  }

  const finalQueue = await request<PickupQueueEntry[]>(`/pickup/schools/${schoolId}/queue`, {
    token: gateToken,
  });
  const finalLogs = await request<PickupLogEntry[]>(`/pickup/schools/${schoolId}/logs`, {
    token: adminToken,
  });
  const verifyChain = await request<{ valid: boolean; firstBadIndex: number }>(
    `/pickup/schools/${schoolId}/logs/verify-chain`,
    { token: adminToken },
  );

  return {
    schoolId,
    activeQueueCount: (finalQueue.data ?? []).length,
    totalLogsCount: (finalLogs.data ?? []).length,
    chainValid: verifyChain.data?.valid ?? false,
  };
}

/**
 * Remove / desativa os dados do tenant CantoPet via API HTTP quando o banco
 * não está acessível diretamente por TCP local.
 */
export async function removeCantoPetViaHttpApi(apiBaseUrl: string) {
  const base = apiBaseUrl.replace(/\/+$/, '').replace(/\/api$/, '');
  const adminEmail = 'admin.cantopet@tutorpass.com.br';

  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: CANTOPET_SHARED_PASSWORD }),
  });
  if (!loginRes.ok) {
    return { deactivatedSchoolId: null, cancelledQueueEntries: 0, deactivatedStudents: 0 };
  }
  const session = (await loginRes.json()) as { accessToken: string; schoolId: string | null };
  if (!session.schoolId) {
    return { deactivatedSchoolId: null, cancelledQueueEntries: 0, deactivatedStudents: 0 };
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.accessToken}`,
  };

  // 1. Cancela entradas ativas na fila
  const queueRes = await fetch(`${base}/api/pickup/schools/${session.schoolId}/queue`, { headers });
  const queue = queueRes.ok ? ((await queueRes.json()) as PickupQueueEntry[]) : [];
  for (const entry of queue) {
    await fetch(`${base}/api/pickup/schools/${session.schoolId}/queue/${entry.id}/cancel`, {
      method: 'POST',
      headers,
    });
  }

  // 2. Inativa os alunos e desvincula contas de tutores
  const tutorsRes = await fetch(`${base}/api/roster/tutors`, { headers });
  const tutors = tutorsRes.ok ? ((await tutorsRes.json()) as Array<{ id: string }>) : [];
  for (const t of tutors) {
    await fetch(`${base}/api/roster/tutors/${t.id}/unlink-user`, {
      method: 'POST',
      headers,
    });
  }

  const studentsRes = await fetch(`${base}/api/roster/students`, { headers });
  const students = studentsRes.ok ? ((await studentsRes.json()) as Array<{ id: string }>) : [];
  for (const s of students) {
    await fetch(`${base}/api/roster/students/${s.id}/status`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ status: 'INACTIVE' }),
    });
  }

  // 3. Desativa as turmas
  const classroomsRes = await fetch(
    `${base}/api/roster/classrooms?includeInactive=false`,
    { headers },
  );
  const classrooms = classroomsRes.ok
    ? ((await classroomsRes.json()) as Array<{ id: string }>)
    : [];
  for (const c of classrooms) {
    await fetch(`${base}/api/roster/classrooms/${c.id}`, {
      method: 'DELETE',
      headers,
    });
  }

  return {
    deactivatedSchoolId: session.schoolId,
    cancelledQueueEntries: queue.length,
    deactivatedStudents: students.length,
  };
}

async function main(): Promise<void> {
  const isRemove = process.argv.includes('--remove') || process.argv.includes('--clean');
  const apiUrl = process.env.API_BASE_URL;

  if (isRemove) {
    if (process.env.DATABASE_URL) {
      const prisma = new PrismaClient();
      try {
        await prisma.$connect();
        const res = await removeCantoPetFromDatabase(prisma);
        // eslint-disable-next-line no-console
        console.log(
          `[seed-cantopet] Tenant CantoPet removido do Postgres: escola=${res.removedSchool}, usuários=${res.removedUsers}.`,
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          '[seed-cantopet] Postgres direto indisponível, executando limpeza via API HTTP...',
          err instanceof Error ? err.message : err,
        );
      } finally {
        await prisma.$disconnect().catch(() => undefined);
      }
    }
    if (apiUrl) {
      const apiRes = await removeCantoPetViaHttpApi(apiUrl);
      // eslint-disable-next-line no-console
      console.log(
        `[seed-cantopet] Tenant CantoPet limpo na API (${apiUrl}): escola=${apiRes.deactivatedSchoolId}, fila cancelada=${apiRes.cancelledQueueEntries}, pets inativados=${apiRes.deactivatedStudents}.`,
      );
    }
    return;
  }

  let dbSeeded = false;
  if (process.env.DATABASE_URL) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      const dbResult = await seedCantoPetDatabase(prisma);
      dbSeeded = true;
      // eslint-disable-next-line no-console
      console.log(
        `[seed-cantopet] Postgres populado com sucesso: ${dbResult.school.name} (${dbResult.school.slug}) — ` +
          `${dbResult.classroomsCount} turmas, ${dbResult.petsCount} pets, ${dbResult.usersCount} contas, ` +
          `${dbResult.defaultPlansCount} planos padrão, ${dbResult.authorizationsCount} autorizações de delegados, ` +
          `${dbResult.pickupLogsCount} logs encadeados SHA-256 (chainValid=${dbResult.chainValid}), ` +
          `${dbResult.activeQueueCount} pets ativos na fila agora.`,
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        '[seed-cantopet] Conexão direta ao Postgres não disponível neste ambiente:',
        err instanceof Error ? err.message : err,
      );
    } finally {
      await prisma.$disconnect().catch(() => undefined);
    }
  }

  if (apiUrl) {
    const httpResult = await syncCantoPetViaHttpApi(apiUrl);
    // eslint-disable-next-line no-console
    console.log(
      `[seed-cantopet] API ao vivo sincronizada (${apiUrl}) — schoolId=${httpResult.schoolId}, ` +
        `fila ativa=${httpResult.activeQueueCount}, logs SHA-256=${httpResult.totalLogsCount} (chainValid=${httpResult.chainValid}).`,
    );
  } else if (!dbSeeded) {
    // Mesmo sem banco ou API externa, executa e valida toda a geração pelos serviços de domínio
    const blueprint = buildCantoPetSeedBlueprint();
    const studentIdByCode = new Map(
      blueprint.pets.map((p) => [p.enrollmentCode, deterministicUuid(`student:${p.enrollmentCode}`)]),
    );
    const tutorIdByCode = new Map(
      blueprint.pets.map((p) => [p.enrollmentCode, deterministicUuid(`tutor:${p.enrollmentCode}`)]),
    );
    const artifacts = await generateCantoPetDomainArtifacts({
      schoolId: deterministicUuid('school:cantopet-suzano'),
      adminUserId: deterministicUuid('user:admin.cantopet@tutorpass.com.br'),
      gateAgentUserId: deterministicUuid('user:portaria.cantopet@tutorpass.com.br'),
      studentIdByCode,
      tutorIdByCode,
    });
    // eslint-disable-next-line no-console
    console.log(
      `[seed-cantopet] Artefatos de domínio gerados e verificados: ` +
        `${blueprint.classrooms.length} turmas, ${blueprint.pets.length} pets, ${blueprint.users.length} usuários, ` +
        `${artifacts.defaultPlans.length} planos padrão, ${artifacts.authorizations.length} autorizações, ` +
        `${artifacts.pickupLogs.length} eventos no PickupLog (verifyChain=${artifacts.chainValid}).`,
    );
  }
}

if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seed-cantopet] Falhou:', err);
    process.exit(1);
  });
}
