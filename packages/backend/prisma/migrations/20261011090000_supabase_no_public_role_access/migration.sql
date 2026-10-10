-- Supabase hardening, second pass. Safe on plain PostgreSQL: Supabase-only parts are skipped when their roles are absent.
--
-- Supabase's default privileges give its public API roles (anon, authenticated) every privilege on new tables in
-- "public". Row-level security already returns them no rows, but it does not cover TRUNCATE, REFERENCES or TRIGGER, so
-- the privileges are removed as well. The browser never reads a table: notifications arrive as Realtime broadcast pings
-- sent by the API, so the earlier per-user notification policy (written for API-minted tokens, before sign-in moved to
-- Supabase Auth) and the table's membership of the realtime publication are dropped too.
CREATE OR REPLACE FUNCTION public.jantahr_supabase_harden() RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE r record; api_role text;
BEGIN
  -- 1. Every application table is behind row-level security with no policy. The API connects as the table owner.
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
  EXECUTE 'DROP POLICY IF EXISTS notification_owner_read ON public."Notification"';

  -- 2. No privileges for the public API roles, now or on tables, sequences and functions created by later migrations.
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', api_role);
    END IF;
  END LOOP;

  -- 3. Nothing in "public" is streamed to browsers.
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'Notification') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public."Notification"';
  END IF;
END
$fn$;

-- The function is for the API (table owner) only; PUBLIC includes anon, which could otherwise call it over RPC.
REVOKE ALL ON FUNCTION public.jantahr_supabase_harden() FROM PUBLIC;
DO $$ DECLARE api_role text; BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.jantahr_supabase_harden() FROM %I', api_role);
    END IF;
  END LOOP;
END $$;

SELECT public.jantahr_supabase_harden();
