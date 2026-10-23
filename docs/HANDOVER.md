# Technical Handover

## Architecture

Next.js App Router / React application with Prisma/PostgreSQL (pgvector), Supabase Storage, Auth.js credentials/optional Google, bcrypt password hashes, TOTP for ADMIN, BullMQ/Redis background jobs, Resend email, PayMongo payment adapter, and optional Make.com/Claude AI adapters. See `AI_ARCHITECTURE.md`, `JOBS.md`, `DATA_MAP.md`, and `SUPABASE_SETUP.md`.

## Accounts and secrets

Create owner-controlled accounts for the chosen host, Supabase, Redis, domain/DNS, Resend, PayMongo, Make.com, Sentry, uptime monitor, Google Search Console/GA4, and GitHub. Store secrets only in each environment's secret manager. `.env.example` names variables; `ENVIRONMENT.md` explains boundaries. Hosting provider remains undecided.

## Operations

The assumptions-led agency acquisition and pricing-validation plan is documented in [GO_TO_MARKET_PLAN.md](GO_TO_MARKET_PLAN.md). Prices and lead targets there are hypotheses, not approved market facts.

- Add a plan: ADMIN > Plans, review the new quote and limits in staging, then communicate the change. Existing subscriptions preserve accepted terms.
- Manage prospects: ADMIN > Prospects; enter the source for business contact details, set an owner and next action, import/export CSV, and move stages. `DO_NOT_CONTACT` prevents reactivation/outreach. No messages are sent from this tracker.
- Founding agencies: ADMIN > Founding Agencies grants up to 365 days of Gold-level plan entitlements without charge. Default suggested term is 90 days. Expiry downgrades to Basic without payment. Outbound reminders/expiry email remain disabled unless `FOUNDING_PERIOD_EMAILS_ENABLED=true` is explicitly approved.
- Lead-cap behavior: `LEAD_CAP_MODE=DELIVER_ALL` is the default and does not lock details. `LOCK_DETAILS` locks only the current UTC-month over-cap tail and requires an upgrade; every valid employer submission is saved and the agency notified. The employer request is never rejected because of the agency cap.
- Reports: ADMIN > Reports includes analytics-consented anonymous visitors/chat funnel, weekly source/city/channel attribution, agency response metrics, and a provisional slow-response list. Agency first-response times are visible only to that agency and admins; do not make public promises until thresholds are approved.
- Step 7 schema: apply migration `20261024100000_step7_product` after backup and approval. It adds response/acquisition fields, the Prospect model, founding-period fields and founding placement markers. Prospect imports require contact-source data; DNC is sticky; request deletion requires a verified reference and audit.
- Approve agencies: ADMIN > Approvals; verify license/contact/profile/media and checklist, record decision and evidence.
- Reconcile bank payments: ADMIN > Payments; compare exact received amount/reference/proof, reject duplicates/mismatches, record note and audit trail.
- Enable AI gradually: keep all flags off, verify kill switch, provider contracts, PII masking, budget caps, FAQ/knowledge grounding and support path in staging; enable only limited reviewed features. Reply mode is DRAFT only; no auto-send.
- Run migrations: back up first; use `npm run db:deploy` against the named environment only after approval. Never run local seed against production. CI applies migrations only to an ephemeral database.
- Seed the production catalog only after owner review of prices and FAQ wording: set `NODE_ENV=production` and `CONFIRM_PRODUCTION_CATALOG_SEED=SEED_REVIEWED_CATALOG_ONLY`, then run `npm run seed:production-catalog`. It creates/updates plans and FAQ only, never users, agencies, or enquiries.
- Promote the initial ADMIN after account creation and email verification: set `ADMIN_EMAIL` and `CONFIRM_ADMIN_PROMOTION` to the exact same address and run `npm run admin:promote`. Enroll TOTP immediately; the script creates no password.
- Restore backups: follow `BACKUP_RESTORE.md`; current restore drill is not yet completed.

## Initial ADMIN

Do not ship a default password. Create an account through controlled registration/email verification, then promote the verified account using a reviewed one-time database procedure with two-person oversight. Enroll and test TOTP before removing bootstrap access. Keep a break-glass process documented outside this repository.

## Deployments and rollback

Host has not been selected. Once decided, document immutable release identifiers, health checks, secrets, custom domain, CDN behavior, scheduled jobs, and rollback operator. Use expand/contract database changes: additive migration first, compatible app deploy second, cleanup migration only in a later release. Roll back code independently; use a tested restore for destructive data changes.
