// Checks a JantaHR installation end to end and says exactly what is missing.
//   pnpm --filter jantahr-backend doctor        (reads packages/backend/.env; real environment variables win)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const here = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
let problems = 0;
const pass = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m, fix) => { problems++; console.log(`  \x1b[31m✗\x1b[0m ${m}${fix ? `\n      → ${fix}` : ''}`); };
const warn = (m, fix) => console.log(`  \x1b[33m!\x1b[0m ${m}${fix ? `\n      → ${fix}` : ''}`);
const section = (t) => console.log(`\n${t}`);
const timeout = (ms) => AbortSignal.timeout(ms);

section('Configuration');
const need = {
  DATABASE_URL: 'Postgres connection string (Supabase: transaction pooler, port 6543)',
  JWT_SECRET: '48+ random characters (internal HMACs)',
  ENCRYPTION_KEY: '48+ random characters; back it up, PAN/Aadhaar/bank fields depend on it',
  SUPABASE_URL: 'https://<project-ref>.supabase.co (Settings > API)',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_… (Settings > API keys)',
  SUPABASE_SECRET_KEY: 'sb_secret_… (Settings > API keys > Create secret key). Server only, never NEXT_PUBLIC_',
};
for (const [k, why] of Object.entries(need)) {
  const v = env[k] || (k === 'SUPABASE_SECRET_KEY' ? env.SUPABASE_SERVICE_ROLE_KEY : k === 'SUPABASE_PUBLISHABLE_KEY' ? env.SUPABASE_ANON_KEY : '');
  if (v) pass(k); else fail(`${k} is not set`, `add to packages/backend/.env: ${why}`);
}
if (env.JWT_SECRET && env.JWT_SECRET.length < 32) warn('JWT_SECRET is shorter than 32 characters', 'use 48+ random characters in production');
console.log(`  · edition: ${env.EDITION || 'self_hosted'}${env.EDITION === 'cloud' ? `, billing: ${env.BILLING_PROVIDER === 'mock' ? 'mock (development only)' : env.RAZORPAY_KEY_ID ? 'Razorpay' : 'not configured'}` : ''}`);

section('Database');
if (env.DATABASE_URL) {
  const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
  try {
    const applied = new Set((await prisma.$queryRawUnsafe('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL')).map((r) => r.migration_name));
    const all = fs.readdirSync(path.join(here, '../prisma/migrations')).filter((d) => /^\d/.test(d));
    const pending = all.filter((m) => !applied.has(m));
    pass('reachable');
    if (pending.length) fail(`${pending.length} migration(s) not applied: ${pending.join(', ')}`, 'pnpm --filter jantahr-backend migrate:deploy');
    else pass(`all ${all.length} migrations applied`);
    const unlinked = await prisma.user.count({ where: { authId: null, isActive: true } });
    if (unlinked) fail(`${unlinked} active user(s) have no Supabase sign-in`, 'pnpm --filter jantahr-backend auth:link --apply');
    else pass('every active user has a Supabase sign-in');
  } catch (e) {
    fail(`cannot use the database: ${e.message.split('\n').map((l) => l.trim()).filter(Boolean).pop()}`, 'check DATABASE_URL and that Postgres is running');
  } finally { await prisma.$disconnect(); }
}

