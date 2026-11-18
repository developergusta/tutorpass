// Cliente mínimo da API do TutorPass (web).
//
// NEXT_PUBLIC_API_URL é a ORIGEM da API (ex.: http://localhost:3333 em dev,
// https://tutorpass-api.up.railway.app em produção). A API do NestJS usa o
// prefixo global `api` (apps/api/src/main.ts), então as rotas reais são
// /api/auth/login, /api/auth/2fa/verify e /api/health.

const rawBase =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export const API_URL = rawBase.replace(/\/+$/, '').replace(/\/api$/, '');

export const apiUrl = (path: string) => `${API_URL}/api${path}`;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

export interface LoginSuccess {
  accessToken: string;
  user: SessionUser;
  schoolId: string | null;
  roles: string[];
  twoFactorSetupRequired?: boolean;
}

export interface LoginNeeds2fa {
  requires2fa: true;
  twoFactorToken: string;
  user: SessionUser;
  schoolId: string | null;
  roles: string[];
}

export type LoginResult = LoginSuccess | LoginNeeds2fa;

export function isNeeds2fa(result: LoginResult): result is LoginNeeds2fa {
  return (result as LoginNeeds2fa).requires2fa === true;
}

const SESSION_KEY = 'tutorpass.session';

// O access token é de curta duração (15 min) e fica em sessionStorage
// (some ao fechar a aba). O refresh token NUNCA passa pelo web: ele vai
// em cookie httpOnly setado pela API (ver auth.controller.ts).
// A topbar (AuthNav) escuta este evento p/ refletir login/logout na hora,
// sem recarregar a página (sessionStorage não dispara 'storage' na própria aba).
function notifySessionChanged() {
  try {
    window.dispatchEvent(new Event('tutorpass:session'));
  } catch {
    // fora do navegador — ignorar
  }
}

export function saveSession(session: LoginSuccess) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // sessionStorage indisponível (modo privado etc.) — login segue em memória.
  }
  notifySessionChanged();
}

export function loadSession(): LoginSuccess | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as LoginSuccess) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignorar
  }
  notifySessionChanged();
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      'Não foi possível falar com o servidor do TutorPass. Verifique se a API está no ar e tente de novo.',
    );
  }
  const data = (await res.json().catch(() => null)) as
    | (T & { message?: string | string[] })
    | null;
  if (!res.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(' ')
      : data?.message;
    throw new Error(message ?? `Erro no servidor (HTTP ${res.status}). Tente de novo.`);
  }
  if (!data) throw new Error('Resposta vazia do servidor. Tente de novo.');
  return data;
}

export function login(
  email: string,
  password: string,
  schoolId?: string,
): Promise<LoginResult> {
  return postJson<LoginResult>('/auth/login', {
    email,
    password,
    ...(schoolId ? { schoolId } : {}),
  });
}

export interface RegisteredUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

/** Cadastro da conta (passo 1 do /cadastro): cria só o usuário, sem escola. */
export function register(
  name: string,
  email: string,
  password: string,
): Promise<RegisteredUser> {
  return postJson<RegisteredUser>('/auth/register', { name, email, password });
}

export interface CreatedSchool {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  createdAt: string;
}

/**
 * Criação da escola (passo 2 do /cadastro): POST /api/schools com o access
 * token da sessão "sem escola"; o servidor vincula o criador como ADMIN.
 * Depois, o cliente faz login de novo COM o schoolId p/ a sessão da escola.
 */
export async function createSchool(
  accessToken: string,
  name: string,
): Promise<CreatedSchool> {
  let res: Response;
  try {
    res = await fetch(apiUrl('/schools'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
      body: JSON.stringify({ name }),
    });
  } catch {
    throw new Error(
      'Não foi possível falar com o servidor do TutorPass. Verifique se a API está no ar e tente de novo.',
    );
  }
  const data = (await res.json().catch(() => null)) as
    | (CreatedSchool & { message?: string | string[] })
    | null;
  if (!res.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(' ')
      : data?.message;
    throw new Error(message ?? `Erro no servidor (HTTP ${res.status}). Tente de novo.`);
  }
  if (!data) throw new Error('Resposta vazia do servidor. Tente de novo.');
  return data;
}

export function verify2fa(
  twoFactorToken: string,
  code: string,
): Promise<LoginSuccess> {
  return postJson<LoginSuccess>('/auth/2fa/verify', { twoFactorToken, code });
}

/**
 * Renova a sessão pelo cookie httpOnly de refresh (a API rotaciona o token
 * a cada uso). Devolve a sessão nova — já salva — ou null quando não há
 * sessão válida (aí limpa o que restou localmente). É o que mantém o
 * usuário logado entre abas/dias sem pedir a senha de novo.
 */
