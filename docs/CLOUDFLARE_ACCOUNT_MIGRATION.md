# Moving FindMaids to a different Cloudflare account

Prepared from a read-only audit of the current deployment. **Nothing was
deployed, changed, or removed** while producing this document, and no secret
values are reproduced here.

## 0. Short version

| Question                                           | Answer                                                                                                                                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare resources in use                        | **1 Worker** (`findmaids`), **Workers Assets** (binding `ASSETS`), **1 Hyperdrive config** (`HYPERDRIVE`), **1 service binding** (`WORKER_SELF_REFERENCE`), **6 secrets**, **21 vars**    |
| KV / R2 / Queues / Durable Objects / cron triggers | **None used by this app** (see §1.3 and §4)                                                                                                                                               |
| Must be recreated in the new account               | Worker, its assets, the Hyperdrive config (new id), the 6 secrets, the vars, the service binding, the `*.workers.dev` subdomain, optionally a custom domain                               |
| Can stay where it is                               | **Supabase** (database + storage), the GitHub repo, the old Worker (until you switch), legacy KV and the three unused Hyperdrive configs                                                  |
| Database                                           | **Unchanged** — same Supabase project, same schema, same data                                                                                                                             |
| DNS                                                | Today there is **no custom domain**; the site is served from the account's `workers.dev` subdomain, so a new account changes the URL                                                      |
| Blocking requirement                               | The new account must be on **Workers Paid** — the current outage is the Free plan's 10 ms CPU ceiling (deploy error `100328`), which follows the Worker to any account that is still Free |

Prepared artefacts:

- `wrangler.new-account.jsonc` — deploy configuration for the new account (placeholders marked `<...>`).
- `scripts/wrangler-var.mjs` — reads a value from a `.jsonc` config (comments + trailing commas).
- `scripts/deploy-cloudflare-windows.ps1` — new optional `-ConfigFile` parameter, default unchanged.

While preparing this, a latent bug in the deploy path was found and fixed:
`wrangler.jsonc` contains trailing commas (prettier adds them), the old inline
`JSON.parse` in the deploy script silently failed on them, and the build then lost
`NEXT_PUBLIC_SITE_URL` — falling back to `http://localhost:3000` in canonical and
e-mailed links (`lib/site-url.ts`). `scripts/wrangler-var.mjs` now parses both
configs correctly.

## 1. Current resource inventory

Account: `Wow.aisolution@gmail.com's Account`
Account ID: `1c46ba431378dac8a9784d59fffb59ce`
`workers.dev` subdomain: `wow-aisolution` → site URL `https://findmaids.wow-aisolution.workers.dev`

### 1.1 Worker and static assets

| Resource           | Detail                                                                        | Where defined                     | Recreate?                                                |
| ------------------ | ----------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------- |
| Worker script      | name `findmaids`, entry `.open-next/worker.js`                                | `wrangler.jsonc` (`name`, `main`) | **Yes** (same name is fine; names are per account)       |
| Workers Assets     | directory `.open-next/assets`, binding `ASSETS`                               | `wrangler.jsonc` (`assets`)       | **Yes** — uploaded automatically by `wrangler deploy`    |
| Compatibility      | `compatibility_date` `2026-10-25`, flag `nodejs_compat`                       | `wrangler.jsonc`                  | Copy as-is                                               |
| Compiled WASM rule | `**/*.wasm` → `CompiledWasm` (Prisma engine)                                  | `wrangler.jsonc` (`rules`)        | Copy as-is                                               |
| Observability      | enabled                                                                       | `wrangler.jsonc`                  | Copy as-is                                               |
| Service binding    | `WORKER_SELF_REFERENCE` → service `findmaids` (OpenNext caching/revalidation) | `wrangler.jsonc` (`services`)     | **Yes**, and the service name must equal the Worker name |
| Cron triggers      | **none**                                                                      | —                                 | Nothing to recreate (see §2.4)                           |

### 1.2 Hyperdrive (database connection)

Four Hyperdrive configs exist in the current account; only one is bound:

