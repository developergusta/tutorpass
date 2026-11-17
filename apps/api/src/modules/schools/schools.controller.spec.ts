import { BadRequestException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { RosterService } from '../roster/roster.service';
import { SchoolsController } from './schools.controller';

const SECRET = 'segredo-de-teste-com-mais-de-32-caracteres-123456';

describe('SchoolsController (POST /schools)', () => {
  let auth: AuthService;
  let roster: RosterService;
  let controller: SchoolsController;

  beforeEach(() => {
    auth = new AuthService(SECRET);
    roster = new RosterService();
    controller = new SchoolsController(roster, auth);
  });

  it('cria a escola, vincula o criador como ADMIN e o login com schoolId devolve o papel', () => {
    auth.register('dono@escola.test', 'Dono da Escola', 'SenhaForte1!');
    // Sessão "sem escola" — é com o token dela que o cadastro cria a escola.
    const session = auth.login('dono@escola.test', 'SenhaForte1!');
    expect(session.schoolId).toBeNull();
    const payload = auth.verifyAccessToken(session.accessToken);

    const school = controller.create(payload, { name: 'Colégio Girassol' });

    expect(school.name).toBe('Colégio Girassol');
    expect(school.slug).toBe('colegio-girassol');
    expect(roster.getSchool(school.id)?.name).toBe('Colégio Girassol');

    const scoped = auth.login('dono@escola.test', 'SenhaForte1!', school.id);
    expect(scoped.schoolId).toBe(school.id);
    expect(scoped.roles).toContain('ADMIN');
  });

  it('nome curto demais → 400 do RosterService e nenhuma escola criada', () => {
    auth.register('dono@escola.test', 'Dono da Escola', 'SenhaForte1!');
    const session = auth.login('dono@escola.test', 'SenhaForte1!');
    const payload = auth.verifyAccessToken(session.accessToken);
    expect(() => controller.create(payload, { name: 'A' })).toThrow(BadRequestException);
    expect(roster.listSchools()).toHaveLength(0);
  });
});
