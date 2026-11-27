import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { applyNewPassword, localPasswordHash } from "@/lib/credentials";
import { supabaseAuthEnabled } from "@/lib/supabase-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/security/client-ip";

const schema = z.object({
  token: z.string().min(32).max(128),
  password: z.string().min(10).max(128),
});

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!(await checkRateLimit(`reset:${ip}`, 5, 3600)).allowed)
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid or expired reset link." },
      { status: 400 },
    );
  const tokenHash = createHash("sha256")
    .update(parsed.data.token)
    .digest("hex");
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });
  if (!record || record.consumedAt || record.expiresAt < new Date())
    return NextResponse.json(
      { error: "Invalid or expired reset link." },
      { status: 400 },
    );
  const user = await prisma.user.findUnique({
    where: { id: record.userId },
    select: {
      id: true,
      email: true,
      name: true,
      supabaseUserId: true,
      passwordHash: true,
    },
  });
  if (!user)
    return NextResponse.json(
      { error: "Invalid or expired reset link." },
      { status: 400 },
    );
  // The reset token proves ownership, so Supabase is updated first: if it cannot
  // store the password the token stays usable instead of being consumed.
  const useSupabase = supabaseAuthEnabled();
  if (useSupabase && !(await applyNewPassword(user, parsed.data.password)))
    return NextResponse.json(
      {
        error:
          "Unable to update the password right now. Please try again shortly.",
      },
      { status: 503 },
    );
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        ...(useSupabase
          ? {}
          : { passwordHash: await localPasswordHash(parsed.data.password) }),
        passwordChangedAt: new Date(),
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
  ]);
  return NextResponse.json({
    message: "Password updated. You can now log in.",
  });
}
