import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Directory, File, Paths, UploadType } from 'expo-file-system';
import { ApiError, api, apiUrl, request } from './api';
import { accessToken } from './supabase';

const DOWNLOAD_LINK_TYPE = 'application/vnd.jantahr.download-link+json';

let directUploads: Promise<boolean> | null = null;
/** The cloud API takes files straight into storage (signed upload) instead of through itself (4.5 MB request cap). */
function usesDirectUploads() {
  directUploads ??= api.get<{ directUploads?: boolean }>('/meta/runtime').then((r) => !!r.directUploads).catch(() => { directUploads = null; return false; });
  return directUploads;
}

export interface LocalFile { uri: string; name: string; mimeType: string }

/**
 * Posts a form with one file, the way the web app does: on the cloud edition the file goes to storage first and the
 * form carries the `upload` ticket; a self-hosted server takes multipart.
 */
export async function uploadFile<T>(path: string, file: LocalFile, fields: Record<string, string> = {}, signPath = '/uploads/sign'): Promise<T> {
  if (await usesDirectUploads()) {
    const local = new File(file.uri);
    const signed = await api.post<{ method: 'PUT'; url: string; headers: Record<string, string>; upload: string }>(signPath, { fileName: file.name, mime: file.mimeType, size: local.size });
    const sent = await local.upload(signed.url, { httpMethod: 'PUT', uploadType: UploadType.BINARY_CONTENT, headers: signed.headers });
    if (sent.status < 200 || sent.status >= 300) throw new ApiError('The file could not be uploaded. Please try again.', sent.status);
    return api.post<T>(path, { ...fields, upload: signed.upload });
  }
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  const token = await accessToken();
  const res = await fetch(apiUrl(path), { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(body?.message ?? 'The file could not be uploaded.', res.status);
  }
  return (await res.json()) as T;
}

const safeName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120) || 'download';

/**
 * Fetches a protected file into the app's cache and opens it: Android's viewer (or the share sheet when no viewer
 * handles the type), so a payslip can be saved, printed or sent on WhatsApp. Stored files may come back as a
 * short-lived signed link (the cloud edition's response cap), generated ones (payslips) as bytes.
 */
export async function openFile(path: string, fallbackName: string, query?: Record<string, string>) {
  if (Platform.OS === 'web') {
    // browser preview only: a signed link or the bytes in a new tab
    const res = await request<Blob | { url: string }>('GET', path, { query, headers: { 'X-Download-Link': '1' } });
    if (typeof res === 'object' && res && 'url' in res) window.open(res.url, '_blank');
    return;
  }
  const token = await accessToken();
  const dir = new Directory(Paths.cache, 'downloads');
  if (!dir.exists) dir.create({ intermediates: true });
  const tmp = new File(dir, `${Date.now()}-${safeName(fallbackName)}`);
  let file = await File.downloadFileAsync(apiUrl(path, query), tmp, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'X-Download-Link': '1' }, idempotent: true,
  });
  if (file.type.startsWith(DOWNLOAD_LINK_TYPE) || (file.size < 4096 && (await file.text()).startsWith('{"url"'))) {
    const { url } = JSON.parse(await file.text()) as { url: string };
    file.delete();
    file = await File.downloadFileAsync(url, new File(dir, `${Date.now()}-${safeName(fallbackName)}`), { idempotent: true });
  }
  if (await file.canPreview().catch(() => false)) {
    await file.preview({ title: fallbackName });
    return;
  }
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { dialogTitle: fallbackName, mimeType: file.type || undefined });
}
