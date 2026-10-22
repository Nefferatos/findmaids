import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { agencyScopedWhere } from "@/lib/tenant";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agency = await prisma.agency.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!agency)
    return NextResponse.json({ error: "Agency not found." }, { status: 404 });
  const url = new URL(request.url);
  const requestedDays = Number(url.searchParams.get("days"));
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  const events = await prisma.analyticsEvent.findMany({
    where: agencyScopedWhere(agency.id, {
      createdAt: { gte: new Date(Date.now() - days * 86_400_000) },
    }),
    select: { type: true, createdAt: true },
  });
  const leads = await prisma.enquiry.findMany({
    where: {
      agencyId: agency.id,
      createdAt: { gte: new Date(Date.now() - days * 86_400_000) },
    },
    select: { createdAt: true },
  });
  return NextResponse.json({
    days,
    events,
    leads: leads.map((lead) => lead.createdAt),
  });
}