export async function refreshSession(): Promise<LoginSuccess | null> {
  try {
    const session = await postJson<LoginSuccess>('/auth/refresh', {});
    saveSession(session);
    return session;
  } catch {
    clearSession();
    return null;
  }
}

/**
 * Logout de verdade: revoga o refresh token na API (ela limpa o cookie) e
 * apaga a sessão local. Sem esta chamada, "sair" só escondia a sessão
 * nesta aba e o cookie continuava válido.
 */
export async function logout(): Promise<void> {
  try {
    await postJson<{ ok: boolean }>('/auth/logout', {});
  } catch {
    // API fora do ar: a sessão local sai mesmo assim.
  }
  clearSession();
}

// ------------------------------------------------- esqueci minha senha

/** Pede a redefinição. A API responde ok sempre (não vaza quem tem conta). */
export function forgotPassword(email: string): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>('/auth/forgot-password', { email });
}

/** Consome o token do link e define a senha nova. */
export function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>('/auth/reset-password', { token, newPassword });
}

export interface PendingReset {
  email: string;
  name: string;
  token: string;
  expiresAt: string;
}

/** Entrega v1 dos links: o admin da escola vê os pedidos pendentes. */
export function listPasswordResets(): Promise<PendingReset[]> {
  return authedJson<PendingReset[]>('/auth/password-resets');
}

// ------------------------------------------------------------ equipe
// Equipe da escola — GET/POST /api/schools/members, com o schoolId
// indo na sessão (o servidor nunca aceita escola pelo body). A lista
// é ADMIN/COORDINATOR; o vínculo é só ADMIN.

export type SchoolRole = 'ADMIN' | 'COORDINATOR' | 'GATE_AGENT' | 'TEACHER' | 'TUTOR';

export interface SchoolMember {
  userId: string;
  name: string;
  email: string;
  role: SchoolRole;
  status: 'ACTIVE' | 'INACTIVE';
}

export function listSchoolMembers(): Promise<SchoolMember[]> {
  return authedJson<SchoolMember[]>('/schools/members');
}

