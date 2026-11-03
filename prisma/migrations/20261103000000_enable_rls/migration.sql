-- Deny Supabase's public API (anon/authenticated) all access to app data.
-- The app connects with the owning database role, which bypasses RLS. No policies are created on purpose.
-- New tables added by later migrations must enable RLS the same way.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
