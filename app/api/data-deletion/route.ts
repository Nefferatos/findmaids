import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";

const schema = z.object({
  email: z.string().trim().email().max(254),
  reason: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await checkRateLimit(`deletion:${ip}`, 3, 86400)).allowed)
    return NextResponse.json(
      { error: "Request limit reached." },
      { status: 429 },
    );
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Enter a valid contact email." },
      { status: 400 },
    );
  if (
    session?.user?.email &&
    session.user.email.toLowerCase() !== parsed.data.email.toLowerCase()
  )
    return NextResponse.json(
      {
        error: "Use the email address associated with your signed-in account.",
      },
      { status: 403 },
    );
  const requestRecord = await prisma.dataDeletionRequest.create({
    data: {
      userId: session?.user.id,
      email: parsed.data.email.toLowerCase(),
      reason: parsed.data.reason,
    },
  });
  await sendEmail(
    parsed.data.email,
    "FindMaids data request received",
    `Your request reference is ${requestRecord.id}. We will review it and respond to this address.`,
  );
  await sendEmail(
    process.env.DATA_REQUEST_EMAIL ?? "support@findmaids.ph",
    "New FindMaids data deletion request",
    `Request reference: ${requestRecord.id}. Please verify the requester and process the request under the approved retention procedure.`,
  );
  return NextResponse.json(
    {
      message:
        "Request received. We will follow up using the email address provided.",
    },
    { status: 201 },
  );
}
