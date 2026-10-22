import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { writeAdminAudit, requestIp } from "@/lib/admin-audit";
import { changeAgencyReviewStatus } from "@/lib/agency-review";
import { transitionAgencyStatus } from "@/lib/admin-workflows";

const checklistSchema = z.object({ licenseVerified: z.boolean(), contactVerified: z.boolean(), contentAppropriate: z.boolean(), mediaReviewed: z.boolean() });
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["request_changes", "reject"]), agencyId: z.string().min(1), note: z.string().trim().min(10).max(2000) }),
  z.object({ action: z.enum(["approve", "suspend", "reinstate"]), agencyId: z.string().min(1), checklist: checklistSchema.optional(), note: z.string().max(2000).optional() }),
  z.object({ action: z.literal("verify"), agencyId: z.string().min(1), enabled: z.boolean() }),
  z.object({ action: z.literal("bulk_suspend"), agencyIds: z.array(z.string().min(1)).min(1).max(100), suspended: z.boolean(), note: z.string().trim().min(5).max(1000) }),
]);

export async function GET(request: Request) {
  const access = await authorizeAdminApi("approvals");
  if (!access.user) return NextResponse.json({ error: "Approval permission required." }, { status: access.status });
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const allowed = ["PENDING", "NEEDS_CHANGES", "REJECTED", "APPROVED", "SUSPENDED"] as const;
  const agencies = await prisma.agency.findMany({
    where: status && allowed.includes(status as (typeof allowed)[number]) ? { status: status as (typeof allowed)[number] } : { status: "PENDING" },
    include: { photos: { orderBy: { sortOrder: "asc" } }, reviews: { where: { status: "PUBLISHED" }, take: 5 }, owner: { select: { email: true, name: true } } },
    orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
    take: 300,
  });
  const result = await Promise.all(agencies.map(async (agency) => {
    const duplicates = await prisma.agency.findMany({
      where: { id: { not: agency.id }, OR: [
        ...(agency.licenseNumber ? [{ licenseNumber: agency.licenseNumber }] : []),
        { phone: agency.phone }, { email: agency.email },
        { AND: [{ name: { equals: agency.name, mode: "insensitive" } }, { address: { equals: agency.address, mode: "insensitive" } }] },
      ] },
      select: { id: true, name: true, slug: true, licenseNumber: true, phone: true, email: true },
      take: 10,
    });
    const waitHours = Math.floor((Date.now() - (agency.submittedAt ?? agency.createdAt).getTime()) / 3_600_000);
    return { ...agency, waitHours, slaBreached: waitHours > 48, duplicates };
  }));
  return NextResponse.json({ agencies: result });
}

export async function POST(request: Request) {
  const access = await authorizeAdminApi("approvals");
  if (!access.user) return NextResponse.json({ error: "Approval permission required." }, { status: access.status });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid approval action." }, { status: 400 });
  const ipAddress = requestIp(request);
  if (parsed.data.action === "bulk_suspend") {
    if (access.user.role !== "ADMIN") return NextResponse.json({ error: "Bulk suspension is ADMIN-only." }, { status: 403 });
    const before = await prisma.agency.findMany({ where: { id: { in: parsed.data.agencyIds } }, select: { id: true, status: true } });
    const status = parsed.data.suspended ? "SUSPENDED" : "APPROVED";
    await prisma.agency.updateMany({ where: { id: { in: parsed.data.agencyIds } }, data: { status, adminNote: parsed.data.note } });
    await writeAdminAudit({ actorId: access.user.id, action: parsed.data.suspended ? "AGENCY_BULK_SUSPEND" : "AGENCY_BULK_REINSTATE", entity: "Agency", before, after: { agencyIds: parsed.data.agencyIds, status, note: parsed.data.note }, ipAddress });
    return NextResponse.json({ updated: parsed.data.agencyIds.length });
  }
  const agency = await prisma.agency.findUnique({ where: { id: parsed.data.agencyId }, include: { owner: { select: { email: true } } } });
  if (!agency) return NextResponse.json({ error: "Agency not found." }, { status: 404 });
  const before = { status: agency.status, adminNote: agency.adminNote, verifiedBadge: agency.verifiedBadge, verifiedAt: agency.verifiedAt, verifiedById: agency.verifiedById, approvalChecklist: agency.approvalChecklist };
  if (parsed.data.action === "verify") {
    if (access.user.role !== "ADMIN") return NextResponse.json({ error: "Verified badge changes are ADMIN-only." }, { status: 403 });
    const updated = await prisma.agency.update({ where: { id: agency.id }, data: { verifiedBadge: parsed.data.enabled, verifiedAt: parsed.data.enabled ? new Date() : null, verifiedById: parsed.data.enabled ? access.user.id : null } });
    await writeAdminAudit({ actorId: access.user.id, action: parsed.data.enabled ? "AGENCY_VERIFIED" : "AGENCY_VERIFICATION_REVOKED", entity: "Agency", entityId: agency.id, agencyId: agency.id, before, after: { verifiedBadge: updated.verifiedBadge, verifiedAt: updated.verifiedAt, verifiedById: updated.verifiedById }, ipAddress });
    return NextResponse.json({ agency: updated });
  }

  let status: "APPROVED" | "NEEDS_CHANGES" | "REJECTED" | "SUSPENDED";
  let note: string | undefined;
  if (parsed.data.action === "approve") {
    if (!parsed.data.checklist || Object.values(parsed.data.checklist).some((value) => value !== true)) return NextResponse.json({ error: "All approval checklist items must be confirmed." }, { status: 400 });
    status = "APPROVED";
    await prisma.agency.update({ where: { id: agency.id }, data: { approvalChecklist: parsed.data.checklist } });
  } else if (parsed.data.action === "request_changes") { status = "NEEDS_CHANGES"; note = parsed.data.note; }
  else if (parsed.data.action === "reject") { status = "REJECTED"; note = parsed.data.note; }
  else { status = parsed.data.action === "suspend" ? "SUSPENDED" : "APPROVED"; note = parsed.data.note; }
  try {
    transitionAgencyStatus(agency.status, status);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid agency status transition." }, { status: 409 });
  }
  const updated = await changeAgencyReviewStatus(agency.id, status, note);
  await writeAdminAudit({ actorId: access.user.id, action: `AGENCY_${parsed.data.action.toUpperCase()}`, entity: "Agency", entityId: agency.id, agencyId: agency.id, before, after: { status, note, checklist: parsed.data.action === "approve" ? parsed.data.checklist : undefined }, ipAddress });
  return NextResponse.json({ agency: updated });
}