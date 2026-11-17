import { ConflictException, NotFoundException } from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/auth.service';
import { AuthService } from '../auth/auth.service';
import { SchoolMembersController } from './school-members.controller';

const SECRET = 'segredo-de-teste-com-mais-de-32-caracteres-123456';
const SCHOOL = 'school-1';

describe('SchoolMembersController (equipe da escola)', () => {
  let auth: AuthService;
  let controller: SchoolMembersController;
  let adminPayload: AccessTokenPayload;

  beforeEach(() => {
    auth = new AuthService(SECRET);
    controller = new SchoolMembersController(auth);
    const owner = auth.register('dono@escola.test', 'Dono da Escola', 'SenhaForte1!');
    auth.addMembership(owner.id, SCHOOL, 'ADMIN');
    const session = auth.login('dono@escola.test', 'SenhaForte1!', SCHOOL);
    adminPayload = auth.verifyAccessToken(session.accessToken);
  });

  it('admin vincula conta existente a um papel e o login dela carrega o papel', () => {
    auth.register('paula@escola.test', 'Paula Portaria', 'SenhaForte1!');
    const added = controller.add(adminPayload, {
      email: 'paula@escola.test',
      role: 'GATE_AGENT',
    });
    expect(added.role).toBe('GATE_AGENT');
    expect(added.schoolId).toBe(SCHOOL);

    const session = auth.login('paula@escola.test', 'SenhaForte1!');
    expect(session.schoolId).toBe(SCHOOL);
    expect(session.roles).toEqual(['GATE_AGENT']);
  });

  it('e-mail sem conta → 404 com a orientação de criar a conta antes', () => {
    expect(() =>
      controller.add(adminPayload, { email: 'ninguem@escola.test', role: 'TEACHER' }),
    ).toThrow(NotFoundException);
  });

  it('mesmo papel duas vezes → 409; papel diferente é permitido', () => {
    auth.register('tiago@escola.test', 'Tiago Professor', 'SenhaForte1!');
    controller.add(adminPayload, { email: 'tiago@escola.test', role: 'TEACHER' });
    expect(() =>
      controller.add(adminPayload, { email: 'tiago@escola.test', role: 'TEACHER' }),
    ).toThrow(ConflictException);
    const second = controller.add(adminPayload, {
      email: 'tiago@escola.test',
      role: 'COORDINATOR',
    });
    expect(second.role).toBe('COORDINATOR');
  });

  it('lista mostra só a equipe da escola da sessão, com nome e e-mail', () => {
    auth.register('rita@escola.test', 'Rita Responsável', 'SenhaForte1!');
    controller.add(adminPayload, { email: 'rita@escola.test', role: 'TUTOR' });
    // Outra escola não pode vazar na lista.
    const other = auth.register('outro@escola.test', 'Outro', 'SenhaForte1!');
    auth.addMembership(other.id, 'school-2', 'ADMIN');

    const list = controller.list(adminPayload);
    expect(list.map((m) => m.email).sort()).toEqual([
      'dono@escola.test',
      'rita@escola.test',
    ]);
    expect(list.find((m) => m.email === 'rita@escola.test')?.role).toBe('TUTOR');
  });
});
