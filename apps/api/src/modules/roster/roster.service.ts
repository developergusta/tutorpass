import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

// Cadastro (roster) da escola: escolas, turmas, alunos, tutores e importação
// CSV de alunos — a peça que prova a tese "implantação em 1 dia".
// Lógica pura, in-memory como os demais serviços; persistência no Step 2
// sobre School/Classroom/Student/Tutor/TutorStudent (já no schema Prisma).
// Inspiração (pesquisa frente a, ciclo 17): PickupRoster — CSV/XLSX com guias
// por SIS e re-importação que ATUALIZA o aluno existente; "pickup." — prévia
// de matches/duplicatas antes de salvar; DismissPro — template CSV p/
// download + export do cadastro atual; QManager — setup em 24 h com importação
// de planilha ou sync com o SIS (Veracross/Blackbaud/GG4L).
//
// Regras que o mercado erra e nós não repetimos:
// - A importação NUNCA apaga o cadastro (o "Upload and Override" do
//   DismissPro, que substitui o roster inteiro, é o anti-padrão): re-importar
//   atualiza por matrícula e pula duplicata, com relatório linha a linha.
// - Nada some sem rastro: aluno nunca é apagado, só muda de status
//   (ACTIVE/INACTIVE/TRANSFERRED); bloqueio de retirada (judicial/
//   administrativo) é um campo explícito com motivo, não um delete.
// - Limite do plano (FREE: 30 alunos) é aplicado na criação/importação via
//   `setStudentLimit` — o controller do Step 2 alimenta com
//   PlanService.canAddStudent; sem limite configurado, não há teto.

export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'TRANSFERRED';
export type Relationship =
  | 'FATHER'
  | 'MOTHER'
  | 'GRANDPARENT'
  | 'SIBLING'
  | 'GUARDIAN'
  | 'OTHER';

