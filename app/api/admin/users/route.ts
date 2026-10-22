import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminApi } from "@/lib/admin-auth";
import { requestIp, writeAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { createHash, randomBytes } from "node:crypto";
import { sendEmail } from "@/lib/email";

const schema = z.object({ userId: z.string().min(1), role: z.enum(["VISITOR", "AGENCY", "STAFF", "ADMIN"]).optional(), disabled: z.boolean().optional(), forceReset: z.boolean().optional() });

export async function GET(request: Request) {
  const access = await authorizeAdminApi("users");
  if (!access.user) return NextResponse.json({ error: "User administration requires ADMIN." }, { status: access.status });
  const search = new URL(request.url).searchParams.get("q")?.trim();
  const users = await prisma.user.findMany({ where: search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] } : {}, select: { id: true, name: true, email: true, role: true, disabled: true, emailVerified: true, createdAt: true, agencies: { select: { id: true, name: true, status: true } } }, orderBy: { createdAt: "desc" }, take: 300 });
  return NextResponse.json({ users });
}

export async function PATCH(request: Request) {
  const access = await authorizeAdminApi("users");
  if (!access.user || access.user.role !== "ADMIN") return NextResponse.json({ error: "Only ADMIN can change user roles or disable accounts." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (parsed.data.role === undefined && parsed.data.disabled === undefined && !parsed.data.forceReset)) return NextResponse.json({ error: "Invalid user update." }, { status: 400 });
  if (parsed.data.userId === access.user.id && (parsed.data.disabled === true || (parsed.data.role !== undefined && parsed.data.role !== "ADMIN"))) return NextResponse.json({ error: "You cannot disable or demote your own active admin account." }, { status: 409 });
  const before = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { role: true, disabled: true } });
  if (!before) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (parsed.data.forceReset) {
    const target = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { email: true } });
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
    const rawToken = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({ data: { userId: parsed.data.userId, tokenHash: createHash("sha256").update(rawToken).digest("hex"), expiresAt: new Date(Date.now() + 30 * 60_000) } });
    const resetUrl = new URL(`/reset-password?token=${rawToken}`, process.env.NEXTAUTH_URL ?? "http://localhost:3000").toString();
    await sendEmail(target.email, "Admin requested a FindMaids password reset", `An administrator requested that you reset your password. This link expires in 30 minutes: ${resetUrl}`);
    await writeAdminAudit({ actorId: access.user.id, action: "USER_FORCE_PASSWORD_RESET", entity: "User", entityId: parsed.data.userId, before, after: { resetEmailSent: true }, ipAddress: requestIp(request) });
    return NextResponse.json({ resetEmailSent: true });
  }
  const user = await prisma.user.update({ where: { id: parsed.data.userId }, data: { ...(parsed.data.role ? { role: parsed.data.role } : {}), ...(parsed.data.disabled === undefined ? {} : { disabled: parsed.data.disabled }) }, select: { id: true, role: true, disabled: true } });
  await writeAdminAudit({ actorId: access.user.id, action: "USER_ACCESS_UPDATE", entity: "User", entityId: user.id, before, after: user, ipAddress: requestIp(request) });
  return NextResponse.json({ user });
}
