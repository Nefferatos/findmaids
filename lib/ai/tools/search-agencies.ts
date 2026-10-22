import { z } from "zod";
import { prisma } from "@/lib/prisma";

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
    take: query.limit,
  });
  return {
    agencies: agencies.map(({ subscriptions, ...agency }) => ({
      ...agency,
      promoted: subscriptions[0]?.plan.name !== "Basic Free",
    })),
    query,
    sponsoredListingsDisclosed: true,
  };
}
