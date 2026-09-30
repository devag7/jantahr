import * as crypto from 'crypto';

/**
 * Minimal JWT support for Supabase, using node:crypto only.
 *  - verify: HS256 (legacy JWT secret; self-hosted default) and ES256 / RS256 (asymmetric signing keys; Supabase cloud default)
 *  - sign: HS256 tokens for Supabase Realtime (role `authenticated`, sub = our user id) so RLS can scope Postgres Changes
 */
const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const fromB64url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export interface SupabaseClaims { sub: string; email?: string; role?: string; aud?: string | string[]; iss?: string; exp?: number; iat?: number; [k: string]: unknown }
export type Jwk = crypto.JsonWebKey & { kid?: string; alg?: string };

export function signHs256(claims: Record<string, unknown>, secret: string): string {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(claims));
  const sig = b64url(crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest());
  return `${head}.${body}.${sig}`;
}

export class JwtError extends Error {}

export function verifySupabaseJwt(token: string, opts: { secret?: string; jwks?: Jwk[]; issuer?: string; audience?: string; now?: number }): SupabaseClaims {
  const parts = token.split('.');
  if (parts.length !== 3) throw new JwtError('Malformed token');
  const [h, p, s] = parts;
  let header: { alg?: string; kid?: string };
  let claims: SupabaseClaims;
  try {
    header = JSON.parse(fromB64url(h).toString('utf8'));
    claims = JSON.parse(fromB64url(p).toString('utf8'));
  } catch {
    throw new JwtError('Malformed token');
  }
  const data = Buffer.from(`${h}.${p}`);
  const sig = fromB64url(s);
  let ok = false;
  if (header.alg === 'HS256') {
    if (!opts.secret) throw new JwtError('HS256 token but no JWT secret configured');
    const expected = crypto.createHmac('sha256', opts.secret).update(data).digest();
    ok = expected.length === sig.length && crypto.timingSafeEqual(expected, sig);
  } else if (header.alg === 'ES256' || header.alg === 'RS256') {
    const jwk = (opts.jwks || []).find((k) => (header.kid ? k.kid === header.kid : true) && (!k.alg || k.alg === header.alg));
    if (!jwk) throw new JwtError('Signing key not found');
    const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    ok = header.alg === 'ES256'
      ? crypto.verify('sha256', data, { key, dsaEncoding: 'ieee-p1363' }, sig)
      : crypto.verify('RSA-SHA256', data, key, sig);
  } else throw new JwtError(`Unsupported algorithm ${header.alg}`);
  if (!ok) throw new JwtError('Invalid signature');
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp < now) throw new JwtError('Token expired');
  if (opts.issuer && claims.iss !== opts.issuer) throw new JwtError('Wrong issuer');
  if (opts.audience) {
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.includes(opts.audience)) throw new JwtError('Wrong audience');
  }
  return claims;
}