export interface SchoolRecord {
  id: string;
  name: string;
  slug: string;
  document?: string;
  timezone: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClassroomRecord {
  id: string;
  schoolId: string;
  name: string;
  grade?: string;
  academicYear: number;
  roomLocation?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentRecord {
  id: string;
  schoolId: string;
  classroomId: string;
  name: string;
  enrollmentCode?: string;
  birthDate?: string; // YYYY-MM-DD
  status: StudentStatus;
  pickupBlocked: boolean;
  blockReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TutorRecord {
  id: string;
  schoolId: string;
  name: string;
  phone: string; // só dígitos, DDD incluído, sem +55
  document?: string;
  /** Conta de login vinculada (User.id) — a maioria dos responsáveis
   * NÃO tem; o vínculo é feito pela secretaria (setTutorUserId) e é
   * ele que destrava a área do responsável (fila/QR pela própria
   * conta). Sem ele, o tutor é só cadastro. */
  userId?: string;
  isBlocked: boolean;
  blockReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TutorLink {
  tutorId: string;
  studentId: string;
  relationship: Relationship;
  isPrimary: boolean;
  canPickup: boolean;
  createdAt: Date;
}

export interface ImportRowError {
  line: number;
  row: string;
  message: string;
}

export interface ImportReport {
  totalRows: number;
  created: number;
  updated: number;
  skippedDuplicates: number;
  tutorsCreated: number;
  tutorsLinked: number;
  classroomsCreated: string[];
  errors: ImportRowError[];
  dryRun: boolean;
}

export interface ImportOptions {
  /** Só valida e relata, sem gravar nada. */
  dryRun?: boolean;
  /** Ano letivo das turmas criadas na importação (default: ano corrente). */
  academicYear?: number;
  /** Cria a turma quando ela não existe (default true); false = erro na linha. */
  createClassrooms?: boolean;
}

const RELATIONSHIP_LABELS: Record<string, Relationship> = {
  pai: 'FATHER',
  mae: 'MOTHER',
  mãe: 'MOTHER',
  avo: 'GRANDPARENT',
  avó: 'GRANDPARENT',
  avô: 'GRANDPARENT',
  irmao: 'SIBLING',
  irmão: 'SIBLING',
  irma: 'SIBLING',
  irmã: 'SIBLING',
  responsavel: 'GUARDIAN',
  responsável: 'GUARDIAN',
  guardiao: 'GUARDIAN',
  guardião: 'GUARDIAN',
  outro: 'OTHER',
};

const HEADER_ALIASES: Record<string, string> = {
  nome: 'name',
  name: 'name',
  aluno: 'name',
  turma: 'classroom',
  sala: 'classroom',
  classroom: 'classroom',
  matricula: 'enrollmentCode',
  matrícula: 'enrollmentCode',
  enrollmentcode: 'enrollmentCode',
  enrollment: 'enrollmentCode',
  nascimento: 'birthDate',
  datanascimento: 'birthDate',
  data_nascimento: 'birthDate',
  birthdate: 'birthDate',
  responsavel: 'tutorName',
  responsável: 'tutorName',
  responsavel_nome: 'tutorName',
  tutor: 'tutorName',
  telefone: 'tutorPhone',
  celular: 'tutorPhone',
  phone: 'tutorPhone',
  parentesco: 'relationship',
  relationship: 'relationship',
};

let seq = 0;
function newId(prefix: string): string {
  return `${prefix}-${++seq}-${Date.now().toString(36)}`;
}

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(name: string): string {
  const slug = fold(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) throw new BadRequestException('Nome inválido p/ gerar o slug da escola');
  return slug;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const withoutCountry =
    digits.length >= 12 && digits.startsWith('55') ? digits.slice(2) : digits;
  if (withoutCountry.length !== 10 && withoutCountry.length !== 11) {
    throw new BadRequestException(
      `Telefone inválido: "${raw}" — esperado DDD + número (10 ou 11 dígitos)`,
    );
  }
  return withoutCountry;
}

function parseBirthDate(raw: string, now: Date): string {
  const trimmed = raw.trim();
  const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  let y: number;
  let m: number;
  let d: number;
  if (ddmmyyyy) {
    [, d, m, y] = ddmmyyyy.map(Number);
  } else if (iso) {
    [, y, m, d] = iso.map(Number);
  } else {
    throw new BadRequestException(
      `Data de nascimento inválida: "${raw}" — use DD/MM/AAAA ou AAAA-MM-DD`,
    );
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    throw new BadRequestException(`Data de nascimento inexistente: "${raw}"`);
  }
  if (date.getTime() > now.getTime()) {
    throw new BadRequestException(`Data de nascimento no futuro: "${raw}"`);
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Parser CSV mínimo: aspas duplas escapam o delimitador e a quebra de linha. */
function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const delimiter = semicolons >= commas ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

@Injectable()
export class RosterService implements OnModuleInit, OnModuleDestroy {
  private schools: SchoolRecord[] = [];
  private classrooms: ClassroomRecord[] = [];
  private students: StudentRecord[] = [];
  private tutors: TutorRecord[] = [];
  private links: TutorLink[] = [];
  private studentLimits = new Map<string, number>();

  // Persistência (Step 2): com o PrismaService presente, o cadastro
  // INTEIRO (escolas, turmas, alunos, tutores e vínculos) é hidratado
  // do Postgres no boot e gravado em write-through — o cadastro
  // sobrevive a restart/deploy (antes só a escola sobrevivia e cada
  // deploy apagava turmas/alunos/tutores). Nos testes
  // (new RosterService()) o parâmetro fica undefined e nada muda.
  constructor(
    @Optional() @Inject(PrismaService) private readonly prisma?: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.prisma) return;
    const rows = await this.prisma.school.findMany();
    this.schools = rows.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      document: s.document ?? undefined,
      timezone: s.timezone,
      isActive: s.isActive,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
    const [classroomRows, studentRows, tutorRows, linkRows] = await Promise.all([
      this.prisma.classroom.findMany(),
      this.prisma.student.findMany(),
      this.prisma.tutor.findMany(),
      this.prisma.tutorStudent.findMany(),
    ]);
    this.classrooms = classroomRows.map((c) => ({
      id: c.id,
      schoolId: c.schoolId,
      name: c.name,
      grade: c.grade ?? undefined,
      academicYear: c.academicYear,
      roomLocation: c.roomLocation ?? undefined,
      isActive: c.isActive,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
    this.students = studentRows.map((s) => ({
      id: s.id,
      schoolId: s.schoolId,
      classroomId: s.classroomId,
      name: s.name,
      enrollmentCode: s.enrollmentCode ?? undefined,
      // @db.Date volta como Date em UTC meia-noite — o cadastro usa a
      // string YYYY-MM-DD.
      birthDate: s.birthDate ? s.birthDate.toISOString().slice(0, 10) : undefined,
      status: s.status,
      pickupBlocked: s.pickupBlocked,
      blockReason: s.blockReason ?? undefined,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
    this.tutors = tutorRows.map((t) => ({
      id: t.id,
      schoolId: t.schoolId,
      name: t.name ?? '',
      phone: t.phone ?? '',
      document: t.document ?? undefined,
      userId: t.userId ?? undefined,
      isBlocked: t.isBlocked,
      blockReason: t.blockReason ?? undefined,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
    this.links = linkRows.map((l) => ({
      tutorId: l.tutorId,
      studentId: l.studentId,
      relationship: l.relationship,
      isPrimary: l.isPrimary,
      canPickup: l.canPickup,
      createdAt: l.createdAt,
    }));
    // eslint-disable-next-line no-console
    console.log(
      `[RosterService] hidratação: ${rows.length} escola(s), ${this.classrooms.length} turma(s), ${this.students.length} aluno(s), ${this.tutors.length} tutor(es) do Postgres`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma?.flushWrites();
  }

  private persist(op: (prisma: PrismaService) => Promise<unknown>): void {
    const prisma = this.prisma;
    if (!prisma) return;
    prisma.enqueueWrite(() => op(prisma));
  }

  // Write-through do cadastro: cada mutação grava o estado COMPLETO da
  // entidade via upsert (a fila de writes é serial, então create e
  // updates chegam ao Postgres na ordem em que aconteceram).
  private persistClassroom(c: ClassroomRecord): void {
    const data = {
      schoolId: c.schoolId,
      name: c.name,
      grade: c.grade ?? null,
      academicYear: c.academicYear,
      roomLocation: c.roomLocation ?? null,
      isActive: c.isActive,
      updatedAt: c.updatedAt,
    };
    this.persist((prisma) =>
      prisma.classroom.upsert({
        where: { id: c.id },
        create: { id: c.id, ...data, createdAt: c.createdAt },
        update: data,
      }),
    );
  }

  private persistStudent(s: StudentRecord): void {
    const data = {
      schoolId: s.schoolId,
      classroomId: s.classroomId,
      name: s.name,
      enrollmentCode: s.enrollmentCode ?? null,
      birthDate: s.birthDate ? new Date(`${s.birthDate}T00:00:00.000Z`) : null,
      status: s.status,
      pickupBlocked: s.pickupBlocked,
      blockReason: s.blockReason ?? null,
      updatedAt: s.updatedAt,
    };
    this.persist((prisma) =>
      prisma.student.upsert({
        where: { id: s.id },
        create: { id: s.id, ...data, createdAt: s.createdAt },
        update: data,
      }),
    );
  }

  private persistTutor(t: TutorRecord): void {
    const data = {
      schoolId: t.schoolId,
      name: t.name,
      phone: t.phone,
      document: t.document ?? null,
      userId: t.userId ?? null,
      isBlocked: t.isBlocked,
      blockReason: t.blockReason ?? null,
      updatedAt: t.updatedAt,
    };
    this.persist((prisma) =>
      prisma.tutor.upsert({
        where: { id: t.id },
        create: { id: t.id, ...data, createdAt: t.createdAt },
        update: data,
      }),
    );
  }

  private persistLink(l: TutorLink): void {
    const data = {
      relationship: l.relationship,
      isPrimary: l.isPrimary,
      canPickup: l.canPickup,
    };
    this.persist((prisma) =>
      prisma.tutorStudent.upsert({
        where: { tutorId_studentId: { tutorId: l.tutorId, studentId: l.studentId } },
        create: { tutorId: l.tutorId, studentId: l.studentId, ...data, createdAt: l.createdAt },
        update: data,
      }),
    );
  }

  // ---------------------------------------------------------------- escolas

  createSchool(
    input: { name: string; slug?: string; document?: string; timezone?: string },
    now: Date = new Date(),
  ): SchoolRecord {
    const name = input.name?.trim();
    if (!name || name.length < 2) {
      throw new BadRequestException('Nome da escola obrigatório (mín. 2 caracteres)');
    }
    const slug = input.slug ? slugify(input.slug) : slugify(name);
    if (this.schools.some((s) => s.slug === slug)) {
      throw new BadRequestException(`Slug "${slug}" já usado por outra escola`);
    }
    const document = input.document?.replace(/\D/g, '') || undefined;
    if (document && document.length !== 14) {
      throw new BadRequestException('CNPJ inválido — esperado 14 dígitos');
    }
    const school: SchoolRecord = {
      // UUID (e não o newId prefixado das demais entidades) porque a escola é
      // persistida no Postgres, onde School.id é uuid — e o schoolId viaja no
      // JWT e nos FKs de SchoolMember.
      id: randomUUID(),
      name,
      slug,
      document,
      timezone: input.timezone?.trim() || 'America/Sao_Paulo',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.schools.push(school);
    this.persist((prisma) =>
      prisma.school.create({
        data: {
          id: school.id,
          name: school.name,
          slug: school.slug,
          document: school.document ?? null,
          timezone: school.timezone,
          isActive: school.isActive,
          createdAt: school.createdAt,
          updatedAt: school.updatedAt,
        },
      }),
    );
    return { ...school };
  }

  updateSchool(
    schoolId: string,
    input: { name?: string; document?: string; timezone?: string },
    now: Date = new Date(),
  ): SchoolRecord {
    const school = this.requireSchool(schoolId);
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (name.length < 2) throw new BadRequestException('Nome da escola inválido');
      school.name = name;
    }
    if (input.document !== undefined) {
      const document = input.document.replace(/\D/g, '') || undefined;
      if (document && document.length !== 14) {
        throw new BadRequestException('CNPJ inválido — esperado 14 dígitos');
      }
      school.document = document;
    }
    if (input.timezone !== undefined) school.timezone = input.timezone.trim();
    school.updatedAt = now;
    this.persist((prisma) =>
      prisma.school.update({
        where: { id: school.id },
        data: {
          name: school.name,
          document: school.document ?? null,
          timezone: school.timezone,
          updatedAt: school.updatedAt,
        },
      }),
    );
    return { ...school };
  }

  /** O slug é o subdomínio da escola — nunca muda depois de criado. */
  deactivateSchool(schoolId: string, now: Date = new Date()): SchoolRecord {
    const school = this.requireSchool(schoolId);
    school.isActive = false;
    school.updatedAt = now;
    this.persist((prisma) =>
      prisma.school.update({
        where: { id: school.id },
        data: { isActive: false, updatedAt: now },
      }),
    );
    return { ...school };
  }

  reactivateSchool(schoolId: string, now: Date = new Date()): SchoolRecord {
    const school = this.requireSchool(schoolId);
    school.isActive = true;
    school.updatedAt = now;
    this.persist((prisma) =>
      prisma.school.update({
        where: { id: school.id },
        data: { isActive: true, updatedAt: now },
      }),
    );
    return { ...school };
  }

  getSchool(schoolId: string): SchoolRecord | null {
    const school = this.schools.find((s) => s.id === schoolId);
    return school ? { ...school } : null;
  }

  listSchools(includeInactive = false): SchoolRecord[] {
    return this.schools
      .filter((s) => includeInactive || s.isActive)
      .map((s) => ({ ...s }));
  }

  private requireSchool(schoolId: string): SchoolRecord {
    const school = this.schools.find((s) => s.id === schoolId);
    if (!school) throw new NotFoundException(`Escola não encontrada: ${schoolId}`);
    return school;
  }

  private requireActiveSchool(schoolId: string): SchoolRecord {
    const school = this.requireSchool(schoolId);
    if (!school.isActive) {
      throw new BadRequestException('Escola desativada — cadastro bloqueado');
    }
    return school;
  }

  // --------------------------------------------------------------- turmas

  createClassroom(
    schoolId: string,
    input: { name: string; grade?: string; academicYear: number; roomLocation?: string },
    now: Date = new Date(),
  ): ClassroomRecord {
    this.requireActiveSchool(schoolId);
    const name = input.name?.trim();
    if (!name) throw new BadRequestException('Nome da turma obrigatório');
    if (!Number.isInteger(input.academicYear) || input.academicYear < 2000) {
      throw new BadRequestException('Ano letivo inválido');
    }
    if (
      this.classrooms.some(
        (c) =>
          c.schoolId === schoolId &&
          c.academicYear === input.academicYear &&
          fold(c.name) === fold(name),
      )
    ) {
      throw new BadRequestException(
        `Turma "${name}" já existe em ${input.academicYear} nesta escola`,
      );
    }
    const classroom: ClassroomRecord = {
      // UUID: a turma é persistida no Postgres (Classroom.id é uuid).
      id: randomUUID(),
      schoolId,
      name,
      grade: input.grade?.trim() || undefined,
      academicYear: input.academicYear,
      roomLocation: input.roomLocation?.trim() || undefined,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.classrooms.push(classroom);
    this.persistClassroom(classroom);
    return { ...classroom };
  }

  renameClassroom(
    classroomId: string,
    name: string,
    now: Date = new Date(),
  ): ClassroomRecord {
    const classroom = this.requireClassroom(classroomId);
    const trimmed = name?.trim();
    if (!trimmed) throw new BadRequestException('Nome da turma obrigatório');
    if (
      this.classrooms.some(
        (c) =>
          c.id !== classroomId &&
          c.schoolId === classroom.schoolId &&
          c.academicYear === classroom.academicYear &&
          fold(c.name) === fold(trimmed),
      )
    ) {
      throw new BadRequestException(`Já existe uma turma "${trimmed}" neste ano letivo`);
    }
    classroom.name = trimmed;
    classroom.updatedAt = now;
    this.persistClassroom(classroom);
    return { ...classroom };
  }

  deactivateClassroom(classroomId: string, now: Date = new Date()): ClassroomRecord {
    const classroom = this.requireClassroom(classroomId);
    classroom.isActive = false;
    classroom.updatedAt = now;
    this.persistClassroom(classroom);
    return { ...classroom };
  }

  listClassrooms(
    schoolId: string,
    filter: { academicYear?: number; includeInactive?: boolean } = {},
  ): ClassroomRecord[] {
    this.requireSchool(schoolId);
    return this.classrooms
      .filter(
        (c) =>
          c.schoolId === schoolId &&
          (filter.academicYear === undefined || c.academicYear === filter.academicYear) &&
          (filter.includeInactive || c.isActive),
      )
      .map((c) => ({ ...c }));
  }

  private requireClassroom(classroomId: string): ClassroomRecord {
    const classroom = this.classrooms.find((c) => c.id === classroomId);
    if (!classroom) throw new NotFoundException(`Turma não encontrada: ${classroomId}`);
    return classroom;
  }

  // --------------------------------------------------------------- alunos

  /** Teto de alunos da escola (alimentado pelo PlanService no Step 2). */
  setStudentLimit(schoolId: string, maxStudents: number): void {
    this.requireSchool(schoolId);
    if (!Number.isInteger(maxStudents) || maxStudents < 0) {
      throw new BadRequestException('Limite de alunos inválido');
    }
    this.studentLimits.set(schoolId, maxStudents);
  }

  countActiveStudents(schoolId: string): number {
    return this.students.filter(
      (s) => s.schoolId === schoolId && s.status === 'ACTIVE',
    ).length;
  }

  createStudent(
    schoolId: string,
    input: {
      name: string;
      classroomId: string;
      enrollmentCode?: string;
      birthDate?: string;
    },
    now: Date = new Date(),
  ): StudentRecord {
    this.requireActiveSchool(schoolId);
    const classroom = this.requireClassroom(input.classroomId);
    if (classroom.schoolId !== schoolId) {
      throw new BadRequestException('Turma pertence a outra escola');
    }
    if (!classroom.isActive) {
      throw new BadRequestException('Turma desativada — não recebe novos alunos');
    }
    const name = input.name?.trim();
    if (!name || name.length < 2) {
      throw new BadRequestException('Nome do aluno obrigatório (mín. 2 caracteres)');
    }
    const enrollmentCode = input.enrollmentCode?.trim() || undefined;
    if (
      enrollmentCode &&
      this.students.some(
        (s) => s.schoolId === schoolId && s.enrollmentCode === enrollmentCode,
      )
    ) {
      throw new BadRequestException(
        `Matrícula "${enrollmentCode}" já cadastrada nesta escola`,
      );
    }
    const birthDate = input.birthDate
      ? parseBirthDate(input.birthDate, now)
      : undefined;
    const limit = this.studentLimits.get(schoolId);
    if (limit !== undefined && this.countActiveStudents(schoolId) >= limit) {
      throw new BadRequestException(
        `Limite de alunos atingido (${limit}) — faça upgrade p/ PRO`,
      );
    }
    const student: StudentRecord = {
      // UUID: o aluno é persistido no Postgres (Student.id é uuid).
      id: randomUUID(),
      schoolId,
      classroomId: input.classroomId,
      name,
      enrollmentCode,
      birthDate,
      status: 'ACTIVE',
      pickupBlocked: false,
      createdAt: now,
      updatedAt: now,
    };
    this.students.push(student);
    this.persistStudent(student);
    return { ...student };
  }

  updateStudent(
    studentId: string,
    input: { name?: string; enrollmentCode?: string | null; birthDate?: string | null },
    now: Date = new Date(),
  ): StudentRecord {
    const student = this.requireStudent(studentId);
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (name.length < 2) throw new BadRequestException('Nome do aluno inválido');
      student.name = name;
    }
    if (input.enrollmentCode !== undefined) {
      const enrollmentCode = input.enrollmentCode?.trim() || undefined;
      if (
        enrollmentCode &&
        this.students.some(
          (s) =>
            s.id !== studentId &&
            s.schoolId === student.schoolId &&
            s.enrollmentCode === enrollmentCode,
        )
      ) {
        throw new BadRequestException(
          `Matrícula "${enrollmentCode}" já cadastrada nesta escola`,
        );
      }
      student.enrollmentCode = enrollmentCode;
    }
    if (input.birthDate !== undefined) {
      student.birthDate = input.birthDate
        ? parseBirthDate(input.birthDate, now)
        : undefined;
    }
    student.updatedAt = now;
    this.persistStudent(student);
    return { ...student };
  }

  transferStudent(
    studentId: string,
    classroomId: string,
    now: Date = new Date(),
  ): StudentRecord {
    const student = this.requireStudent(studentId);
    const classroom = this.requireClassroom(classroomId);
    if (classroom.schoolId !== student.schoolId) {
      throw new BadRequestException('Turma pertence a outra escola');
    }
    if (!classroom.isActive) {
      throw new BadRequestException('Turma desativada — não recebe alunos');
    }
    student.classroomId = classroomId;
    student.updatedAt = now;
    this.persistStudent(student);
    return { ...student };
  }

  setStudentStatus(
    studentId: string,
    status: StudentStatus,
    now: Date = new Date(),
  ): StudentRecord {
    const student = this.requireStudent(studentId);
    student.status = status;
    student.updatedAt = now;
    this.persistStudent(student);
    return { ...student };
  }

  /** Bloqueio de retirada (judicial/administrativo): motivo obrigatório e registrado. */
  blockPickup(
    studentId: string,
    reason: string,
    now: Date = new Date(),
  ): StudentRecord {
    const student = this.requireStudent(studentId);
    if (!reason?.trim() || reason.trim().length < 3) {
      throw new BadRequestException('Motivo do bloqueio obrigatório (mín. 3 caracteres)');
    }
    student.pickupBlocked = true;
    student.blockReason = reason.trim();
    student.updatedAt = now;
    this.persistStudent(student);
    return { ...student };
  }

  unblockPickup(studentId: string, now: Date = new Date()): StudentRecord {
    const student = this.requireStudent(studentId);
    student.pickupBlocked = false;
    student.blockReason = undefined;
    student.updatedAt = now;
    this.persistStudent(student);
    return { ...student };
  }

  getStudent(studentId: string): StudentRecord | null {
    const student = this.students.find((s) => s.id === studentId);
    return student ? { ...student } : null;
  }

  listStudents(
    schoolId: string,
    filter: { classroomId?: string; status?: StudentStatus; search?: string } = {},
  ): StudentRecord[] {
    this.requireSchool(schoolId);
    const search = filter.search ? fold(filter.search) : undefined;
    return this.students
      .filter(
        (s) =>
          s.schoolId === schoolId &&
          (filter.classroomId === undefined || s.classroomId === filter.classroomId) &&
          (filter.status === undefined || s.status === filter.status) &&
          (search === undefined || fold(s.name).includes(search)),
      )
      .map((s) => ({ ...s }));
  }

  private requireStudent(studentId: string): StudentRecord {
    const student = this.students.find((s) => s.id === studentId);
    if (!student) throw new NotFoundException(`Aluno não encontrado: ${studentId}`);
    return student;
  }

  // -------------------------------------------------------------- tutores

  createTutor(
    schoolId: string,
    input: { name: string; phone: string; document?: string },
    now: Date = new Date(),
  ): TutorRecord {
    this.requireActiveSchool(schoolId);
    const name = input.name?.trim();
    if (!name || name.length < 2) {
      throw new BadRequestException('Nome do tutor obrigatório (mín. 2 caracteres)');
    }
    const phone = normalizePhone(input.phone);
    if (this.tutors.some((t) => t.schoolId === schoolId && t.phone === phone)) {
      throw new BadRequestException(
        `Já existe um tutor com o telefone ${phone} nesta escola`,
      );
    }
    const document = input.document?.replace(/\D/g, '') || undefined;
    if (document && document.length !== 11 && document.length !== 14) {
      throw new BadRequestException('Documento inválido — esperado CPF (11) ou CNPJ (14)');
    }
    const tutor: TutorRecord = {
      // UUID: o tutor é persistido no Postgres (Tutor.id é uuid).
      id: randomUUID(),
      schoolId,
      name,
      phone,
      document,
      isBlocked: false,
      createdAt: now,
      updatedAt: now,
    };
    this.tutors.push(tutor);
    this.persistTutor(tutor);
    return { ...tutor };
  }

  /**
   * Vínculo conta ↔ cadastro: a secretaria liga o responsável do
   * cadastro à conta de login dele (User.id) — é esse vínculo que
   * resolve "quem sou eu" na área do responsável, sem o tutor passar
   * id de outro no body. Uma conta só pode estar vinculada a UM
   * responsável (a coluna é única no banco; a checagem aqui dá o
   * erro legível antes do banco reclamar).
   */
  setTutorUserId(
    tutorId: string,
    userId: string | null,
    now: Date = new Date(),
  ): TutorRecord {
    const tutor = this.requireTutor(tutorId);
    if (userId) {
      const clash = this.tutors.find((t) => t.id !== tutorId && t.userId === userId);
      if (clash) {
        throw new BadRequestException(
          'Esta conta já está vinculada a outro responsável.',
        );
      }
    }
    tutor.userId = userId ?? undefined;
    tutor.updatedAt = now;
    this.persistTutor(tutor);
    return { ...tutor };
  }

  /** O responsável por trás de uma conta, dentro de uma escola. */
  getTutorByUserId(schoolId: string, userId: string): TutorRecord | null {
    const tutor = this.tutors.find(
      (t) => t.schoolId === schoolId && t.userId === userId,
    );
    return tutor ? { ...tutor } : null;
  }

  blockTutor(tutorId: string, reason: string, now: Date = new Date()): TutorRecord {
    const tutor = this.requireTutor(tutorId);
    if (!reason?.trim() || reason.trim().length < 3) {
      throw new BadRequestException('Motivo do bloqueio obrigatório (mín. 3 caracteres)');
    }
    tutor.isBlocked = true;
    tutor.blockReason = reason.trim();
    tutor.updatedAt = now;
    this.persistTutor(tutor);
    return { ...tutor };
  }

  unblockTutor(tutorId: string, now: Date = new Date()): TutorRecord {
    const tutor = this.requireTutor(tutorId);
    tutor.isBlocked = false;
    tutor.blockReason = undefined;
    tutor.updatedAt = now;
    this.persistTutor(tutor);
    return { ...tutor };
  }

  getTutor(tutorId: string): TutorRecord | null {
    const tutor = this.tutors.find((t) => t.id === tutorId);
    return tutor ? { ...tutor } : null;
  }

  listTutors(schoolId: string, includeBlocked = true): TutorRecord[] {
    this.requireSchool(schoolId);
    return this.tutors
      .filter((t) => t.schoolId === schoolId && (includeBlocked || !t.isBlocked))
      .map((t) => ({ ...t }));
  }

  private requireTutor(tutorId: string): TutorRecord {
    const tutor = this.tutors.find((t) => t.id === tutorId);
    if (!tutor) throw new NotFoundException(`Tutor não encontrado: ${tutorId}`);
    return tutor;
  }

  // ------------------------------------------------------- vínculo tutor-aluno

  linkTutor(
    tutorId: string,
    studentId: string,
    relationship: Relationship,
    options: { isPrimary?: boolean; canPickup?: boolean } = {},
    now: Date = new Date(),
  ): TutorLink {
    const tutor = this.requireTutor(tutorId);
    const student = this.requireStudent(studentId);
    if (tutor.schoolId !== student.schoolId) {
      throw new BadRequestException('Tutor e aluno de escolas diferentes');
    }
    if (tutor.isBlocked) {
      throw new BadRequestException('Tutor bloqueado — não pode ser vinculado');
    }
    const existing = this.links.find(
      (l) => l.tutorId === tutorId && l.studentId === studentId,
    );
    if (existing) {
      throw new BadRequestException('Tutor já vinculado a este aluno');
    }
    const isPrimary = options.isPrimary ?? false;
    if (isPrimary) {
      for (const link of this.links) {
        if (link.studentId === studentId && link.isPrimary) {
          link.isPrimary = false;
          this.persistLink(link);
        }
      }
    }
    const link: TutorLink = {
      tutorId,
      studentId,
      relationship,
      isPrimary,
      canPickup: options.canPickup ?? true,
      createdAt: now,
    };
    this.links.push(link);
    this.persistLink(link);
    return { ...link };
  }

  unlinkTutor(tutorId: string, studentId: string): boolean {
    const idx = this.links.findIndex(
      (l) => l.tutorId === tutorId && l.studentId === studentId,
    );
    if (idx === -1) return false;
    this.links.splice(idx, 1);
    this.persist((prisma) =>
      prisma.tutorStudent.delete({
        where: { tutorId_studentId: { tutorId, studentId } },
      }),
    );
    return true;
  }

  listTutorsOfStudent(studentId: string): (TutorLink & { tutor: TutorRecord })[] {
    this.requireStudent(studentId);
    return this.links
      .filter((l) => l.studentId === studentId)
      .map((l) => ({
        ...l,
        tutor: { ...(this.tutors.find((t) => t.id === l.tutorId) as TutorRecord) },
      }));
  }

  listStudentsOfTutor(tutorId: string): (TutorLink & { student: StudentRecord })[] {
    this.requireTutor(tutorId);
    return this.links
      .filter((l) => l.tutorId === tutorId)
      .map((l) => ({
        ...l,
        student: { ...(this.students.find((s) => s.id === l.studentId) as StudentRecord) },
      }));
  }

  // ------------------------------------------------------- importação CSV

  /** Template p/ download: cabeçalho + 2 linhas de exemplo (padrão DismissPro). */
  rosterTemplateCsv(): string {
    return [
      'nome;turma;matricula;nascimento;responsavel;telefone;parentesco',
      'Ana Silva;3º A;2026001;12/03/2018;Maria Silva;(11) 98765-4321;mãe',
      'Bruno Costa;3º A;2026002;25/07/2018;João Costa;11987654322;pai',
    ].join('\n');
  }

  /** Export do cadastro atual (backup antes de re-importar — padrão DismissPro). */
  exportRosterCsv(schoolId: string): string {
    this.requireSchool(schoolId);
    const lines = [
      'nome;turma;matricula;nascimento;responsavel;telefone;parentesco;status',
    ];
    for (const student of this.listStudents(schoolId)) {
      const classroom = this.classrooms.find((c) => c.id === student.classroomId);
      const links = this.listTutorsOfStudent(student.id);
      const primary = links.find((l) => l.isPrimary) ?? links[0];
      const phone = primary ? primary.tutor.phone : '';
      const tutorName = primary ? primary.tutor.name : '';
      const relationship = primary ? primary.relationship : '';
      lines.push(
        [
          student.name,
          classroom?.name ?? '',
          student.enrollmentCode ?? '',
          student.birthDate ?? '',
          tutorName,
          phone,
          relationship,
          student.status,
        ].join(';'),
      );
    }
    return lines.join('\n');
  }

  /**
   * Importa alunos de um CSV. Regras (o que o mercado erra):
   * - re-importar ATUALIZA por matrícula (nunca apaga o cadastro);
   * - sem matrícula, o aluno é identificado por nome + turma — duplicata é
   *   pulada e relatada, não criada 2×;
   * - cada linha ruim é relatada com o nº da linha e o resto do arquivo segue;
   * - `dryRun` valida tudo e relata sem gravar (a prévia de matches/duplicatas
   *   do PickupRoster/"pickup." — a secretaria confere antes de salvar);
   * - colunas de responsável criam o tutor (por telefone) e o vínculo.
   */
  importStudents(
    schoolId: string,
    csvText: string,
    options: ImportOptions = {},
    now: Date = new Date(),
  ): ImportReport {
    this.requireActiveSchool(schoolId);
    const academicYear =
      options.academicYear ?? now.getFullYear();
    const createClassrooms = options.createClassrooms ?? true;
    const dryRun = options.dryRun ?? false;
    const rows = parseCsv(csvText);
    if (rows.length < 2) {
      throw new BadRequestException(
        'CSV vazio ou sem linhas de dados — use o template p/ download',
      );
    }
    const header = rows[0].map((h) => fold(h).replace(/[^a-z0-9_]/g, ''));
    const columns = header.map((h) => HEADER_ALIASES[h]);
    if (!columns.includes('name') || !columns.includes('classroom')) {
      throw new BadRequestException(
        'Cabeçalho inválido — colunas obrigatórias: nome e turma',
      );
    }
    const report: ImportReport = {
      totalRows: rows.length - 1,
      created: 0,
      updated: 0,
      skippedDuplicates: 0,
      tutorsCreated: 0,
      tutorsLinked: 0,
      classroomsCreated: [],
      errors: [],
      dryRun,
    };
    // Estado simulado p/ o dryRun e p/ duplicatas dentro do próprio arquivo.
    const pendingClassrooms = new Map<string, string>(); // fold(nome) -> id
    const pendingStudents = new Map<string, string>(); // chave dedupe -> id
    const pendingTutors = new Map<string, string>(); // telefone -> id
    const pendingLimit = { count: this.countActiveStudents(schoolId) };
    const limit = this.studentLimits.get(schoolId);

    const classroomIdFor = (className: string): string | null => {
      const key = fold(className);
      if (pendingClassrooms.has(key)) return pendingClassrooms.get(key) as string;
      const existing = this.classrooms.find(
        (c) =>
          c.schoolId === schoolId &&
          c.academicYear === academicYear &&
          fold(c.name) === key,
      );
      if (existing) {
        if (!existing.isActive) return null;
        return existing.id;
      }
      if (!createClassrooms) return null;
      const created = this.createClassroom(
        schoolId,
        { name: className.trim(), academicYear },
        now,
      );
      if (dryRun) {
        // Desfaz a criação real: no dryRun nada é gravado.
        this.classrooms.splice(this.classrooms.indexOf(created), 1);
        pendingClassrooms.set(key, created.id);
        report.classroomsCreated.push(className.trim());
      } else {
        report.classroomsCreated.push(className.trim());
      }
      return created.id;
    };

    for (let i = 1; i < rows.length; i++) {
      const line = i + 1;
      const raw = rows[i];
      const get = (field: string): string => {
        const idx = columns.indexOf(field);
        return idx === -1 ? '' : (raw[idx] ?? '').trim();
      };
      try {
        const name = get('name');
        const classroomName = get('classroom');
        if (!name || name.length < 2) {
          throw new BadRequestException('nome do aluno obrigatório (mín. 2 caracteres)');
        }
        if (!classroomName) {
          throw new BadRequestException('turma obrigatória');
        }
        const enrollmentCode = get('enrollmentCode') || undefined;
        const birthRaw = get('birthDate');
        const birthDate = birthRaw ? parseBirthDate(birthRaw, now) : undefined;
        // Valida o responsável ANTES de criar/atualizar o aluno: uma linha
        // com tutor inválido não deixa aluno órfão no cadastro.
        const tutorData = this.parseTutorRow(schoolId, get);
        const classroomId = classroomIdFor(classroomName);
        if (!classroomId) {
          throw new BadRequestException(
            `turma "${classroomName}" não existe ou está desativada`,
          );
        }
        // Dedupe: matrícula primeiro; sem ela, nome + turma.
        const dedupeKey = enrollmentCode
          ? `code:${enrollmentCode}`
          : `name:${fold(name)}|class:${classroomId}`;
        const existingByCode = enrollmentCode
          ? this.students.find(
              (s) => s.schoolId === schoolId && s.enrollmentCode === enrollmentCode,
            )
          : undefined;
        const existingByName =
          !enrollmentCode
            ? this.students.find(
                (s) =>
                  s.schoolId === schoolId &&
                  s.classroomId === classroomId &&
                  fold(s.name) === fold(name),
              )
            : undefined;
        const pendingId = pendingStudents.get(dedupeKey);
        const existing = existingByCode ?? existingByName;
        if (existing || pendingId) {
          const studentId = existing?.id ?? (pendingId as string);
          this.applyTutorLink(schoolId, studentId, tutorData, report, pendingTutors, dryRun, now);
          if (pendingStudents.has(dedupeKey)) {
            // O aluno nasceu neste mesmo arquivo: 2ª ocorrência é duplicata,
            // não atualização (a re-importação de outro arquivo é que atualiza).
            report.skippedDuplicates++;
          } else if (existing) {
            if (!dryRun) {
              this.updateStudent(
                existing.id,
                { name, enrollmentCode, birthDate },
                now,
              );
              if (existing.classroomId !== classroomId) {
                this.transferStudent(existing.id, classroomId, now);
              }
            }
            report.updated++;
          }
          continue;
        }
        if (limit !== undefined && pendingLimit.count >= limit) {
          throw new BadRequestException(
            `limite de alunos atingido (${limit}) — faça upgrade p/ PRO`,
          );
        }
        let studentId: string;
        if (dryRun) {
          studentId = newId('student-dryrun');
          pendingStudents.set(dedupeKey, studentId);
          pendingLimit.count++;
          report.created++;
        } else {
          const created = this.createStudent(
            schoolId,
            { name, classroomId, enrollmentCode, birthDate },
            now,
          );
          studentId = created.id;
          pendingStudents.set(dedupeKey, studentId);
          pendingLimit.count++;
          report.created++;
        }
        this.applyTutorLink(schoolId, studentId, tutorData, report, pendingTutors, dryRun, now);
      } catch (err) {
        report.errors.push({
          line,
          row: raw.join(';'),
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return report;
  }

  /**
   * Valida as colunas do responsável de uma linha do CSV (nome + telefone
   * juntos; telefone válido; tutor existente não bloqueado). Não grava nada.
   */
  private parseTutorRow(
    schoolId: string,
    get: (field: string) => string,
  ): { name: string; phone: string; relationship: Relationship } | null {
    const tutorName = get('tutorName');
    const tutorPhoneRaw = get('tutorPhone');
    if (!tutorName && !tutorPhoneRaw) return null;
    if (!tutorName || !tutorPhoneRaw) {
      throw new BadRequestException(
        'responsável incompleto — informe nome e telefone juntos',
      );
    }
    if (tutorName.trim().length < 2) {
      throw new BadRequestException('nome do responsável inválido');
    }
    const phone = normalizePhone(tutorPhoneRaw);
    const relRaw = get('relationship');
    const relationship: Relationship =
      (relRaw ? RELATIONSHIP_LABELS[fold(relRaw)] : undefined) ?? 'OTHER';
    const existing = this.tutors.find(
      (t) => t.schoolId === schoolId && t.phone === phone,
    );
    if (existing?.isBlocked) {
      throw new BadRequestException(
        `tutor ${tutorName} está bloqueado nesta escola`,
      );
    }
    return { name: tutorName.trim(), phone, relationship };
  }

  private applyTutorLink(
    schoolId: string,
    studentId: string,
    tutorData: { name: string; phone: string; relationship: Relationship } | null,
    report: ImportReport,
    pendingTutors: Map<string, string>,
    dryRun: boolean,
    now: Date,
  ): void {
    if (!tutorData) return;
    let tutorId = pendingTutors.get(tutorData.phone);
    if (!tutorId) {
      const existing = this.tutors.find(
        (t) => t.schoolId === schoolId && t.phone === tutorData.phone,
      );
      if (existing) {
        tutorId = existing.id;
      } else if (dryRun) {
        tutorId = newId('tutor-dryrun');
        pendingTutors.set(tutorData.phone, tutorId);
        report.tutorsCreated++;
      } else {
        const created = this.createTutor(
          schoolId,
          { name: tutorData.name, phone: tutorData.phone },
          now,
        );
        tutorId = created.id;
        pendingTutors.set(tutorData.phone, tutorId);
        report.tutorsCreated++;
      }
    }
    if (dryRun) {
      report.tutorsLinked++;
      return;
    }
    const alreadyLinked = this.links.some(
      (l) => l.tutorId === tutorId && l.studentId === studentId,
    );
    if (!alreadyLinked) {
      const isFirst = this.listTutorsOfStudent(studentId).length === 0;
      this.linkTutor(tutorId as string, studentId, tutorData.relationship, { isPrimary: isFirst }, now);
      report.tutorsLinked++;
    }
  }
}
