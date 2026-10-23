import { prisma } from "@/lib/prisma";
import { countLockedLeads, getLeadCapMode } from "@/lib/leads/cap";

export function monthStartUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getAgencyLeadAllowance(agencyId: string, now = new Date()) {
  const start = monthStartUtc(now);
  const [subscription, basicPlan, monthlyCount] = await Promise.all([
    prisma.subscription.findFirst({
      where: {
        agencyId,
        status: "ACTIVE",
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.plan.findUnique({ where: { name: "Basic Free" } }),
    prisma.enquiry.count({ where: { agencyId, createdAt: { gte: start } } }),
  ]);
  const currentPriority = subscription?.plan.listingPriority ?? 0;
  const upgradePlan = await prisma.plan.findFirst({
    where: { isActive: true, listingPriority: { gt: currentPriority } },
    orderBy: { listingPriority: "asc" },
  });
  const monthlyLimit = subscription ? subscription.plan.leadLimit : (basicPlan?.leadLimit ?? null);
  const mode = getLeadCapMode();
  const overLimitCount = monthlyLimit === null ? 0 : Math.max(0, monthlyCount - monthlyLimit);
  const lockedCount = countLockedLeads(mode, monthlyLimit, monthlyCount);
  const lockedLeads = lockedCount === 0
    ? []
    : await prisma.enquiry.findMany({
        where: { agencyId, createdAt: { gte: start } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: monthlyLimit ?? 0,
        take: lockedCount,
        select: { id: true },
      });
  const lockedIds = new Set(lockedLeads.map((lead) => lead.id));
  return {
    mode,
    start,
    monthlyCount,
    monthlyLimit,
    overLimitCount,
    lockedCount,
    lockedIds,
    planName: subscription?.plan.name ?? basicPlan?.name ?? "Basic Free",
    planFeatures: subscription?.plan.features ?? basicPlan?.features ?? [],
    upgradePlanName: upgradePlan?.name ?? null,
    upgradePlanFeatures: upgradePlan?.features ?? null,
    upgradePriceMonthly: upgradePlan ? Number(upgradePlan.priceMonthly) : null,
  };
}
