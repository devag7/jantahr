// Supabase Auth (GoTrue REST) helpers for the API test suites. Works against a real project, the self-hosted stack
// or test/support/gotrue-stub.mjs: SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY (defaults match the stub).
import crypto from 'node:crypto';

const URL_ = (process.env.SUPABASE_URL || 'http://localhost:9999').replace(/\/$/, '');
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'anon-local';

async function gotrue(method, path, body, token) {
  const res = await fetch(`${URL_}/auth/v1${path}`, {
    method, headers: { 'content-type': 'application/json', apikey: KEY, authorization: `Bearer ${token || KEY}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}
const asSession = (r) => (r.status === 200 && r.data?.access_token
  ? { status: 200, accessToken: r.data.access_token, refreshToken: r.data.refresh_token, user: r.data.user }
  : { status: r.status, error: r.data });

export const signIn = async (email, password) => asSession(await gotrue('POST', '/token?grant_type=password', { email, password }));
export const signUp = async (email, password, data = {}) => asSession(await gotrue('POST', '/signup', { email, password, data }));
export const refresh = async (refreshToken) => asSession(await gotrue('POST', '/token?grant_type=refresh_token', { refresh_token: refreshToken }));
export const signOut = (token, scope = 'local') => gotrue('POST', `/logout?scope=${scope}`, {}, token);

/** Enrol a TOTP factor and verify it; returns the AAL2 session and the secret. */
export async function enrollTotp(token) {
  const f = await gotrue('POST', '/factors', { factor_type: 'totp', friendly_name: `test-${Date.now()}` }, token);
  const ch = await gotrue('POST', `/factors/${f.data.id}/challenge`, {}, token);
  const v = await gotrue('POST', `/factors/${f.data.id}/verify`, { challenge_id: ch.data.id, code: totp(f.data.totp.secret) }, token);
  return { factorId: f.data.id, secret: f.data.totp.secret, session: asSession(v) };
}
/** Step an AAL1 session up to AAL2 with an existing factor. */
export async function verifyTotp(token, factorId, secret) {
  const ch = await gotrue('POST', `/factors/${factorId}/challenge`, {}, token);
  return asSession(await gotrue('POST', `/factors/${factorId}/verify`, { challenge_id: ch.data.id, code: totp(secret) }, token));
}

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function totp(secret) {
  let bits = 0, v = 0; const key = [];
  for (const ch of secret.replace(/=+$/, '')) { v = (v << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { key.push((v >>> (bits - 8)) & 255); bits -= 8; } }
  const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const m = crypto.createHmac('sha1', Buffer.from(key)).update(c).digest(); const o = m[m.length - 1] & 15;
  return String((m.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}
