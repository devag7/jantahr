import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { StorageService, uploadScope } from './storage.service';

process.env.AWS_ACCESS_KEY_ID ||= 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY ||= 'test-secret-key';

const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(200, 0x20)]);
const ENV: Record<string, string> = {
  STORAGE_DRIVER: 's3', S3_BUCKET: 'jantahr', S3_ENDPOINT: 'http://storage:5000/storage/v1/s3',
  S3_PUBLIC_ENDPOINT: 'https://ref.storage.supabase.co/storage/v1/s3', UPLOAD_MODE: 'direct', JWT_SECRET: 'x'.repeat(32),
};

/** StorageService over an in-memory bucket (the S3 client is replaced; presigning runs for real). */
function service(env = ENV) {
  const svc = new StorageService({ get: (k: string) => env[k] } as ConfigService);
  const objects = new Map<string, Buffer>();
  const deleted: string[] = [];
  (svc as unknown as { s3: unknown }).s3 = {
    send: async (cmd: { input: { Key: string } }) => {
      const key = cmd.input.Key as string;
      const body = objects.get(key);
      if (cmd instanceof HeadObjectCommand) { if (!body) throw new Error('NotFound'); return { ContentLength: body.length }; }
      if (cmd instanceof GetObjectCommand) return { Body: { transformToByteArray: async () => new Uint8Array(body!.subarray(0, 512)) } };
      if (cmd.constructor.name === 'DeleteObjectCommand') { objects.delete(key); deleted.push(key); return {}; }
      throw new Error(`unexpected ${cmd.constructor.name}`);
    },
  };
  return { svc, objects, deleted };
}
const user = { companyId: 'co1', userId: 'u1' };

describe('StorageService direct uploads', () => {
  it('presigns against the public endpoint and binds the ticket to the uploader', async () => {
    const { svc } = service();
    expect(svc.directUploads).toBe(true);
    const s = await svc.signUpload(uploadScope(user), { fileName: 'offer.pdf', mime: 'application/pdf', size: PDF.length });
    expect(s.url.startsWith('https://ref.storage.supabase.co/storage/v1/s3/jantahr/uploads/c/co1/u/u1/')).toBe(true);
    expect(s.url).toContain('X-Amz-Signature=');
    expect(s.headers['Content-Type']).toBe('application/pdf');
  });

  it('claims an uploaded object that matches the ticket', async () => {
    const { svc, objects } = service();
    const s = await svc.signUpload(uploadScope(user), { fileName: 'offer.pdf', mime: 'application/pdf', size: PDF.length });
    const key = decodeURIComponent(new URL(s.url).pathname).replace('/storage/v1/s3/jantahr/', '');
    objects.set(key, PDF);
    await expect(svc.claim(s.upload, uploadScope(user))).resolves.toEqual({ key, name: 'offer.pdf', size: PDF.length, mime: 'application/pdf' });
  });

  it('rejects tickets for another user, tampered tickets and missing objects', async () => {
    const { svc, objects } = service();
    const s = await svc.signUpload(uploadScope(user), { fileName: 'a.pdf', mime: 'application/pdf', size: PDF.length });
    await expect(svc.claim(s.upload, uploadScope({ companyId: 'co1', userId: 'u2' }))).rejects.toThrow('Invalid upload reference');
    const [payload, mac] = s.upload.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), sc: 'c/co1/u/u2' })).toString('base64url');
    await expect(svc.claim(`${forged}.${mac}`, 'c/co1/u/u2')).rejects.toThrow('Invalid upload reference');
    await expect(svc.claim(s.upload, uploadScope(user))).rejects.toThrow('did not finish uploading');
    expect(objects.size).toBe(0);
  });

  it('deletes an object whose size or content does not match the declaration', async () => {
    const { svc, objects, deleted } = service();
    const s = await svc.signUpload(uploadScope(user), { fileName: 'cv.pdf', mime: 'application/pdf', size: PDF.length });
    const key = decodeURIComponent(new URL(s.url).pathname).replace('/storage/v1/s3/jantahr/', '');
    objects.set(key, Buffer.concat([Buffer.from('MZ'), Buffer.alloc(PDF.length - 2)]));
    await expect(svc.claim(s.upload, uploadScope(user))).rejects.toThrow('does not match');
    expect(deleted).toEqual([key]);
  });

  it('refuses unsupported types and oversize files before signing', async () => {
    const { svc } = service();
    await expect(svc.signUpload('s', { fileName: 'x.exe', mime: 'application/x-msdownload', size: 10 })).rejects.toThrow('Unsupported file type');
    await expect(svc.signUpload('s', { fileName: 'x.pdf', mime: 'application/pdf', size: 11 * 1024 * 1024 })).rejects.toThrow('too large');
  });

  it('keeps multipart uploads on self-hosted servers and checks their content too', async () => {
    const { svc } = service({ ...ENV, UPLOAD_MODE: 'proxy' });
    expect(svc.directUploads).toBe(false);
    const fake = { originalname: 'x.pdf', mimetype: 'application/pdf', size: 20, buffer: Buffer.from('<html>not a pdf</html>') } as Express.Multer.File;
    await expect(svc.save('employees/e1', fake)).rejects.toThrow('does not match its type');
  });
});

