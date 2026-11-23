import { NextResponse } from "next/server";
import { z } from "zod";
import { compare, hash } from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/security/client-ip";

export const runtime = "nodejs";

const schema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(10).max(128),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "Choose a password you have not used here before.",
    path: ["newPassword"],
  });

/**
 * Agency self-service password change. Setting `passwordChangedAt` invalidates
 * every existing session (the JWT callback compares it against the token issue
 * time), so the client signs the user out and asks them to sign in again.
 */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = clientIp(request);
  if (
    !(await checkRateLimit(`agency-password:${session.user.id}:${ip}`, 5, 3600))
      .allowed
  )
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 },
    );

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Choose a new password of at least 10 characters." },
      { status: 400 },
    );

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash)
    return NextResponse.json(
      { error: "Password login is not enabled for this account." },
      { status: 400 },
    );
  if (!(await compare(parsed.data.currentPassword, user.passwordHash)))
    return NextResponse.json(
      { error: "Current password is incorrect." },
      { status: 400 },
    );

  const passwordHash = await hash(parsed.data.newPassword, 12);
  const agency = await prisma.agency.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: session.user.id },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        agencyId: agency?.id,
        action: "AGENCY_PASSWORD_CHANGED",
        entity: "User",
        entityId: session.user.id,
        after: { sessionsInvalidated: true },
      },
    });
  });

  return NextResponse.json({ saved: true, reauthenticate: true });
}
