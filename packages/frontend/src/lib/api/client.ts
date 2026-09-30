import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import { accessToken, createClient } from '@/lib/supabase/client';
import { ENDPOINTS } from './endpoints';

export const http = axios.create({ baseURL: API_BASE_URL, timeout: 30_000 });

http.interceptors.request.use(async (config) => {
  const token = await accessToken();
  if (token && !config.headers.has('Authorization')) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

/** Codes the API returns with 401 when a Supabase session is fine but JantaHR needs something else first. */
export type AuthProblem = 'MFA_REQUIRED' | 'NO_ACCOUNT' | 'ACCOUNT_DISABLED' | 'SSO_NOT_IN_PLAN' | 'SESSION_INVALID';
let onAuthProblem: (code: AuthProblem, message: string) => void = () => undefined;
export function setAuthProblemHandler(fn: (code: AuthProblem, message: string) => void) { onAuthProblem = fn; }

// An expired access token gets one refresh (single flight) and a retry; anything else goes to the auth store.
let refreshing: Promise<string | null> | null = null;
http.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    const body = error.response?.data as { code?: AuthProblem; message?: string } | undefined;
    if (error.response?.status === 401 && original) {
      const code = body?.code ?? 'SESSION_INVALID';
      if (code === 'SESSION_INVALID' && !original._retried && (await accessToken())) {
        original._retried = true;
        refreshing ??= createClient().auth.refreshSession().then(({ data }) => data.session?.access_token ?? null).finally(() => { refreshing = null; });
        const token = await refreshing;
        if (token) {
          original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
          return http(original);
        }
      }
      onAuthProblem(code, body?.message ?? 'Please sign in again.');
    }
    return Promise.reject(error);
  },
);

// ---- typed transport helpers (components never touch axios) ----
export async function get<T>(url: string, params?: object): Promise<T> {
  return (await http.get<T>(url, { params })).data;
}
export async function post<T>(url: string, body?: unknown): Promise<T> {
  return (await http.post<T>(url, body)).data;
}
export async function put<T>(url: string, body?: unknown): Promise<T> {
  return (await http.put<T>(url, body)).data;
}
export async function patch<T>(url: string, body?: unknown): Promise<T> {
  return (await http.patch<T>(url, body)).data;
}
export async function del<T>(url: string): Promise<T> {
  return (await http.delete<T>(url)).data;
}
const DOWNLOAD_LINK_TYPE = 'application/vnd.jantahr.download-link+json';
let directUploads: Promise<boolean> | null = null;
/** The API says whether files go straight to object storage (serverless cloud) or through it (self-hosted). */
function usesDirectUploads(): Promise<boolean> {
  directUploads ??= http.get<{ directUploads?: boolean }>(ENDPOINTS.meta.runtime).then((r) => !!r.data.directUploads).catch(() => { directUploads = null; return false; });
  return directUploads;
}

interface SignedUpload { method: 'PUT'; url: string; headers: Record<string, string>; upload: string }

/** PUTs the file to its presigned URL and returns the ticket the API redeems in place of the bytes. */
async function sendDirect(file: File, signUrl: string): Promise<string> {
  const s = (await http.post<SignedUpload>(signUrl, { fileName: file.name, mime: file.type, size: file.size })).data;
  const res = await fetch(s.url, { method: s.method, headers: s.headers, body: file });
  if (!res.ok) throw new Error('The file could not be uploaded. Please try again.');
  return s.upload;
}

/**
 * Posts a form that carries one file. Self-hosted servers take it as multipart; on the serverless cloud edition
 * (4.5 MB request cap) the file goes directly to storage and the form is sent as JSON with an `upload` ticket.
 */
export async function upload<T>(url: string, form: FormData, signUrl: string = ENDPOINTS.uploads.sign): Promise<T> {
  if (await usesDirectUploads()) {
    const body: Record<string, string> = {};
    for (const [k, v] of Array.from(form.entries())) {
      if (typeof v === 'string') body[k] = v;
      else body.upload = await sendDirect(v, signUrl);
    }
    return (await http.post<T>(url, body)).data;
  }
  return (await http.post<T>(url, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
}

/** Fetches a protected file and hands it to the browser as a download / new tab. */
export async function downloadFile(url: string, params?: object, fallbackName = 'download', openInTab = false): Promise<void> {
  // Stored files can exceed the serverless 4.5 MB response cap, so on the cloud edition the API may answer with a
  // short-lived signed link instead of the bytes. Generated files (payslips, reports) always come back as bytes.
  const direct = await usesDirectUploads();
  const res = await http.get<Blob>(url, { params, responseType: 'blob', headers: direct ? { 'X-Download-Link': '1' } : undefined });
  if (String(res.headers['content-type'] ?? '').startsWith(DOWNLOAD_LINK_TYPE)) {
    const link = JSON.parse(await res.data.text()) as { url: string };
    // A new tab either saves the file (attachment) or shows it, and never navigates the app away.
    window.open(link.url, '_blank', 'noopener');
    return;
  }
  const disposition = res.headers['content-disposition'] as string | undefined;
  const name = /filename="?([^";]+)"?/.exec(disposition || '')?.[1];
  const objectUrl = URL.createObjectURL(res.data);
  if (openInTab) window.open(objectUrl, '_blank');
  else {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = name ? decodeURIComponent(name) : fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

/** 402 from the API: the action needs a plan feature or more seats (cloud edition). */
export function planError(e: unknown): { code: 'PLAN_REQUIRED' | 'SEAT_LIMIT'; message: string } | null {
  if (!axios.isAxiosError(e) || e.response?.status !== 402) return null;
  const d = e.response.data as { code?: 'PLAN_REQUIRED' | 'SEAT_LIMIT'; message?: string };
  return { code: d?.code ?? 'PLAN_REQUIRED', message: d?.message ?? 'This needs a different plan.' };
}

/** Normalises API/validation errors into one human string. */
export function errorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { message?: string | string[] } | undefined;
    if (Array.isArray(data?.message)) return data.message.join('. ');
    if (data?.message) return data.message;
    if (e.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your connection.';
    if (e.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
    return e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}
