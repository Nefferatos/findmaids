import { createHash } from "node:crypto";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  token: z.string().min(32).max(128),
  password: z.string().min(10).max(128),
});

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
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
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await hash(parsed.data.password, 12),
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
