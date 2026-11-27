-- Supabase Auth now owns account credentials. This column links a profile row to
-- its `auth.users` identity. It stays null for accounts that predate the
-- integration and for deployments without Supabase Auth; such accounts keep
-- signing in with the legacy bcrypt hash and are linked on their next
-- successful sign-in.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "supabaseUserId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_supabaseUserId_key" ON "User"("supabaseUserId");
