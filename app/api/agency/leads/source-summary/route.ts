import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    return NextResponse.json({ error: "Agency access required." }, { status: 403 });
  const agency = await prisma.agency.findUnique({ where: { ownerId: session.user.id }, select: { id: true } });
  if (!agency) return NextResponse.json({ error: "Agency not found." }, { status: 404 });
  const leads = await prisma.enquiry.findMany({
    where: { agencyId: agency.id, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
    select: { source: true, acquisitionSource: true },
    take: 5000,
  });
  const bySource = leads.reduce<Record<string, number>>((counts, lead) => {
    const attribution = lead.acquisitionSource;
    const source = attribution && typeof attribution === "object" && !Array.isArray(attribution) && "sourceCategory" in attribution
      ? String(attribution.sourceCategory)
      : lead.source;
    counts[source] = (counts[source] ?? 0) + 1;
    return counts;
  }, {});
  return NextResponse.json({ bySource, total: leads.length });
}
