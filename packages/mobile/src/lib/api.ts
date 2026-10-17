import { API_URL } from './config';
import { accessToken, supabase } from './supabase';

/** Codes the API returns with 401 when the Supabase session is fine but JantaHR needs something else first. */
export type AuthProblem = 'MFA_REQUIRED' | 'NO_ACCOUNT' | 'ACCOUNT_DISABLED' | 'SSO_NOT_IN_PLAN' | 'SESSION_INVALID';

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

let onAuthProblem: (code: AuthProblem) => void = () => undefined;
/** The auth provider re-derives the sign-in state when a request reports one of these. */
export function setAuthProblemHandler(fn: (code: AuthProblem) => void) { onAuthProblem = fn; }

type Query = Record<string, string | number | boolean | undefined | null>;
interface Options { query?: Query; body?: unknown; headers?: Record<string, string>; timeoutMs?: number }

export function apiUrl(path: string, query?: Query) {
  const q = Object.entries(query ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return `${API_URL}${path}${q.length ? `?${q.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')}` : ''}`;
}

async function send(method: string, path: string, o: Options, token: string | null) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), o.timeoutMs ?? 30_000);
  try {
    return await fetch(apiUrl(path, o.query), {
      method,
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        ...(o.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...o.headers,
      },
      body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
    });
  } catch (e) {
    throw new ApiError((e as Error).name === 'AbortError' ? 'The request timed out. Please try again.' : 'Cannot reach JantaHR. Check your connection.', 0);
  } finally {
    clearTimeout(timer);
  }
}

async function readError(res: Response): Promise<{ message: string; code?: string }> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[]; code?: string } | null;
  const message = Array.isArray(body?.message) ? body!.message.join('. ') : body?.message;
  return { message: message || `Something went wrong (${res.status}).`, code: body?.code };
}

let refreshing: Promise<string | null> | null = null;

/** One API call with the session's token. An expired token gets one refresh and a retry (single flight). */
export async function request<T>(method: string, path: string, o: Options = {}): Promise<T> {
  let token = await accessToken();
  let res = await send(method, path, o, token);
  if (res.status === 401) {
    const { message, code } = await readError(res);
    const problem = (code ?? 'SESSION_INVALID') as AuthProblem;
    if (problem === 'SESSION_INVALID' && token) {
      refreshing ??= supabase.auth.refreshSession().then(({ data }) => data.session?.access_token ?? null).finally(() => { refreshing = null; });
      token = await refreshing;
      if (token) res = await send(method, path, o, token);
    }
    if (res.status === 401) {
      onAuthProblem(problem);
      throw new ApiError(message, 401, problem);
    }
  }
  if (!res.ok) {
    const { message, code } = await readError(res);
    throw new ApiError(message, res.status, code);
  }
  if (res.status === 204) return undefined as T;
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('json') ? await res.json() : await res.text()) as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body: body ?? {} }),
  del: <T>(path: string) => request<T>('DELETE', path),
};

/** One human sentence for any error the app can meet. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.status === 402 ? `${e.message} Ask your HR team about your company's plan.` : e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong. Please try again.';
}
export const isForbidden = (e: unknown) => e instanceof ApiError && e.status === 403;
export const isPlanError = (e: unknown) => e instanceof ApiError && e.status === 402;
