/**
 * Applies pending migrations through a direct (session) connection.
 * Supabase: DATABASE_URL points at the transaction pooler (port 6543, ?pgbouncer=true) for the app, which cannot run
 * migrations; DIRECT_URL is the direct or session-pooler connection (port 5432). Falls back to DATABASE_URL.
 */
const { execSync } = require('child_process');
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL (and DIRECT_URL on Supabase) before migrating');
  process.exit(1);
}
if (process.env.SKIP_MIGRATIONS === 'true') {
  console.log('SKIP_MIGRATIONS=true, not migrating');
  process.exit(0);
}
execSync('npx prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });
