import type { MaidStatus, Prisma } from "@prisma/client";
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
export function agencyMaidInclude(take = 60): Prisma.MaidFindManyArgs {
  return {
    where: publishedMaidWhere(),
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take,
  };
}
