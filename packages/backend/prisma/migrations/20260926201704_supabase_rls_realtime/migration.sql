-- Supabase hardening. Safe on plain PostgreSQL: Supabase-only parts are skipped when their roles/schemas are absent.
-- Kept in a function so the API can re-apply it at boot (tables added by later migrations get RLS too).
CREATE OR REPLACE FUNCTION public.jantahr_supabase_harden() RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE r record;
BEGIN
  -- 1. Every application table is behind row-level security with no policy, so Supabase's auto-generated REST and
  --    GraphQL APIs expose nothing to the anon/authenticated roles. The API connects as the table owner (bypasses RLS).
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;

  -- 2. Realtime: a signed-in browser may read only its own notifications (token minted by the API, sub = user id).
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'DROP POLICY IF EXISTS notification_owner_read ON public."Notification"';
    EXECUTE $p$CREATE POLICY notification_owner_read ON public."Notification" FOR SELECT TO authenticated USING ("userId" = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub'))$p$;
    EXECUTE 'GRANT SELECT ON public."Notification" TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'Notification') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public."Notification"';
  END IF;
END
$fn$;

SELECT public.jantahr_supabase_harden();
