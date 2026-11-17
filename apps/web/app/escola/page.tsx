'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import RequireAuth from '../../components/RequireAuth';
import {
  createClassroom,
  createStudent,
  createTutor,
  deactivateClassroom,
  importStudents,
  linkTutor,
  listClassrooms,
  listPasswordResets,
  listStudentTutors,
  listStudents,
  listTutors,
  setStudentStatus,
  type Classroom,
  type ImportReport,
  type PendingReset,
  type Student,
  type StudentTutor,
  type Tutor,
} from '../../lib/api';

// Área da escola — o cadastro que faltava (varredura 17/11/2026): turmas,
// alunos, tutores e importação CSV. Sem estas telas, a escola não tinha
// como colocar um único aluno no sistema.

const RELATIONSHIPS: { value: string; label: string }[] = [
  { value: 'MOTHER', label: 'Mãe' },
  { value: 'FATHER', label: 'Pai' },
  { value: 'GRANDPARENT', label: 'Avó/Avô' },
  { value: 'SIBLING', label: 'Irmão/Irmã' },
  { value: 'GUARDIAN', label: 'Responsável legal' },
  { value: 'OTHER', label: 'Outro' },
];

type Tab = 'turmas' | 'alunos' | 'tutores' | 'importar';

// Entrega v1 dos links de redefinição de senha: só aparece p/ ADMIN
// (a API responde 403 p/ os demais — aí o cartão nem renderiza).
function PasswordResetsCard() {
  const [pending, setPending] = useState<PendingReset[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listPasswordResets()
      .then((list) => {
        if (alive) setPending(list);
      })
      .catch(() => {
        if (alive) setPending(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!pending || pending.length === 0) return null;

  async function copyLink(reset: PendingReset) {
    const url = `${window.location.origin}/redefinir-senha?token=${reset.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(reset.email);
    } catch {
      setCopied(null);
      window.prompt('Copie o link de redefinição:', url);
    }
  }

  return (
    <section className="card resets-card">
      <h2>Redefinições de senha pendentes</h2>
      <p className="muted">
        Quem pediu "esqueci minha senha" aparece aqui por 1 hora. Passe o link para a
        pessoa — é assim que a redefinição chega enquanto o TutorPass não manda e-mail.
      </p>
      <ul className="roster-list">
        {pending.map((r) => (
          <li className="roster-row" key={r.token}>
            <span>
              <strong>{r.name}</strong>
              <span className="muted">
                {' '}
                · {r.email} · expira às{' '}
                {new Date(r.expiresAt).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </span>
            <button className="btn secondary small" type="button" onClick={() => void copyLink(r)}>
              {copied === r.email ? 'Link copiado ✓' : 'Copiar link'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EscolaPanel() {
  const [tab, setTab] = useState<Tab>('turmas');
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reloadBase = useCallback(async () => {
    try {
      const [c, t] = await Promise.all([listClassrooms(), listTutors()]);
      setClassrooms(c);
      setTutors(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o cadastro.');
    }
  }, []);

  useEffect(() => {
    void reloadBase();
  }, [reloadBase]);

  function flash(message: string) {
    setNotice(message);
    setError(null);
  }

  return (
    <main className="container section">
      <h1 className="section-title">Área da escola</h1>
      <p className="muted">
        Cadastro de turmas, alunos e responsáveis — é daqui que a fila da portaria nasce.
      </p>

      {error ? (
        <p className="alert error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p className="alert ok">{notice}</p> : null}

      <PasswordResetsCard />

      <div className="admin-tabs" role="tablist" aria-label="Seções do cadastro">
        {(
          [
            ['turmas', 'Turmas'],
            ['alunos', 'Alunos'],
            ['tutores', 'Responsáveis'],
            ['importar', 'Importar CSV'],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={`admin-tab${tab === value ? ' is-active' : ''}`}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'turmas' ? (
        <TurmasTab classrooms={classrooms} onChanged={reloadBase} onError={setError} onNotice={flash} />
      ) : null}
      {tab === 'alunos' ? (
        <AlunosTab
          classrooms={classrooms}
          tutors={tutors}
          onError={setError}
          onNotice={flash}
        />
      ) : null}
      {tab === 'tutores' ? (
        <TutoresTab tutors={tutors} onChanged={reloadBase} onError={setError} onNotice={flash} />
      ) : null}
      {tab === 'importar' ? <ImportarTab onDone={reloadBase} onError={setError} /> : null}
    </main>
  );
}

function TurmasTab({
  classrooms,
  onChanged,
  onError,
  onNotice,
}: {
  classrooms: Classroom[];
  onChanged: () => Promise<void>;
  onError: (m: string | null) => void;
  onNotice: (m: string) => void;
}) {
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [year, setYear] = useState('2026');
  const [room, setRoom] = useState('');
  const [busy, setBusy] = useState(false);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError(null);
    try {
      await createClassroom({
        name: name.trim(),
        grade: grade.trim() || undefined,
        academicYear: Number(year),
        roomLocation: room.trim() || undefined,
      });
      setName('');
      setGrade('');
      setRoom('');
      await onChanged();
      onNotice('Turma criada.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Não foi possível criar a turma.');
    } finally {
      setBusy(false);
    }
  }

  async function onDeactivate(c: Classroom) {
    onError(null);
    try {
      await deactivateClassroom(c.id);
      await onChanged();
      onNotice(`Turma "${c.name}" desativada.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Não foi possível desativar a turma.');
    }
  }

  return (
    <section>
      <form className="card roster-form" onSubmit={onCreate}>
        <h2>Nova turma</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="t-name">Nome da turma</label>
            <input id="t-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="3º B" />
          </div>
          <div className="field">
            <label htmlFor="t-grade">Série/Ano</label>
            <input id="t-grade" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="3º ano" />
          </div>
          <div className="field">
            <label htmlFor="t-year">Ano letivo</label>
            <input id="t-year" type="number" min={2000} required value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="t-room">Sala/Local</label>
            <input id="t-room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Sala 4, bloco A" />
          </div>
        </div>
        <p>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Criando…' : 'Criar turma'}
          </button>
        </p>
      </form>

      <ul className="roster-list">
        {classrooms.length === 0 ? (
          <li className="muted">Nenhuma turma ainda — crie a primeira no formulário acima.</li>
        ) : (
          classrooms.map((c) => (
            <li className="roster-row" key={c.id}>
              <span>
                <strong>{c.name}</strong>
                {c.grade ? <span className="muted"> · {c.grade}</span> : null}
                <span className="muted"> · {c.academicYear}</span>
                {c.roomLocation ? <span className="muted"> · {c.roomLocation}</span> : null}
              </span>
              {c.isActive ? (
                <button className="btn secondary small" type="button" onClick={() => void onDeactivate(c)}>
                  Desativar
                </button>
              ) : (
                <span className="badge off">Desativada</span>
              )}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function AlunosTab({
  classrooms,
  tutors,
  onError,
  onNotice,
}: {
  classrooms: Classroom[];
  tutors: Tutor[];
  onError: (m: string | null) => void;
  onNotice: (m: string) => void;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [filterClassroom, setFilterClassroom] = useState('');
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [enrollment, setEnrollment] = useState('');
  const [birth, setBirth] = useState('');
  const [busy, setBusy] = useState(false);
  const [openStudent, setOpenStudent] = useState<string | null>(null);
  const [studentTutors, setStudentTutors] = useState<StudentTutor[]>([]);
  const [linkTutorId, setLinkTutorId] = useState('');
  const [linkRel, setLinkRel] = useState('MOTHER');
  const [linkPrimary, setLinkPrimary] = useState(true);

  const reload = useCallback(async () => {
    try {
      setStudents(await listStudents(filterClassroom || undefined, search || undefined));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Não foi possível carregar os alunos.');
    }
  }, [filterClassroom, search, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const classroomName = (id: string) =>
    classrooms.find((c) => c.id === id)?.name ?? 'Turma removida';

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!classroomId) {
      onError('Escolha a turma do aluno (crie uma turma primeiro, se ainda não há).');
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await createStudent({
        name: name.trim(),
        classroomId,
        enrollmentCode: enrollment.trim() || undefined,
        birthDate: birth || undefined,
      });
      setName('');
      setEnrollment('');
      setBirth('');
      await reload();
      onNotice('Aluno cadastrado.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Não foi possível cadastrar o aluno.');
    } finally {
      setBusy(false);
    }
  }

  async function onToggleStatus(s: Student) {
    onError(null);
    try {
      await setStudentStatus(s.id, s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
      await reload();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Não foi possível mudar o status.');
    }
  }

  async function onOpenTutors(s: Student) {
    if (openStudent === s.id) {
      setOpenStudent(null);
      return;
    }
    setOpenStudent(s.id);
    setStudentTutors([]);
    try {
      setStudentTutors(await listStudentTutors(s.id));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Não foi possível carregar os responsáveis.');
    }
  }

  async function onLink(s: Student) {
    if (!linkTutorId) {
      onError('Escolha o responsável para vincular (cadastre em Responsáveis, se faltar).');
      return;
    }
    onError(null);
    try {
      await linkTutor(linkTutorId, {
        studentId: s.id,
        relationship: linkRel,
        isPrimary: linkPrimary,
        canPickup: true,
      });
      setStudentTutors(await listStudentTutors(s.id));
      onNotice('Responsável vinculado.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Não foi possível vincular.');
    }
  }

  return (
    <section>
      <form className="card roster-form" onSubmit={onCreate}>
        <h2>Novo aluno</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="a-name">Nome do aluno</label>
            <input id="a-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
          </div>
          <div className="field">
            <label htmlFor="a-class">Turma</label>
            <select id="a-class" required value={classroomId} onChange={(e) => setClassroomId(e.target.value)}>
              <option value="">Escolha…</option>
              {classrooms
                .filter((c) => c.isActive)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.academicYear})
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="a-enroll">Matrícula (opcional)</label>
            <input id="a-enroll" value={enrollment} onChange={(e) => setEnrollment(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="a-birth">Nascimento (opcional)</label>
            <input id="a-birth" type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
          </div>
        </div>
        <p>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Cadastrando…' : 'Cadastrar aluno'}
          </button>
        </p>
      </form>

      <div className="form-grid roster-filters">
        <div className="field">
          <label htmlFor="f-class">Filtrar por turma</label>
          <select id="f-class" value={filterClassroom} onChange={(e) => setFilterClassroom(e.target.value)}>
            <option value="">Todas</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-search">Buscar por nome</label>
          <input id="f-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Digite parte do nome" />
        </div>
      </div>

      <ul className="roster-list">
        {students.length === 0 ? (
          <li className="muted">Nenhum aluno neste filtro.</li>
        ) : (
          students.map((s) => (
            <li className="roster-item" key={s.id}>
              <div className="roster-row">
                <span>
                  <strong>{s.name}</strong>
                  <span className="muted"> · {classroomName(s.classroomId)}</span>
                  {s.enrollmentCode ? <span className="muted"> · matr. {s.enrollmentCode}</span> : null}
                  {s.pickupBlocked ? <span className="badge danger">Retirada bloqueada</span> : null}
                  {s.status !== 'ACTIVE' ? <span className="badge off">Inativo</span> : null}
                </span>
                <span className="row-actions">
                  <button className="btn secondary small" type="button" onClick={() => void onOpenTutors(s)}>
                    Responsáveis
                  </button>
                  <button className="btn secondary small" type="button" onClick={() => void onToggleStatus(s)}>
                    {s.status === 'ACTIVE' ? 'Desativar' : 'Reativar'}
                  </button>
                </span>
              </div>
              {openStudent === s.id ? (
                <div className="student-tutors">
                  {studentTutors.length === 0 ? (
                    <p className="muted">Nenhum responsável vinculado ainda — sem responsável, ninguém retira este aluno.</p>
                  ) : (
                    <ul>
                      {studentTutors.map((st) => (
                        <li key={st.tutorId}>
                          {st.tutor.name} — {RELATIONSHIPS.find((r) => r.value === st.relationship)?.label ?? st.relationship}
                          {st.isPrimary ? ' · principal' : ''}
                          {st.canPickup ? ' · pode retirar' : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor={`link-tutor-${s.id}`}>Vincular responsável</label>
                      <select id={`link-tutor-${s.id}`} value={linkTutorId} onChange={(e) => setLinkTutorId(e.target.value)}>
                        <option value="">Escolha…</option>
                        {tutors.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.phone})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`link-rel-${s.id}`}>Parentesco</label>
                      <select id={`link-rel-${s.id}`} value={linkRel} onChange={(e) => setLinkRel(e.target.value)}>
                        {RELATIONSHIPS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>
                        <input type="checkbox" checked={linkPrimary} onChange={(e) => setLinkPrimary(e.target.checked)} />{' '}
                        Responsável principal
                      </label>
                    </div>
                  </div>
                  <p>
                    <button className="btn small" type="button" onClick={() => void onLink(s)}>
                      Vincular
                    </button>
                  </p>
                </div>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function TutoresTab({
  tutors,
  onChanged,
  onError,
  onNotice,
}: {
  tutors: Tutor[];
  onChanged: () => Promise<void>;
  onError: (m: string | null) => void;
  onNotice: (m: string) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [document_, setDocument] = useState('');
  const [busy, setBusy] = useState(false);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError(null);
    try {
      await createTutor({
        name: name.trim(),
        phone: phone.trim(),
        document: document_.trim() || undefined,
      });
      setName('');
      setPhone('');
      setDocument('');
      await onChanged();
      onNotice('Responsável cadastrado. Vincule-o aos alunos na aba Alunos.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Não foi possível cadastrar o responsável.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <form className="card roster-form" onSubmit={onCreate}>
        <h2>Novo responsável</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="r-name">Nome</label>
            <input id="r-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
          </div>
          <div className="field">
            <label htmlFor="r-phone">Celular (com DDD)</label>
            <input id="r-phone" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="11987654321" inputMode="tel" />
          </div>
          <div className="field">
            <label htmlFor="r-doc">Documento (opcional)</label>
            <input id="r-doc" value={document_} onChange={(e) => setDocument(e.target.value)} placeholder="CPF ou RG" />
          </div>
        </div>
        <p>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Cadastrando…' : 'Cadastrar responsável'}
          </button>
        </p>
      </form>

      <ul className="roster-list">
        {tutors.length === 0 ? (
          <li className="muted">Nenhum responsável ainda.</li>
        ) : (
          tutors.map((t) => (
            <li className="roster-row" key={t.id}>
              <span>
                <strong>{t.name}</strong>
                <span className="muted"> · {t.phone}</span>
                {t.isBlocked ? <span className="badge danger">Bloqueado</span> : null}
              </span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function ImportarTab({
  onDone,
  onError,
}: {
  onDone: () => Promise<void>;
  onError: (m: string | null) => void;
}) {
  const [csv, setCsv] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  async function onFile(file: File | null) {
    if (!file) return;
    setCsv(await file.text());
  }

  async function onImport(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError(null);
    setReport(null);
    try {
      const result = await importStudents(csv, dryRun);
      setReport(result);
      if (!dryRun) await onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'A importação falhou.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <form className="card roster-form" onSubmit={onImport}>
        <h2>Importar alunos por CSV</h2>
        <p className="muted">
          Colunas obrigatórias: <strong>nome</strong> e <strong>turma</strong>. Opcionais:
          matrícula, nascimento e as colunas de responsável (nome e telefone) — a importação
          cria as turmas e os responsáveis que ainda não existirem. Comece com "só validar"
          para conferir a prévia sem gravar nada.
        </p>
        <div className="field">
          <label htmlFor="csv-file">Arquivo CSV</label>
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="field">
          <label htmlFor="csv-text">Ou cole o conteúdo do CSV</label>
          <textarea
            id="csv-text"
            rows={8}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={'nome,turma,matricula\nAlice Martins,3º B,2026001'}
          />
        </div>
        <p>
          <label>
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />{' '}
            Só validar (não grava nada)
          </label>
        </p>
        <p>
          <button className="btn" type="submit" disabled={busy || !csv.trim()}>
            {busy ? 'Importando…' : dryRun ? 'Validar CSV' : 'Importar de verdade'}
          </button>
        </p>
      </form>

      {report ? (
        <div className="card">
          <h2>{report.dryRun ? 'Prévia da importação' : 'Importação concluída'}</h2>
          <ul>
            <li>{report.totalRows} linha(s) no arquivo</li>
            <li>{report.created} aluno(s) criado(s), {report.updated} atualizado(s)</li>
            <li>{report.skippedDuplicates} duplicata(s) pulada(s)</li>
            <li>
              {report.tutorsCreated} responsável(is) criado(s), {report.tutorsLinked} vínculo(s)
            </li>
            {report.classroomsCreated.length ? (
              <li>Turmas criadas: {report.classroomsCreated.join(', ')}</li>
            ) : null}
          </ul>
          {report.errors.length ? (
            <>
              <h3>Erros por linha</h3>
              <ul>
                {report.errors.map((err, i) => (
                  <li key={i}>
                    Linha {err.row}: {err.message}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default function EscolaPage() {
  return (
    <RequireAuth area="área da escola">
      <EscolaPanel />
    </RequireAuth>
  );
}
