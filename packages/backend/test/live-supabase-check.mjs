// Live check against a real Supabase project (no emails are sent; everything created is removed at the end).
// Needs the API running with that project, and SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY:
//   node --env-file=.env test/live-supabase-check.mjs
import { createClient } from '@supabase/supabase-js';
import { enrollTotp, refresh, signIn, verifyTotp } from './support/supabase-auth.mjs';

const API = process.env.API || 'http://localhost:3010';
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let passes = 0, failures = 0;
const ok = (name, cond, extra) => { if (cond) { passes++; console.log(`  ✓ ${name}`); } else { failures++; console.log(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); } };
const call = async (method, path, token, body) => {
  const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); return { status: r.status, data: t ? JSON.parse(t) : null };
};
const alg = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[0], 'base64url').toString()).alg;

const hr = await signIn('hr@jantahr.com', 'Demo@1234');
ok(`HR signs in with Supabase (token ${hr.accessToken ? alg(hr.accessToken) : '-'})`, hr.status === 200, hr.error);
ok('API verifies the Supabase token and maps the account', (await call('GET', '/auth/me', hr.accessToken)).data?.role === 'HR_ADMIN');
ok('wrong password refused by Supabase', (await signIn('hr@jantahr.com', 'wrong-password-1')).status === 400);
const r = await refresh(hr.refreshToken);
ok('refreshed session accepted', r.status === 200 && (await call('GET', '/auth/me', r.accessToken)).status === 200, r.error);

const email = `live.check.${Date.now().toString(36)}@jantahr.com`;
let authId = null, employeeId = null;
try {
  const created = await call('POST', '/employees', r.accessToken, { firstName: 'Live', lastName: 'Check', email, gender: 'FEMALE', dateOfJoining: '2026-09-01' });
  employeeId = created.data?.id;
  const temp = created.data?.temporaryPassword;
  ok('HR creates an employee: Supabase account made through the admin API', created.status === 201 && !!temp, created.data);
  authId = (await admin.auth.admin.listUsers({ perPage: 200 })).data?.users.find((u) => u.email === email)?.id ?? null;
  ok('account exists in Supabase, email pre-confirmed', !!authId);

  const first = await signIn(email, temp);
  ok('employee signs in with the temporary password, must change it', first.status === 200 && (await call('GET', '/auth/me', first.accessToken)).data?.mustChangePassword === true, first.error);
  ok('change password (API verifies the current one with Supabase)', (await call('POST', '/auth/change-password', first.accessToken, { currentPassword: temp, newPassword: 'LiveCheck2026' })).status === 200);
  ok('old password refused, new one works', (await signIn(email, temp)).status === 400 && (await signIn(email, 'LiveCheck2026')).status === 200);

  const before = await signIn(email, 'LiveCheck2026');
  await new Promise((res) => setTimeout(res, 1100));
  const reset = await call('POST', `/employees/${employeeId}/reset-password`, r.accessToken);
  ok('HR reset: new temporary password, earlier sessions refused', reset.status === 201 && (await call('GET', '/auth/me', before.accessToken)).status === 401, reset.data);
  const pw = reset.data?.temporaryPassword;

  ok('suspended employee refused by Supabase', (await call('POST', `/employees/${employeeId}/status`, r.accessToken, { status: 'SUSPENDED' })).status === 201 && (await signIn(email, pw)).status === 400);
  ok('reactivated employee signs in again', (await call('POST', `/employees/${employeeId}/status`, r.accessToken, { status: 'ACTIVE' })).status === 201 && (await signIn(email, pw)).status === 200);

  const s1 = await signIn(email, pw);
  const enrol = await enrollTotp(s1.accessToken);
  ok('TOTP factor enrolled and verified in Supabase (AAL2)', enrol.session.status === 200, enrol.session.error);
  ok('API turns two-factor on', (await call('POST', '/auth/mfa/sync', enrol.session.accessToken)).data?.mfaEnabled === true);
  const aal1 = await signIn(email, pw);
  const blocked = await call('GET', '/auth/me', aal1.accessToken);
  ok('password-only session refused with MFA_REQUIRED', blocked.status === 401 && blocked.data?.code === 'MFA_REQUIRED', blocked.data);
  const aal2 = await verifyTotp(aal1.accessToken, enrol.factorId, enrol.secret);
  ok('code step-up accepted', (await call('GET', '/auth/me', aal2.accessToken)).status === 200, aal2.error);
} finally {
  // leave the project as it was: the throw-away account goes, and so does its JantaHR employee
  if (authId) await admin.auth.admin.deleteUser(authId);
  console.log(`  · removed test sign-in ${email}${employeeId ? ' (re-seed to drop the employee row)' : ''}`);
}
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
