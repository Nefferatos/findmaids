import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const tokenSchema = z
  .string()
  .min(32)
  .max(128)
  .regex(/^[a-f0-9]+$/i);

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const parsedToken = tokenSchema.safeParse(token);
  if (!parsedToken.success)
    return NextResponse.redirect(
      new URL("/login?verified=invalid", request.url),
    );
  const tokenHash = createHash("sha256").update(parsedToken.data).digest("hex");
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
  });
  if (!record || record.consumedAt || record.expiresAt < new Date()) {
    return NextResponse.redirect(
      new URL("/login?verified=invalid", request.url),
    );
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
  ]);
  const user = await prisma.user.findUnique({
    where: { id: record.userId },
    select: { role: true },
  });
  const destination =
    user?.role === "AGENCY" ? "/agency/onboarding" : "/login?verified=success";
  return NextResponse.redirect(new URL(destination, request.url));
}
