import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendOutboundLeadEvent } from "@/lib/jobs/outbound";
import { getAgencyLeadAllowance } from "@/lib/leads/access";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    return NextResponse.json(
      { error: "Agency access required." },
      { status: 401 },
    );
  if (
    !(await checkRateLimit(`lead-reply:${session.user.id}`, 30, 3600)).allowed
  )
    return NextResponse.json(
      { error: "Reply limit reached." },
      { status: 429 },
    );
  const parsed = z
    .object({
      enquiryId: z.string().min(1),
      body: z.string().trim().min(3).max(5000),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid reply." }, { status: 400 });
  const agency = await prisma.agency.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true, name: true },
  });
  if (!agency)
    return NextResponse.json({ error: "Agency not found." }, { status: 404 });
  const enquiry = await prisma.enquiry.findFirst({
    where: { id: parsed.data.enquiryId, agencyId: agency.id },
    select: { id: true, email: true, firstRespondedAt: true },
  });
  if (!enquiry)
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  const allowance = await getAgencyLeadAllowance(agency.id);
  if (allowance.lockedIds.has(enquiry.id))
    return NextResponse.json({ error: "Upgrade to unlock this lead before replying." }, { status: 403 });
  await sendEmail(
    enquiry.email,
    `Reply from ${agency.name}`,
    `${parsed.data.body}\n\nSent by ${agency.name} after agency review.`,
  );
  await prisma.enquiry.update({
    where: { id: enquiry.id },
    data: {
      aiReplyDraft: parsed.data.body,
      aiReplyApprovedAt: new Date(),
      aiReplySentAt: new Date(),
      status: "CONTACTED",
      firstRespondedAt: enquiry.firstRespondedAt ?? new Date(),
    },
  });
  await sendOutboundLeadEvent("lead.replied", {
    enquiryId: enquiry.id,
    agencyId: agency.id,
  }).catch(() => false);
  return NextResponse.json({ sent: true, approved: true });
}
