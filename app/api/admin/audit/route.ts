import { NextResponse } from "next/server";
import { authorizeAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const access = await authorizeAdminApi("audit");
  if (!access.user) return NextResponse.json({ error: "Audit access requires ADMIN." }, { status: access.status });
  const params = new URL(request.url).searchParams;
  const page = Math.min(1000, Math.max(1, Number(params.get("page")) || 1));
  const pageSize = 100;
  const action = params.get("action")?.slice(0, 100);
  const entity = params.get("entity")?.slice(0, 100);
  const from = params.get("from");
  const to = params.get("to");
  const where = { ...(action ? { action: { contains: action, mode: "insensitive" as const } } : {}), ...(entity ? { entity: { contains: entity, mode: "insensitive" as const } } : {}), ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}) } } : {}) };
  const [total, logs] = await Promise.all([prisma.auditLog.count({ where }), prisma.auditLog.findMany({ where, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize })]);
  return NextResponse.json({ total, page, pageSize, logs });
}