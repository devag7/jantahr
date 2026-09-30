import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Field-level encryption for PII/SPII (Aadhaar, PAN, bank account) using AES-256-GCM.
 * Ciphertext format: enc:v1:<iv b64>:<tag b64>:<data b64>
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly key: Buffer;
  private static readonly PREFIX = 'enc:v1:';

  constructor(config: ConfigService) {
    const raw = config.get<string>('ENCRYPTION_KEY');
    if (raw) {
      this.key = crypto.createHash('sha256').update(raw).digest();
    } else {
      if (config.get('NODE_ENV') === 'production') {
        throw new Error('ENCRYPTION_KEY must be set in production');
      }
      this.logger.warn('ENCRYPTION_KEY not set: deriving a dev key from JWT_SECRET. Set ENCRYPTION_KEY before production.');
      this.key = crypto.createHash('sha256').update('dev:' + (config.get<string>('JWT_SECRET') || 'jantahr')).digest();
    }
  }

  isEncrypted(v?: string | null): boolean {
    return !!v && v.startsWith(CryptoService.PREFIX);
  }

  encrypt(plain?: string | null): string | null {
    if (plain === undefined || plain === null || plain === '') return null;
    if (this.isEncrypted(plain)) return plain;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${CryptoService.PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
  }

  decrypt(value?: string | null): string | null {
    if (!value) return null;
    if (!this.isEncrypted(value)) return value; // legacy plaintext
    try {
      const [iv, tag, data] = value.slice(CryptoService.PREFIX.length).split(':');
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
    } catch {
      this.logger.error('Failed to decrypt field (wrong key or corrupted data)');
      return null;
    }
  }

  /** Mask all but last N chars: XXXXXXXX1234 */
  mask(value?: string | null, visible = 4): string | null {
    if (!value) return null;
    const v = value.replace(/\s+/g, '');
    if (v.length <= visible) return '*'.repeat(v.length);
    return '*'.repeat(v.length - visible) + v.slice(-visible);
  }

  sha256(v: string): string {
    return crypto.createHash('sha256').update(v).digest('hex');
  }

  randomToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }
}
