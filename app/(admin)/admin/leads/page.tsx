import { AdminLeads } from "@/components/admin-leads";
import { Container, SectionHeading } from "@/components/site";
import { requireAdminPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Lead moderation | FindMaids Admin", robots: { index: false, follow: false } };

export default async function AdminLeadsPage() {
  await requireAdminPermission("leads");
  const [leads, anomalies] = await Promise.all([
    prisma.enquiry.findMany({ include: { agency: { select: { name: true, city: true } } }, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.$queryRaw<Array<{ sourceIpHash: string; volume: bigint }>>`SELECT "sourceIpHash", COUNT(*) AS volume FROM "Enquiry" WHERE "sourceIpHash" IS NOT NULL AND "createdAt" >= NOW() - INTERVAL '24 hours' GROUP BY "sourceIpHash" HAVING COUNT(*) >= 5 ORDER BY volume DESC LIMIT 30`,
  ]);
  return <Container className="py-8"><SectionHeading eyebrow="Lead moderation" title="Enquiries" description="Search all leads, inspect hashed-IP volume anomalies, and block abusive patterns."/><AdminLeads initialLeads={leads.map((lead) => ({ ...lead, createdAt: lead.createdAt.toISOString() }))} anomalies={anomalies.map((item) => ({ ipHash: item.sourceIpHash, volume: Number(item.volume) }))}/></Container>;
}
