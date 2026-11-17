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
export function saveSession(session: LoginSuccess) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // sessionStorage indisponível (modo privado etc.) — login segue em memória.
  }
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

export function login(email: string, password: string): Promise<LoginResult> {
  return postJson<LoginResult>('/auth/login', { email, password });
}

export function verify2fa(
  twoFactorToken: string,
  code: string,
): Promise<LoginSuccess> {
  return postJson<LoginSuccess>('/auth/2fa/verify', { twoFactorToken, code });
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
