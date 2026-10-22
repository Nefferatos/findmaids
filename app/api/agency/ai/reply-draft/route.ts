import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/ai/flags";
import { maskPii } from "@/lib/ai/guardrails";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    return NextResponse.json(
      { error: "Agency access required." },
      { status: 401 },
    );
  if (
    !(await checkRateLimit(`ai-reply-draft:${session.user.id}`, 30, 3600))
      .allowed
  )
    return NextResponse.json(
      { error: "Draft limit reached. Try again later." },
      { status: 429 },
    );
  const parsed = z
    .object({ enquiryId: z.string().min(1) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid enquiry." }, { status: 400 });
  const agency = await prisma.agency.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true, name: true },
  });
  if (!agency || !(await isFeatureEnabled("agency_auto_reply", agency.id)))
    return NextResponse.json(
      { error: "Reply drafts are not enabled." },
      { status: 404 },
    );
  const enquiry = await prisma.enquiry.findFirst({
    where: { id: parsed.data.enquiryId, agencyId: agency.id },
    select: { id: true, name: true, message: true },
  });
  if (!enquiry)
    return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
  const firstName = maskPii(enquiry.name).trim().split(/\s+/)[0] || "there";
  const context = maskPii(enquiry.message).slice(0, 240);
  const draft = `Hello ${firstName},\n\nThank you for contacting ${agency.name}. We have received your enquiry${context ? ` about: “${context}”` : ""}. Our team will review the details and get back to you directly.\n\nTo help us respond, please let us know a convenient time to reach you.\n\nKind regards,\n${agency.name}`;
  return NextResponse.json({ draft, mode: "editable-draft", sent: false });
}
