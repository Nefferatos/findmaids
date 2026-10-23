import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/ai/flags";
import { maskPii } from "@/lib/ai/guardrails";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkAiBudget } from "@/lib/ai/budget";
import { generateLoggedText } from "@/lib/ai/call";
import { getAiProvider } from "@/lib/ai/provider";
import { getAgencyLeadAllowance } from "@/lib/leads/access";

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
    include: { agency: { include: { aiSettings: true } } },
  });
  if (!enquiry)
    return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
  const allowance = await getAgencyLeadAllowance(agency.id);
  if (allowance.lockedIds.has(enquiry.id))
    return NextResponse.json({ error: "Upgrade to unlock this lead before preparing a reply." }, { status: 403 });
  if (enquiry.aiReplyDraft)
    return NextResponse.json({
      draft: enquiry.aiReplyDraft,
      mode: "editable-draft",
      sent: false,
    });
  const budget = await checkAiBudget(agency.id);
  const firstName = maskPii(enquiry.name).trim().split(/\s+/)[0] || "there";
  const facts =
    enquiry.agency.aiSettings?.knowledgeBase?.trim() ||
    "No agency-specific facts are available. Do not state prices, availability, visa outcomes or guarantees; say the agency will confirm.";
  let draft = `Hello ${firstName},\n\nThank you for contacting ${agency.name}. Our team will review your enquiry and confirm the relevant details directly.\n\nKind regards,\n${agency.name}`;
  if (budget.allowed && getAiProvider().name !== "mock") {
    try {
      const generated = await generateLoggedText({
        feature: "agency_auto_reply",
        promptVersion: "agency-auto-reply.v1",
        agencyId: agency.id,
        maxTokens: 300,
        messages: [
          {
            role: "system",
            content: `Write a concise ${enquiry.agency.aiSettings?.replyTone ?? "professional"} first reply for human approval. Never state or promise a price, availability, visa, placement outcome, or a claim not in the agency facts. Be explicit that this is an assistant-prepared draft and never impersonate a person. Agency facts: ${maskPii(facts).slice(0, 3000)}`,
          },
          { role: "user", content: maskPii(enquiry.message).slice(0, 2000) },
        ],
      });
      if (generated.text.trim()) draft = generated.text;
    } catch {
      // Return the conservative acknowledgement draft when the provider is unavailable.
    }
  }
  return NextResponse.json({ draft, mode: "editable-draft", sent: false });
}
