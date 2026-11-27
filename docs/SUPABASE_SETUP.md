# Supabase Setup

FindMaids uses Supabase Postgres for Prisma data, Supabase Storage for media and private payment documents, and Supabase Auth (GoTrue) for **account credentials** — sign-up, sign-in and password changes. Never place the Supabase service-role key in browser code or a `NEXT_PUBLIC_*` variable.

## Auth (sign-up and sign-in)

Supabase Auth owns the password. Every registration creates an `auth.users` row (Authentication > Users), every sign-in is a Supabase password grant, and password reset/change writes through the Supabase Admin API. The profile row in `User` stays the source of truth for the app's own rules; `User.supabaseUserId` links the two.

| Concern | Owner |
| --- | --- |
| E-mail + password, password hashing, password policy | **Supabase Auth** (`auth.users`) |
| Roles (`VISITOR`/`AGENCY`/`STAFF`/`ADMIN`), disabled accounts, admin TOTP | `User` row + `auth.ts` |
| E-mail verification link (`/api/verify-email`) | The app (Resend), gated by `User.emailVerified` |
| Session cookie, RBAC, impersonation | The app (Auth.js JWT, `AUTH_SECRET`) |

Because the app sends its own verification mail, identities are created with `email_confirm: true`: Supabase must neither block the password grant nor send a second e-mail. Sign-in still fails until `User.emailVerified` is set by `/api/verify-email`.

Required configuration:

```env
SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"   # create/update/delete identities
SUPABASE_ANON_KEY="<anon-key>"                    # preferred key for the password grant
SUPABASE_AUTH_DISABLED="false"                    # "true" keeps the local bcrypt path
```

Deploy the two keys as Worker secrets (`npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`, `npx wrangler secret put SUPABASE_ANON_KEY`); `SUPABASE_URL` is already a `wrangler.jsonc` var.

Two dashboard settings matter:

1. **Authentication > Providers > Email must be enabled.** With it off, GoTrue answers every password grant with `422 email_provider_disabled` ("Email logins are disabled") and nobody can sign in.
2. **Authentication > Users** is where identities appear. No template work is needed: the app sends its own confirmation and reset e-mails, so Supabase's confirmation/recovery templates are unused.

To make a misconfigured project fail loudly instead of quietly, `/api/register` performs the password grant before reporting success and deletes the identity again if the project cannot sign the account in — a disabled provider surfaces as "Account creation is temporarily unavailable" rather than an account that can never log in. Sign-in logs `Supabase password grant did not complete` with the GoTrue reason whenever the failure is not a plain wrong password.

Optional: enable leases in Authentication > Sessions if you want Supabase-side session limits — the app does not rely on them.

### Existing accounts

Accounts created before this integration keep their bcrypt row and sign in as before. The first successful sign-in creates the matching Supabase identity (with the password the user just proved, or by reusing the identity that already has that address) and stores `User.supabaseUserId`, so every later sign-in is a Supabase password grant. No bulk import or forced password reset is needed.

### Operating notes

- A linked account is decided by Supabase alone. If an identity is deleted in the dashboard, that account can no longer sign in, even though the old bcrypt hash is still in the table.
- Password reset (`/api/reset-password`) and the agency change-password form update Supabase first and then stamp `User.passwordChangedAt`, which invalidates existing app sessions.
- Sign-in keeps its existing rate limit (10 attempts / 15 minutes per IP + identifier); a Supabase outage fails closed with the generic "email or password is incorrect" message.
- Registration answers with the same neutral message when the address already exists, so the form cannot be used to enumerate accounts.
- Display-only E2E runs set `SUPABASE_AUTH_DISABLED=true` (`playwright.display.config.ts`) so they never touch the real project; unit tests set it in `vitest.config.mts`.
- To disable the integration entirely, set `SUPABASE_AUTH_DISABLED=true`: new accounts are stored with a bcrypt hash again and every account falls back to the local hash. Accounts created while Supabase was active have no local hash, so disabling it locks them out — re-enable or reset their passwords first.

## Database

1. Create a Supabase project and enable the `vector` extension in Database > Extensions before applying Prisma migrations.
2. Set `DATABASE_URL` to the project transaction-pooler URL for runtime. Use the pooler hostname and port shown in your project dashboard; port `6543` is common. Retain `pgbouncer=true` and use a small `connection_limit` for Prisma serverless connections.
3. Set `DIRECT_URL` to the **Session pooler** string (port `5432`, user `postgres.<project-ref>`). The `db.<ref>.supabase.co` direct host is IPv6-only and fails on many networks. Prisma migrations use this URL.
4. Keep both URLs in local ignored `.env` or the hosting secret store. URL-encode reserved password characters.
5. Generate the Prisma client and deploy migrations:

```powershell
npx prisma generate
npx prisma migrate deploy
npm run seed
```

The included `.env.example` has placeholders only. Replace the project ref, region and password with values from your Supabase dashboard. Never commit a populated `.env`.

