import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Optional,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthService, type AccessTokenPayload } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DismissalPlanService } from '../dismissal-plans/dismissal-plan.service';
import {
  CreateClassroomDto,
  CreatePetVaccinationDto,
  CreateStudentDto,
  CreateTutorDto,
  ImportStudentsDto,
  LinkTutorDto,
  LinkTutorUserDto,
  RenameClassroomDto,
  SetDefaultPlanDto,
  SetStudentStatusDto,
  UpdatePetVaccinationDto,
  UpdateStudentDto,
  UpsertPetProfileDto,
} from './dto/roster.dto';
import { RosterService } from './roster.service';

// Cadastro da escola (turmas, alunos, tutores) — a camada HTTP que
// faltava: o RosterService existia com lógica e testes desde o ciclo 15,
// mas sem controller nenhuma tela conseguia usá-lo (varredura 17/11/2026).
//
// O schoolId vem SEMPRE da sessão (access token), nunca do body/query —
// isolamento de tenant por construção. Nos recursos por :id, o registro
// é conferido contra a escola da sessão: id de outra escola responde
// 404 (não vaza nem a existência).
@Controller('roster')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RosterController {
  constructor(
    private readonly roster: RosterService,
    private readonly auth: AuthService,
    @Optional() @Inject(DismissalPlanService) private readonly dismissalPlans?: DismissalPlanService,
  ) {}

  private schoolId(user: AccessTokenPayload): string {
    if (!user.schoolId) {
      throw new BadRequestException(
        'Sessão sem escola — entre com a escola selecionada para gerir o cadastro.',
      );
    }
    return user.schoolId;
  }

  private ownClassroom(user: AccessTokenPayload, classroomId: string) {
    const schoolId = this.schoolId(user);
    const classroom = this.roster
      .listClassrooms(schoolId, { includeInactive: true })
      .find((c) => c.id === classroomId);
    if (!classroom) throw new NotFoundException('Turma não encontrada');
    return classroom;
  }

  private ownStudent(user: AccessTokenPayload, studentId: string) {
    const student = this.roster.getStudent(studentId);
    if (!student || student.schoolId !== this.schoolId(user)) {
      throw new NotFoundException('Aluno não encontrado');
    }
    return student;
  }

  private ownTutor(user: AccessTokenPayload, tutorId: string) {
    const tutor = this.roster.getTutor(tutorId);
    if (!tutor || tutor.schoolId !== this.schoolId(user)) {
      throw new NotFoundException('Tutor não encontrado');
    }
    return tutor;
  }

  // ------------------------------------------------------------ turmas

  @Get('classrooms')
  @Roles('ADMIN', 'COORDINATOR', 'GATE_AGENT', 'TEACHER')
  listClassrooms(
    @CurrentUser() user: AccessTokenPayload,
    @Query('academicYear') academicYear?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.roster.listClassrooms(this.schoolId(user), {
      academicYear: academicYear ? Number(academicYear) : undefined,
      includeInactive: includeInactive === 'true',
    });
  }

  @Post('classrooms')
  @Roles('ADMIN', 'COORDINATOR')
  createClassroom(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateClassroomDto) {
    return this.roster.createClassroom(this.schoolId(user), dto);
  }

  @Patch('classrooms/:id')
  @Roles('ADMIN', 'COORDINATOR')
  renameClassroom(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: RenameClassroomDto,
  ) {
    this.ownClassroom(user, id);
    return this.roster.renameClassroom(id, dto.name);
  }

  @Delete('classrooms/:id')
  @Roles('ADMIN', 'COORDINATOR')
  deactivateClassroom(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    this.ownClassroom(user, id);
    return this.roster.deactivateClassroom(id);
  }

  // ------------------------------------------------------------ alunos

  @Get('students')
  @Roles('ADMIN', 'COORDINATOR', 'GATE_AGENT', 'TEACHER')
  listStudents(
    @CurrentUser() user: AccessTokenPayload,
    @Query('classroomId') classroomId?: string,
    @Query('search') search?: string,
  ) {
    return this.roster
      .listStudents(this.schoolId(user), { classroomId, search })
      .map((s) => ({
        ...s,
        tutorCount: this.roster.listTutorsOfStudent(s.id).length,
        clinicalAlerts: this.roster.getPetClinicalAlerts(s.id),
      }));
  }

  @Get('students/:id')
  @Roles('ADMIN', 'COORDINATOR', 'GATE_AGENT', 'TEACHER')
  getStudent(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    const student = this.ownStudent(user, id);
    return {
      ...student,
      tutorCount: this.roster.listTutorsOfStudent(student.id).length,
      clinicalAlerts: this.roster.getPetClinicalAlerts(student.id),
    };
  }

  // ------------------------------------------------ ficha do pet & vacinas (Fase 1)

  @Get('students/:id/pet-profile')
  @Roles('ADMIN', 'COORDINATOR', 'GATE_AGENT', 'TEACHER')
  getPetProfile(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    const student = this.ownStudent(user, id);
    return {
      student,
      profile: this.roster.getPetProfile(student.id),
      vaccinations: this.roster.listPetVaccinations(student.id),
      clinicalAlerts: this.roster.getPetClinicalAlerts(student.id),
    };
  }

  @Put('students/:id/pet-profile')
  @Roles('ADMIN', 'COORDINATOR')
  upsertPetProfile(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpsertPetProfileDto,
  ) {
    const student = this.ownStudent(user, id);
    return this.roster.upsertPetProfile(student.id, dto);
  }

  @Get('students/:id/vaccinations')
  @Roles('ADMIN', 'COORDINATOR', 'GATE_AGENT', 'TEACHER')
  listPetVaccinations(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    const student = this.ownStudent(user, id);
    return this.roster.listPetVaccinations(student.id);
  }

  @Post('students/:id/vaccinations')
  @Roles('ADMIN', 'COORDINATOR')
  addPetVaccination(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: CreatePetVaccinationDto,
  ) {
    const student = this.ownStudent(user, id);
    return this.roster.addPetVaccination(student.id, dto);
  }

  @Patch('students/:id/vaccinations/:vaccinationId')
  @Roles('ADMIN', 'COORDINATOR')
  updatePetVaccination(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Param('vaccinationId') vaccinationId: string,
    @Body() dto: UpdatePetVaccinationDto,
  ) {
    const student = this.ownStudent(user, id);
    const existing = this.roster
      .listPetVaccinations(student.id)
      .find((v) => v.id === vaccinationId);
    if (!existing) throw new NotFoundException('Vacina não encontrada para este aluno');
    return this.roster.updatePetVaccination(vaccinationId, dto);
  }

  @Delete('students/:id/vaccinations/:vaccinationId')
  @Roles('ADMIN', 'COORDINATOR')
  removePetVaccination(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Param('vaccinationId') vaccinationId: string,
  ) {
    const student = this.ownStudent(user, id);
    const existing = this.roster
      .listPetVaccinations(student.id)
      .find((v) => v.id === vaccinationId);
    if (!existing) throw new NotFoundException('Vacina não encontrada para este aluno');
    return { removed: this.roster.removePetVaccination(vaccinationId) };
  }

  @Get('students/:id/default-plans')
  @Roles('ADMIN', 'COORDINATOR', 'GATE_AGENT', 'TEACHER')
  listDefaultPlans(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    const student = this.ownStudent(user, id);
    return this.dismissalPlans?.listDefaultsForStudent(student.id) ?? [];
  }

  @Put('students/:id/default-plans')
  @Roles('ADMIN', 'COORDINATOR')
  setDefaultPlan(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: SetDefaultPlanDto,
  ) {
    const student = this.ownStudent(user, id);
    if (!this.dismissalPlans) {
      throw new BadRequestException('Serviço de planos padrão não disponível.');
    }
    const primary = this.dismissalPlans.setDefault({
      schoolId: student.schoolId,
      studentId: student.id,
      weekday: dto.weekday,
      mode: dto.mode,
      busLine: dto.busLine,
      pickupBy: dto.pickupBy,
      note: dto.note,
      setBy: user.sub,
      setByRole: 'STAFF',
    });
    if (dto.copyToWeekdays) {
      const targetWeekdays = [0, 1, 2, 3, 4, 5, 6].filter((w) => w !== dto.weekday);
      this.dismissalPlans.copyDefault(
        student.schoolId,
        student.id,
        dto.weekday,
        targetWeekdays,
        user.sub,
      );
    }
    return this.dismissalPlans.listDefaultsForStudent(student.id);
  }

  @Post('students')
  @Roles('ADMIN', 'COORDINATOR')
  createStudent(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateStudentDto) {
    return this.roster.createStudent(this.schoolId(user), dto);
  }

  @Patch('students/:id')
  @Roles('ADMIN', 'COORDINATOR')
  updateStudent(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    this.ownStudent(user, id);
    return this.roster.updateStudent(id, dto);
  }

  @Post('students/:id/status')
  @Roles('ADMIN', 'COORDINATOR')
  setStudentStatus(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: SetStudentStatusDto,
  ) {
    this.ownStudent(user, id);
    return this.roster.setStudentStatus(id, dto.status);
  }

  @Get('students/:id/tutors')
  @Roles('ADMIN', 'COORDINATOR', 'GATE_AGENT')
  tutorsOfStudent(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    this.ownStudent(user, id);
    return this.roster.listTutorsOfStudent(id);
  }

  @Post('import')
  @Roles('ADMIN', 'COORDINATOR')
  importStudents(@CurrentUser() user: AccessTokenPayload, @Body() dto: ImportStudentsDto) {
    return this.roster.importStudents(this.schoolId(user), dto.csv, {
      academicYear: dto.academicYear,
      dryRun: dto.dryRun,
    });
  }

  // ----------------------------------------------------------- tutores

  @Get('tutors')
  @Roles('ADMIN', 'COORDINATOR', 'GATE_AGENT')
  listTutors(@CurrentUser() user: AccessTokenPayload) {
    return this.roster.listTutors(this.schoolId(user)).map((t) => ({
      ...t,
      studentCount: this.roster
        .listStudentsOfTutor(t.id)
        .filter((l) => l.student.status === 'ACTIVE').length,
    }));
  }

  @Post('tutors')
  @Roles('ADMIN', 'COORDINATOR')
  createTutor(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateTutorDto) {
    return this.roster.createTutor(this.schoolId(user), dto);
  }

  @Post('tutors/:id/link')
  @Roles('ADMIN', 'COORDINATOR')
  linkTutor(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: LinkTutorDto,
  ) {
    this.ownTutor(user, id);
    this.ownStudent(user, dto.studentId);
    return this.roster.linkTutor(id, dto.studentId, dto.relationship, {
      isPrimary: dto.isPrimary,
      canPickup: dto.canPickup,
    });
  }

  @Delete('tutors/:id/link/:studentId')
  @Roles('ADMIN', 'COORDINATOR')
  unlinkTutor(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Param('studentId') studentId: string,
  ) {
    this.ownTutor(user, id);
    this.ownStudent(user, studentId);
    return { removed: this.roster.unlinkTutor(id, studentId) };
  }

  // ------------------------------------------------- vínculo com a conta

  // A secretaria vincula o responsável do cadastro à conta de login
  // dele (criada na aba Equipe). É este vínculo que destrava a área
  // do responsável: sem ele, a conta TUTOR entra e não vê nada.
  @Post('tutors/:id/link-user')
  @Roles('ADMIN', 'COORDINATOR')
  linkTutorUser(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: LinkTutorUserDto,
  ) {
    this.ownTutor(user, id);
    const account = this.auth.findUserByEmail(dto.email);
    if (!account) {
      throw new NotFoundException(
        'Nenhuma conta com este e-mail. Crie a conta primeiro (aba Equipe) e tente de novo.',
      );
    }
    return this.roster.setTutorUserId(id, account.id);
  }

  @Post('tutors/:id/unlink-user')
  @Roles('ADMIN', 'COORDINATOR')
  unlinkTutorUser(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    this.ownTutor(user, id);
    return this.roster.setTutorUserId(id, null);
  }
}
