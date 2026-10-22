import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminApi } from "@/lib/admin-auth";
import { requestIp, writeAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";

const schema = z.object({ agencyId: z.string().min(1), type: z.enum(["FEATURED", "HOMEPAGE", "SEARCH", "CATEGORY_TOP"]), startDate: z.iso.datetime(), endDate: z.iso.datetime() });

export async function GET() {
  const access = await authorizeAdminApi("placements");
  if (!access.user) return NextResponse.json({ error: "Placement administration requires ADMIN." }, { status: access.status });
  const placements = await prisma.adPlacement.findMany({ include: { agency: { select: { name: true, slug: true } } }, orderBy: [{ startDate: "asc" }, { type: "asc" }], take: 1000 });
  return NextResponse.json({ placements });
}

export async function POST(request: Request) {
  const access = await authorizeAdminApi("placements");
  if (!access.user || access.user.role !== "ADMIN") return NextResponse.json({ error: "Scheduling placements requires ADMIN." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid placement schedule." }, { status: 400 });
  const startDate = new Date(parsed.data.startDate);
  const endDate = new Date(parsed.data.endDate);
  if (endDate <= startDate) return NextResponse.json({ error: "End date must be after start date." }, { status: 400 });
  const agency = await prisma.agency.findFirst({ where: { id: parsed.data.agencyId, status: "APPROVED" }, select: { id: true } });
  if (!agency) return NextResponse.json({ error: "Approved agency not found." }, { status: 404 });
  const conflict = await prisma.adPlacement.findFirst({ where: { type: parsed.data.type, status: { in: ["ACTIVE", "SCHEDULED"] }, startDate: { lt: endDate }, endDate: { gt: startDate } }, include: { agency: { select: { name: true } } } });
  if (conflict) return NextResponse.json({ error: `Slot conflicts with ${conflict.agency.name}.`, conflict }, { status: 409 });
  const placement = await prisma.adPlacement.create({ data: { agencyId: agency.id, type: parsed.data.type, startDate, endDate, status: startDate <= new Date() ? "ACTIVE" : "SCHEDULED" } });
  await writeAdminAudit({ actorId: access.user.id, action: "PLACEMENT_SCHEDULE", entity: "AdPlacement", entityId: placement.id, agencyId: agency.id, after: placement, ipAddress: requestIp(request) });
  return NextResponse.json({ placement }, { status: 201 });
}

export async function PATCH(request: Request) {
  const access = await authorizeAdminApi("placements");
  if (!access.user || access.user.role !== "ADMIN") return NextResponse.json({ error: "Placement changes require ADMIN." }, { status: 403 });
  const parsed = z.object({ placementId: z.string().min(1), status: z.enum(["ACTIVE", "SCHEDULED", "CANCELLED", "COMPLETED"]) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid placement status." }, { status: 400 });
  const before = await prisma.adPlacement.findUnique({ where: { id: parsed.data.placementId } });
  if (!before) return NextResponse.json({ error: "Placement not found." }, { status: 404 });
  const placement = await prisma.adPlacement.update({ where: { id: before.id }, data: { status: parsed.data.status } });
  await writeAdminAudit({ actorId: access.user.id, action: "PLACEMENT_STATUS", entity: "AdPlacement", entityId: placement.id, agencyId: placement.agencyId, before, after: placement, ipAddress: requestIp(request) });
  return NextResponse.json({ placement });
}
