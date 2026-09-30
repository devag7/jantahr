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
