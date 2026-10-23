import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { z } from "zod";
import { generateSecret, verify } from "otplib";
import { authorizeAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { encryptTotpSecret, decryptTotpSecret, totpUri } from "@/lib/totp";
import { requestIp, writeAdminAudit } from "@/lib/admin-audit";
import { checkRateLimit } from "@/lib/rate-limit";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("verify"), code: z.string().regex(/^\d{6}$/) }),
  z.object({ action: z.literal("disable"), code: z.string().regex(/^\d{6}$/) }),
]);

export async function POST(request: Request) {
  const access = await authorizeAdminApi("twoFactor");
  if (!access.user)
    return NextResponse.json(
      { error: "ADMIN permission required." },
      { status: access.status },
    );
  if (!(await checkRateLimit(`admin-totp:${access.user.id}`, 8, 900)).allowed)
    return NextResponse.json(
      { error: "Too many authenticator attempts. Try again later." },
      { status: 429 },
    );
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid 2FA request." },
      { status: 400 },
    );
  const user = await prisma.user.findUnique({
    where: { id: access.user.id },
    select: {
      email: true,
      totpEnabled: true,
      totpSecret: true,
      totpPendingSecret: true,
    },
  });
  if (!user)
    return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (parsed.data.action === "start") {
    if (user.totpEnabled)
      return NextResponse.json(
        { error: "TOTP is already enabled." },
        { status: 409 },
      );
    const secret = generateSecret();
    const encrypted = encryptTotpSecret(secret);
    await prisma.user.update({
      where: { id: access.user.id },
      data: { totpPendingSecret: encrypted },
    });
    await writeAdminAudit({
      actorId: access.user.id,
      action: "ADMIN_TOTP_SETUP_STARTED",
      entity: "User",
      entityId: access.user.id,
      ipAddress: requestIp(request),
    });
    const dataUrl = await QRCode.toDataURL(totpUri(secret, user.email));
    return NextResponse.json({ qrCode: dataUrl, manualSecret: secret });
  }

  if (parsed.data.action === "verify") {
    if (user.totpEnabled || !user.totpPendingSecret)
      return NextResponse.json(
        { error: "Start a TOTP setup first." },
        { status: 409 },
      );
    const secret = decryptTotpSecret(user.totpPendingSecret);
    if (
      !(await verify({ token: parsed.data.code, secret, epochTolerance: 30 }))
        .valid
    )
      return NextResponse.json(
        { error: "Invalid authenticator code." },
        { status: 400 },
      );
    await prisma.user.update({
      where: { id: access.user.id },
      data: {
        totpSecret: user.totpPendingSecret,
        totpPendingSecret: null,
        totpEnabled: true,
        totpVerifiedAt: new Date(),
      },
    });
    await writeAdminAudit({
      actorId: access.user.id,
      action: "ADMIN_TOTP_ENABLED",
      entity: "User",
      entityId: access.user.id,
      ipAddress: requestIp(request),
    });
    return NextResponse.json({
      enabled: true,
      message: "TOTP enabled. Sign out and sign in again with a current code.",
    });
  }

  if (!user.totpEnabled || !user.totpSecret)
    return NextResponse.json(
      { error: "TOTP is not enabled." },
      { status: 409 },
    );
  const secret = decryptTotpSecret(user.totpSecret);
  if (
    !(await verify({ token: parsed.data.code, secret, epochTolerance: 30 }))
      .valid
  )
    return NextResponse.json(
      { error: "Invalid authenticator code." },
      { status: 400 },
    );
  await prisma.user.update({
    where: { id: access.user.id },
    data: {
      totpSecret: null,
      totpPendingSecret: null,
      totpEnabled: false,
      totpVerifiedAt: null,
    },
  });
  await writeAdminAudit({
    actorId: access.user.id,
    action: "ADMIN_TOTP_DISABLED",
    entity: "User",
    entityId: access.user.id,
    ipAddress: requestIp(request),
  });
  return NextResponse.json({ enabled: false });
}
