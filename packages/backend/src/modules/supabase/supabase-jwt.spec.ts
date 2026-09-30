import * as crypto from 'crypto';
import { Jwk, JwtError, signHs256, verifySupabaseJwt } from './supabase-jwt';

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const now = 1_790_000_000;
const claims = { sub: 'u1', email: 'a@b.in', aud: 'authenticated', iss: 'https://x.supabase.co/auth/v1', exp: now + 600 };

describe('Supabase JWT', () => {
  const secret = 'super-secret-jwt-token-with-at-least-32-characters';
  it('round-trips HS256 and checks issuer / audience / expiry', () => {
    const t = signHs256(claims, secret);
    expect(verifySupabaseJwt(t, { secret, issuer: claims.iss, audience: 'authenticated', now }).email).toBe('a@b.in');
    expect(() => verifySupabaseJwt(t, { secret: 'wrong-secret-of-the-right-length-1234567', now })).toThrow(JwtError);
    expect(() => verifySupabaseJwt(t, { secret, issuer: 'https://other', now })).toThrow('Wrong issuer');
    expect(() => verifySupabaseJwt(t, { secret, audience: 'anon', now })).toThrow('Wrong audience');
    expect(() => verifySupabaseJwt(t, { secret, now: now + 601 })).toThrow('Token expired');
  });
  it('verifies ES256 tokens against a JWKS (Supabase asymmetric signing keys)', () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'ES256' };
    const head = b64url(JSON.stringify({ alg: 'ES256', kid: 'k1', typ: 'JWT' }));
    const body = b64url(JSON.stringify(claims));
    const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: privateKey, dsaEncoding: 'ieee-p1363' });
    const token = `${head}.${body}.${b64url(sig)}`;
    expect(verifySupabaseJwt(token, { jwks: [jwk as Jwk], now }).sub).toBe('u1');
    const tampered = `${head}.${b64url(JSON.stringify({ ...claims, sub: 'admin' }))}.${b64url(sig)}`;
    expect(() => verifySupabaseJwt(tampered, { jwks: [jwk as Jwk], now })).toThrow('Invalid signature');
    expect(() => verifySupabaseJwt(token, { jwks: [{ ...jwk, kid: 'other' } as Jwk], now })).toThrow('Signing key not found');
  });
  it('rejects alg=none and garbage', () => {
    const none = `${b64url('{"alg":"none"}')}.${b64url(JSON.stringify(claims))}.`;
    expect(() => verifySupabaseJwt(none, { secret, now })).toThrow('Unsupported algorithm');
    expect(() => verifySupabaseJwt('abc', { secret })).toThrow('Malformed');
  });
});

