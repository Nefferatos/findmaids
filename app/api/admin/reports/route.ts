import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminApi } from "@/lib/admin-auth";
import { requestIp, writeAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";

const schema = z.object({ reportId: z.string().min(1), status: z.enum(["REVIEWING", "RESOLVED", "DISMISSED"]), resolutionNote: z.string().trim().min(3).max(2000) });

export async function GET() {
  const access = await authorizeAdminApi("reports");
  if (!access.user) return NextResponse.json({ error: "ADMIN reports permission required." }, { status: access.status });
  const reports = await prisma.report.findMany({ where: { status: { in: ["OPEN", "REVIEWING"] } }, include: { reporter: { select: { id: true, email: true } } }, orderBy: { createdAt: "asc" }, take: 500 });
  return NextResponse.json({ reports });
}

export async function PATCH(request: Request) {
  const access = await authorizeAdminApi("reports");
  if (!access.user || access.user.role !== "ADMIN") return NextResponse.json({ error: "ADMIN report resolution required." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid report resolution." }, { status: 400 });
  const before = await prisma.report.findUnique({ where: { id: parsed.data.reportId } });
  if (!before) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  const report = await prisma.report.update({ where: { id: before.id }, data: { status: parsed.data.status, resolutionNote: parsed.data.resolutionNote, resolvedById: access.user.id, resolvedAt: new Date() } });
  await writeAdminAudit({ actorId: access.user.id, action: "REPORT_RESOLVED", entity: "Report", entityId: report.id, agencyId: report.agencyId ?? undefined, before, after: report, ipAddress: requestIp(request) });
  return NextResponse.json({ report });
}