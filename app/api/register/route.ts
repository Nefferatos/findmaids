import { randomBytes, createHash } from "node:crypto";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
  accountType: z.enum(["employer", "agency"]),
});

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = await checkRateLimit(`register:${ip}`, 5, 3600);
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 },
    );

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Check the fields and try again." },
      { status: 400 },
    );

  const email = parsed.data.email.toLowerCase();
  if (
    await prisma.user.findUnique({ where: { email }, select: { id: true } })
  ) {
    return NextResponse.json(
      {
        message:
          "If the address is eligible, verification instructions will be sent.",
      },
      { status: 201 },
    );
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash: await hash(parsed.data.password, 12),
      role: parsed.data.accountType === "agency" ? "AGENCY" : "VISITOR",
    },
  });
  if (parsed.data.accountType === "agency") {
    await prisma.agencyOnboardingDraft.create({
      data: { userId: user.id, currentStep: 1, data: {} },
    });
  }
  const rawToken = randomBytes(32).toString("hex");
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: createHash("sha256").update(rawToken).digest("hex"),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
  });
  const verifyUrl = new URL(
    `/api/verify-email?token=${rawToken}`,
    process.env.NEXTAUTH_URL ?? "http://localhost:3000",
  ).toString();
  await sendEmail(
    email,
    "Verify your FindMaids account",
    `Confirm your email within 24 hours: ${verifyUrl}`,
  );
  return NextResponse.json(
    { message: "Account created. Check your email to verify it." },
    { status: 201 },
  );
}