## Staging project (ref `tajpujqabclbxoggkxse`)

Staging only; production uses its own project. Supabase databases are always named `postgres`, so write-safety is enforced by `lib/security/staging-guard.ts`: `APP_ENV` must be `staging` or `test`, and `STAGING_PROJECT_REF` must appear in both `DATABASE_URL` and `DIRECT_URL`. All write scripts go through `npm run staging:run`.

**Extension:** `vector` (installed in the `extensions` schema).

**Tables (32 app tables + `_prisma_migrations`):** AdminSetting, AdPlacement, Agency, AgencyAiSettings, AgencyOnboardingDraft, AgencyPhoto, AiCallLog, AiFeedback, AnalyticsEvent, AuditLog, BlockList, Conversation, CookieConsent, DataDeletionRequest, EmailVerificationToken, Enquiry, FeatureFlag, HandoffRequest, InvoiceSequence, KnowledgeDocument, Message, PasswordResetToken, Payment, PaymentWebhookEvent, Plan, Prospect, RateLimitBucket, Report, Review, Subscription, SubscriptionNotice, User. Vector data: `KnowledgeDocument.embedding vector(1536)` with HNSW index `KnowledgeDocument_embedding_hnsw_idx`.

**Row Level Security:** enabled on every public table with no policies, so Supabase's public API (anon/authenticated) cannot read or write app data. The app connects with the owning database role, which bypasses RLS. Migration `20261103000000_enable_rls` applies this to existing tables; **any new table in a later migration must also `ENABLE ROW LEVEL SECURITY`.** `storage.objects` has RLS on with no permissive policy, so only the service role can write or read private files.

**Recreate from scratch**

1. Create an empty project (Singapore) and enable `vector`.
2. Paste `supabase/staging-setup.sql` into the SQL Editor and run it once. It is one transaction, creates the schema, the HNSW index, RLS and both buckets, and refuses to run twice.
3. Fill **profile B** of the single Git-ignored `.env` (there is no `.env.staging`) with the pooler URLs, `STAGING_PROJECT_REF`, `APP_ENV=staging`, `SUPABASE_URL` and the service-role key.
4. Record the baseline: `npx --no-install prisma migrate resolve --applied <name>` for each folder in `prisma/migrations` that the SQL already contains, then `npm run db:deploy` for the rest.
5. Verify: `npx --no-install tsx scripts/verify-staging-db.ts` (tables, vector index, RLS) and `scripts/verify-staging-storage.ts` (buckets, limits, signed URLs; deletes its own test files). These are guarded, so `APP_ENV` and `STAGING_PROJECT_REF` must be present in `.env`.

## Storage Buckets

Bucket limits: `findmaids-media` is public, 5 MB, JPG/PNG/WebP. `findmaids-private` is private, 10 MB, PDF/JPG/PNG/WebP (the app allows payment proof up to 8 MB).

Create two buckets in Supabase Storage:

- `findmaids-media`: public reads for agency listing images. App uploads require an authenticated agency and image validation.
- `findmaids-private`: private bucket for bank-transfer proofs and invoice PDFs. Do not allow public access or anonymous reads.
- `findmaids-backups`: private bucket written by `npm run db:backup` (`pg_dump`
  archives + manifests). Created automatically when missing; see
  [BACKUP_RESTORE.md](BACKUP_RESTORE.md).

The server-only `SUPABASE_SERVICE_ROLE_KEY` is used by `lib/storage.ts`. Private object routes first verify agency ownership or ADMIN permission. Keep the key in a secret manager and rotate it if exposed.

Set these server environment variables:

```dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
SUPABASE_MEDIA_BUCKET=findmaids-media
SUPABASE_PRIVATE_BUCKET=findmaids-private
```

Supabase Storage is the only object-storage implementation. Populate these values in development and production; storage operations return a configuration error until they are set.

## AI Demo Flags

The employer assistant, agency reply draft, and profile helper are deterministic workflows. They do not call Claude, Make.com, or any external model, and are disabled by default. An ADMIN can enable them in Admin > Settings > `featureFlags`. Reply and profile suggestions are drafts only. Agency-scoped `FeatureFlag` records override the global setting.

## Make.com AI and Embeddings

`AI_PROVIDER=make` uses `AI_WEBHOOK_URL` for generation/moderation and `AI_EMBEDDINGS_WEBHOOK_URL` for embeddings. Both are disabled when the URLs are absent. The embeddings webhook receives `{action:"embed",text,dimensions:1536}` and must respond with exactly 1536 numeric values in `{embedding:[...]}`. Protect it with `AI_WEBHOOK_SECRET`; implement the same Bearer token validation in the Make scenario. Never log unmasked request text in Make history; configure scenario data retention accordingly.

Claude is selected only with `AI_PROVIDER=claude` and a server-side `AI_API_KEY`. `AI_PROVIDER=mock` remains the default and requires no provider credentials. Redis-backed jobs need `REDIS_URL` and `npm run jobs:worker`; see [JOBS.md](JOBS.md).
