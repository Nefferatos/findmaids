import type { Prisma } from "@prisma/client";

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
 * Where-clause fragment that hides sample agencies when they are not allowed.
 * Written as `OR` (so `adminNote IS NULL` rows are kept) and intended to be
 * pushed into the `AND` array of a query so it composes with other filters.
 */
export function sampleAgencyVisibilityWhere(
  env: Env = process.env,
): Prisma.AgencyWhereInput | null {
  if (sampleDataEnabled(env)) return null;
  return {
    OR: [{ adminNote: null }, { adminNote: { not: SAMPLE_AGENCY_MARKER } }],
  };
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
