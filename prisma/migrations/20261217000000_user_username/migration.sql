-- Optional login handle so an account can sign in with a username instead of
-- its email address. Nullable and unique, so existing accounts are unaffected.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "username" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
