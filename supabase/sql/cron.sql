-- Scheduled jobs through Supabase pg_cron + pg_net → Edge Function `jobs-dispatch` → JantaHR API.
-- Use this when the API runs on Vercel (JOBS_MODE=external). Run once in the SQL editor after setting the two
-- Vault secrets below. Times are UTC (IST - 5:30). Re-running replaces the schedules.
--
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/jobs-dispatch', 'jantahr_jobs_url');
--   select vault.create_secret('<same value as JOBS_DISPATCH_SECRET>', 'jantahr_jobs_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.jantahr_dispatch(jobs text[]) returns bigint language sql security definer as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'jantahr_jobs_url'),
    headers := jsonb_build_object('content-type', 'application/json',
                                  'x-dispatch-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'jantahr_jobs_secret')),
    body := jsonb_build_object('jobs', to_jsonb(jobs)),
    timeout_milliseconds := 120000
  );
$$;
revoke all on function public.jantahr_dispatch(text[]) from public, anon, authenticated;

select cron.schedule('jantahr-nightly',      '40 18 * * *', $$ select public.jantahr_dispatch(array['attendance-finalise']) $$);   -- 00:10 IST
select cron.schedule('jantahr-housekeeping', '15 21 * * *', $$ select public.jantahr_dispatch(array['privacy-housekeeping', 'billing-sweep']) $$); -- 02:45 IST
select cron.schedule('jantahr-accrual',      '0 19 $ * *',  $$ select public.jantahr_dispatch(array['leave-accrual']) $$);          -- 00:30 IST on the 1st
select cron.schedule('jantahr-rollover',     '45 18 31 12 *', $$ select public.jantahr_dispatch(array['leave-rollover']) $$);       -- 00:15 IST, 1 Jan
select cron.schedule('jantahr-billing-inbox','*/10 * * * *', $$ select public.jantahr_dispatch(array['billing-inbox']) $$);
