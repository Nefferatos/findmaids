# Backup and Restore

## Current status

Automated daily Supabase backups, retention windows, point-in-time recovery entitlement, object versioning, and a successful restore test have **not** been verified. Do not claim backups are operational until the owner records provider settings and completes the restore drill below. No production backup operation was run. Backup configuration and a tested restore remain a **launch blocker**.

## Manual dump into a Supabase Storage bucket

`prisma migrate` only creates or alters **schema**; it never copies rows. Copying
data is `pg_dump` → `pg_restore`, wrapped by two scripts that follow this repo's
guard and secret-handling rules:

```powershell
npm run db:backup                       # dump + upload (uses the active .env profile)
npm run db:backup -- --no-upload        # dump only, kept in ./backups/
npm run db:backup -- --schema=public --bucket=findmaids-backups
npm run db:backup -- --delete-local     # remove the local copy after a successful upload
```

What it does:

1. Reads `DIRECT_URL` (session pooler, port 5432 — never the 6543 transaction
   pooler, which breaks long dumps) and passes host/user/password to `pg_dump` as
   `PG*` environment variables, so the password never appears in the process list
   and Prisma-only parameters (`?schema=`, `pgbouncer=true`) are never sent.
2. Dumps the active schema (`DATABASE_SCHEMA`; `public` on the staging project) in
   custom format with `--no-owner --no-privileges`, so it restores into another
   Supabase project without role conflicts.
3. Writes `<name>-manifest.json` beside the archive: timestamp, source host,
   schema, database size, `pg_dump`/server versions, sha256 and exact row counts
   per table.
4. Uploads both files to `<SUPABASE_BACKUP_BUCKET>/db/<schema>/<stamp>/` with the
   service-role key. The bucket is created **private** when missing.

Requirements: PostgreSQL client tools 16+ on `PATH` (`pg_dump --version`) and
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env`. Supabase caps object size
by plan (50 MB on Free), so a larger dump needs a paid plan or external storage.
Creating a bucket with an explicit limit above that ceiling fails with
`413 EntityTooLarge`; the script then retries without an explicit limit and the
project-wide cap applies.
`./backups/` is git-ignored: dumps contain personal data — never commit or paste
them into tickets or chat.

## Copy a database to another project

Schema and data are separate steps, which is why "migrate" alone does not do it:

1. Target project: enable the `vector` extension (the restore also attempts
   `create extension if not exists vector with schema extensions`).
2. Point `.env` at the **source** and run `npm run db:backup`.
3. Point `.env` at the **target** (`APP_ENV=staging|test`, `STAGING_PROJECT_REF`
   present in both URLs), then:

```powershell
npm run db:restore -- --file=backups/<file>.dump --confirm=<target host>
# or straight from the bucket (downloads first, then restores)
npm run db:restore -- --key=db/<schema>/<stamp>/<file>.dump --confirm=<target host>
```

4. The restore compares row counts with the manifest and exits non-zero on a
   mismatch. Use `--drop-existing` only on a target you may wipe; `--strict` aborts
   on the first `pg_restore` error.
5. Storage objects are **not** part of a dump. Copy `findmaids-media` and
   `findmaids-private` separately (Supabase CLI `supabase storage cp -r`, or
   list/download/upload through the storage API), otherwise rows point at missing
   files.

Local targets (`127.0.0.1`, `localhost`, private ranges) skip the staging guard;
any remote target must pass it, so a production overwrite cannot happen by accident.

## Configure before launch

1. Confirm the Supabase plan supports the required automated backup/PITR window; record schedule, retention, region, encryption, and owner in the operations register.
2. Enable database backups and test a restore into a separate staging project. Never restore over production as a test.
3. Back up Supabase Storage separately. Enable supported object versioning/retention or implement an approved cross-account object backup; verify private bank proof and invoice objects are included.
4. Store credentials in the host secret manager, restrict access, enable MFA, and keep restore credentials separate from application credentials.
5. Document invoice/legal retention and legal holds before configuring deletion schedules.

## Restore drill

1. Open a change/incident record and identify a timestamped backup.
2. Create an isolated restore target in the approved region and restrict network access.
3. Restore database and storage snapshot; do not use production secrets or send emails/payments.
4. Apply no migrations until database integrity and required extensions (including `vector`) are confirmed.
5. Run `npx prisma migrate status`, health checks, and read-only smoke checks for agency directory, plans, invoices, and enquiry counts.
6. Verify row counts/referential integrity and private-object retrieval using a test account.
7. Record source snapshot, duration, data-loss window, validation evidence, deviations, operator, and sign-off here.
8. Destroy isolated restore data under the approved secure disposal procedure.

## Drill record

- Last successful restore: **NOT RUN**
- Target RPO / RTO: `[OWNER TO SET]`
- Backup retention: `[OWNER TO SET]`
- Storage object versioning/backup: `[OWNER TO CONFIGURE AND TEST]`
- Restore operator and reviewer: `[OWNER TO ASSIGN]`
