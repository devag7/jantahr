import { CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { Request, Response } from 'express';
import { errorMessage } from '../utils/errors';

const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/csv']);
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** A signed upload URL is valid this long; the ticket that claims the object, a little longer. */
const SIGNED_URL_SECONDS = 10 * 60;
const TICKET_SECONDS = 60 * 60;
export const DOWNLOAD_LINK_TYPE = 'application/vnd.jantahr.download-link+json';
const MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.csv': 'text/csv',
};

export interface StoredFile { key: string; name: string; size: number; mime: string }
export interface UploadRequest { fileName: string; mime: string; size: number }
export interface SignedUpload { method: 'PUT'; url: string; headers: Record<string, string>; upload: string; expiresAt: string }

/** First bytes of each allowed type, so a renamed executable cannot pass as a PDF. */
function contentMatches(mime: string, head: Buffer): boolean {
  const starts = (...b: number[]) => b.every((x, i) => head[i] === x);
  switch (mime) {
    case 'application/pdf': return head.subarray(0, 5).toString('latin1') === '%PDF-';
    case 'image/png': return starts(0x89, 0x50, 0x4e, 0x47);
    case 'image/jpeg': return starts(0xff, 0xd8, 0xff);
    case 'image/webp': return head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP';
    case 'application/msword': return starts(0xd0, 0xcf, 0x11, 0xe0);
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return starts(0x50, 0x4b, 0x03, 0x04);
    case 'text/csv': return !head.includes(0);
    default: return false;
  }
}

