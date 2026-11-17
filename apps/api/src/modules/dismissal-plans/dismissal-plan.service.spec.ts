import { DismissalPlanService } from './dismissal-plan.service';

// Hoje = terça, 17/11/2026 (horário local da escola; o serviço compara data/hora local).
const TUESDAY = '2026-11-17';
const BEFORE_CUTOFF = new Date('2026-11-17T12:00:00Z');
const AFTER_CUTOFF = new Date('2026-11-17T14:00:00Z');

const SCHOOL = 'school-1';
const STUDENT = 'student-1';
const STAFF = 'staff-1';
const TUTOR = 'tutor-1';

describe('DismissalPlanService', () => {
  let service: DismissalPlanService;

  beforeEach(() => {
    service = new DismissalPlanService();
  });

  function setCarDefault(weekday = 2) {
    return service.setDefault(
      {
        schoolId: SCHOOL,
        studentId: STUDENT,
        weekday,
        mode: 'CAR',
        pickupBy: 'Mãe',
        setBy: STAFF,
        setByRole: 'STAFF',
      },
      BEFORE_CUTOFF,
    );
  }

  describe('plano padrão', () => {
    it('staff define o plano padrão de um dia da semana', () => {
      const plan = setCarDefault();
      expect(plan.mode).toBe('CAR');
      expect(plan.pickupBy).toBe('Mãe');
      expect(service.getDefault(STUDENT, 2)).toBe(plan);
    });

    it('tutor não pode definir o plano padrão (é da escola)', () => {
      expect(() =>
        service.setDefault({
          schoolId: SCHOOL,
          studentId: STUDENT,
          weekday: 2,
          mode: 'WALK',
          setBy: TUTOR,
          setByRole: 'TUTOR',
        }),
      ).toThrow('Só a secretaria pode definir o plano padrão');
    });

    it('rejeita dia da semana inválido', () => {
      expect(() =>
        service.setDefault({
          schoolId: SCHOOL,
          studentId: STUDENT,
          weekday: 7,
          mode: 'WALK',
          setBy: STAFF,
          setByRole: 'STAFF',
        }),
      ).toThrow('Dia da semana inválido');
    });

    it('CAR exige quem busca e BUS exige a linha', () => {
      expect(() =>
        service.setDefault({
          schoolId: SCHOOL,
          studentId: STUDENT,
          weekday: 2,
          mode: 'CAR',
          setBy: STAFF,
          setByRole: 'STAFF',
        }),
      ).toThrow('Informe quem vai buscar o aluno');
      expect(() =>
        service.setDefault({
          schoolId: SCHOOL,
          studentId: STUDENT,
          weekday: 2,
          mode: 'BUS',
          setBy: STAFF,
          setByRole: 'STAFF',
        }),
      ).toThrow('Informe a linha do ônibus/van');
    });

    it('redefinir o mesmo dia substitui o plano (upsert) e registra o modo anterior', () => {
      setCarDefault();
      const updated = service.setDefault(
        {
          schoolId: SCHOOL,
          studentId: STUDENT,
          weekday: 2,
          mode: 'BUS',
          busLine: 'Linha 12',
          setBy: STAFF,
          setByRole: 'STAFF',
        },
        BEFORE_CUTOFF,
      );
      expect(updated.mode).toBe('BUS');
      expect(service.listDefaultsForStudent(STUDENT)).toHaveLength(1);
      const log = service.listChangeLog(SCHOOL);
      expect(log[0].action).toBe('DEFAULT_SET');
      expect(log[0].fromMode).toBe('CAR');
    });

    it('copyDefault replica o plano de segunda para 3ª–6ª (COPY MONDAY)', () => {
      service.setDefault(
        {
          schoolId: SCHOOL,
          studentId: STUDENT,
          weekday: 1,
          mode: 'BUS',
          busLine: 'Linha 12',
          setBy: STAFF,
          setByRole: 'STAFF',
        },
        BEFORE_CUTOFF,
      );
      const copied = service.copyDefault(SCHOOL, STUDENT, 1, [2, 3, 4, 5], STAFF);
      expect(copied).toHaveLength(4);
      expect(copied.every((p) => p.mode === 'BUS' && p.busLine === 'Linha 12')).toBe(true);
      expect(service.listDefaultsForStudent(STUDENT)).toHaveLength(5);
    });

    it('copyDefault sem plano no dia de origem é rejeitado', () => {
      expect(() => service.copyDefault(SCHOOL, STUDENT, 1, [2, 3], STAFF)).toThrow(
        'Não há plano padrão no dia de origem',
      );
    });

    it('clearDefault remove o plano e resolve passa a NONE', () => {
      setCarDefault();
      expect(service.clearDefault(SCHOOL, STUDENT, 2, STAFF)).toBe(true);
      expect(service.clearDefault(SCHOOL, STUDENT, 2, STAFF)).toBe(false);
      expect(service.resolvePlanForDate(STUDENT, TUESDAY).source).toBe('NONE');
    });
  });

  describe('exceção do dia', () => {
    it('cria exceção para dia futuro sem cutoff', () => {
      const exception = service.createException(
        {
          schoolId: SCHOOL,
          studentId: STUDENT,
          date: '2026-11-20',
          mode: 'WALK',
          createdBy: TUTOR,
          createdByRole: 'TUTOR',
        },
        AFTER_CUTOFF, // depois do cutoff, mas a data é futura
      );
      expect(exception.status).toBe('ACTIVE');
    });

    it('cria exceção para hoje antes do cutoff', () => {
      const exception = service.createException(
        {
          schoolId: SCHOOL,
          studentId: STUDENT,
          date: TUESDAY,
          mode: 'CAR',
          pickupBy: 'Avó',
          createdBy: TUTOR,
          createdByRole: 'TUTOR',
        },
        BEFORE_CUTOFF,
      );
      expect(exception.pickupBy).toBe('Avó');
    });

    it('rejeita exceção para hoje depois do cutoff', () => {
      expect(() =>
        service.createException(
          {
            schoolId: SCHOOL,
            studentId: STUDENT,
            date: TUESDAY,
            mode: 'WALK',
            createdBy: TUTOR,
            createdByRole: 'TUTOR',
          },
          AFTER_CUTOFF,
        ),
      ).toThrow('horário-limite');
    });

    it('rejeita exceção para dia passado e data inválida', () => {
      expect(() =>
        service.createException(
          {
            schoolId: SCHOOL,
            studentId: STUDENT,
            date: '2026-11-16',
            mode: 'WALK',
            createdBy: TUTOR,
            createdByRole: 'TUTOR',
          },
          BEFORE_CUTOFF,
        ),
      ).toThrow('hoje ou um dia futuro');
      expect(() =>
        service.createException(
          {
            schoolId: SCHOOL,
            studentId: STUDENT,
            date: '17/11/2026',
            mode: 'WALK',
            createdBy: TUTOR,
            createdByRole: 'TUTOR',
          },
          BEFORE_CUTOFF,
        ),
      ).toThrow('YYYY-MM-DD');
    });

    it('rejeita segunda exceção ativa no mesmo dia', () => {
      service.createException(
        {
          schoolId: SCHOOL,
          studentId: STUDENT,
          date: TUESDAY,
          mode: 'WALK',
          createdBy: TUTOR,
          createdByRole: 'TUTOR',
        },
        BEFORE_CUTOFF,
      );
      expect(() =>
        service.createException(
          {
            schoolId: SCHOOL,
            studentId: STUDENT,
            date: TUESDAY,
            mode: 'CAR',
            pickupBy: 'Pai',
            createdBy: TUTOR,
            createdByRole: 'TUTOR',
          },
          BEFORE_CUTOFF,
        ),
      ).toThrow('Já existe uma exceção ativa');
    });

    it('atualiza a exceção antes do cutoff; depois do cutoff é rejeitado', () => {
      const exception = service.createException(
        {
          schoolId: SCHOOL,
          studentId: STUDENT,
          date: TUESDAY,
          mode: 'WALK',
          createdBy: TUTOR,
          createdByRole: 'TUTOR',
        },
        BEFORE_CUTOFF,
      );
      const updated = service.updateException(
        exception.id,
        { mode: 'CAR', pickupBy: 'Avó' },
        TUTOR,
        'TUTOR',
        BEFORE_CUTOFF,
      );
      expect(updated.mode).toBe('CAR');
      expect(() =>
        service.updateException(exception.id, { mode: 'WALK' }, TUTOR, 'TUTOR', AFTER_CUTOFF),
      ).toThrow('horário-limite');
    });

    it('só quem criou pode cancelar (tutor); staff pode cancelar qualquer uma', () => {
      const exception = service.createException(
        {
          schoolId: SCHOOL,
          studentId: STUDENT,
          date: TUESDAY,
          mode: 'WALK',
          createdBy: TUTOR,
          createdByRole: 'TUTOR',
        },
        BEFORE_CUTOFF,
      );
      expect(() =>
        service.cancelException(exception.id, 'tutor-2', 'TUTOR', BEFORE_CUTOFF),
      ).toThrow('Só quem criou a exceção pode cancelá-la');
      const cancelled = service.cancelException(exception.id, STAFF, 'STAFF', BEFORE_CUTOFF);
      expect(cancelled.status).toBe('CANCELLED');
    });

    it('cutoff configurável por escola vale no lugar do padrão', () => {
      service.setCutoff(SCHOOL, '14:00');
      // 13:45 passa a ser antes do cutoff da escola
      const exception = service.createException(
        {
          schoolId: SCHOOL,
          studentId: STUDENT,
          date: TUESDAY,
          mode: 'WALK',
          createdBy: TUTOR,
          createdByRole: 'TUTOR',
        },
        new Date('2026-11-17T13:45:00Z'),
      );
      expect(exception.status).toBe('ACTIVE');
      expect(() => service.setCutoff(SCHOOL, '25:00')).toThrow('Horário-limite inválido');
    });
  });

  describe('resolvePlanForDate', () => {
    it('exceção ativa vence o plano padrão', () => {
      setCarDefault(2); // terça = carro (mãe)
      service.createException(
        {
          schoolId: SCHOOL,
          studentId: STUDENT,
          date: TUESDAY,
          mode: 'BUS',
          busLine: 'Linha 12',
          createdBy: TUTOR,
          createdByRole: 'TUTOR',
        },
        BEFORE_CUTOFF,
      );
      const resolved = service.resolvePlanForDate(STUDENT, TUESDAY);
      expect(resolved.source).toBe('EXCEPTION');
      expect(resolved.mode).toBe('BUS');
      expect(resolved.busLine).toBe('Linha 12');
    });

    it('sem exceção, vale o plano padrão do dia da semana', () => {
      setCarDefault(2);
      const resolved = service.resolvePlanForDate(STUDENT, TUESDAY);
      expect(resolved.source).toBe('DEFAULT');
      expect(resolved.mode).toBe('CAR');
      expect(resolved.pickupBy).toBe('Mãe');
    });

    it('sem plano nem exceção, a resposta é NONE (não inventa plano)', () => {
      const resolved = service.resolvePlanForDate(STUDENT, TUESDAY);
      expect(resolved.source).toBe('NONE');
      expect(resolved.mode).toBeNull();
    });

    it('exceção cancelada não vence o plano padrão', () => {
      setCarDefault(2);
      const exception = service.createException(
        {
          schoolId: SCHOOL,
          studentId: STUDENT,
          date: TUESDAY,
          mode: 'WALK',
          createdBy: TUTOR,
          createdByRole: 'TUTOR',
        },
        BEFORE_CUTOFF,
      );
      service.cancelException(exception.id, TUTOR, 'TUTOR', BEFORE_CUTOFF);
      expect(service.resolvePlanForDate(STUDENT, TUESDAY).source).toBe('DEFAULT');
    });
  });

  describe('listas e refresh', () => {
    it('listExceptionsForSchool traz só as ativas do dia', () => {
      service.createException(
        {
          schoolId: SCHOOL,
          studentId: STUDENT,
          date: TUESDAY,
          mode: 'WALK',
          createdBy: TUTOR,
          createdByRole: 'TUTOR',
        },
        BEFORE_CUTOFF,
      );
      service.createException(
        {
          schoolId: SCHOOL,
          studentId: 'student-2',
          date: '2026-11-18',
          mode: 'BUS',
          busLine: 'Linha 3',
          createdBy: TUTOR,
          createdByRole: 'TUTOR',
        },
        BEFORE_CUTOFF,
      );
      expect(service.listExceptionsForSchool(SCHOOL, TUESDAY)).toHaveLength(1);
      expect(service.listExceptionsForSchool(SCHOOL, '2026-11-18')).toHaveLength(1);
    });

    it('refresh expira exceções de dias passados e é idempotente', () => {
      service.createException(
        {
          schoolId: SCHOOL,
          studentId: STUDENT,
          date: TUESDAY,
          mode: 'WALK',
          createdBy: TUTOR,
          createdByRole: 'TUTOR',
        },
        BEFORE_CUTOFF,
      );
      service.createException(
        {
          schoolId: SCHOOL,
          studentId: STUDENT,
          date: '2026-11-20',
          mode: 'WALK',
          createdBy: TUTOR,
          createdByRole: 'TUTOR',
        },
        BEFORE_CUTOFF,
      );
      const expired = service.refresh(new Date('2026-11-18T08:00:00Z'));
      expect(expired).toBe(1);
      expect(service.refresh(new Date('2026-11-18T08:00:00Z'))).toBe(0);
      expect(service.resolvePlanForDate(STUDENT, '2026-11-20').source).toBe('EXCEPTION');
    });

    it('changeLog registra mudanças em ordem (mais recente primeiro)', () => {
      setCarDefault();
      service.createException(
        {
          schoolId: SCHOOL,
          studentId: STUDENT,
          date: '2026-11-20',
          mode: 'WALK',
          createdBy: TUTOR,
          createdByRole: 'TUTOR',
        },
        BEFORE_CUTOFF,
      );
      const log = service.listChangeLog(SCHOOL);
      expect(log).toHaveLength(2);
      expect(log.map((c) => c.action)).toEqual(['EXCEPTION_CREATED', 'DEFAULT_SET']);
    });
  });
});
