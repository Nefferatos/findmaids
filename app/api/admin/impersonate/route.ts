import { createHmac, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminApi } from "@/lib/admin-auth";
import { requestIp, writeAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";

const schema = z.object({ agencyId: z.string().min(1), action: z.enum(["start", "stop"]) });
function signature(payload: string) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Auth secret is not configured.");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export async function POST(request: Request) {
  const access = await authorizeAdminApi("users");
  if (!access.user || access.user.role !== "ADMIN") return NextResponse.json({ error: "Read-only impersonation is ADMIN-only." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid impersonation action." }, { status: 400 });
  const response = NextResponse.json({ started: parsed.data.action === "start" });
  if (parsed.data.action === "stop") {
    response.cookies.delete("fm-admin-impersonation");
    await writeAdminAudit({ actorId: access.user.id, action: "IMPERSONATION_STOP", entity: "Agency", entityId: parsed.data.agencyId, ipAddress: requestIp(request) });
    return response;
  }
  const agency = await prisma.agency.findUnique({ where: { id: parsed.data.agencyId }, select: { id: true, ownerId: true } });
  if (!agency?.ownerId) return NextResponse.json({ error: "Agency owner not found." }, { status: 404 });
  const payload = Buffer.from(JSON.stringify({ adminId: access.user.id, agencyId: agency.id, userId: agency.ownerId, nonce: randomBytes(12).toString("hex"), expiresAt: Date.now() + 15 * 60_000 })).toString("base64url");
  response.cookies.set("fm-admin-impersonation", `${payload}.${signature(payload)}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 15 * 60 });
  await writeAdminAudit({ actorId: access.user.id, action: "IMPERSONATION_START_READ_ONLY", entity: "Agency", entityId: agency.id, after: { userId: agency.ownerId, expiresInMinutes: 15, readOnly: true }, ipAddress: requestIp(request) });
  return response;
}
