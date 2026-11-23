import { requireOwnedAgency } from "@/lib/agency";
import { agencyMenuItem } from "@/lib/agency-menu";
import { prisma } from "@/lib/prisma";
import { getAgencyLeadAllowance } from "@/lib/leads/access";
import { redactLockedLeadDetails } from "@/lib/leads/presentation";
import { calculateResponseMetrics } from "@/lib/leads/response-metrics";
import { AgencyPageHeading } from "@/components/agency/agency-page-heading";
import { LeadManager } from "@/components/lead-manager";

export const metadata = {
  title: "Enquiries | FindMaids",
  robots: { index: false, follow: false },
};

export default async function AgencyEnquiriesPage() {
  const { agency } = await requireOwnedAgency();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
  const [leads, allowance, recentSamples] = await Promise.all([
    prisma.enquiry.findMany({
      where: { agencyId: agency.id },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
    getAgencyLeadAllowance(agency.id),
    prisma.enquiry.findMany({
      where: { agencyId: agency.id, createdAt: { gte: thirtyDaysAgo } },
      select: {
        createdAt: true,
        firstRespondedAt: true,
        source: true,
        acquisitionSource: true,
      },
      take: 5000,
    }),
  ]);
  const lockedIds = allowance.lockedIds;
  const enquirySourceCounts = recentSamples.reduce<Record<string, number>>(
    (counts, lead) => {
      const attribution = lead.acquisitionSource;
      const category =
        attribution &&
        typeof attribution === "object" &&
        !Array.isArray(attribution) &&
        "sourceCategory" in attribution
          ? String(attribution.sourceCategory)
          : lead.source;
      counts[category] = (counts[category] ?? 0) + 1;
      return counts;
    },
    {},
  );

  return (
    <AgencyPageHeading item={agencyMenuItem("enquiries")}>
      <LeadManager
        leads={leads.map((lead) => {
          const details = redactLockedLeadDetails(lead, lockedIds.has(lead.id));
          // Prisma Decimal is not serialisable to a client component (the lead
          // table does not display the budget).
          const { budget, ...plain } = details;
          void budget;
          return {
            ...plain,
            createdAt: lead.createdAt.toISOString(),
            firstRespondedAt: lead.firstRespondedAt
              ? lead.firstRespondedAt.toISOString()
              : null,
          };
        })}
        leadCap={{
          mode: allowance.mode,
          planName: allowance.planName,
          monthlyLimit: allowance.monthlyLimit,
          monthlyCount: allowance.monthlyCount,
          overLimitCount: allowance.overLimitCount,
          lockedCount: allowance.lockedCount,
          upgradePlanName: allowance.upgradePlanName,
          upgradePlanFeatures: allowance.upgradePlanFeatures,
          upgradePriceMonthly: allowance.upgradePriceMonthly,
        }}
        responseMetrics={calculateResponseMetrics(recentSamples)}
        enquirySourceCounts={enquirySourceCounts}
      />
    </AgencyPageHeading>
  );
}