/**
 * Object storage for documents, receipts, résumés and selfies.
 *   STORAGE_DRIVER=local (default)  → files under UPLOAD_DIR (dev, single-node)
 *   STORAGE_DRIVER=s3               → S3 bucket `S3_BUCKET` (AWS, MinIO or Supabase Storage via S3_ENDPOINT);
 *                                     STORAGE_AUTO_CREATE_BUCKET=true creates a missing (private) bucket at boot
 * Keys are relative paths (`employees/<id>/<uuid>.pdf`) and identical across drivers.
 *
 * Direct uploads (UPLOAD_MODE=direct, the default on Vercel with the s3 driver): serverless functions accept at most
 * 4.5 MB per request, so the browser PUTs the file straight to the bucket with a short-lived presigned URL and sends
 * the API a signed ticket instead of the bytes. The API then checks the stored object's size, type and first bytes
 * before attaching it, exactly as it checks a multipart upload. S3_PUBLIC_ENDPOINT is the endpoint browsers can
 * reach when S3_ENDPOINT is an internal hostname.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly root: string;
  private readonly s3: S3Client | null;
  private readonly presigner: S3Client | null;
  private readonly bucket: string;
  private readonly ticketSecret: string;
  readonly directUploads: boolean;

  constructor(config: ConfigService) {
    this.root = path.resolve(config.get<string>('UPLOAD_DIR') || './uploads');
    this.bucket = config.get<string>('S3_BUCKET') || '';
    this.ticketSecret = config.get<string>('UPLOAD_SIGNING_SECRET') || config.get<string>('JWT_SECRET') || '';
    if (config.get('STORAGE_DRIVER') === 's3') {
      if (!this.bucket) throw new Error('S3_BUCKET must be set when STORAGE_DRIVER=s3');
      const region = config.get<string>('AWS_REGION') || 'ap-south-1';
      const endpoint = config.get<string>('S3_ENDPOINT');
      const publicEndpoint = config.get<string>('S3_PUBLIC_ENDPOINT') || endpoint;
      this.s3 = new S3Client({ region, ...(endpoint ? { endpoint, forcePathStyle: true } : {}) });
      this.presigner = new S3Client({ region, ...(publicEndpoint ? { endpoint: publicEndpoint, forcePathStyle: true } : {}) });
      this.autoCreate = config.get('STORAGE_AUTO_CREATE_BUCKET') === 'true';
      const mode = config.get<string>('UPLOAD_MODE') || (process.env.VERCEL ? 'direct' : 'proxy');
      this.directUploads = mode === 'direct';
      this.logger.log(`Using S3 storage (bucket ${this.bucket}, ${this.directUploads ? 'direct' : 'proxied'} uploads)`);
    } else {
      this.s3 = null;
      this.presigner = null;
      this.directUploads = false;
      fs.mkdirSync(this.root, { recursive: true });
    }
  }

  private autoCreate = false;

  async onModuleInit() {
    if (!this.s3 || !this.autoCreate) return;
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Created private bucket ${this.bucket}`);
      } catch (e) {
        this.logger.error(`Bucket ${this.bucket} is missing and could not be created: ${errorMessage(e)}`);
      }
    }
  }

  private safeFolder(folder: string) {
    return folder.replace(/[^a-zA-Z0-9_\-/]/g, '');
  }

  private async put(key: string, body: Buffer, contentType: string): Promise<void> {
    if (this.s3) {
      await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
      return;
    }
    const full = this.resolve(key);
    await fs.promises.mkdir(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, body);
  }

  private checkRequest(mime: string, size: number) {
    if (!ALLOWED.has(mime)) throw new BadRequestException('Unsupported file type. Allowed: PDF, PNG, JPG, WEBP, DOC(X), CSV');
    if (!(size > 0)) throw new BadRequestException('The file is empty');
    if (size > MAX_UPLOAD_BYTES) throw new BadRequestException('File too large (max 10 MB)');
  }

  private ext(name: string) {
    return path.extname(name).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 8);
  }

  async save(folder: string, file: Express.Multer.File): Promise<StoredFile> {
    if (!file) throw new BadRequestException('No file uploaded');
    this.checkRequest(file.mimetype, file.size);
    if (!contentMatches(file.mimetype, file.buffer.subarray(0, 512))) throw new BadRequestException('The file content does not match its type');
    const key = `${this.safeFolder(folder)}/${crypto.randomUUID()}${this.ext(file.originalname)}`;
    await this.put(key, file.buffer, file.mimetype);
    return { key, name: file.originalname, size: file.size, mime: file.mimetype };
  }

  /**
   * Presigned PUT for a direct upload. `scope` binds the ticket to its uploader (a user, or a job for public
   * applications) so one person's ticket cannot attach another person's object.
   */
  async signUpload(scope: string, req: UploadRequest): Promise<SignedUpload> {
    if (!this.presigner) throw new BadRequestException('Direct uploads need the s3 storage driver');
    if (!this.ticketSecret) throw new Error('JWT_SECRET (or UPLOAD_SIGNING_SECRET) is required to sign uploads');
    const fileName = String(req.fileName || '').slice(0, 200) || 'file';
    this.checkRequest(req.mime, Number(req.size));
    const key = `uploads/${this.safeFolder(scope)}/${crypto.randomUUID()}${this.ext(fileName)}`;
    const url = await getSignedUrl(this.presigner, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: req.mime }), { expiresIn: SIGNED_URL_SECONDS });
    const exp = Math.floor(Date.now() / 1000) + TICKET_SECONDS;
    const payload = Buffer.from(JSON.stringify({ k: key, n: fileName, m: req.mime, s: Number(req.size), sc: scope, e: exp })).toString('base64url');
    return { method: 'PUT', url, headers: { 'Content-Type': req.mime }, upload: `${payload}.${this.sign(payload)}`, expiresAt: new Date((Date.now() + SIGNED_URL_SECONDS * 1000)).toISOString() };
  }

  private sign(payload: string) {
    return crypto.createHmac('sha256', this.ticketSecret).update(`upload:${payload}`).digest('base64url');
  }

  /** Verifies a direct-upload ticket and the object it points at; returns it like `save` does. */
  async claim(ticket: string, scope: string): Promise<StoredFile> {
    if (!this.s3 || typeof ticket !== 'string' || !this.ticketSecret) throw new BadRequestException('No file uploaded');
    const [payload, mac] = ticket.split('.');
    const expected = this.sign(payload || '');
    if (!mac || mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) throw new BadRequestException('Invalid upload reference');
    let t: { k: string; n: string; m: string; s: number; sc: string; e: number };
    try { t = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { throw new BadRequestException('Invalid upload reference'); }
    if (t.sc !== scope) throw new BadRequestException('Invalid upload reference');
    if (t.e < Date.now() / 1000) throw new BadRequestException('The upload expired. Please choose the file again.');
    let head;
    try { head = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: t.k })); } catch { throw new BadRequestException('The file did not finish uploading. Please try again.'); }
    const first = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: t.k, Range: 'bytes=0-511' }));
    const bytes = Buffer.from(await first.Body!.transformToByteArray());
    if (head.ContentLength !== t.s || head.ContentLength > MAX_UPLOAD_BYTES || !contentMatches(t.m, bytes)) {
      await this.remove(t.k);
      throw new BadRequestException('The uploaded file does not match what was declared');
    }
    return { key: t.k, name: t.n, size: t.s, mime: t.m };
  }

  /** A multipart file (self-hosted, local dev) or a direct-upload ticket (cloud), whichever the request carried. */
  async accept(folder: string, scope: string, file?: Express.Multer.File, ticket?: string): Promise<StoredFile> {
    if (file) return this.save(folder, file);
    if (ticket) return this.claim(ticket, scope);
    throw new BadRequestException('No file uploaded');
  }

  /** Save a base64 data-URL image (selfie capture from browser/mobile). */
  async saveDataUrl(folder: string, dataUrl: string): Promise<string> {
    const m = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(dataUrl || '');
    if (!m) throw new BadRequestException('Invalid image data');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 3 * 1024 * 1024) throw new BadRequestException('Image too large (max 3 MB)');
    const key = `${this.safeFolder(folder)}/${crypto.randomUUID()}.${m[1] === 'image/png' ? 'png' : m[1] === 'image/webp' ? 'webp' : 'jpg'}`;
    await this.put(key, buf, m[1]);
    return key;
  }

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new BadRequestException('Invalid path');
    return full;
  }

  async read(key: string): Promise<Buffer> {
    try {
      if (this.s3) {
        const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
        return Buffer.from(await res.Body!.transformToByteArray());
      }
      return await fs.promises.readFile(this.resolve(key));
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new NotFoundException('File not found');
    }
  }

  /**
   * Sends a stored object. Streams it through the API, except on serverless deployments (responses capped at
   * 4.5 MB) where a client that sends `X-Download-Link: 1` gets a five-minute signed link to the object instead.
   */
  async send(req: Request, res: Response, key: string, name: string, disposition: 'inline' | 'attachment' = 'attachment'): Promise<void> {
    const ext = path.extname(key).toLowerCase();
    const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';
    if (ext && !path.extname(name)) name += ext;
    const cd = `${disposition}; filename="${encodeURIComponent(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`;
    if (this.directUploads && this.presigner && req.get('x-download-link') === '1') {
      const url = await getSignedUrl(this.presigner, new GetObjectCommand({ Bucket: this.bucket, Key: key, ResponseContentDisposition: cd, ResponseContentType: mime }), { expiresIn: 300 });
      res.type(DOWNLOAD_LINK_TYPE).send(JSON.stringify({ url, name, disposition }));
      return;
    }
    const buffer = await this.read(key);
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', cd);
    res.send(buffer);
  }

  async remove(key?: string | null): Promise<void> {
    if (!key) return;
    if (this.s3) {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })).catch((e) => this.logger.warn(`S3 delete failed: ${e.message}`));
      return;
    }
    await fs.promises.unlink(this.resolve(key)).catch(() => undefined);
  }
}

/** Ticket scope for a signed-in uploader: tickets are only redeemable by the user they were issued to. */
export const uploadScope = (user: { companyId: string; userId: string }) => `c/${user.companyId}/u/${user.userId}`;
