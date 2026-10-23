import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { agencyScopedWhere } from "@/lib/tenant";
import { getAgencyLeadAllowance } from "@/lib/leads/access";
import { redactLockedLeadDetails } from "@/lib/leads/presentation";
import { calculateResponseMetrics } from "@/lib/leads/response-metrics";
import { shouldSetFirstRespondedAt } from "@/lib/leads/response-action";

const updateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["NEW", "CONTACTED", "CLOSED"]).optional(),
  privateNotes: z.string().max(5000).optional(),
});

async function ownedAgency() {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY") return null;
  return prisma.agency.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
}

export async function GET(request: Request) {
  const agency = await ownedAgency();
  if (!agency)
    return NextResponse.json(
      { error: "Agency access required." },
      { status: 403 },
    );
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const start = url.searchParams.get("from");
  const end = url.searchParams.get("to");
  const dateSchema = z.iso.date();
  if (
    (start && !dateSchema.safeParse(start).success) ||
    (end && !dateSchema.safeParse(end).success)
  )
    return NextResponse.json(
      { error: "Use valid YYYY-MM-DD dates." },
      { status: 400 },
    );
  const leads = await prisma.enquiry.findMany({
    where: agencyScopedWhere(agency.id, {
      ...(status && ["NEW", "CONTACTED", "CLOSED"].includes(status)
        ? { status: status as "NEW" | "CONTACTED" | "CLOSED" }
        : {}),
      ...(start || end
        ? {
            createdAt: {
              ...(start ? { gte: new Date(start) } : {}),
              ...(end ? { lte: new Date(`${end}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    }),
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      source: true,
      acquisitionSource: true,
      firstRespondedAt: true,
      message: true,
      privateNotes: true,
      aiSummary: true,
      aiHelperType: true,
      aiLocation: true,
      aiBudgetText: true,
      aiStartDateText: true,
      aiUrgency: true,
      aiQualityScore: true,
      aiQualityReasons: true,
      aiSpamProbability: true,
      aiReplyDraft: true,
    },
    orderBy: { createdAt: "desc" },
    take: 250,
  });
  const allowance = await getAgencyLeadAllowance(agency.id);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const responseLeads = await prisma.enquiry.findMany({
    where: agencyScopedWhere(agency.id, { createdAt: { gte: thirtyDaysAgo } }),
    select: { createdAt: true, firstRespondedAt: true },
    take: 5000,
  });
  const visibleLeads = leads.map((lead) =>
    redactLockedLeadDetails(lead, allowance.lockedIds.has(lead.id)),
  );
  if (url.searchParams.get("format") === "csv") {
    const escape = (value: string | null) =>
      `"${(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      "id,name,email,phone,status,createdAt,message,privateNotes",
      ...visibleLeads.map((lead) =>
        [
          lead.id,
          lead.name,
          lead.detailsLocked ? "LOCKED" : lead.email,
          lead.phone,
          lead.status,
          lead.createdAt.toISOString(),
          lead.message,
          lead.privateNotes,
        ]
          .map(escape)
          .join(","),
      ),
    ].join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=findmaids-leads.csv",
        "Cache-Control": "no-store",
      },
    });
  }
  return NextResponse.json({
    leads: visibleLeads,
    leadCap: {
      mode: allowance.mode,
      planName: allowance.planName,
      monthlyLimit: allowance.monthlyLimit,
      monthlyCount: allowance.monthlyCount,
      lockedCount: allowance.lockedCount,
      planFeatures: allowance.planFeatures,
      upgradePlanName: allowance.upgradePlanName,
      upgradePlanFeatures: allowance.upgradePlanFeatures,
      upgradePriceMonthly: allowance.upgradePriceMonthly,
    },
    responseMetrics: calculateResponseMetrics(responseLeads),
  });
}

export async function PATCH(request: Request) {
  const agency = await ownedAgency();
  if (!agency)
    return NextResponse.json(
      { error: "Agency access required." },
      { status: 403 },
    );
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid lead update." },
      { status: 400 },
    );
  const existing = await prisma.enquiry.findFirst({
    where: agencyScopedWhere(agency.id, { id: parsed.data.id }),
    select: { id: true, status: true, privateNotes: true, firstRespondedAt: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  const allowance = await getAgencyLeadAllowance(agency.id);
  if (allowance.lockedIds.has(existing.id))
    return NextResponse.json({ error: "Upgrade to unlock this lead before updating it." }, { status: 403 });
  const firstResponseAction = shouldSetFirstRespondedAt({
    previousStatus: existing.status,
    nextStatus: parsed.data.status,
    previousNotes: existing.privateNotes,
    nextNotes: parsed.data.privateNotes,
  });
  const updated = await prisma.enquiry.updateMany({
    where: agencyScopedWhere(agency.id, { id: parsed.data.id }),
    data: {
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.privateNotes !== undefined
        ? { privateNotes: parsed.data.privateNotes }
        : {}),
      ...(firstResponseAction && !existing.firstRespondedAt
        ? { firstRespondedAt: new Date() }
        : {}),
    },
  });
  return updated.count
    ? NextResponse.json({ updated: true })
    : NextResponse.json({ error: "Lead not found." }, { status: 404 });
}