| id                                 | name                    | Origin                                                                                           | Caching                  | Used by FindMaids?                    |
| ---------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------ | ------------------------ | ------------------------------------- |
| `7b18607838664896bddab1469031d074` | `findmaids-supabase-v2` | `postgres.tajpujqabclbxoggkxse` @ `aws-0-ap-northeast-1.pooler.supabase.com:5432`, db `postgres` | disabled                 | **Yes — bound as `HYPERDRIVE`**       |
| `d50ba26e7c9a485f947c8d9efff16ef9` | `findmaids-supabase`    | same project                                                                                     | disabled                 | No (superseded)                       |
| `1d7f4175e1b547788a69a283e8fbe1ca` | `findmaids-staging-db`  | same project                                                                                     | cache settings undefined | No (staging helper)                   |
| `4fcf33197c9940d7a8d06df522252e37` | `findmaids-prod-db`     | **old ATS project** `postgres.etdbexgrsenjznxbbnbd` @ `aws-1-ap-south-1.pooler.supabase.com`     | disabled                 | **No — do not use** (legacy database) |

How the app resolves the connection (`lib/prisma.ts`):

1. `getCloudflareContext().env.HYPERDRIVE.connectionString` (preferred in the Worker),
2. otherwise the `DATABASE_URL` secret,
3. otherwise the in-memory mock (local/display runs only).

The URL is normalised with `?schema=public` and `options=-c search_path=public`
when missing, and `DATABASE_SCHEMA=public` is set as a var.

### 1.3 KV, R2, Queues, Durable Objects

| Kind                 | In account                                                                                               | Bound/used by FindMaids                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| KV                   | `APP_DATA` (`62a5ada5801547b5b0895fec94ab0b12`), `APP_DATA_preview` (`595830971f4f4125975ddcdeb627de67`) | **No** — legacy from the previous app; no binding in `wrangler.jsonc`, no code reference |
| R2                   | none used by the app (the audit token cannot even list R2 buckets)                                       | **No**                                                                                   |
| Queues               | none                                                                                                     | **No**                                                                                   |
| Durable Objects      | none                                                                                                     | **No**                                                                                   |
| OpenNext cache/queue | `open-next.config.ts` is `defineCloudflareConfig({})` → no KV/R2/DO/queue overrides                      | Nothing to provision                                                                     |

Job queue: `lib/jobs/queue.ts` uses Redis (`REDIS_URL`) when configured. It is
**not configured on the Worker**, so `enqueueJob()` returns `false` and nothing
is queued. The BullMQ worker (`npm run jobs:worker`) is a separate Node process,
not a Cloudflare resource.

### 1.4 Other Cloudflare features

| Feature                       | Status                                                         |
| ----------------------------- | -------------------------------------------------------------- |
| Custom domain / Worker routes | **None** in `wrangler.jsonc`; no zone attached to this Worker  |
| Pages / R2 / Stream / Images  | Not provisioned                                                |
| Turnstile                     | Not provisioned (keys empty, forms skip it)                    |
| Email Routing                 | Not used (email is sent through Resend and currently disabled) |

## 2. Environment variables, secrets and bindings

### 2.1 Secrets on the Worker (re-add in the new account)

Verified with `wrangler secret list` — names only:

