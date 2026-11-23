import type { MaidStatus, Prisma } from "@/lib/generated/prisma/client";
import { sampleMaidVisibilityWhere } from "@/lib/sample-data";
export const maidStatusLabels: Record<MaidStatus, string> = {
  AVAILABLE: "Available",
  ON_HOLD: "On hold",
  PLACED: "Placed",
};

/** Where-clause for maids that may be shown publicly. */
export function publishedMaidWhere(agencyId?: string): Prisma.MaidWhereInput {
  const visibility = sampleMaidVisibilityWhere();
  return {
    published: true,
    ...(agencyId ? { agencyId } : {}),
    ...(visibility ? { AND: [visibility] } : {}),
  };
}

/**
 * Maid profiles an agency has published. Sample rows are filtered out
 * automatically outside local/preview environments (see lib/sample-data.ts).
 */
export function agencyMaidInclude(
  take = AGENCY_MAID_LIMIT,
): Prisma.MaidFindManyArgs {
  return {
    where: publishedMaidWhere(),
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take,
  };
}

/**
 * Maid profiles one agency may keep. The agency dashboard and the public agency
 * profile both use this ceiling, so a migrated inventory is never silently cut
 * off. It was raised from 60 when a 174-profile agency inventory was imported.
 */
export const AGENCY_MAID_LIMIT = 250;
