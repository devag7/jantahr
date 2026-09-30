// A small in-memory stand-in for Supabase Auth (GoTrue) so the API test suites and local development run without
// Docker or a hosted project. TEST USE ONLY: no email delivery, no rate limits, no OAuth, HS256 tokens.
// It implements the subset JantaHR and supabase-js use, with the same paths and response shapes:
//   GET  /auth/v1/settings                       POST /auth/v1/signup
//   POST /auth/v1/token?grant_type=password|refresh_token
//   GET|PUT /auth/v1/user                        POST /auth/v1/logout[?scope=global|local|others]
//   POST /auth/v1/recover                        POST /auth/v1/factors, /factors/:id/challenge, /factors/:id/verify
//   DELETE /auth/v1/factors/:id                  /auth/v1/admin/users[/:id[/factors[/:fid]]]
// Run: GOTRUE_JWT_SECRET=<32+ chars> GOTRUE_SERVICE_KEY=<key> PORT=9999 node test/support/gotrue-stub.mjs
// Users persist to GOTRUE_STUB_FILE (optional) so a restart keeps seeded accounts.
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';

const PORT = Number(process.env.PORT || 9999);
const SECRET = process.env.GOTRUE_JWT_SECRET || '';
const SERVICE_KEY = process.env.GOTRUE_SERVICE_KEY || '';
const FILE = process.env.GOTRUE_STUB_FILE || '';
const ISS = `${(process.env.GOTRUE_PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '')}/auth/v1`;
if (SECRET.length < 32 || !SERVICE_KEY) { console.error('Set GOTRUE_JWT_SECRET (32+ chars) and GOTRUE_SERVICE_KEY'); process.exit(1); }

const db = { users: {}, refresh: {}, sessions: {}, challenges: {} };
if (FILE && fs.existsSync(FILE)) Object.assign(db, JSON.parse(fs.readFileSync(FILE, 'utf8')));
const save = () => { if (FILE) fs.writeFileSync(FILE, JSON.stringify(db)); };
const now = () => new Date().toISOString();
const b64url = (b) => Buffer.from(b).toString('base64url');
const sign = (claims) => {
  const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })); const p = b64url(JSON.stringify(claims));
  return `${h}.${p}.${b64url(crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest())}`;
};
const verify = (token) => {
  const [h, p, s] = String(token || '').split('.');
  if (!s || b64url(crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest()) !== s) return null;
  const c = JSON.parse(Buffer.from(p, 'base64url').toString());
  return c.exp * 1000 > Date.now() ? c : null;
};
const hash = (pw) => { const salt = crypto.randomBytes(8).toString('hex'); return `${salt}:${crypto.scryptSync(pw, salt, 32).toString('hex')}`; };
const checkPw = (pw, stored) => { if (!stored) return false; const [salt, h] = stored.split(':'); return crypto.timingSafeEqual(Buffer.from(h, 'hex'), crypto.scryptSync(String(pw), salt, 32)); };

