import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Storage through its own API, authenticated with the project's secret key. Unlike the S3 protocol it needs no
 * separate access key pair, so a deployment that already has SUPABASE_URL and SUPABASE_SECRET_KEY can store files.
 * The bucket is private: objects are reachable only through this class or the short-lived links it signs.
 */
export class SupabaseStorage {
  private readonly client: SupabaseClient;
  private readonly base: string;

  constructor(url: string, private readonly secretKey: string, readonly bucket: string) {
    this.base = url.replace(/\/$/, '');
    this.client = createClient(this.base, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  private get objects() {
    return this.client.storage.from(this.bucket);
  }

  /** Object endpoints not covered by supabase-js (size and ranged reads). */
  private raw(prefix: string, key: string, init: RequestInit = {}) {
    const path = key.split('/').map(encodeURIComponent).join('/');
    return fetch(`${this.base}/storage/v1/object/${prefix}${this.bucket}/${path}`, {
      ...init, headers: { apikey: this.secretKey, authorization: `Bearer ${this.secretKey}`, ...(init.headers as Record<string, string> | undefined) },
    });
  }

  /** Creates the private bucket when it is missing. Returns true when it had to be created. */
  async ensureBucket(): Promise<boolean> {
    if (!(await this.client.storage.getBucket(this.bucket)).error) return false;
    const { error } = await this.client.storage.createBucket(this.bucket, { public: false });
    if (error && !/already exists/i.test(error.message)) throw new Error(error.message);
    return !error;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const { error } = await this.objects.upload(key, body, { contentType, upsert: false });
    if (error) throw new Error(error.message);
  }

  async read(key: string): Promise<Buffer> {
    const { data, error } = await this.objects.download(key);
    if (error || !data) throw new Error(error?.message || 'not found');
    return Buffer.from(await data.arrayBuffer());
  }

  /** Stored size in bytes, or null when there is no such object. */
  async size(key: string): Promise<number | null> {
    const res = await this.raw('', key, { method: 'HEAD' });
    const length = Number(res.headers.get('content-length'));
    return res.ok && Number.isFinite(length) ? length : null;
  }

  async firstBytes(key: string, count: number): Promise<Buffer> {
    const res = await this.raw('authenticated/', key, { headers: { range: `bytes=0-${count - 1}` } });
    if (!res.ok) throw new Error(`read failed (${res.status})`);
    return Buffer.from(await res.arrayBuffer()).subarray(0, count);
  }

  async remove(key: string): Promise<void> {
    const { error } = await this.objects.remove([key]);
    if (error) throw new Error(error.message);
  }

  /** URL a browser can PUT one file to. Supabase fixes its lifetime at two hours; the upload ticket expires sooner. */
  async signPut(key: string): Promise<string> {
    const { data, error } = await this.objects.createSignedUploadUrl(key);
    if (error || !data) throw new Error(error?.message || 'could not sign the upload');
    return data.signedUrl;
  }

  /** Short-lived read link; `downloadName` makes the browser save the file under that name instead of showing it. */
  async signGet(key: string, seconds: number, downloadName?: string): Promise<string> {
    const { data, error } = await this.objects.createSignedUrl(key, seconds, downloadName ? { download: downloadName } : undefined);
    if (error || !data) throw new Error(error?.message || 'could not sign the download');
    return data.signedUrl;
  }
}
