import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

const svc = () => new CryptoService({ get: (k: string) => ({ ENCRYPTION_KEY: 'test-key-please-ignore', JWT_SECRET: 'x'.repeat(20) } as Record<string, string>)[k] } as ConfigService);

describe('CryptoService', () => {
  it('round-trips and never stores plaintext', () => {
    const c = svc();
    const enc = c.encrypt('ABCDE1234F')!;
    expect(enc).not.toContain('ABCDE1234F');
    expect(c.isEncrypted(enc)).toBe(true);
    expect(c.decrypt(enc)).toBe('ABCDE1234F');
  });
  it('uses a fresh IV each time', () => {
    const c = svc();
    expect(c.encrypt('same')).not.toEqual(c.encrypt('same'));
  });
  it('detects tampering and wrong keys', () => {
    const c = svc();
    const enc = c.encrypt('secret')!;
    const parts = enc.split(':');
    parts[4] = Buffer.from('tampered').toString('base64');
    expect(c.decrypt(parts.join(':'))).toBeNull();
    const other = new CryptoService({ get: (k: string) => ({ ENCRYPTION_KEY: 'another-key' } as Record<string, string>)[k] } as ConfigService);
    expect(other.decrypt(enc)).toBeNull();
  });
  it('is idempotent on already-encrypted values and passes legacy plaintext through', () => {
    const c = svc();
    const enc = c.encrypt('x1')!;
    expect(c.encrypt(enc)).toBe(enc);
    expect(c.decrypt('plain-legacy')).toBe('plain-legacy');
  });
  it('masks all but the last four characters', () => {
    expect(svc().mask('ABCDE1234F')).toBe('******234F');
    expect(svc().mask('12')).toBe('**');
    expect(svc().mask(null)).toBeNull();
  });
});

