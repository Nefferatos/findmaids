import { requireOwnedAgency } from "@/lib/agency";
import { agencyMenuItem } from "@/lib/agency-menu";
import { prisma } from "@/lib/prisma";
import { AgencyPageHeading } from "@/components/agency/agency-page-heading";
import { AgencyCharts } from "@/components/agency-charts";

export const metadata = {
  title: "Analytics | FindMaids",
  robots: { index: false, follow: false },
};

export default async function AgencyAnalyticsPage() {
  const { agency } = await requireOwnedAgency();
  const now = new Date();
  const chartStart = new Date(now.getTime() - 90 * 86_400_000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
  const [events, sourceEnquiries] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where: { agencyId: agency.id, createdAt: { gte: chartStart } },
      select: { type: true, createdAt: true },
    }),
    prisma.enquiry.findMany({
      where: { agencyId: agency.id, createdAt: { gte: thirtyDaysAgo } },
      select: { source: true, acquisitionSource: true },
      take: 5000,
    }),
  ]);
  const clickTypes = new Set([
    "phone_click",
    "whatsapp_click",
    "website_click",
  ]);
  const byDay = new Map<string, { views: number; clicks: number }>();
  for (const event of events) {
    const day = event.createdAt.toISOString().slice(0, 10);
    const bucket = byDay.get(day) ?? { views: 0, clicks: 0 };
    if (event.type === "profile_view") bucket.views += 1;
    else if (clickTypes.has(event.type)) bucket.clicks += 1;
    byDay.set(day, bucket);
  }
  const chartData = Array.from({ length: 90 }, (_, index) => {
    const day = new Date(now.getTime() - (89 - index) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const bucket = byDay.get(day);
    return {
      date: day.slice(5),
      views: bucket?.views ?? 0,
      clicks: bucket?.clicks ?? 0,
      enquiries: 0,
    };
  });
  const sourceCounts = sourceEnquiries.reduce<Record<string, number>>(
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
    <AgencyPageHeading item={agencyMenuItem("analytics")}>
      <AgencyCharts data={chartData} />
      {Object.keys(sourceCounts).length ? (
        <div className="mt-5">
          <h2 className="text-[15px] font-bold text-[#1f3a7a]">
            Enquiry sources (30 days)
          </h2>
          <ul className="mt-2 max-w-md text-[12.5px]">
            {Object.entries(sourceCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([source, count]) => (
                <li
                  key={source}
                  className="flex justify-between border-b border-[#dddddd] py-1"
                >
                  <span>{source}</span>
                  <strong>{count}</strong>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </AgencyPageHeading>
  );
}
