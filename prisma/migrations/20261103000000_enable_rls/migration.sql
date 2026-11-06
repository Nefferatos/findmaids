-- Deny Supabase's public API (anon/authenticated) all access to app data.
-- The app connects with the owning database role, which bypasses RLS. No policies are created on purpose.
-- New tables added by later migrations must enable RLS the same way.
-- The schema is resolved dynamically so the migration also works when the app
-- lives in a dedicated schema (DATABASE_SCHEMA) instead of "public".
DO $$
DECLARE
  r record;
  app_schema text := current_schema();
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = app_schema LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', app_schema, r.tablename);
  END LOOP;
END $$;
