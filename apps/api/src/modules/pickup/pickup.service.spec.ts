import { PickupService } from './pickup.service';
import { QrTokenService } from '../qr/qr-token.service';

describe('PickupService.chainHash', () => {
  it('é determinístico para o mesmo hash anterior e payload', () => {
    const a = PickupService.chainHash('abc123', { event: 'QUEUED', studentId: 's1' });
    const b = PickupService.chainHash('abc123', { event: 'QUEUED', studentId: 's1' });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('muda quando o payload muda', () => {
    const a = PickupService.chainHash('abc123', { event: 'QUEUED' });
    const b = PickupService.chainHash('abc123', { event: 'CALLED' });
    expect(a).not.toBe(b);
  });

  it('muda quando o hash anterior muda (encadeamento)', () => {
    const a = PickupService.chainHash('prev-1', { event: 'QUEUED' });
    const b = PickupService.chainHash('prev-2', { event: 'QUEUED' });
    expect(a).not.toBe(b);
  });

  it('aceita null como hash anterior (gênese)', () => {
    const h = PickupService.chainHash(null, { event: 'QUEUED' });
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toBe(PickupService.chainHash(null, { event: 'CALLED' }));
  });
});

describe('PickupService — fluxo da fila', () => {
  const SCHOOL = 'school-1';
  const STUDENT = 'student-1';
  const TUTOR = 'tutor-1';
  const STAFF = 'staff-1';
  const T0 = new Date('2026-11-17T15:00:00Z');

  function service() {
    return new PickupService(new QrTokenService());
  }

  it('join cria entrada QUEUED e registra QUEUE_JOINED no log', () => {
    const svc = service();
    const entry = svc.join({ schoolId: SCHOOL, studentId: STUDENT, tutorId: TUTOR }, T0);
    expect(entry.status).toBe('QUEUED');
    expect(entry.source).toBe('MANUAL');
    expect(entry.joinedAt).toEqual(T0);
    const logs = svc.listLogs(SCHOOL);
    expect(logs).toHaveLength(1);
    expect(logs[0].eventType).toBe('QUEUE_JOINED');
    expect(logs[0].prevHash).toBeNull();
    expect(svc.verifyChain(SCHOOL).valid).toBe(true);
  });

  it('não permite duas entradas ativas do mesmo aluno', () => {
    const svc = service();
    svc.join({ schoolId: SCHOOL, studentId: STUDENT, tutorId: TUTOR }, T0);
    expect(() =>
      svc.join({ schoolId: SCHOOL, studentId: STUDENT, tutorId: TUTOR }, T0),
    ).toThrow('já está na fila');
    // Outro aluno entra normalmente.
    const other = svc.join({ schoolId: SCHOOL, studentId: 'student-2', tutorId: TUTOR }, T0);
    expect(other.status).toBe('QUEUED');
  });

  it('permite nova entrada depois que a anterior foi liberada', async () => {
    const qr = new QrTokenService();
    const svc = new PickupService(qr);
    const entry = svc.join({ schoolId: SCHOOL, studentId: STUDENT, tutorId: TUTOR }, T0);
    const { token } = qr.issue(SCHOOL, TUTOR);
    await svc.validateQr(entry.id, token, STAFF, T0);
    svc.release(entry.id, STAFF, T0);
    expect(entry.status).toBe('RELEASED');
    const again = svc.join({ schoolId: SCHOOL, studentId: STUDENT, tutorId: TUTOR }, T0);
    expect(again.status).toBe('QUEUED');
    expect(again.id).not.toBe(entry.id);
  });

  it('fluxo completo: join -> call -> validateQr -> release, com waitSeconds', async () => {
    const qr = new QrTokenService();
    const svc = new PickupService(qr);
    const entry = svc.join(
      { schoolId: SCHOOL, studentId: STUDENT, tutorId: TUTOR, source: 'GEOFENCE' },
      T0,
    );
    const called = svc.call(entry.id, STAFF, new Date('2026-11-17T15:01:00Z'));
    expect(called.status).toBe('CALLED');
    expect(called.calledAt).toEqual(new Date('2026-11-17T15:01:00Z'));

    const { token } = qr.issue(SCHOOL, TUTOR);
    const validated = await svc.validateQr(
      entry.id,
      token,
      STAFF,
      new Date('2026-11-17T15:02:00Z'),
    );
    expect(validated.status).toBe('VALIDATED');

    const released = svc.release(entry.id, STAFF, new Date('2026-11-17T15:05:00Z'));
    expect(released.status).toBe('RELEASED');
    expect(released.waitSeconds).toBe(300);

    const logs = svc.listLogs(SCHOOL);
    expect(logs.map((l) => l.eventType)).toEqual([
      'QUEUE_JOINED',
      'QUEUE_CALLED',
      'QR_SCANNED',
      'RELEASED',
    ]);
    expect(svc.verifyChain(SCHOOL)).toEqual({ valid: true, firstBadIndex: -1 });
    // A cadeia quebra se um evento for adulterado.
    logs[1].payload = { adulterado: true };
    expect(svc.verifyChain(SCHOOL).valid).toBe(false);
    expect(svc.verifyChain(SCHOOL).firstBadIndex).toBe(1);
  });

  it('release sem validate é recusado', () => {
    const svc = service();
    const entry = svc.join({ schoolId: SCHOOL, studentId: STUDENT, tutorId: TUTOR }, T0);
    expect(() => svc.release(entry.id, STAFF, T0)).toThrow('validado');
  });

  it('call de entrada já liberada é recusado', async () => {
    const qr = new QrTokenService();
    const svc = new PickupService(qr);
    const entry = svc.join({ schoolId: SCHOOL, studentId: STUDENT, tutorId: TUTOR }, T0);
    const { token } = qr.issue(SCHOOL, TUTOR);
    await svc.validateQr(entry.id, token, STAFF, T0);
    svc.release(entry.id, STAFF, T0);
    expect(() => svc.call(entry.id, STAFF, T0)).toThrow('na fila');
  });

  it('QR de outro tutor é rejeitado e fica no log (QR_REJECTED)', async () => {
    const qr = new QrTokenService();
    const svc = new PickupService(qr);
    const entry = svc.join({ schoolId: SCHOOL, studentId: STUDENT, tutorId: TUTOR }, T0);
    const { token } = qr.issue(SCHOOL, 'outro-tutor');
    await expect(svc.validateQr(entry.id, token, STAFF, T0)).rejects.toThrow(
      'outra escola ou de outro tutor',
    );
    expect(entry.status).toBe('QUEUED');
    const logs = svc.listLogs(SCHOOL);
    expect(logs.map((l) => l.eventType)).toEqual(['QUEUE_JOINED', 'QR_REJECTED']);
    expect(svc.verifyChain(SCHOOL).valid).toBe(true);
  });

  it('QR reutilizado é rejeitado (nonce de uso único)', async () => {
    const qr = new QrTokenService();
    const svc = new PickupService(qr);
    const entry = svc.join({ schoolId: SCHOOL, studentId: STUDENT, tutorId: TUTOR }, T0);
    const { token } = qr.issue(SCHOOL, TUTOR);
    await svc.validateQr(entry.id, token, STAFF, T0);
    const entry2 = svc.join({ schoolId: SCHOOL, studentId: 'student-2', tutorId: TUTOR }, T0);
    await expect(svc.validateQr(entry2.id, token, STAFF, T0)).rejects.toThrow('já utilizado');
    expect(svc.listLogs(SCHOOL).filter((l) => l.eventType === 'QR_REJECTED')).toHaveLength(1);
  });

  it('QR inválido não consome a entrada e registra a tentativa', async () => {
    const qr = new QrTokenService();
    const svc = new PickupService(qr);
    const entry = svc.join({ schoolId: SCHOOL, studentId: STUDENT, tutorId: TUTOR }, T0);
    await expect(svc.validateQr(entry.id, 'lixo.sem-assinatura', STAFF, T0)).rejects.toThrow();
    expect(entry.status).toBe('QUEUED');
    expect(svc.listLogs(SCHOOL).map((l) => l.eventType)).toEqual([
      'QUEUE_JOINED',
      'QR_REJECTED',
    ]);
  });

  it('validateQr sem serviço de QR configurado recusa com erro claro', async () => {
    const svc = new PickupService();
    const entry = svc.join({ schoolId: SCHOOL, studentId: STUDENT, tutorId: TUTOR }, T0);
    await expect(svc.validateQr(entry.id, 'x.y', STAFF, T0)).rejects.toThrow(
      'serviço de QR não configurado',
    );
  });

  it('cancel só vale na fila ou chamado e registra CANCELLED', () => {
    const svc = service();
    const entry = svc.join({ schoolId: SCHOOL, studentId: STUDENT, tutorId: TUTOR }, T0);
    const cancelled = svc.cancel(entry.id, STAFF, T0);
    expect(cancelled.status).toBe('CANCELLED');
    expect(() => svc.cancel(entry.id, STAFF, T0)).toThrow('na fila ou chamado');
    expect(svc.listLogs(SCHOOL).map((l) => l.eventType)).toEqual([
      'QUEUE_JOINED',
      'CANCELLED',
    ]);
  });

  it('bloqueio vence fila: impede join e tira entrada ativa da fila', () => {
    const svc = service();
    const entry = svc.join({ schoolId: SCHOOL, studentId: STUDENT, tutorId: TUTOR }, T0);
    svc.block(SCHOOL, STUDENT, 'Pendência na secretaria', STAFF, T0);
    expect(entry.status).toBe('BLOCKED');
    expect(svc.isBlocked(SCHOOL, STUDENT)).toBe('Pendência na secretaria');
    expect(() =>
      svc.join({ schoolId: SCHOOL, studentId: STUDENT, tutorId: TUTOR }, T0),
    ).toThrow('Retirada bloqueada');
    svc.unblock(SCHOOL, STUDENT);
    expect(svc.isBlocked(SCHOOL, STUDENT)).toBeNull();
    const again = svc.join({ schoolId: SCHOOL, studentId: STUDENT, tutorId: TUTOR }, T0);
    expect(again.status).toBe('QUEUED');
    expect(svc.listLogs(SCHOOL).map((l) => l.eventType)).toEqual([
      'QUEUE_JOINED',
      'BLOCKED',
      'QUEUE_JOINED',
    ]);
  });

  it('block sem motivo é recusado', () => {
    const svc = service();
    expect(() => svc.block(SCHOOL, STUDENT, '   ', STAFF, T0)).toThrow('motivo');
  });

  it('expireStale expira só entradas de dias anteriores', () => {
    const svc = service();
    const old = svc.join(
      { schoolId: SCHOOL, studentId: STUDENT, tutorId: TUTOR },
      new Date('2026-11-16T15:00:00Z'),
    );
    const today = svc.join(
      { schoolId: SCHOOL, studentId: 'student-2', tutorId: TUTOR },
      new Date('2026-11-17T15:00:00Z'),
    );
    const n = svc.expireStale(new Date('2026-11-17T23:00:00Z'));
    expect(n).toBe(1);
    expect(old.status).toBe('EXPIRED');
    expect(today.status).toBe('QUEUED');
    expect(svc.listLogs(SCHOOL).filter((l) => l.eventType === 'EXPIRED')).toHaveLength(1);
  });

  it('listActiveForSchool devolve a fila em FIFO', () => {
    const svc = service();
    const b = svc.join(
      { schoolId: SCHOOL, studentId: 'student-2', tutorId: TUTOR },
      new Date('2026-11-17T15:02:00Z'),
    );
    const a = svc.join(
      { schoolId: SCHOOL, studentId: STUDENT, tutorId: TUTOR },
      new Date('2026-11-17T15:01:00Z'),
    );
    svc.cancel(a.id, STAFF, T0);
    const active = svc.listActiveForSchool(SCHOOL);
    expect(active.map((e) => e.id)).toEqual([b.id]);
  });

  it('entrada inexistente dá erro claro', () => {
    const svc = service();
    expect(() => svc.call('inexistente', STAFF, T0)).toThrow('não encontrada');
  });
});

describe('PickupService — múltiplos portões', () => {
  const SCHOOL = 'school-1';
  const TUTOR = 'tutor-1';
  const STAFF = 'staff-1';
  const T0 = new Date('2026-11-17T15:00:00Z');

  function service() {
    return new PickupService(new QrTokenService());
  }

  it('join com gate guarda o portão e registra no log; sem gate é null', () => {
    const svc = service();
    const entry = svc.join(
      { schoolId: SCHOOL, studentId: 'student-1', tutorId: TUTOR, gate: 'Portão A' },
      T0,
    );
    expect(entry.gate).toBe('Portão A');
    expect(svc.listLogs(SCHOOL)[0].payload).toMatchObject({ gate: 'Portão A' });
    const plain = svc.join(
      { schoolId: SCHOOL, studentId: 'student-2', tutorId: TUTOR },
      T0,
    );
    expect(plain.gate).toBeNull();
  });

  it('gate com espaços vira o nome aparado; gate em branco vira null', () => {
    const svc = service();
    const entry = svc.join(
      { schoolId: SCHOOL, studentId: 'student-1', tutorId: TUTOR, gate: '  Fundos  ' },
      T0,
    );
    expect(entry.gate).toBe('Fundos');
    const blank = svc.join(
      { schoolId: SCHOOL, studentId: 'student-2', tutorId: TUTOR, gate: '   ' },
      T0,
    );
    expect(blank.gate).toBeNull();
  });

  it('gate com mais de 40 caracteres é recusado', () => {
    const svc = service();
    expect(() =>
      svc.join(
        { schoolId: SCHOOL, studentId: 'student-1', tutorId: TUTOR, gate: 'P'.repeat(41) },
        T0,
      ),
    ).toThrow('40 caracteres');
  });

  it('listActiveForSchool filtra por portão; sem filtro traz a fila inteira', () => {
    const svc = service();
    svc.join({ schoolId: SCHOOL, studentId: 'a', tutorId: TUTOR, gate: 'Portão A' }, T0);
    svc.join({ schoolId: SCHOOL, studentId: 'b', tutorId: TUTOR, gate: 'Fundos' }, T0);
    svc.join({ schoolId: SCHOOL, studentId: 'c', tutorId: TUTOR }, T0);
    expect(svc.listActiveForSchool(SCHOOL)).toHaveLength(3);
    const gateA = svc.listActiveForSchool(SCHOOL, 'Portão A');
    expect(gateA).toHaveLength(1);
    expect(gateA[0].studentId).toBe('a');
    expect(svc.listActiveForSchool(SCHOOL, 'Portão C')).toHaveLength(0);
  });

  it('listGates conta entradas ativas por portão, do maior p/ o menor', () => {
    const svc = service();
    svc.join({ schoolId: SCHOOL, studentId: 'a', tutorId: TUTOR, gate: 'Fundos' }, T0);
    svc.join({ schoolId: SCHOOL, studentId: 'b', tutorId: TUTOR, gate: 'Portão A' }, T0);
    svc.join({ schoolId: SCHOOL, studentId: 'c', tutorId: TUTOR, gate: 'Fundos' }, T0);
    svc.join({ schoolId: SCHOOL, studentId: 'd', tutorId: TUTOR }, T0);
    const cancelled = svc.join(
      { schoolId: SCHOOL, studentId: 'e', tutorId: TUTOR, gate: 'Portão A' },
      T0,
    );
    svc.cancel(cancelled.id, STAFF, T0);
    expect(svc.listGates(SCHOOL)).toEqual([
      { gate: 'Fundos', count: 2 },
      { gate: 'Portão A', count: 1 },
    ]);
  });
});

describe('PickupService — irmãos em portões diferentes', () => {
  const SCHOOL = 'school-1';
  const TUTOR = 'tutor-1';
  const STAFF = 'staff-1';
  const T0 = new Date('2026-11-17T15:00:00Z');

  function service() {
    return new PickupService(new QrTokenService());
  }

  it('tutor com 2 filhos em portões diferentes é conflito, com os portões e alunos', () => {
    const svc = service();
    svc.join({ schoolId: SCHOOL, studentId: 'a', tutorId: TUTOR, gate: 'Portão A' }, T0);
    svc.join({ schoolId: SCHOOL, studentId: 'b', tutorId: TUTOR, gate: 'Fundos' }, T0);
    expect(svc.listSiblingGateConflicts(SCHOOL)).toEqual([
      {
        tutorId: TUTOR,
        studentIds: ['a', 'b'],
        gates: [
          { gate: 'Fundos', studentIds: ['b'] },
          { gate: 'Portão A', studentIds: ['a'] },
        ],
      },
    ]);
  });

  it('mesmo portão não é conflito; tutores diferentes no mesmo par de portões não é conflito', () => {
    const svc = service();
    svc.join({ schoolId: SCHOOL, studentId: 'a', tutorId: TUTOR, gate: 'Portão A' }, T0);
    svc.join({ schoolId: SCHOOL, studentId: 'b', tutorId: TUTOR, gate: 'Portão A' }, T0);
    svc.join({ schoolId: SCHOOL, studentId: 'c', tutorId: 'tutor-2', gate: 'Fundos' }, T0);
    expect(svc.listSiblingGateConflicts(SCHOOL)).toEqual([]);
  });

  it('um filho na fila única e outro num portão nomeado também é divisão', () => {
    const svc = service();
    svc.join({ schoolId: SCHOOL, studentId: 'a', tutorId: TUTOR }, T0);
    svc.join({ schoolId: SCHOOL, studentId: 'b', tutorId: TUTOR, gate: 'Portão A' }, T0);
    const conflicts = svc.listSiblingGateConflicts(SCHOOL);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].gates).toEqual([
      { gate: null, studentIds: ['a'] },
      { gate: 'Portão A', studentIds: ['b'] },
    ]);
  });

  it('entrada cancelada não conta; conflito some quando só resta 1 portão ativo', () => {
    const svc = service();
    svc.join({ schoolId: SCHOOL, studentId: 'a', tutorId: TUTOR, gate: 'Portão A' }, T0);
    const b = svc.join({ schoolId: SCHOOL, studentId: 'b', tutorId: TUTOR, gate: 'Fundos' }, T0);
    expect(svc.listSiblingGateConflicts(SCHOOL)).toHaveLength(1);
    svc.cancel(b.id, STAFF, T0);
    expect(svc.listSiblingGateConflicts(SCHOOL)).toEqual([]);
  });

  it('outra escola não contamina; conflitos ordenados por tutorId', () => {
    const svc = service();
    svc.join({ schoolId: SCHOOL, studentId: 'a', tutorId: 'tutor-2', gate: 'Portão A' }, T0);
    svc.join({ schoolId: SCHOOL, studentId: 'b', tutorId: 'tutor-2', gate: 'Fundos' }, T0);
    svc.join({ schoolId: SCHOOL, studentId: 'c', tutorId: 'tutor-1', gate: 'Portão A' }, T0);
    svc.join({ schoolId: SCHOOL, studentId: 'd', tutorId: 'tutor-1', gate: 'Fundos' }, T0);
    svc.join({ schoolId: 'school-2', studentId: 'e', tutorId: 'tutor-1', gate: 'Portão A' }, T0);
    const conflicts = svc.listSiblingGateConflicts(SCHOOL);
    expect(conflicts.map((c) => c.tutorId)).toEqual(['tutor-1', 'tutor-2']);
  });
});
