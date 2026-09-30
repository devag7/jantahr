import { supabase } from './supabase';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3002';

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

/** 401 codes that mean "finish signing in" rather than "request failed" (see the API's AuthGuard). */
let onAuthProblem: (code: string) => void = () => undefined;
export const setAuthProblemHandler = (fn: (code: string) => void) => { onAuthProblem = fn; };

const accessToken = async () => (await supabase.auth.getSession()).data.session?.access_token ?? null;

async function raw(path: string, init: RequestInit, retry = true): Promise<Response> {
  const token = await accessToken();
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init.headers as Record<string, string> | undefined) } });
  if (res.status === 401 && token) {
    const code = ((await res.clone().json().catch(() => null)) as { code?: string } | null)?.code ?? 'SESSION_INVALID';
    if (code === 'SESSION_INVALID' && retry && (await supabase.auth.refreshSession()).data.session) return raw(path, init, false);
    onAuthProblem(code);
  }
  return res;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await raw(path, { method: init.method ?? 'GET', body: init.body === undefined ? undefined : JSON.stringify(init.body) });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const m = data?.message;
    throw new ApiError(Array.isArray(m) ? m.join('. ') : m || `Request failed (${res.status})`, res.status, data?.code);
  }
  return data as T;
}

/** Auth header for authenticated file downloads (payslip PDFs). */
export async function authedDownloadHeaders() {
  return { Authorization: `Bearer ${await accessToken()}` };
}
