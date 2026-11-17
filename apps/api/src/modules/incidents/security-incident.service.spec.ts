import {
  addBusinessDays,
  businessDaysBetween,
  SecurityIncidentService,
  type ReportIncidentInput,
} from './security-incident.service';

const SCHOOL = 'school-1';
const FRI_13_NOV = new Date('2026-11-13T10:00:00Z'); // sexta-feira

function baseInput(overrides: Partial<ReportIncidentInput> = {}): ReportIncidentInput {
  return {
    schoolId: SCHOOL,
    title: 'Planilha de alunos com permissão aberta',
    description: 'Link da planilha com nomes e telefones ficou público por 2h.',
    category: 'OPEN_SPREADSHEET',
    dataCategories: ['STUDENT_NAME', 'GUARDIAN_CONTACT'],
    affectedCount: 42,
    relevantRisk: true,
    detectedAt: FRI_13_NOV,
    reportedBy: 'dpo-escola',
    ...overrides,
  };
}

describe('SecurityIncidentService', () => {
  let service: SecurityIncidentService;

  beforeEach(() => {
    service = new SecurityIncidentService();
  });

  describe('report', () => {
    it('cria o incidente OPEN com os prazos em dias úteis (3 e 20)', () => {
      const incident = service.report(baseInput(), FRI_13_NOV);
      expect(incident.status).toBe('OPEN');
      // sex 13/11 + 3 dias úteis = qua 18/11
      expect(incident.communicationDueAt).toEqual(new Date('2026-11-18T10:00:00Z'));
      // sex 13/11 + 20 dias úteis = sex 11/12
      expect(incident.supplementDueAt).toEqual(new Date('2026-12-11T10:00:00Z'));
      expect(incident.anpdNotifiedAt).toBeNull();
      expect(service.listEvents(incident.id)).toHaveLength(1);
      expect(service.listEvents(incident.id)[0].type).toBe('REPORTED');
      expect(service.verifyChain(incident.id)).toBe(true);
    });

    it('rejeita título/descrição vazios, categoria inválida e affectedCount negativo', () => {
      expect(() => service.report(baseInput({ title: '  ' }), FRI_13_NOV)).toThrow(
        'obrigatórios',
      );
      expect(() => service.report(baseInput({ description: '' }), FRI_13_NOV)).toThrow(
        'obrigatórios',
      );
      expect(() =>
        service.report(baseInput({ category: 'HACKED' as never }), FRI_13_NOV),
      ).toThrow('Categoria inválida');
      expect(() => service.report(baseInput({ dataCategories: [] }), FRI_13_NOV)).toThrow(
        'ao menos uma categoria',
      );
      expect(() => service.report(baseInput({ affectedCount: -1 }), FRI_13_NOV)).toThrow(
        'inteiro maior ou igual a 0',
      );
      expect(() => service.report(baseInput({ reportedBy: ' ' }), FRI_13_NOV)).toThrow(
        'obrigatório',
      );
    });

    it('rejeita detectedAt no futuro', () => {
      expect(() =>
        service.report(
          baseInput({ detectedAt: new Date('2026-11-14T10:00:00Z') }),
          FRI_13_NOV,
        ),
      ).toThrow('no futuro');
    });
  });

  describe('addBusinessDays / businessDaysBetween', () => {
    it('pula fim de semana: sex + 3 dias úteis = qua', () => {
      expect(addBusinessDays(FRI_13_NOV, 3)).toEqual(new Date('2026-11-18T10:00:00Z'));
    });

    it('detecção no sábado também cai na quarta (seg é o 1º dia útil)', () => {
      const sat = new Date('2026-11-14T10:00:00Z');
      expect(addBusinessDays(sat, 3)).toEqual(new Date('2026-11-18T10:00:00Z'));
    });

    it('businessDaysBetween conta só dias úteis e fica negativo após o vencimento', () => {
      expect(
        businessDaysBetween(FRI_13_NOV, new Date('2026-11-18T10:00:00Z')),
      ).toBe(3);
      expect(
        businessDaysBetween(new Date('2026-11-19T10:00:00Z'), new Date('2026-11-18T10:00:00Z')),
      ).toBe(-1);
    });
  });

  describe('contain / close', () => {
    it('OPEN → CONTAINED com nota obrigatória; conter 2x é erro', () => {
      const incident = service.report(baseInput(), FRI_13_NOV);
      expect(() => service.contain(incident.id, 'dpo-escola', '  ')).toThrow('nota');
      const contained = service.contain(
        incident.id,
        'dpo-escola',
        'Link revogado e acesso restrito.',
        new Date('2026-11-13T11:00:00Z'),
      );
      expect(contained.status).toBe('CONTAINED');
      expect(contained.containedAt).toEqual(new Date('2026-11-13T11:00:00Z'));
      expect(() => service.contain(incident.id, 'dpo-escola', 'de novo')).toThrow('OPEN');
    });

    it('fechar exige contenção e, com risco relevante, ANPD + titulares', () => {
      const incident = service.report(baseInput(), FRI_13_NOV);
      expect(() => service.close(incident.id, 'dpo-escola')).toThrow('conter');
      service.contain(incident.id, 'dpo-escola', 'Link revogado.');
      expect(() => service.close(incident.id, 'dpo-escola')).toThrow('ANPD');
      service.recordAnpdNotification(incident.id, 'dpo-escola', new Date('2026-11-16T09:00:00Z'));
      expect(() => service.close(incident.id, 'dpo-escola')).toThrow('titulares');
      service.recordSubjectsNotification(
        incident.id,
        'dpo-escola',
        new Date('2026-11-16T10:00:00Z'),
      );
      const closed = service.close(incident.id, 'dpo-escola', new Date('2026-11-16T11:00:00Z'));
      expect(closed.status).toBe('CLOSED');
      expect(() => service.close(incident.id, 'dpo-escola')).toThrow('já fechado');
    });

    it('sem risco relevante, fecha só com contenção (sem comunicação obrigatória)', () => {
      const incident = service.report(
        baseInput({ relevantRisk: false, category: 'LOST_DEVICE', affectedCount: 0 }),
        FRI_13_NOV,
      );
      service.contain(incident.id, 'dpo-escola', 'Aparelho sem dados de alunos.');
      const closed = service.close(incident.id, 'dpo-escola');
      expect(closed.status).toBe('CLOSED');
    });

    it('ANPD + titulares comunicados viram COMMUNICATED antes do fechamento', () => {
      const incident = service.report(baseInput(), FRI_13_NOV);
      service.recordAnpdNotification(incident.id, 'dpo-escola', new Date('2026-11-16T09:00:00Z'));
      expect(service.get(incident.id).status).toBe('OPEN');
      service.recordSubjectsNotification(
        incident.id,
        'dpo-escola',
        new Date('2026-11-16T10:00:00Z'),
      );
      expect(service.get(incident.id).status).toBe('COMMUNICATED');
    });

    it('comunicação duplicada é erro', () => {
      const incident = service.report(baseInput(), FRI_13_NOV);
      service.recordAnpdNotification(incident.id, 'dpo-escola');
      expect(() => service.recordAnpdNotification(incident.id, 'dpo-escola')).toThrow(
        'já comunicada',
      );
    });
  });

  describe('supplement', () => {
    it('complementação exige ANPD comunicada e só pode ser enviada 1x', () => {
      const incident = service.report(baseInput(), FRI_13_NOV);
      expect(() => service.recordSupplement(incident.id, 'dpo-escola')).toThrow(
        'comunicação inicial',
      );
      service.recordAnpdNotification(incident.id, 'dpo-escola');
      const updated = service.recordSupplement(incident.id, 'dpo-escola');
      expect(updated.supplementSentAt).not.toBeNull();
      expect(() => service.recordSupplement(incident.id, 'dpo-escola')).toThrow('já enviada');
    });
  });

  describe('listOverdue / businessDaysRemaining', () => {
    it('lista incidente com comunicação vencida e some após comunicar a ANPD', () => {
      const incident = service.report(baseInput(), FRI_13_NOV);
      const afterDue = new Date('2026-11-19T10:00:00Z'); // qua 18/11 vencido
      expect(service.listOverdue(afterDue)).toHaveLength(1);
      expect(service.businessDaysRemaining(incident.id, afterDue)).toBe(-1);
      service.recordAnpdNotification(incident.id, 'dpo-escola', afterDue);
      expect(service.listOverdue(afterDue)).toHaveLength(0);
      expect(service.businessDaysRemaining(incident.id, FRI_13_NOV)).toBe(3);
    });

    it('lista complementação vencida mesmo com ANPD já comunicada', () => {
      const detected = new Date('2026-10-01T10:00:00Z'); // qui 01/10
      const incident = service.report(
        baseInput({ detectedAt: detected }),
        detected,
      );
      service.recordAnpdNotification(incident.id, 'dpo-escola', new Date('2026-10-02T09:00:00Z'));
      // suplemento vence sex 30/10 (01/10 + 20 dias úteis)
      expect(service.listOverdue(new Date('2026-10-29T10:00:00Z'))).toHaveLength(0);
      expect(service.listOverdue(new Date('2026-11-02T10:00:00Z'))).toHaveLength(1);
      service.recordSupplement(incident.id, 'dpo-escola', new Date('2026-11-02T11:00:00Z'));
      expect(service.listOverdue(new Date('2026-11-02T10:00:00Z'))).toHaveLength(0);
    });

    it('sem risco relevante, o vencimento não entra na lista (sem obrigação)', () => {
      service.report(baseInput({ relevantRisk: false }), FRI_13_NOV);
      expect(service.listOverdue(new Date('2026-11-19T10:00:00Z'))).toHaveLength(0);
    });

    it('incidente fechado nunca aparece como vencido', () => {
      const incident = service.report(baseInput({ relevantRisk: false }), FRI_13_NOV);
      service.contain(incident.id, 'dpo-escola', 'Contido.');
      service.close(incident.id, 'dpo-escola');
      expect(service.listOverdue(new Date('2026-12-01T10:00:00Z'))).toHaveLength(0);
    });
  });

  describe('addNote / listForSchool / verifyChain', () => {
    it('anotação entra no log sem mudar o status; vazia ou após fechar é erro', () => {
      const incident = service.report(baseInput(), FRI_13_NOV);
      expect(() => service.addNote(incident.id, 'dpo-escola', '  ')).toThrow('vazia');
      service.addNote(incident.id, 'dpo-escola', 'Ligamos para as 42 famílias.');
      expect(service.get(incident.id).status).toBe('OPEN');
      expect(service.listEvents(incident.id).map((e) => e.type)).toEqual(['REPORTED', 'NOTE']);
      service.contain(incident.id, 'dpo-escola', 'Contido.');
      service.recordAnpdNotification(incident.id, 'dpo-escola');
      service.recordSubjectsNotification(incident.id, 'dpo-escola');
      service.close(incident.id, 'dpo-escola');
      expect(() => service.addNote(incident.id, 'dpo-escola', 'tarde demais')).toThrow(
        'fechado',
      );
    });

    it('listForSchool filtra por escola e ordena por detectedAt desc', () => {
      const a = service.report(baseInput(), FRI_13_NOV);
      const b = service.report(
        baseInput({ schoolId: 'school-2', detectedAt: new Date('2026-11-12T10:00:00Z') }),
        FRI_13_NOV,
      );
      service.report(
        baseInput({ detectedAt: new Date('2026-11-10T10:00:00Z') }),
        FRI_13_NOV,
      );
      const list = service.listForSchool(SCHOOL);
      expect(list.map((i) => i.id)).toEqual([a.id, expect.any(String)]);
      expect(list).toHaveLength(2);
      expect(service.listForSchool('school-2').map((i) => i.id)).toEqual([b.id]);
    });

    it('verifyChain detecta adulteração no log do incidente', () => {
      const incident = service.report(baseInput(), FRI_13_NOV);
      expect(service.verifyChain(incident.id)).toBe(true);
      const events = service.listEvents(incident.id);
      events[0].note = 'adulterado';
      // listEvents devolve cópias da lista, mas os objetos são os mesmos:
      // a adulteração precisa ser detectada no log interno.
      expect(service.verifyChain(incident.id)).toBe(false);
    });

    it('get de incidente inexistente dá 404', () => {
      expect(() => service.get('incident-inexistente')).toThrow('não encontrado');
      expect(() => service.verifyChain('incident-inexistente')).toThrow('não encontrado');
    });
  });
});