describe('StorageService on Supabase Storage (secret key, no S3 key pair)', () => {
  const SB_ENV: Record<string, string> = { SUPABASE_URL: 'https://ref.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test', JWT_SECRET: 'x'.repeat(32) };
  /** The Supabase client is replaced by an in-memory bucket. */
  function supabaseService(env: Record<string, string>) {
    const svc = new StorageService({ get: (k: string) => env[k] } as ConfigService);
    const objects = new Map<string, Buffer>();
    (svc as unknown as { sb: unknown }).sb = {
      put: async (key: string, body: Buffer) => { objects.set(key, body); },
      read: async (key: string) => { const b = objects.get(key); if (!b) throw new Error('not found'); return b; },
      size: async (key: string) => objects.get(key)?.length ?? null,
      firstBytes: async (key: string, n: number) => objects.get(key)!.subarray(0, n),
      remove: async (key: string) => { objects.delete(key); },
      signPut: async (key: string) => `https://ref.supabase.co/storage/v1/object/upload/sign/jantahr/${key}?token=t`,
      signGet: async (key: string, _s: number, name?: string) => `https://ref.supabase.co/storage/v1/object/sign/jantahr/${key}?token=t${name ? `&download=${name}` : ''}`,
    };
    return { svc, objects };
  }
  afterEach(() => { delete process.env.VERCEL; });

  it('is the default on Vercel when Supabase is configured, and local files stay the default elsewhere', () => {
    expect((new StorageService({ get: (k: string) => SB_ENV[k] } as ConfigService) as unknown as { sb: unknown }).sb).toBeNull();
    process.env.VERCEL = '1';
    const svc = new StorageService({ get: (k: string) => SB_ENV[k] } as ConfigService);
    expect((svc as unknown as { sb: unknown }).sb).not.toBeNull();
    expect(svc.directUploads).toBe(true);
  });

  it('an explicit STORAGE_DRIVER wins, and supabase needs its URL and key', () => {
    process.env.VERCEL = '1';
    const local = new StorageService({ get: (k: string) => ({ ...SB_ENV, STORAGE_DRIVER: 'local', UPLOAD_DIR: require('os').tmpdir() } as Record<string, string>)[k] } as ConfigService);
    expect((local as unknown as { sb: unknown }).sb).toBeNull();
    expect(() => new StorageService({ get: (k: string) => ({ STORAGE_DRIVER: 'supabase', JWT_SECRET: 'x'.repeat(32) } as Record<string, string>)[k] } as ConfigService)).toThrow('SUPABASE_URL');
  });

  it('signs a direct upload, then attaches the object only when it matches what was declared', async () => {
    const { svc, objects } = supabaseService({ ...SB_ENV, STORAGE_DRIVER: 'supabase', UPLOAD_MODE: 'direct' });
    const s = await svc.signUpload(uploadScope(user), { fileName: 'offer.pdf', mime: 'application/pdf', size: PDF.length });
    expect(s.method).toBe('PUT');
    expect(s.url).toContain('/storage/v1/object/upload/sign/jantahr/uploads/c/co1/u/u1/');
    const key = decodeURIComponent(new URL(s.url).pathname.split('/jantahr/')[1]);
    await expect(svc.claim(s.upload, uploadScope(user))).rejects.toThrow('did not finish uploading');
    objects.set(key, PDF);
    await expect(svc.claim(s.upload, uploadScope({ companyId: 'co1', userId: 'someone-else' }))).rejects.toThrow('Invalid upload reference');
    expect(await svc.claim(s.upload, uploadScope(user))).toEqual({ key, name: 'offer.pdf', size: PDF.length, mime: 'application/pdf' });
    expect(await svc.read(key)).toEqual(PDF);

    const fake = await svc.signUpload(uploadScope(user), { fileName: 'cv.pdf', mime: 'application/pdf', size: 4 });
    const fakeKey = decodeURIComponent(new URL(fake.url).pathname.split('/jantahr/')[1]);
    objects.set(fakeKey, Buffer.from('MZ\x90\x00'));
    await expect(svc.claim(fake.upload, uploadScope(user))).rejects.toThrow('does not match');
    expect(objects.has(fakeKey)).toBe(false);
  });
});
