/**
 * Where scheduled jobs are triggered from:
 *  - inprocess (default): @nestjs/schedule timers inside the API (long-running Docker / VM deployments)
 *  - external: serverless (Vercel). Timers are ignored; Vercel Cron or Supabase pg_cron → Edge Function call /internal/jobs/:name
 * Jobs are idempotent and guarded by Postgres advisory locks, so running both never double-processes.
 */
export const inProcessJobs = () => process.env.JOBS_MODE !== 'external';
