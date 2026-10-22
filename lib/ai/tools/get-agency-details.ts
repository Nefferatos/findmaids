import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const getAgencyDetailsInput = z.object({
  slug: z.string().trim().min(1).max(120),
});
export type GetAgencyDetailsInput = z.infer<typeof getAgencyDetailsInput>;

export async function getAgencyDetails(input: GetAgencyDetailsInput) {
  const query = getAgencyDetailsInput.parse(input);
  const agency = await prisma.agency.findFirst({
    where: { slug: query.slug, status: "APPROVED" },
    select: {
      name: true,
      slug: true,
      description: true,
      city: true,
      province: true,
      services: true,
      languages: true,
      phone: true,
      email: true,
      website: true,
      verifiedBadge: true,
      subscriptions: {
        where: { status: "ACTIVE" },
        select: { plan: { select: { name: true } } },
        take: 1,
      },
    },
  });
  if (!agency) return { agency: null, query };
  const { subscriptions, ...details } = agency;
  return {
    agency: {
      ...details,
      promoted: Boolean(
        subscriptions[0] && subscriptions[0].plan.name !== "Basic Free",
      ),
    },
    query,
  };
}
