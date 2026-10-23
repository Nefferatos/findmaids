# Backup and Restore

## Current status

Automated daily Supabase backups, retention windows, point-in-time recovery entitlement, object versioning, and a successful restore test have **not** been verified. Do not claim backups are operational until the owner records provider settings and completes the restore drill below. No production backup operation was run. Backup configuration and a tested restore remain a **launch blocker**.

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
