import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EarlyDismissalService } from './early-dismissal.service';

const MIN = 60_000;

function at(hours: number, minutes = 0): Date {
  // 2026-11-17 (terça), em UTC, para datas determinísticas nos testes.
  return new Date(Date.UTC(2026, 10, 17, hours, minutes));
}

function base(overrides: Partial<Parameters<EarlyDismissalService['request']>[0]> = {}) {
  return {
    schoolId: 'school-1',
    tutorId: 'tutor-1',
    studentIds: ['student-1'],
    requestedAt: at(16, 0),
    reason: 'Consulta médica',
    pickupBy: 'Mãe',
    ...overrides,
  };
}

describe('EarlyDismissalService', () => {
  let service: EarlyDismissalService;

  beforeEach(() => {
    service = new EarlyDismissalService();
  });

  describe('request', () => {
    it('cria pedido REQUESTED com motivo e quem busca', () => {
      const req = service.request(base(), at(14, 0));
      expect(req.status).toBe('REQUESTED');
      expect(req.reason).toBe('Consulta médica');
      expect(req.pickupBy).toBe('Mãe');
      expect(req.decidedBy).toBeNull();
    });

    it('rejeita horário no passado', () => {
      expect(() => service.request(base({ requestedAt: at(13, 0) }), at(14, 0))).toThrow(
        BadRequestException,
      );
    });

    it('rejeita pedido dentro do cutoff de 30 min', () => {
      // 15h50 p/ saída às 16h = 10 min de antecedência.
      expect(() => service.request(base(), at(15, 50))).toThrow(BadRequestException);
    });

    it('aceita pedido exatamente no cutoff (30 min)', () => {
      const req = service.request(base(), at(15, 30));
      expect(req.status).toBe('REQUESTED');
    });

    it('exige motivo com ao menos 3 caracteres', () => {
      expect(() => service.request(base({ reason: '  ' }), at(14, 0))).toThrow(
        BadRequestException,
      );
    });

    it('exige quem vai buscar', () => {
      expect(() => service.request(base({ pickupBy: ' ' }), at(14, 0))).toThrow(
        BadRequestException,
      );
    });

    it('exige ao menos um aluno', () => {
      expect(() => service.request(base({ studentIds: [] }), at(14, 0))).toThrow(
        BadRequestException,
      );
    });

    it('rejeita 2º pedido ativo p/ o mesmo aluno no mesmo dia', () => {
      service.request(base(), at(14, 0));
      expect(() =>
        service.request(base({ requestedAt: at(17, 0) }), at(14, 0)),
      ).toThrow(BadRequestException);
    });

    it('permite novo pedido no dia seguinte e p/ outro aluno', () => {
      service.request(base(), at(14, 0));
      const nextDay = service.request(
        base({ requestedAt: new Date(Date.UTC(2026, 10, 18, 16, 0)) }),
        at(14, 0),
      );
      expect(nextDay.status).toBe('REQUESTED');
      const otherStudent = service.request(
        base({ studentIds: ['student-2'], requestedAt: at(17, 0) }),
        at(14, 0),
      );
      expect(otherStudent.status).toBe('REQUESTED');
    });

    it('permite novo pedido após o anterior ser recusado', () => {
      const first = service.request(base(), at(14, 0));
      service.reject(first.id, 'staff-1', 'Sem autorização da direção.');
      const second = service.request(base({ requestedAt: at(17, 0) }), at(14, 0));
      expect(second.status).toBe('REQUESTED');
    });
  });

  describe('approve / reject', () => {
    it('aprova pedido REQUESTED e registra quem decidiu', () => {
      const req = service.request(base(), at(14, 0));
      const approved = service.approve(req.id, 'staff-1', 'Ok, sala avisada.', at(14, 10));
      expect(approved.status).toBe('APPROVED');
      expect(approved.decidedBy).toBe('staff-1');
      expect(approved.decisionNote).toBe('Ok, sala avisada.');
    });

    it('recusa exige motivo para o tutor', () => {
      const req = service.request(base(), at(14, 0));
      expect(() => service.reject(req.id, 'staff-1', ' ')).toThrow(BadRequestException);
      const rejected = service.reject(req.id, 'staff-1', 'Prova marcada nesse horário.');
      expect(rejected.status).toBe('REJECTED');
      expect(rejected.decisionNote).toBe('Prova marcada nesse horário.');
    });

    it('não aprova nem recusa pedido já decidido', () => {
      const req = service.request(base(), at(14, 0));
      service.approve(req.id, 'staff-1');
      expect(() => service.approve(req.id, 'staff-1')).toThrow(BadRequestException);
      expect(() => service.reject(req.id, 'staff-1', 'Tarde demais.')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancel', () => {
    it('tutor cancela o próprio pedido REQUESTED', () => {
      const req = service.request(base(), at(14, 0));
      const cancelled = service.cancel(req.id, 'tutor-1', at(14, 20));
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancelledAt).not.toBeNull();
    });

    it('outro tutor não pode cancelar', () => {
      const req = service.request(base(), at(14, 0));
      expect(() => service.cancel(req.id, 'tutor-2')).toThrow(ForbiddenException);
    });

    it('não cancela pedido já aprovado', () => {
      const req = service.request(base(), at(14, 0));
      service.approve(req.id, 'staff-1');
      expect(() => service.cancel(req.id, 'tutor-1')).toThrow(BadRequestException);
    });
  });

  describe('markUsed', () => {
    it('marca USED só pedido aprovado', () => {
      const req = service.request(base(), at(14, 0));
      expect(() => service.markUsed(req.id)).toThrow(BadRequestException);
      service.approve(req.id, 'staff-1');
      const used = service.markUsed(req.id, at(16, 5));
      expect(used.status).toBe('USED');
      expect(used.usedAt).toEqual(at(16, 5));
    });
  });

  describe('refresh', () => {
    it('expira REQUESTED e APPROVED com horário passado; não toca USED/CANCELLED', () => {
      const pending = service.request(base(), at(14, 0));
      const approved = service.request(base({ studentIds: ['student-2'] }), at(14, 0));
      service.approve(approved.id, 'staff-1');
      const used = service.request(base({ studentIds: ['student-3'] }), at(14, 0));
      service.approve(used.id, 'staff-1');
      service.markUsed(used.id, at(16, 0));
      const cancelled = service.request(base({ studentIds: ['student-4'] }), at(14, 0));
      service.cancel(cancelled.id, 'tutor-1');

      const expired = service.refresh(at(18, 0));
      expect(expired).toBe(2);
      expect(pending.status).toBe('EXPIRED');
      expect(approved.status).toBe('EXPIRED');
      expect(used.status).toBe('USED');
      expect(cancelled.status).toBe('CANCELLED');
    });

    it('refresh é idempotente', () => {
      service.request(base(), at(14, 0));
      expect(service.refresh(at(18, 0))).toBe(1);
      expect(service.refresh(at(18, 0))).toBe(0);
    });
  });

  describe('listPendingForSchool', () => {
    it('lista só REQUESTED da escola, do horário mais cedo p/ o mais tarde', () => {
      const late = service.request(base({ studentIds: ['s-1'], requestedAt: at(17, 0) }), at(14, 0));
      const early = service.request(base({ studentIds: ['s-2'], requestedAt: at(15, 0) }), at(14, 0));
      service.request(base({ schoolId: 'school-2', studentIds: ['s-3'] }), at(14, 0));
      service.approve(late.id, 'staff-1');
      const pending = service.listPendingForSchool('school-1');
      expect(pending.map((r) => r.id)).toEqual([early.id]);
    });
  });

  describe('isApprovedForPickup', () => {
    it('vale a partir de 30 min antes do horário, no dia pedido', () => {
      const req = service.request(base(), at(14, 0));
      service.approve(req.id, 'staff-1');
      expect(service.isApprovedForPickup('student-1', at(15, 29))).toBeNull();
      expect(service.isApprovedForPickup('student-1', at(15, 30))?.id).toBe(req.id);
      expect(service.isApprovedForPickup('student-1', at(16, 45))?.id).toBe(req.id);
    });

    it('não vale em outro dia nem p/ outro aluno nem sem aprovação', () => {
      const req = service.request(base(), at(14, 0));
      expect(service.isApprovedForPickup('student-1', at(16, 0))).toBeNull();
      service.approve(req.id, 'staff-1');
      expect(service.isApprovedForPickup('student-2', at(16, 0))).toBeNull();
      expect(
        service.isApprovedForPickup('student-1', new Date(Date.UTC(2026, 10, 18, 16, 0))),
      ).toBeNull();
    });
  });
});