// RFC 6238 TOTP, ±1 step
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32 = (buf) => { let bits = 0, v = 0, o = ''; for (const x of buf) { v = (v << 8) | x; bits += 8; while (bits >= 5) { o += B32[(v >>> (bits - 5)) & 31]; bits -= 5; } } return bits ? o + B32[(v << (5 - bits)) & 31] : o; };
const unb32 = (s) => { let bits = 0, v = 0; const o = []; for (const ch of s) { v = (v << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { o.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(o); };
const hotp = (secret, n) => { const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(n)); const m = crypto.createHmac('sha1', unb32(secret)).update(c).digest(); const o = m[m.length - 1] & 15; return String((m.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0'); };
const totpOk = (secret, code) => { const n = Math.floor(Date.now() / 30000); return [-1, 0, 1].some((w) => hotp(secret, n + w) === String(code)); };

const publicUser = (u) => ({
  id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, phone: '', email_confirmed_at: u.confirmedAt, confirmed_at: u.confirmedAt,
  last_sign_in_at: u.lastSignIn ?? null, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: u.meta ?? {},
  identities: [], created_at: u.createdAt, updated_at: u.updatedAt, is_anonymous: false, banned_until: u.bannedUntil ?? null,
  factors: (u.factors ?? []).map(({ secret, ...f }) => f),
});
const byEmail = (email) => Object.values(db.users).find((u) => u.email === String(email || '').toLowerCase());
const banned = (u) => u.bannedUntil && new Date(u.bannedUntil) > new Date();

function session(u, { aal = 'aal1', amr = [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }], sessionId = crypto.randomUUID() } = {}) {
  const iat = Math.floor(Date.now() / 1000);
  const access_token = sign({ aud: 'authenticated', exp: iat + 3600, iat, iss: ISS, sub: u.id, email: u.email, phone: '', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: u.meta ?? {}, role: 'authenticated', aal, amr, session_id: sessionId, is_anonymous: false });
  const refresh_token = crypto.randomBytes(24).toString('base64url');
  db.refresh[refresh_token] = { userId: u.id, sessionId, aal, amr };
  db.sessions[sessionId] = { userId: u.id };
  u.lastSignIn = now(); save();
  return { access_token, token_type: 'bearer', expires_in: 3600, expires_at: iat + 3600, refresh_token, user: publicUser(u) };
}
function createUser({ email, password, email_confirm = true, user_metadata = {} }) {
  const id = crypto.randomUUID(); const t = now();
  const u = { id, email: String(email).toLowerCase(), pw: password ? hash(password) : null, confirmedAt: email_confirm ? t : null, meta: user_metadata, createdAt: t, updatedAt: t, factors: [] };
  db.users[id] = u; save(); return u;
}
const err = (res, status, code, msg) => json(res, status, { code: status, error_code: code, msg, message: msg, error_description: msg });
function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

http.createServer((req, res) => {
  const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => {
    try { handle(req, res, chunks.length ? JSON.parse(Buffer.concat(chunks).toString() || '{}') : {}); }
    catch (e) { err(res, 500, 'unexpected_failure', e.message); }
  });
}).listen(PORT, () => console.log(`GoTrue stub on :${PORT} (iss ${ISS})`));

function handle(req, res, body) {
  if (req.method === 'OPTIONS') return json(res, 204);
  const url = new URL(req.url, 'http://x'); const path = url.pathname.replace(/^\/auth\/v1/, '');
  const bearer = (req.headers.authorization || '').replace(/^Bearer /i, '');
  const isService = bearer === SERVICE_KEY || req.headers.apikey === SERVICE_KEY && bearer === SERVICE_KEY;
  const claims = verify(bearer);
  const me = claims && db.users[claims.sub] && db.sessions[claims.session_id] ? db.users[claims.sub] : null;
  let m;

  if (path === '/health') return json(res, 200, { name: 'GoTrue stub' });
  if (url.pathname === '/realtime/v1/api/broadcast') return json(res, 202, {}); // Realtime is not emulated; accept pings
  if (path === '/settings') return json(res, 200, { external: { email: true, google: false, phone: false }, disable_signup: false, mailer_autoconfirm: true, phone_autoconfirm: false });

  if (path === '/signup' && req.method === 'POST') {
    if (!body.email || !body.password || String(body.password).length < 6) return err(res, 422, 'weak_password', 'Password should be at least 6 characters.');
    if (byEmail(body.email)) return err(res, 422, 'user_already_exists', 'User already registered');
    const u = createUser({ email: body.email, password: body.password, user_metadata: body.data ?? {} });
    return json(res, 200, session(u));
  }
  if (path === '/token' && req.method === 'POST') {
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      const u = byEmail(body.email);
      if (!u || !checkPw(body.password, u.pw)) return err(res, 400, 'invalid_credentials', 'Invalid login credentials');
      if (!u.confirmedAt) return err(res, 400, 'email_not_confirmed', 'Email not confirmed');
      if (banned(u)) return err(res, 400, 'user_banned', 'User is banned');
      return json(res, 200, session(u));
    }
    if (grant === 'refresh_token') {
      const r = db.refresh[body.refresh_token]; const u = r && db.users[r.userId];
      if (!r || !u || !db.sessions[r.sessionId]) return err(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found');
      if (banned(u)) return err(res, 400, 'user_banned', 'User is banned');
      delete db.refresh[body.refresh_token];
      return json(res, 200, session(u, { aal: r.aal, amr: r.amr, sessionId: r.sessionId }));
    }
    return err(res, 400, 'validation_failed', 'Unsupported grant type');
  }
  if (path === '/recover' && req.method === 'POST') { console.log(`[stub] recovery requested for ${body.email}`); return json(res, 200, {}); }
  if (path === '/logout' && req.method === 'POST') {
    if (!claims) return json(res, 204);
    const scope = url.searchParams.get('scope') || 'global';
    for (const [sid, s] of Object.entries(db.sessions)) {
      if (s.userId !== claims.sub) continue;
      if (scope === 'global' || (scope === 'local' && sid === claims.session_id) || (scope === 'others' && sid !== claims.session_id)) delete db.sessions[sid];
    }
    for (const [t, r] of Object.entries(db.refresh)) if (!db.sessions[r.sessionId]) delete db.refresh[t];
    save(); return json(res, 204);
  }
  if (path === '/user') {
    if (!me) return err(res, 401, 'bad_jwt', 'invalid JWT');
    if (req.method === 'PUT') {
      if (body.password) me.pw = hash(body.password);
      if (body.data) me.meta = { ...me.meta, ...body.data };
      me.updatedAt = now(); save();
    }
    return json(res, 200, publicUser(me));
  }

  // ---- MFA (TOTP) ----
  if (path === '/factors' && req.method === 'POST') {
    if (!me) return err(res, 401, 'bad_jwt', 'invalid JWT');
    const secret = b32(crypto.randomBytes(20)); const id = crypto.randomUUID();
    me.factors.push({ id, friendly_name: body.friendly_name ?? null, factor_type: 'totp', status: 'unverified', created_at: now(), updated_at: now(), secret }); save();
    const uri = `otpauth://totp/JantaHR:${me.email}?secret=${secret}&issuer=JantaHR`;
    return json(res, 200, { id, type: 'totp', friendly_name: body.friendly_name ?? null, totp: { qr_code: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>', secret, uri } });
  }
  if ((m = /^\/factors\/([^/]+)\/challenge$/.exec(path)) && req.method === 'POST') {
    if (!me || !me.factors.find((f) => f.id === m[1])) return err(res, 404, 'mfa_factor_not_found', 'Factor not found');
    const id = crypto.randomUUID(); db.challenges[id] = { factorId: m[1], exp: Date.now() + 300000 };
    return json(res, 200, { id, type: 'totp', expires_at: Math.floor(db.challenges[id].exp / 1000) });
  }
  if ((m = /^\/factors\/([^/]+)\/verify$/.exec(path)) && req.method === 'POST') {
    const f = me?.factors.find((x) => x.id === m[1]); const ch = db.challenges[body.challenge_id];
    if (!f || !ch || ch.factorId !== f.id || ch.exp < Date.now()) return err(res, 422, 'mfa_challenge_expired', 'Challenge expired');
    if (!totpOk(f.secret, body.code)) return err(res, 422, 'mfa_verification_failed', 'Invalid TOTP code entered');
    delete db.challenges[body.challenge_id]; f.status = 'verified'; f.updated_at = now();
    delete db.sessions[claims.session_id];
    return json(res, 200, session(me, { aal: 'aal2', amr: [{ method: 'totp', timestamp: Math.floor(Date.now() / 1000) }, ...(claims.amr ?? [])] }));
  }
  if ((m = /^\/factors\/([^/]+)$/.exec(path)) && req.method === 'DELETE') {
    const f = me?.factors.find((x) => x.id === m[1]);
    if (!f) return err(res, 404, 'mfa_factor_not_found', 'Factor not found');
    if (f.status === 'verified' && claims.aal !== 'aal2') return err(res, 422, 'insufficient_aal', 'AAL2 required to unenroll verified factor');
    me.factors = me.factors.filter((x) => x.id !== f.id); save();
    return json(res, 200, { id: f.id });
  }

  // ---- admin (service key) ----
  if (path.startsWith('/admin/')) {
    if (!isService) return err(res, 403, 'not_admin', 'User not allowed');
    if (path === '/admin/users' && req.method === 'POST') {
      if (byEmail(body.email)) return err(res, 422, 'email_exists', 'A user with this email address has already been registered');
      return json(res, 200, publicUser(createUser(body)));
    }
    if (path === '/admin/users' && req.method === 'GET') {
      const page = Number(url.searchParams.get('page') || 1); const per = Number(url.searchParams.get('per_page') || 50);
      const all = Object.values(db.users);
      return json(res, 200, { aud: 'authenticated', users: all.slice((page - 1) * per, page * per).map(publicUser), total: all.length });
    }
    if ((m = /^\/admin\/users\/([^/]+)$/.exec(path))) {
      const u = db.users[m[1]]; if (!u) return err(res, 404, 'user_not_found', 'User not found');
      if (req.method === 'GET') return json(res, 200, publicUser(u));
      if (req.method === 'DELETE') { delete db.users[u.id]; for (const [sid, s] of Object.entries(db.sessions)) if (s.userId === u.id) delete db.sessions[sid]; save(); return json(res, 200, {}); }
      if (req.method === 'PUT') {
        if (body.email) { const other = byEmail(body.email); if (other && other.id !== u.id) return err(res, 422, 'email_exists', 'A user with this email address has already been registered'); u.email = body.email.toLowerCase(); }
        if (body.password) u.pw = hash(body.password);
        if (body.user_metadata) u.meta = { ...u.meta, ...body.user_metadata };
        if (body.email_confirm) u.confirmedAt ??= now();
        if (body.ban_duration) u.bannedUntil = body.ban_duration === 'none' ? null : new Date(Date.now() + parseInt(body.ban_duration, 10) * 3600000).toISOString();
        u.updatedAt = now(); save(); return json(res, 200, publicUser(u));
      }
    }
    if ((m = /^\/admin\/users\/([^/]+)\/factors$/.exec(path)) && req.method === 'GET') {
      const u = db.users[m[1]]; if (!u) return err(res, 404, 'user_not_found', 'User not found');
      return json(res, 200, publicUser(u).factors);
    }
    if ((m = /^\/admin\/users\/([^/]+)\/factors\/([^/]+)$/.exec(path)) && req.method === 'DELETE') {
      const u = db.users[m[1]]; if (!u) return err(res, 404, 'user_not_found', 'User not found');
      u.factors = u.factors.filter((f) => f.id !== m[2]); save(); return json(res, 200, { id: m[2] });
    }
  }
  return err(res, 404, 'not_found', `No route ${req.method} ${path}`);
}
