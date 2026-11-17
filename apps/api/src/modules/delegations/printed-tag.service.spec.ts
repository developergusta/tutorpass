import { PrintedTagService, PRINTED_TAG_QR_PREFIX } from './printed-tag.service';

const NOW = new Date('2026-11-17T12:00:00-03:00');
const SCHOOL = 'school-1';
const OTHER_SCHOOL = 'school-2';
const TUTOR = 'tutor-1';
const STUDENT_A = 'student-a';
const STUDENT_B = 'student-b';

function issue(service: PrintedTagService, overrides: Record<string, unknown> = {}) {
  return service.issue({
    schoolId: SCHOOL,
    tutorId: TUTOR,
    delegateName: 'Avó Maria',
    delegateDocument: 'RG 12.345.678-9',
    studentIds: [STUDENT_A],
    ...overrides,
  } as never, NOW);
}

describe('PrintedTagService', () => {
  let service: PrintedTagService;

  beforeEach(() => {
    service = new PrintedTagService();
  });

  it('emite tag ativa com código de 6 dígitos, QR e validade padrão de 1 dia', () => {
    const tag = issue(service);
    expect(tag.status).toBe('ACTIVE');
    expect(tag.code).toMatch(/^\d{6}$/);
    expect(tag.qrPayload).toBe(`${PRINTED_TAG_QR_PREFIX}:${SCHOOL}:${tag.code}`);
    expect(tag.singleUse).toBe(true);
    expect(tag.expiresAt.getTime() - NOW.getTime()).toBe(86_400_000);
    expect(tag.useCount).toBe(0);
  });

  it('aceita validade de até 30 dias e multiuso', () => {
    const tag = issue(service, { validityDays: 7, singleUse: false });
    expect(tag.expiresAt.getTime() - NOW.getTime()).toBe(7 * 86_400_000);
    expect(tag.singleUse).toBe(false);
  });

  it('rejeita emissão sem nome/documento/aluno e validade fora de 1–30 dias', () => {
    expect(() => issue(service, { delegateName: '  ' })).toThrow('Nome do delegado é obrigatório');
    expect(() => issue(service, { delegateDocument: '' })).toThrow('Documento do delegado é obrigatório');
    expect(() => issue(service, { studentIds: [] })).toThrow('Autorize ao menos 1 aluno');
    expect(() => issue(service, { validityDays: 0 })).toThrow('Validade inválida');
    expect(() => issue(service, { validityDays: 31 })).toThrow('Validade inválida');
  });

  it('não emite 2ª tag ativa p/ mesmo delegado + aluno (sem sobreposição)', () => {
    issue(service);
    expect(() => issue(service)).toThrow('já tem tag ativa');
    // Outro aluno, tudo bem.
    expect(() => issue(service, { studentIds: [STUDENT_B] })).not.toThrow();
  });

  it('não repete o código entre tags ativas da mesma escola', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const tag = issue(service, { delegateDocument: `RG ${i}`, studentIds: [STUDENT_B] });
      expect(codes.has(tag.code)).toBe(false);
      codes.add(tag.code);
    }
  });

  it('check libera código certo p/ aluno coberto e barra aluno não coberto', () => {
    const tag = issue(service);
    expect(service.check(SCHOOL, tag.code, STUDENT_A, NOW).allowed).toBe(true);
    const other = service.check(SCHOOL, tag.code, STUDENT_B, NOW);
    expect(other.allowed).toBe(false);
    expect(other.reason).toMatch('não coberto');
  });

  it('check barra código de outra escola e código malformado', () => {
    const tag = issue(service);
    expect(service.check(OTHER_SCHOOL, tag.code, STUDENT_A, NOW).allowed).toBe(false);
    expect(service.check(SCHOOL, '12345', STUDENT_A, NOW).reason).toMatch('6 dígitos');
  });

  it('uso único vira USED na 1ª retirada e barra a 2ª', () => {
    const tag = issue(service);
    service.use(tag, STUDENT_A, NOW);
    expect(tag.status).toBe('USED');
    expect(tag.useCount).toBe(1);
    expect(service.check(SCHOOL, tag.code, STUDENT_A, NOW).allowed).toBe(false);
    expect(() => service.use(tag, STUDENT_A, NOW)).toThrow('já utilizada');
  });

  it('multiuso permite várias retiradas até expirar', () => {
    const tag = issue(service, { singleUse: false });
    service.use(tag, STUDENT_A, NOW);
    service.use(tag, STUDENT_A, NOW);
    expect(tag.status).toBe('ACTIVE');
    expect(tag.useCount).toBe(2);
  });

  it('checkQrPayload aceita o QR da tag e rejeita QR malformado', () => {
    const tag = issue(service);
    expect(service.checkQrPayload(tag.qrPayload, STUDENT_A, NOW).allowed).toBe(true);
    expect(service.checkQrPayload('TUTORPASS-TAG:escola', STUDENT_A, NOW).allowed).toBe(false);
    expect(service.checkQrPayload('OUTRO:escola:123456', STUDENT_A, NOW).allowed).toBe(false);
    expect(service.checkQrPayload(tag.qrPayload, STUDENT_B, NOW).allowed).toBe(false);
  });

  it('recusa invalida a tag e diz quem avisar', () => {
    const tag = issue(service);
    const refusal = service.refuse(tag, 'Documento não confere com o impresso', NOW);
    expect(tag.status).toBe('REFUSED');
    expect(refusal.notifyTutorId).toBe(TUTOR);
    expect(refusal.reason).toMatch('Documento não confere');
    expect(service.check(SCHOOL, tag.code, STUDENT_A, NOW).allowed).toBe(false);
    // Recusa repetida é idempotente.
    expect(service.refuse(tag, 'outro motivo', NOW).tag.status).toBe('REFUSED');
    expect(() => service.refuse(tag, '', NOW)).not.toThrow();
  });

  it('recusa exige motivo e barra tag encerrada', () => {
    const tag = issue(service);
    expect(() => service.refuse(tag, '  ', NOW)).toThrow('Motivo da recusa é obrigatório');
    service.use(tag, STUDENT_A, NOW);
    expect(() => service.refuse(tag, 'tarde demais', NOW)).toThrow('já encerrada');
  });

  it('revoga tag ativa e é idempotente; barra revogar tag usada', () => {
    const tag = issue(service);
    service.revoke(tag, NOW);
    expect(tag.status).toBe('REVOKED');
    expect(service.revoke(tag, NOW).status).toBe('REVOKED');
    expect(service.check(SCHOOL, tag.code, STUDENT_A, NOW).allowed).toBe(false);
    const used = issue(service, { delegateDocument: 'RG 99', studentIds: [STUDENT_B] });
    service.use(used, STUDENT_B, NOW);
    expect(() => service.revoke(used, NOW)).toThrow('já encerrada');
  });

  it('expiração: refresh marca EXPIRED após expiresAt', () => {
    const tag = issue(service);
    const after = new Date(NOW.getTime() + 2 * 86_400_000);
    expect(service.check(SCHOOL, tag.code, STUDENT_A, after).allowed).toBe(false);
    expect(service.refreshAll(after)).toEqual([tag]);
    expect(tag.status).toBe('EXPIRED');
    expect(service.refreshAll(after)).toEqual([]);
  });

  it('brute-force: 5 códigos errados travam o código por 15 min e depois liberam', () => {
    const wrong = '000000';
    for (let i = 0; i < 5; i++) {
      expect(service.check(SCHOOL, wrong, STUDENT_A, NOW).reason).toMatch('não encontrado');
    }
    expect(service.check(SCHOOL, wrong, STUDENT_A, NOW).reason).toMatch('bloqueado');
    const later = new Date(NOW.getTime() + 16 * 60_000);
    expect(service.check(SCHOOL, wrong, STUDENT_A, later).reason).toMatch('não encontrado');
  });

  it('listActiveForStudent devolve só tags válidas p/ o aluno', () => {
    const active = issue(service);
    const used = issue(service, { delegateDocument: 'RG 77', studentIds: [STUDENT_A, STUDENT_B] });
    service.use(used, STUDENT_B, NOW);
    expect(service.listActiveForStudent(SCHOOL, STUDENT_A, NOW)).toEqual([active]);
    expect(service.listActiveForStudent(SCHOOL, STUDENT_B, NOW)).toEqual([]);
  });
});
