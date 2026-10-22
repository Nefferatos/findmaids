import { randomBytes, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";

const schema = z.object({ email: z.string().trim().email().max(254) });

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await checkRateLimit(`forgot:${ip}`, 5, 3600)).allowed) {
    return NextResponse.json({
      message: "If an account matches, reset instructions will be sent.",
    });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (user) {
    const rawToken = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: createHash("sha256").update(rawToken).digest("hex"),
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
      },
    });
    const url = new URL(
      `/reset-password?token=${rawToken}`,
      process.env.NEXTAUTH_URL ?? "http://localhost:3000",
    ).toString();
    await sendEmail(
      user.email,
      "Reset your FindMaids password",
      `Reset your password within 30 minutes: ${url}`,
    );
  }
  return NextResponse.json({
    message: "If an account matches, reset instructions will be sent.",
  });
}
