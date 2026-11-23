import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Sample/demo data control.
 *
 * Demonstration agencies and maid profiles are stored with recognisable markers
 * (`Agency.adminNote = "findmaids:sample-data"`, `Maid.isSample = true`) so they
 * can be seeded into a database with plain SQL and removed again in one
 * statement:
 *
 *   supabase/ALL-IN-ONE-sample-setup.sql   – insert the samples
 *   supabase/009-remove-sample-data.sql    – delete them before launch
 *
 * This module decides whether the running app is allowed to show those rows.
 *
 * On a live deployment the filter is deliberately broader than the two markers:
 * rows written by older/misconfigured seeds are still recognised by their
 * fabricated contact details (`.test` e-mail, `TEST-`/`E2E-` licence number) and
 * by names only a fixture would use (`… (Demo)`, `TEST Agency …`). Markers are
 * what new seeds must write; the extra signatures are the safety net for rows
 * that already reached the shared database.
 *
 * Visibility matrix
 * ┌──────────────────────────────────────┬───────────────────────────────┐
 * │ Runner                               │ Samples shown?                │
 * ├──────────────────────────────────────┼───────────────────────────────┤
 * │ `npm run dev` (localhost)            │ yes                           │
 * │ `npm run build && npm start` (local) │ no  (NODE_ENV=production)     │
 * │ Cloudflare / Vercel production       │ no  (APP_ENV=production, …)   │
 * │ Staging/preview + SHOW_SAMPLE_DATA   │ yes (opt-in, explicit)        │
 * │ Any deployment with APP_ENV=production, VERCEL_ENV=production,       │
 * │ CF_PAGES=production or ENVIRONMENT=production → always no, even      │
 * │ with SHOW_SAMPLE_DATA=true.                                          │
 * └──────────────────────────────────────┴───────────────────────────────┘
 *
 * Note that `NODE_ENV` is baked in as "production" by `next build`, so it can
 * never be used on its own to identify the live site — the explicit
 * `APP_ENV`/`VERCEL_ENV`/`CF_PAGES`/`ENVIRONMENT` markers do that.
 */

export const SAMPLE_AGENCY_MARKER = "findmaids:sample-data";

/**
 * `Agency.adminNote` prefixes reserved for demo/test tooling. An older banner
 * seed wrote `demo:homepage-banner`; recognising the prefix means a seed that
 * forgot the marker still cannot leak onto the live site.
 */
export const SAMPLE_ADMIN_NOTE_PREFIXES = ["demo:", "test:"] as const;

/**
 * `adminNote` values that mark an agency as demonstration data. Both are
 * hidden on a live deployment and removed by `supabase/009-remove-sample-data.sql`.
 */
export const SAMPLE_AGENCY_MARKERS = [
  SAMPLE_AGENCY_MARKER,
  "demo:homepage-banner",
] as const;

/**
 * Name fragments only test fixtures use (`Casa Care (Demo)`, `TEST Agency A`,
 * `Demo Agency (Test Only)`, …). A real agency is named after its business, so a
 * live deployment must never list a row that matches one of these.
 */
export const SAMPLE_AGENCY_NAME_HINTS = [
  "(demo)",
  "(test only)",
  "demo agency",
  "test agency",
  "sample agency",
  // Matches "E2E Household Agency", "E2E Founding Agency 1699…", etc.
  "e2e ",
] as const;

/** `.test` is a reserved TLD: only fixtures, seeds and E2E suites use it. */
export const SAMPLE_EMAIL_SUFFIX = ".test";

/** Licence numbers fabricated by seeds and CI: `TEST-A-0001`, `E2E-TEST-001`, … */
export const SAMPLE_LICENSE_PREFIXES = ["TEST", "E2E"] as const;
export const SAMPLE_LICENSE_HINT = "-TEST-";

type Env = Record<string, string | undefined>;

/**
 * True when the process is a real live deployment. These markers are set by
 * `wrangler.jsonc` (APP_ENV/Vercel/Cloudflare Pages) and can never be
 * overridden by SHOW_SAMPLE_DATA.
 */
export function isLiveDeployment(env: Env = process.env): boolean {
  return (
    env.APP_ENV === "production" ||
    env.VERCEL_ENV === "production" ||
    env.CF_PAGES === "production" ||
    env.ENVIRONMENT === "production"
  );
}

/**
 * Whether sample agencies/maids may be rendered.
 *
 * - live deployment → never
 * - `SHOW_SAMPLE_DATA=false` → never
 * - `SHOW_SAMPLE_DATA=true` → yes (staging/preview demo builds; a live
 *   deployment is still blocked by the check above)
 * - otherwise → only when not a production build, i.e. `npm run dev`
 */
export function sampleDataEnabled(env: Env = process.env): boolean {
  if (isLiveDeployment(env)) return false;
  if (env.SHOW_SAMPLE_DATA === "false") return false;
  if (env.SHOW_SAMPLE_DATA === "true") return true;
  return env.NODE_ENV !== "production";
}

/**
 * Every condition a live deployment applies to keep demonstration agencies out
 * of the directory. Exported so the cleanup SQL in `supabase/010-…` can mirror
 * the same signatures, and so tests can assert on each rule.
 *
 * Notes on nullability:
 *  - `adminNote` and `licenseNumber` are optional, and `NOT (column LIKE …)` is
 *    NULL - not true - for a missing value in Postgres. Rows without a note or
 *    licence are therefore kept with an explicit `null` branch instead of being
 *    silently hidden.
 *  - `name` and `email` are required columns, so they need no null branch.
 */
export function testAgencyExclusions(): Prisma.AgencyWhereInput[] {
  const conditions: Prisma.AgencyWhereInput[] = [
    {
      OR: [
        { adminNote: null },
        { adminNote: { notIn: [...SAMPLE_AGENCY_MARKERS] } },
      ],
    },
  ];
  for (const prefix of SAMPLE_ADMIN_NOTE_PREFIXES)
    // `adminNote` is optional: `NOT (adminNote LIKE 'demo:%')` is NULL - and so
    // filters the row out - when there is no note, so NULL is kept explicitly.
    conditions.push({
      OR: [{ adminNote: null }, { NOT: { adminNote: { startsWith: prefix } } }],
    });
  for (const hint of SAMPLE_AGENCY_NAME_HINTS)
    conditions.push({ NOT: { name: { contains: hint, mode: "insensitive" } } });
  conditions.push({ NOT: { email: { endsWith: SAMPLE_EMAIL_SUFFIX } } });
  conditions.push({
    OR: [
      { licenseNumber: null },
      {
        AND: [
          ...SAMPLE_LICENSE_PREFIXES.map((prefix) => ({
            NOT: { licenseNumber: { startsWith: prefix } },
          })),
          { NOT: { licenseNumber: { contains: SAMPLE_LICENSE_HINT } } },
        ],
      },
    ],
  });
  return conditions;
}

/**
 * Where-clause fragment that hides sample agencies when they are not allowed.
 * Composed as `AND` so it can be pushed into another `AND` array and combined
 * with the caller's filters.
 */
export function sampleAgencyVisibilityWhere(
  env: Env = process.env,
): Prisma.AgencyWhereInput | null {
  if (sampleDataEnabled(env)) return null;
  return { AND: testAgencyExclusions() };
}

/**
 * Equivalent visibility rule for maid rows. Sample maids are keyed on their own
 * `isSample` flag, so no extra join is needed.
 */
export function sampleMaidVisibilityWhere(
  env: Env = process.env,
): Prisma.MaidWhereInput | null {
  if (sampleDataEnabled(env)) return null;
  return { isSample: false };
}