| Secret                      | Used by                                             | Notes                                                                                                                     |
| --------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`               | NextAuth session signing, impersonation cookie      | ≥32 chars, not a placeholder, else `instrumentation.ts` refuses to start. Reusing the value keeps existing sessions valid |
| `NEXTAUTH_SECRET`           | Legacy fallback for the same secret                 | Must equal `AUTH_SECRET` (the guard rejects a mismatch)                                                                   |
| `TOTP_ENCRYPTION_KEY`       | Admin 2FA secret encryption                         | Base64 that decodes to exactly 32 bytes                                                                                   |
| `CRON_SECRET`               | `/api/cron/*` bearer token                          | Any long random string                                                                                                    |
| `SUPABASE_SERVICE_ROLE_KEY` | Storage uploads/downloads, admin API                | Supabase project `tajpujqabclbxoggkxse`                                                                                   |
| `DATABASE_URL`              | Fallback when Hyperdrive is unavailable; Prisma CLI | Supabase **pooled** connection string                                                                                     |

Values are in the git-ignored `.env` and your password manager. Cloudflare never
returns secret values, so copy them from there — never into the repository, an
issue, or a terminal log.

### 2.2 Vars currently on the Worker (21)

From `wrangler.jsonc`; only the two URL vars change with the account:

`APP_ENV=production`, `NODE_ENV=production`, `SHOW_SAMPLE_DATA=false`,
`DATABASE_SCHEMA=public`,
**`NEXT_PUBLIC_SITE_URL` → new account URL**, **`NEXTAUTH_URL` → new account URL**,
`SUPABASE_URL=https://tajpujqabclbxoggkxse.supabase.co` (unchanged),
`SUPABASE_MEDIA_BUCKET=findmaids-media`, `SUPABASE_PRIVATE_BUCKET=findmaids-private`,
`AUTH_TRUST_HOST=true`, `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false`,
`BUSINESS_COUNTRY=SG`, `MANUAL_BANK_TRANSFER_ENABLED=false`,
`LEAD_CAP_MODE=DELIVER_ALL`, `DATA_RETENTION_DAYS=365`,
`FOUNDING_PERIOD_EMAILS_ENABLED=false`, `AI_PROVIDER=mock`, `AI_MODEL=mock`,
`PAYMENT_PROVIDER=mock`, `EMAIL_DELIVERY_DISABLED=true`, `LOG_LEVEL=info`.

`NEXT_PUBLIC_*` values are **inlined at build time**: a build made with the old
URL keeps the old URL in the client bundle regardless of runtime vars. The
deploy script reads `NEXT_PUBLIC_SITE_URL` from the config passed via
`-ConfigFile` and exports it for the build.

### 2.3 Bindings declared by the Worker

| Binding                 | Type            | Value                        |
| ----------------------- | --------------- | ---------------------------- |
| `HYPERDRIVE`            | Hyperdrive      | new account's config id (§3) |
| `ASSETS`                | Workers Assets  | managed by `wrangler deploy` |
| `WORKER_SELF_REFERENCE` | Service binding | `findmaids` (same Worker)    |

### 2.4 Optional variables (unset today → feature off)

Carry over only if you enable the feature:

`AI_API_KEY`, `AI_WEBHOOK_URL`, `AI_WEBHOOK_SECRET`, `AI_EMBEDDINGS_PROVIDER`,
`AI_EMBEDDINGS_WEBHOOK_URL`, `AI_EMBEDDING_DIMENSIONS`, `AI_OUTBOUND_WEBHOOK_URL`,
`AI_OUTBOUND_WEBHOOK_SECRET`, `AI_TIMEOUT_MS`, `AI_TEMPERATURE`, `AI_MAX_TOKENS`,
`AI_MONTHLY_BUDGET_SGD`, `AI_DEFAULT_AGENCY_BUDGET_SGD`, `AI_SGD_PER_USD`,
`AI_INPUT_USD_PER_MILLION`, `AI_OUTPUT_USD_PER_MILLION`, `CLAUDE_API_URL`,
`RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_WEBHOOK_SECRET`, `WHATSAPP_WEBHOOK_SECRET`,
`TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `AUTH_GOOGLE_ID`,
`AUTH_GOOGLE_SECRET`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`,
`SENTRY_TRACES_SAMPLE_RATE`, `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`,
`NEXT_PUBLIC_MAINTENANCE_MESSAGE`, `DATA_REQUEST_EMAIL`, `REDIS_URL`,
`ADMIN_MFA_BYPASS` (**must stay unset/false in production**).

Cron endpoints (`/api/cron/subscriptions`, `/api/cron/admin-monthly-summary`)
have **no Cloudflare cron trigger**; they are called by an external scheduler with
`Authorization: Bearer $CRON_SECRET`. Re-point that scheduler at the new host.

## 3. Hyperdrive: recreate for the new account

The id is account-scoped, so the binding in `wrangler.jsonc` **cannot** be
reused; create an equivalent config in the new account and keep the same
behaviour (same Supabase project, caching off so edits are visible immediately).

```powershell
# 1. Authenticate against the NEW account first (section 8).

# 2. Create the config. Use the Supabase SESSION POOLER string (port 5432),
#    not the transaction pooler on 6543: the Worker does its own pooling and
#    Hyperdrive closes sockets per request.
#    The value is DIRECT_URL in .env and contains the password, so do not paste
#    it into any document or log.
npx wrangler hyperdrive create findmaids-supabase-v2 `
  --connection-string "<Supabase session pooler URL>" `
  --caching-disabled

# 3. Copy the printed id into wrangler.new-account.jsonc -> hyperdrive[0].id
```

Notes:

- The app adds `?schema=public` and `options=-c search_path=public` itself, so the
  stored connection string does not need the `schema` parameter.
- Keep `origin_connection_limit` at the default (20), like the current config.
- Do **not** point the new config at `etdbexgrsenjznxbbnbd` (the old ATS project).
- `DATABASE_URL` (secret) is only a fallback; it should reference the same new
  Supabase project.

## 4. Storage and other data stores

| Store                                                   | Location                                         | Action on migration                                                                                                        |
| ------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Postgres (agencies, maids, users, enquiries, payments…) | Supabase `tajpujqabclbxoggkxse`, schema `public` | **No change** — same database, same migrations                                                                             |
| Public media (`findmaids-media`)                        | Supabase Storage                                 | **No change** — URLs are absolute (`https://tajpujqabclbxoggkxse.supabase.co/storage/...`), independent of the Worker host |
| Private media (`findmaids-private`)                     | Supabase Storage                                 | **No change**                                                                                                              |
| Backups (`findmaids-backups`)                           | Supabase Storage                                 | **No change**                                                                                                              |
| Legacy KV `APP_DATA`                                    | Old Cloudflare account                           | Not used; leave it behind                                                                                                  |
| R2                                                      | —                                                | Not used                                                                                                                   |

## 5. What stays vs what must be recreated

| Item                                    | Stays in old account                    | Recreate in new account               |
| --------------------------------------- | --------------------------------------- | ------------------------------------- |
| Supabase project (DB + storage)         | ✅ unchanged                            | —                                     |
| GitHub repository / Actions             | ✅                                      | add new secrets if you use CI         |
| Old Worker + its deployment             | ✅ (keep until the new one is verified) | —                                     |
| Legacy KV namespaces                    | ✅ (unused)                             | —                                     |
| Unused Hyperdrive configs               | ✅                                      | —                                     |
| Worker `findmaids`                      | —                                       | ✅                                    |
| Workers Assets                          | —                                       | ✅ (automatic)                        |
| Hyperdrive `HYPERDRIVE`                 | —                                       | ✅ (new id)                           |
| 6 secrets                               | —                                       | ✅                                    |
| 21 vars, with the new URL               | —                                       | ✅                                    |
| Service binding `WORKER_SELF_REFERENCE` | —                                       | ✅                                    |
| `*.workers.dev` subdomain               | —                                       | ✅ (new account's subdomain)          |
| Custom domain / DNS zone                | —                                       | only if you want a domain (§6)        |
| CPU limit `limits.cpu_ms`               | —                                       | ✅ once the new account is Paid (§10) |

## 6. Domain and DNS

Today: **no custom domain**. The public URL is the account subdomain:
`https://findmaids.wow-aisolution.workers.dev` (`wow-aisolution` is the old
account's `workers.dev` subdomain).

Consequences of moving accounts:

- The new account has its **own** `workers.dev` subdomain, e.g.
  `https://findmaids.<new-subdomain>.workers.dev`. Update `NEXT_PUBLIC_SITE_URL`
  and `NEXTAUTH_URL` in `wrangler.new-account.jsonc` and rebuild (they are
  inlined at build time).
- `NEXTAUTH_URL` must match the host users browse, otherwise login redirects and
  cookies point at the wrong origin.
- Bookmarked links, e-mails containing the old host, and the external cron
  scheduler URL must be updated.

If you want a real domain (recommended before launch):

| Option                                             | Work required                                                                                                                                        | Notes                                                                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Keep `workers.dev`                                 | none                                                                                                                                                 | Fastest cutover; URL contains the account name                                                                      |
| Custom domain with the **zone in the new account** | move/transfer the DNS zone to the new account, then `wrangler domains add findmaids.example.com` (or `routes` + `custom_domain: true` in the config) | Cleanest: Cloudflare creates the DNS record and certificate automatically                                           |
| Custom domain with the zone in the **old account** | add a Worker route/custom domain from the old zone, or proxy a CNAME                                                                                 | `custom_domain` needs the zone in the same account; a plain CNAME to `*.workers.dev` is fragile (TLS + host header) |
| Temporary only                                     | use the new `workers.dev` host and keep the current one live                                                                                         | This is what the checklist in §9 does                                                                               |

If a domain is added later, set `NEXT_PUBLIC_SITE_URL`/`NEXTAUTH_URL` to it and
redeploy so the inlined client values change too. If Google login is ever
enabled, add the new host to the OAuth redirect URIs.

## 7. Can the Supabase project stay as it is?

**Yes.** The migration is Cloudflare-side only:

- Database: same project (`tajpujqabclbxoggkxse`), schema `public`, same rows.
  `DATABASE_SCHEMA=public` must stay in the vars.
- Migrations: already applied (`prisma migrate deploy` is a no-op); nothing to
  re-run for the migration.
- Storage: same buckets; public URLs are absolute to the Supabase host, so they
  survive the move unchanged.
- Authentication: NextAuth credentials only; sessions are JWTs signed with
  `AUTH_SECRET`. Reusing the same secret keeps existing sessions valid; rotating
  it logs everybody out.
- Network: the new Hyperdrive must be able to reach the Supabase pooler, which is
  the default. If Supabase "Network Restrictions" are enabled later, add
  Cloudflare's egress ranges or the Worker cannot connect.
- Do **not** switch to the old ATS project (`etdbexgrsenjznxbbnbd`) as a
  shortcut; `findmaids-prod-db` still points there.

## 8. Authenticating Wrangler for the new account

Two supported ways; both leave the current account untouched.

### A. Browser login (interactive)

```powershell
npx wrangler login          # choose the NEW account in the browser
npx wrangler whoami         # lists the accounts this machine may use
$env:CLOUDFLARE_ACCOUNT_ID = "<new account id>"   # keeps commands scoped
```

### B. API token (recommended for scripts and CI)

Create a token in the **new** account (My Profile → API Tokens → Create Token):

| Scope                              | Permission | Needed for                         |
| ---------------------------------- | ---------- | ---------------------------------- |
| Account → Workers Scripts          | Edit       | deploy                             |
| Account → Workers Hyperdrive       | Edit       | create/update the config           |
| Account → Account Settings         | Read       | `wrangler whoami`                  |
| Account → Workers KV / R2 / Queues | —          | not required today                 |
| Zone → Workers Routes + DNS        | Edit       | only if you attach a custom domain |

```powershell
$env:CLOUDFLARE_API_TOKEN  = "<token from the new account>"
$env:CLOUDFLARE_ACCOUNT_ID = "<new account id>"
npx wrangler whoami          # confirm the account id before deploying
```

Never echo the token, never commit it, and prefer a short expiry.
`wrangler secret put` reads values from stdin, so secret values never have to
appear on a command line.

## 9. Safe deployment checklist (nothing is switched until phase 5)

### Phase 0 — pre-flight (old account keeps running)

- [ ] Confirm the new account's **Account ID** and `workers.dev` subdomain.
- [ ] Confirm the new account is on **Workers Paid** (required for §10).
- [ ] Node 22 available (`node -v`) — Wrangler 4 requires ≥22.
- [ ] `npm ci --include=dev`, `npx tsc --noEmit`, `npx vitest run` all green.
- [ ] Record the current live version:
      `npx wrangler deployments list --name findmaids`
      (last known serving version: `a4866cac-fe2a-4687-8d80-2fd6e23cb27f`).
- [ ] Do **not** delete or modify anything in the old account yet.

### Phase 1 — create the new-account resources

- [ ] `npx wrangler hyperdrive create findmaids-supabase-v2 --connection-string "<session pooler URL>" --caching-disabled`
- [ ] Put the new id in `wrangler.new-account.jsonc` → `hyperdrive[0].id`
      (the placeholder `00000000000000000000000000000000` will not deploy).
- [ ] Set `NEXT_PUBLIC_SITE_URL` and `NEXTAUTH_URL` in that file to
      `https://findmaids.<new-subdomain>.workers.dev`.
- [ ] If you deploy under a temporary name (`findmaids-next`), change both
      `name` and `services[0].service` (they must match).
- [ ] Validate the file:
      `node scripts/wrangler-var.mjs wrangler.new-account.jsonc vars.NEXT_PUBLIC_SITE_URL`
      (prints the URL; a parse error would surface here).
- [ ] Optional dry run (bundles locally, uploads nothing):
      `npx wrangler deploy --dry-run --config wrangler.new-account.jsonc`

### Phase 2 — secrets in the new Worker

For each name below (values from `.env` / password manager):

```powershell
$env:CLOUDFLARE_ACCOUNT_ID = "<new account id>"
"<value>" | npx wrangler secret put AUTH_SECRET             --config wrangler.new-account.jsonc
"<value>" | npx wrangler secret put NEXTAUTH_SECRET         --config wrangler.new-account.jsonc
"<value>" | npx wrangler secret put TOTP_ENCRYPTION_KEY     --config wrangler.new-account.jsonc
"<value>" | npx wrangler secret put CRON_SECRET             --config wrangler.new-account.jsonc
"<value>" | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.new-account.jsonc
"<value>" | npx wrangler secret put DATABASE_URL            --config wrangler.new-account.jsonc
npx wrangler secret list --config wrangler.new-account.jsonc   # names only
```

- [ ] All six present, and `AUTH_SECRET === NEXTAUTH_SECRET`.
- [ ] Nothing was pasted into a shell history you do not control.
- [ ] If `secret put` complains that the Worker does not exist, deploy once first
      (phase 3) and then repeat phase 2 — the URL is not shared with users yet.

### Phase 3 — build + deploy to the new account

```powershell
npm run deploy:cf:win -- -ConfigFile wrangler.new-account.jsonc
```

- [ ] The build inlines the **new** URL; the log prints
      `[deploy] NEXT_PUBLIC_SITE_URL=https://findmaids.<new-subdomain>.workers.dev`.
- [ ] The `.env` is parked during the build (default) so no local secret is baked in.
- [ ] The script prunes build-only modules before upload (the unpruned bundle is
      ~59 MiB, close to Cloudflare's 63.9 MiB script limit).
- [ ] Upload succeeds and prints a new Version ID.
- [ ] The old deployment is still serving (check the old URL).

### Phase 4 — verify the new deployment (before any DNS change)

- [ ] `/` → 200, real data only (the 172 published maids of _At The Agency_).
- [ ] `/maids/search`, `/maid-agency`, `/agencies/at-the-agency` → 200.
- [ ] `/this-does-not-exist` → **404** (not 500).
- [ ] `/guides/choosing-an-agency` → 200; `/guides/nope` → 404.
- [ ] `/api/health` → 200.
- [ ] `/login` → 200, and login works (`/agency` → 200 with the agency account).
- [ ] `npx wrangler tail findmaids --config wrangler.new-account.jsonc` shows
      `outcome: ok` (not `exceededCpu`, not `exception`).
- [ ] No demo/test agencies or maids appear on the live pages.

### Phase 5 — cut over

- [ ] Share the new URL, or attach the custom domain (§6), update
      `NEXT_PUBLIC_SITE_URL`/`NEXTAUTH_URL` and redeploy.
- [ ] Re-point the external cron scheduler and any monitoring to the new host.
- [ ] If you use GitHub Actions, add the secrets/vars for the new account in the
      repository settings (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
      `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `NEXTAUTH_SECRET`,
      `TOTP_ENCRYPTION_KEY`, `CRON_SECRET`, `SUPABASE_URL`,
      `SUPABASE_SERVICE_ROLE_KEY`, plus the `NEXT_PUBLIC_SITE_URL` variable).
- [ ] Keep the old Worker for at least a few days.

### Phase 6 — rollback

- [ ] The old Worker still serves the previous URL → traffic can be pointed back.
- [ ] New account: `npx wrangler rollback <version-id> --config wrangler.new-account.jsonc`.
- [ ] DNS: revert the record to the old Worker.
- [ ] Nothing in the database needs undoing — both Workers read the same data.

## 10. After the move: enable the CPU limit (the reason for switching)

`wrangler.new-account.jsonc` already contains:

```jsonc
"limits": { "cpu_ms": 30000 }
```

It only works on **Workers Paid**; on Free the deploy fails with
`code: 100328` ("CPU limits are not supported for the Free plan"). With the paid
plan, verify:

```powershell
npx wrangler deployments list --config wrangler.new-account.jsonc
npx wrangler tail findmaids --config wrangler.new-account.jsonc   # outcome: ok
```

If the new account is still Free, remove the `limits` block and expect the same
503/1102 behaviour the current deployment has (SSR pages need ≈10–13 ms CPU;
Free allows 10 ms).

## 11. Explicit "do not" list

- Do not change DNS, the old Worker, or the old account until phase 5.
- Do not reuse the old ATS Hyperdrive config (`findmaids-prod-db`).
- Do not enable Hyperdrive caching (maid edits must be visible immediately).
- Do not rotate the database password or restore a database dump during the move.
- Do not commit `.env`, `.env.deploybak`, or any secret to git.
- Do not set `ADMIN_MFA_BYPASS=true` on the new Worker.
- Do not delete the old Supabase project, its storage buckets, or the old Worker
  as part of this migration.

## 12. What is needed from you to proceed

1. New Cloudflare **Account ID** and its `workers.dev` **subdomain**.
2. Confirmation that the new account is on **Workers Paid** (or that the `limits`
   block should be removed).
3. The **Supabase session-pooler connection string** (`.env` → `DIRECT_URL`) to
   create the Hyperdrive config — no need to paste it in chat: either run the
   command locally, or tell me to run it with the value read from `.env`.
4. Whether the final host stays `*.workers.dev` or becomes a custom domain.
5. If CI should deploy: permission to add the GitHub Actions secrets for the new
   account.
