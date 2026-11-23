# Maid Migration (old ATS project → FindMaids)

Targeted transfer of maid profiles and their **photo binaries** from the old ATS
Supabase project into one agency of this FindMaids project. It is deliberately
_not_ a database restore: no other agency, table or bucket is touched, and the
source project is only ever read.

```powershell
npm run maids:migrate                                   # 0. list destination agencies + source summary
npm run maids:migrate -- --to-agency=<slug> --dry-run   # 1. full plan, no writes
npm run maids:migrate -- --to-agency=<slug> --limit 3 --confirm=<slug>   # 2. test batch
npm run maids:migrate -- --to-agency=<slug> --verify    # 3. prove rows + photo URLs
npm run maids:migrate -- --to-agency=<slug> --confirm=<slug>             # 4. the rest
```

## Where the old data lives (verified, 2026-11)

| Item              | Finding                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Profiles          | `public.app_data`, row `id = default`, JSON column `data.maids` — 174 records, all `agencyId = 1`                                          |
| Normalised mirror | `public.maids` has the same 174 rows (snake_case); the blob is authoritative for this tool                                                 |
| Photos            | bucket `ats-applications` (public), path `maids/agency-1/<referenceCode>/photos/<file>`                                                    |
| Photo links       | `photoDataUrls[]` (+ `photoDataUrl`, `photoThumbnailDataUrls`, `photoPortraitDataUrls`): 298 references, 290 present in storage, 8 missing |
| Objects in bucket | 458 files / 18.4 MB across 145 reference folders (some are not referenced by the blob)                                                     |
| Other keys        | `data.ats`, `clients`, `enquiries`, `agencyAdmins`, … are **not** migrated                                                                 |

## What the importer does

1. Reads the blob with the source service-role key (`SOURCE_*`, git-ignored `.env`).
2. Walks `maids/` → agency folders → reference folders → `photos/` (read-only listing).
3. Maps each profile explicitly to the destination `Maid` model (see the table the
   dry run prints). Nothing is inserted blindly; unknown vocabulary is normalised.
4. Downloads every referenced photo, re-encodes it exactly like the dashboard does
   (sharp, 800×800 inside, WebP q82) and uploads it to the **destination** media
   bucket under `maids/<agency-slug>/<reference>/<uuid>.webp`.
5. Creates the row with the selected `agencyId`, the new photo URLs, and an
   `AuditLog` entry `MAID_MIGRATED` carrying the source project/id/reference.
6. Records everything in `migration/maid-migrate-<agency-slug>.json` so a re-run
   resumes instead of duplicating.

### Safety rules baked in

- `--to-agency` must match an exact slug or owner email; an unknown value fails.
- A real run additionally requires `--confirm=<agency-slug>`.
- `--dry-run` performs no uploads and no database writes.
- Existing rows are **never** updated or deleted: duplicates are skipped (same
  reference, or same full name + date of birth).
- Storage keys are fresh UUIDs, so no existing object can be overwritten.
- Other agencies are untouched: every write carries the chosen `agencyId`, and the
  importer never edits RLS, plans, subscriptions or storage policies.
- Profiles import **unpublished** by default. `--publish` publishes all of them;
  `--publish-source-public` keeps the source `isPublic` flag per profile.
- `AGENCY_MAID_LIMIT` (60) is enforced; exceeding it needs `--allow-over-limit`.

## Environment

```dotenv
# read-only source (never in code, never in git)
SOURCE_SUPABASE_URL=https://<old-ref>.supabase.co
SOURCE_SUPABASE_SERVICE_ROLE_KEY=<old service role key>
SOURCE_APP_DATA_TABLE=app_data
SOURCE_APP_DATA_ID=default
SOURCE_STORAGE_BUCKET=ats-applications
```

The destination reuses the app's existing `DATABASE_URL` / `DIRECT_URL`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_MEDIA_BUCKET`. The tool
refuses to run if both Supabase URLs are the same project. `.env` is git-ignored;
rotate both service-role keys if they were ever shared outside the secret store.

## Verifying a test batch

1. Dry run, then `--limit 3 --confirm=<slug>`.
2. `npm run maids:migrate -- --to-agency=<slug> --verify` — checks the row exists,
   belongs to that agency, and every `photoUrls` entry answers 200.
3. In the app: sign in as the agency owner, open `/agency/dashboard` → maids list,
   open one imported profile and confirm the photo renders and the biodata matches.
   Imported rows are unpublished, so they are **not** on the public directory yet.
4. Only then run the remaining profiles (optionally `--publish`).

## Rollback (scoped to the imported rows)

```sql
-- ids are in migration/maid-migrate-<slug>.json (state.maids[*].destinationId)
DELETE FROM "Maid" WHERE "agencyId" = '<agencyId>' AND "id" IN ('<id1>', '<id2>');
```

Uploaded objects are listed as `photoUrls` in the same state file; delete them from
`findmaids-media` by key. Nothing else references them, so no other agency is
affected.

## Notes and known gaps

- **Capacity:** `AGENCY_MAID_LIMIT` in `lib/maids.ts` was raised from 60 to 250
  when a 174-profile inventory was imported; `agencyMaidInclude()` now defaults to
  the same constant so the public agency page is not truncated at 60. The agency
  dashboard already lists every profile.
- `passportNo`, `evaluationMethods` and `agesOfChildren` have no destination
  column: the first two are dropped, the last is appended to `notes`.
- Education labels arrive with mixed encodings (`10â€“12 yrs`, `10Ã¢â‚¬â€œ12 yrs`,
  `10~12 yrs`); they are repaired and normalised to the four portal labels, and the
  original value is kept in `notes` when it differs.
- Placements like `Ex-Singapore Helper`, `New to Singapore`, `Transfer Helper`
  are aliased to the portal vocabulary (`Ex-Singapore maid`, `New maid`,
  `Transfer maid`).
- `public.ats-applications` is a public bucket in the old project; treat the
  downloaded images as already exposed and rotate the source key after the
  migration.
- Storage objects referenced by the blob but missing from the bucket are reported;
  those profiles import without the missing photo rather than failing.