section('Supabase Auth');
const url = (env.SUPABASE_URL || '').replace(/\/$/, '');
const publishable = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (url && publishable) {
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: publishable }, signal: timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const s = await res.json();
    pass(`reachable at ${url}`);
    if (s.external?.email) pass('email + password sign-in on'); else fail('email sign-in is off', 'Authentication > Providers > Email: enable');
    if (s.mailer_autoconfirm) warn('"Confirm email" is off: anyone can register an address they do not own', 'Authentication > Providers > Email: turn on Confirm email (needs SMTP)');
    else pass('new sign-ups must confirm their email');
    if (s.external?.google) pass('Google sign-in on'); else warn('Google sign-in off (optional)', 'Authentication > Providers > Google');
    if (s.disable_signup) warn('sign-ups disabled: new companies cannot register', 'Authentication > Providers > Email: allow new users to sign up');
  } catch (e) {
    fail(`cannot reach Supabase Auth: ${e.message}`, 'check SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY');
  }
  try {
    const jwks = await (await fetch(`${url}/auth/v1/.well-known/jwks.json`, { headers: { apikey: publishable }, signal: timeout(10000) })).json();
    if (jwks.keys?.length) pass(`session tokens verified with the project's signing keys (${[...new Set(jwks.keys.map((k) => k.alg))].join(', ')})`);
    else if (env.SUPABASE_JWT_SECRET) pass('session tokens verified with SUPABASE_JWT_SECRET (HS256)');
    else fail('no way to verify session tokens', 'set SUPABASE_JWT_SECRET (Settings > JWT Keys > Legacy JWT secret) or switch the project to asymmetric signing keys');
  } catch {
    if (env.SUPABASE_JWT_SECRET) pass('session tokens verified with SUPABASE_JWT_SECRET (HS256)');
    else fail('signing keys unavailable and SUPABASE_JWT_SECRET not set', 'set SUPABASE_JWT_SECRET');
  }
  if (secret) {
    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) fail(`secret key rejected: ${error.message}`, 'create a new secret key in Settings > API keys');
    else pass('secret key accepted: the API can create, disable and reset employee sign-ins');
  }
  console.log('  · not checkable from here, set in the dashboard: redirect URL <web>/auth/callback (Authentication > URL Configuration),\n    custom SMTP (Authentication > Emails), minimum password length 8 (Authentication > Policies)');
}

section('File storage');
if (env.STORAGE_DRIVER === 's3') {
  const { S3Client, HeadBucketCommand } = await import('@aws-sdk/client-s3');
  const s3 = new S3Client({ region: env.AWS_REGION || 'ap-south-1', ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT, forcePathStyle: true } : {}) });
  try { await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET })); pass(`bucket ${env.S3_BUCKET} reachable`); }
  catch (e) {
    if (env.STORAGE_AUTO_CREATE_BUCKET === 'true' && e.$metadata?.httpStatusCode === 404) warn(`bucket ${env.S3_BUCKET} does not exist yet; the API creates it at start`);
    else fail(`bucket ${env.S3_BUCKET}: ${e.name}`, 'check S3_ENDPOINT, S3_BUCKET and the Storage S3 access keys (Storage > Settings > S3 connection)');
  }
} else warn('files are stored on local disk (UPLOAD_DIR)', 'fine for one server; set STORAGE_DRIVER=s3 on Vercel or with several API instances');

section('Web app');
const webEnv = path.join(here, '../../frontend/.env.local');
if (fs.existsSync(webEnv)) {
  const web = Object.fromEntries(fs.readFileSync(webEnv, 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
  if (!web.NEXT_PUBLIC_SUPABASE_URL || !web.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) fail('web app has no Supabase URL / publishable key', 'set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in packages/frontend/.env.local');
  else if (web.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '') !== url) fail(`web signs in at ${web.NEXT_PUBLIC_SUPABASE_URL} but the API trusts ${url || '(unset)'}`, 'point both at the same Supabase project');
  else pass('web app and API use the same Supabase project');
  if (Object.keys(web).some((k) => k.startsWith('NEXT_PUBLIC_') && /SECRET|SERVICE_ROLE/.test(k))) fail('a secret key is exposed through a NEXT_PUBLIC_ variable', 'remove it from packages/frontend/.env.local and rotate the key');
} else warn('packages/frontend/.env.local not found (checked on the web project in production)');

console.log(problems ? `\n${problems} problem(s) to fix.` : '\nAll checks passed.');
process.exit(problems ? 1 : 0);