export function addSchoolMember(email: string, role: SchoolRole): Promise<SchoolMember> {
  return authedJson<SchoolMember>('/schools/members', {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
}

// ------------------------------------------------------------ implantação
// Checklist de implantação em 1 dia (OnboardingService, 4 passos do
// runbook: conta → alunos do CSV → equipe → primeira saída). A API já
// tinha GET /onboarding/schools/:schoolId/checklist e POST
// steps/:step/complete|reopen; o web não mostrava nada — e a home
// promete "Implantação em 1 dia" sem nenhuma tela p/ acompanhar.
// Leitura: ADMIN/COORDINATOR/GATE_AGENT/TEACHER; marcar/reabrir:
// ADMIN/COORDINATOR. A marcação ainda é manual — a integração
// automática (marcar ao importar o CSV etc.) é Step 2 da API.

export type OnboardingStepId =
  | 'ACCOUNT_CREATED'
  | 'ROSTER_IMPORTED'
  | 'STAFF_INVITED'
  | 'FIRST_DISMISSAL_DONE';

export interface OnboardingStepState {
  id: OnboardingStepId;
  title: string;
  description: string;
  minutes: number;
  done: boolean;
  doneAt: string | null;
  doneBy: string | null;
}

export interface OnboardingChecklist {
  schoolId: string;
  steps: OnboardingStepState[];
  doneCount: number;
  totalCount: number;
  progressPercent: number;
  nextStep: OnboardingStepId | null;
  isComplete: boolean;
  estimatedMinutesTotal: number;
  estimatedMinutesRemaining: number;
  isDemo: boolean;
}

async function onboardingSchoolId(): Promise<string> {
  const session = loadSession() ?? (await refreshSession());
  if (!session?.schoolId) {
    throw new Error('Sessão sem escola — entre de novo selecionando a escola.');
  }
  return session.schoolId;
}

export async function getOnboardingChecklist(): Promise<OnboardingChecklist> {
  const schoolId = await onboardingSchoolId();
  return authedJson<OnboardingChecklist>(`/onboarding/schools/${schoolId}/checklist`);
}

export async function completeOnboardingStep(step: OnboardingStepId): Promise<OnboardingChecklist> {
  const schoolId = await onboardingSchoolId();
  return authedJson<OnboardingChecklist>(`/onboarding/schools/${schoolId}/steps/${step}/complete`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function reopenOnboardingStep(step: OnboardingStepId): Promise<OnboardingChecklist> {
  const schoolId = await onboardingSchoolId();
  return authedJson<OnboardingChecklist>(`/onboarding/schools/${schoolId}/steps/${step}/reopen`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

// ------------------------------------------------------------ segurança
// Segurança da conta — 2FA TOTP, troca de senha e sessões ativas.
// As rotas /api/auth/2fa/*, /auth/change-password, /auth/sessions e
// /auth/revoke-all-sessions já existiam na API (TwoFactorService +
// AuthService); o web não tinha a tela. Tudo passa por authedJson
// (Bearer + refresh em 401) — o segredo do 2FA nunca sai do navegador
// para um serviço de terceiros: o QR é gerado localmente do otpauthUrl.

export interface TwoFactorStatus {
  enabled: boolean;
  hasPendingSetup: boolean;
  recoveryCodesRemaining: number;
  lastUsedAt: string | null;
  lockedUntil: string | null;
}

export function getTwoFactorStatus(): Promise<TwoFactorStatus> {
  return authedJson<TwoFactorStatus>('/auth/2fa/status');
}

/** Inicia o cadastro: devolve o segredo e o otpauthUrl p/ o QR. */
export function setupTwoFactor(): Promise<{ secret: string; otpauthUrl: string }> {
  return authedJson<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/**
 * Confirma o cadastro com um código do app autenticador. Só então o 2FA
 * passa a valer — e a resposta traz os códigos de recuperação em texto
 * claro UMA vez: a tela precisa exibi-los e avisar que não voltam.
 */
export function confirmTwoFactor(code: string): Promise<{ recoveryCodes: string[] }> {
  return authedJson<{ recoveryCodes: string[] }>('/auth/2fa/confirm', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

/** Desativa o 2FA com um código válido (a API recusa p/ quem é obrigado). */
export function disableTwoFactor(code: string): Promise<{ ok: boolean }> {
  return authedJson<{ ok: boolean }>('/auth/2fa/disable', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

/** Gera um lote novo de códigos (invalida o anterior). Exige código 2FA. */
export function regenerateRecoveryCodes(code: string): Promise<{ recoveryCodes: string[] }> {
  return authedJson<{ recoveryCodes: string[] }>('/auth/2fa/recovery-codes', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export interface AuthSession {
  jti: string;
  familyId: string;
  createdAt: string;
  expiresAt: string;
  familyExpiresAt: string;
}

/**
 * Sessões ativas (refresh tokens válidos). A API não registra aparelho
 * nem IP — a tela diz isso, em vez de inventar um "dispositivo".
 */
export function listSessions(): Promise<AuthSession[]> {
  return authedJson<AuthSession[]>('/auth/sessions');
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean }> {
  return authedJson<{ ok: boolean }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

/** Encerra TODAS as sessões, inclusive a atual (a API limpa o cookie). */
export function revokeAllSessions(): Promise<{ ok: boolean }> {
  return authedJson<{ ok: boolean }>('/auth/revoke-all-sessions', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

// ------------------------------------------------------------ roster
// Cadastro da escola (turmas, alunos, tutores) — /api/roster/*, com o
// schoolId indo na sessão (o servidor nunca aceita escola pelo body).

export interface Classroom {
  id: string;
  name: string;
  grade?: string;
  academicYear: number;
  roomLocation?: string;
  isActive: boolean;
}

export interface Student {
  id: string;
  name: string;
  classroomId: string;
  enrollmentCode?: string;
  birthDate?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'TRANSFERRED';
  pickupBlocked: boolean;
}

export interface Tutor {
  id: string;
  name: string;
  phone: string;
  document?: string;
  isBlocked: boolean;
}

export interface StudentTutor {
  tutorId: string;
  studentId: string;
  relationship: string;
  isPrimary: boolean;
  canPickup: boolean;
  tutor: Tutor;
}

export interface ImportReport {
  totalRows: number;
  created: number;
  updated: number;
  skippedDuplicates: number;
  tutorsCreated: number;
  tutorsLinked: number;
  classroomsCreated: string[];
  errors: { row: number; message: string }[];
  dryRun: boolean;
}

/** Fetch autenticado: Bearer da sessão; em 401, renova 1x e repete. */
async function authedJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  async function attempt(token: string): Promise<Response> {
    return fetch(apiUrl(path), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
      credentials: 'include',
    });
  }
  let session = loadSession();
  if (!session) {
    session = await refreshSession();
    if (!session) throw new Error('Sessão expirada — entre de novo.');
  }
  let res = await attempt(session.accessToken);
  if (res.status === 401) {
    const renewed = await refreshSession();
    if (!renewed) throw new Error('Sessão expirada — entre de novo.');
    res = await attempt(renewed.accessToken);
  }
  const data = (await res.json().catch(() => null)) as
    | (T & { message?: string | string[] })
    | null;
  if (!res.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(' ')
      : data?.message;
    throw new Error(message ?? `Erro no servidor (HTTP ${res.status}). Tente de novo.`);
  }
  if (!data) throw new Error('Resposta vazia do servidor. Tente de novo.');
  return data;
}

export function listClassrooms(): Promise<Classroom[]> {
  return authedJson<Classroom[]>('/roster/classrooms?includeInactive=true');
}

export function createClassroom(input: {
  name: string;
  grade?: string;
  academicYear: number;
  roomLocation?: string;
}): Promise<Classroom> {
  return authedJson<Classroom>('/roster/classrooms', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deactivateClassroom(id: string): Promise<Classroom> {
  return authedJson<Classroom>(`/roster/classrooms/${id}`, { method: 'DELETE' });
}

export function listStudents(classroomId?: string, search?: string): Promise<Student[]> {
  const q = new URLSearchParams();
  if (classroomId) q.set('classroomId', classroomId);
  if (search) q.set('search', search);
  const suffix = q.toString() ? `?${q}` : '';
  return authedJson<Student[]>(`/roster/students${suffix}`);
}

export function createStudent(input: {
  name: string;
  classroomId: string;
  enrollmentCode?: string;
  birthDate?: string;
}): Promise<Student> {
  return authedJson<Student>('/roster/students', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function setStudentStatus(
  id: string,
  status: Student['status'],
): Promise<Student> {
  return authedJson<Student>(`/roster/students/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export function listTutors(): Promise<Tutor[]> {
  return authedJson<Tutor[]>('/roster/tutors');
}

export function createTutor(input: {
  name: string;
  phone: string;
  document?: string;
}): Promise<Tutor> {
  return authedJson<Tutor>('/roster/tutors', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listStudentTutors(studentId: string): Promise<StudentTutor[]> {
  return authedJson<StudentTutor[]>(`/roster/students/${studentId}/tutors`);
}

export function linkTutor(
  tutorId: string,
  input: { studentId: string; relationship: string; isPrimary?: boolean; canPickup?: boolean },
): Promise<unknown> {
  return authedJson(`/roster/tutors/${tutorId}/link`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function importStudents(csv: string, dryRun: boolean): Promise<ImportReport> {
  return authedJson<ImportReport>('/roster/import', {
    method: 'POST',
    body: JSON.stringify({ csv, dryRun }),
  });
}

// ------------------------------------------------------------ portaria
// Ações da fila (PickupController): o schoolId vai na ROTA e sai da
// sessão — o servidor confere tenant e papel (GATE_AGENT/COORD/ADMIN).

async function pickupAction<T>(entryId: string, action: string, body?: unknown): Promise<T> {
  const session = loadSession() ?? (await refreshSession());
  if (!session?.schoolId) {
    throw new Error('Sessão sem escola — entre de novo selecionando a escola.');
  }
  return authedJson<T>(`/pickup/schools/${session.schoolId}/queue/${entryId}/${action}`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export function callQueueEntry(entryId: string): Promise<unknown> {
  return pickupAction(entryId, 'call');
}

export function validateQueueQr(entryId: string, token: string): Promise<unknown> {
  return pickupAction(entryId, 'validate-qr', { token });
}

export function releaseQueueEntry(entryId: string): Promise<unknown> {
  return pickupAction(entryId, 'release');
}

export function cancelQueueEntry(entryId: string): Promise<unknown> {
  return pickupAction(entryId, 'cancel');
}

// Irmãos em portões diferentes (PickupController): GET
// /pickup/schools/:schoolId/sibling-gate-conflicts — a portaria sinaliza
// o conflito p/ o tutor não deixar um filho esperando no portão errado.
// A API devolve só ids (tutorId/studentIds); o nome do aluno vem da fila
// ao vivo quando ela resolve o studentId. Só GATE_AGENT/COORDINATOR/
// ADMIN/TEACHER — TUTOR recebe 403 e a tela some com o alerta.
export interface SiblingGateConflict {
  tutorId: string;
  studentIds: string[];
  gates: { gate: string | null; studentIds: string[] }[];
}

export async function listSiblingGateConflicts(): Promise<SiblingGateConflict[]> {
  const session = loadSession() ?? (await refreshSession());
  if (!session?.schoolId) {
    throw new Error('Sessão sem escola — entre de novo selecionando a escola.');
  }
  return authedJson<SiblingGateConflict[]>(
    `/pickup/schools/${session.schoolId}/sibling-gate-conflicts`,
  );
}

/** true quando a API responde no healthcheck; false quando está fora do ar. */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('/health'), { cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}
