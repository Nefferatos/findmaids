import { randomBytes, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { localPasswordHash } from "@/lib/credentials";
import {
  supabaseAuthEnabled,
  supabaseCreateUser,
  supabaseDeleteUser,
  supabasePasswordGrant,
} from "@/lib/supabase-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/security/client-ip";
import { sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
  accountType: z.enum(["employer", "agency"]),
});

export async function POST(request: Request) {
  const ip = clientIp(request);
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
  const neutralMessage =
    "If the address is eligible, verification instructions will be sent.";
  if (
    await prisma.user.findUnique({ where: { email }, select: { id: true } })
  ) {
    return NextResponse.json({ message: neutralMessage }, { status: 201 });
  }

  // Supabase Auth owns the credential, so the identity is created first: a
  // failure cannot leave a profile that has no way to sign in.
  const supabaseConfigured = supabaseAuthEnabled();
  let supabaseUserId: string | null = null;
  // A project whose Email provider is switched off cannot sign anybody in. That
  // is a configuration state, not an outage, so the account is created with the
  // local bcrypt hash (the pre-Supabase behaviour) instead of failing the
  // registration; it links to Supabase on the first sign-in once the provider is
  // enabled. A genuine Supabase failure still asks the caller to retry.
  let useLocalPassword = !supabaseConfigured;
  if (supabaseConfigured) {
    const identity = await supabaseCreateUser({
      email,
      password: parsed.data.password,
      name: parsed.data.name,
      accountType: parsed.data.accountType,
    });
    if (!identity.ok) {
      // Identical answer to the existing-profile branch: registration must not
      // reveal which e-mail addresses already have an account.
      if (identity.error === "email_exists")
        return NextResponse.json({ message: neutralMessage }, { status: 201 });
      if (identity.error === "email_provider_disabled") {
        useLocalPassword = true;
        logger.warn(
          "Supabase Email provider is disabled; registration stored a local password hash",
        );
      } else {
        return NextResponse.json(
          {
            error:
              "Account creation is temporarily unavailable. Please try again shortly.",
          },
          { status: 503 },
        );
      }
    } else {
      // Prove the new credential can sign in before telling the caller the
      // account exists, so no identity is left behind that rejects its password.
      const signIn = await supabasePasswordGrant({
        email,
        password: parsed.data.password,
      });
      if (signIn.ok) {
        supabaseUserId = identity.userId;
      } else {
        await supabaseDeleteUser(identity.userId);
        if (signIn.error !== "email_provider_disabled")
          return NextResponse.json(
            {
              error:
                "Account creation is temporarily unavailable. Please try again shortly.",
            },
            { status: 503 },
          );
        useLocalPassword = true;
        logger.warn(
          "Supabase Email provider is disabled; registration stored a local password hash",
        );
      }
    }
  }

  let user;
  try {
    user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        // Supabase stores the password; the local hash is the fallback when the
        // integration is off or the project cannot sign the account in.
        passwordHash: useLocalPassword
          ? await localPasswordHash(parsed.data.password)
          : null,
        supabaseUserId,
        role: parsed.data.accountType === "agency" ? "AGENCY" : "VISITOR",
      },
    });
  } catch (error) {
    // Roll the identity back so it cannot block a retry with the same address.
    if (supabaseUserId) await supabaseDeleteUser(supabaseUserId);
    throw error;
  }
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
  // A blank NEXTAUTH_URL must not throw here; siteUrl() validates the base.
  const verifyUrl = siteUrl(`/api/verify-email?token=${rawToken}`);
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
