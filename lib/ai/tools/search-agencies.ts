import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { embedLoggedText } from "@/lib/ai/call";

export const searchAgenciesInput = z.object({
  city: z.string().trim().min(1).optional(),
  services: z.array(z.string().trim().min(1)).max(10).default([]),
  limit: z.number().int().min(1).max(20).default(10),
});

export type SearchAgenciesInput = z.infer<typeof searchAgenciesInput>;

export async function searchAgencies(input: SearchAgenciesInput) {
  const query = searchAgenciesInput.parse(input);
  const agencies = await prisma.agency.findMany({
    where: {
      status: "APPROVED",
      ...(query.city
        ? { city: { contains: query.city, mode: "insensitive" } }
        : {}),
      ...(query.services.length
        ? { services: { hasSome: query.services } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      province: true,
      services: true,
      verifiedBadge: true,
      subscriptions: {
        where: { status: "ACTIVE" },
        select: { plan: { select: { name: true } } },
        take: 1,
      },
    },
    orderBy: [{ verifiedBadge: "desc" }, { name: "asc" }],
    take: 100,
  });
  let ordered = agencies;
  if (
    process.env.AI_PROVIDER &&
    process.env.AI_PROVIDER !== "mock" &&
    agencies.length > 0
  ) {
    try {
      const { embedding } = await embedLoggedText(
        `${query.city ?? ""} ${query.services.join(" ")}`,
        "agency_search_embedding",
      );
      if (embedding.length !== 1536)
        throw new Error("Expected a 1536-dimension embedding.");
      const vector = `[${embedding.join(",")}]`;
      const similarities = await prisma.$queryRaw<
        { agencyId: string; similarity: number }[]
      >(Prisma.sql`
        SELECT "agencyId", 1 - ("embedding" <=> ${vector}::vector) AS similarity
        FROM "KnowledgeDocument"
        WHERE "agencyId" IN (${Prisma.join(agencies.map((agency) => agency.id))}) AND "embedding" IS NOT NULL
        ORDER BY "embedding" <=> ${vector}::vector
      `);
      const rank = new Map(
        similarities.map((item, index) => [item.agencyId, index]),
      );
      ordered = [...agencies].sort(
        (a, b) =>
          (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
      );
    } catch {
      ordered = agencies;
    }
  }
  return {
    agencies: ordered
      .slice(0, query.limit)
      .map(({ subscriptions, ...agency }) => ({
        ...agency,
        promoted: Boolean(
          subscriptions[0] && subscriptions[0].plan.name !== "Basic Free",
        ),
      })),
    query,
    sponsoredListingsDisclosed: true,
  };
}
