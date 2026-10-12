-- Scheduled jobs through Supabase pg_cron + pg_net, calling the JantaHR API directly.
-- The simplest trigger for a hosted API (JOBS_MODE=external): no Edge Function and no secret beyond the API's own
-- CRON_SECRET. Use cron.sql instead when the jobs should go through the `jobs-dispatch` Edge Function.
--
-- Run once in the SQL editor after creating the two Vault secrets. Times are UTC (IST - 5:30). Re-running replaces
-- the schedules, and both files use the same schedule names, so applying one replaces the other.
--
--   select vault.create_secret('https://<site>/api/internal/jobs', 'jantahr_api_jobs_url');
--   select vault.create_secret('<the API''s CRON_SECRET>', 'jantahr_cron_secret');
--
-- Every job takes an advisory lock and is idempotent, so it is safe for Vercel Cron to fire the same job as well.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.jantahr_run_job(job text) returns bigint language sql security definer set search_path = '' as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'jantahr_api_jobs_url') || '/' || job,
    headers := jsonb_build_object('content-type', 'application/json',
                                  'authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'jantahr_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$$;
revoke all on function public.jantahr_run_job(text) from public;
do $$ declare api_role text; begin
  foreach api_role in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = api_role) then
      execute format('revoke all on function public.jantahr_run_job(text) from %I', api_role);
    end if;
  end loop;
end $$;

select cron.schedule('jantahr-nightly',      '40 18 * * *',   $$ select public.jantahr_run_job('attendance-finalise') $$);   -- 00:10 IST
select cron.schedule('jantahr-housekeeping', '15 21 * * *',   $$ select public.jantahr_run_job('privacy-housekeeping'), public.jantahr_run_job('billing-sweep') $$); -- 02:45 IST
select cron.schedule('jantahr-accrual',      '0 19 $ * *',    $$ select public.jantahr_run_job('leave-accrual') $$);         -- 00:30 IST on the 1st
select cron.schedule('jantahr-rollover',     '45 18 31 12 *', $$ select public.jantahr_run_job('leave-rollover') $$);        -- 00:15 IST, 1 Jan
select cron.schedule('jantahr-billing-inbox','*/10 * * * *',  $$ select public.jantahr_run_job('billing-inbox') $$);
