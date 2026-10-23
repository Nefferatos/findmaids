import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { enquirySubmissionSchema } from "@/lib/validation";
import { hasBlockedPattern, hashBlockValue } from "@/lib/moderation";
import { enqueueJob } from "@/lib/jobs/queue";
import { sendOutboundLeadEvent } from "@/lib/jobs/outbound";
import { summarizeLead } from "@/lib/jobs/lead-summary";
import { logger } from "@/lib/logger";
import { getLeadCapMode } from "@/lib/leads/cap";
import { getConsentedAcquisitionSource } from "@/lib/attribution-consent";

async function verifyTurnstile(token: string | undefined, request: Request) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!token) return false;
  const body = new URLSearchParams({
    secret,
    response: token,
    remoteip: request.headers.get("cf-connecting-ip") ?? "",
  });
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body, cache: "no-store" },
  );
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (!(await checkRateLimit(`enquiry:${ip}`, 5, 3600)).allowed)
    return NextResponse.json(
      { error: "Too many enquiries. Try again later." },
      { status: 429 },
    );
  const parsed = enquirySubmissionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Please check the enquiry details and consent." },
      { status: 400 },
    );
  const clientIp = request.headers.get("cf-connecting-ip") ?? ip;
  if (
    await hasBlockedPattern({
      email: parsed.data.email,
      phone: parsed.data.phone,
      ip: clientIp,
    })
  )
    return NextResponse.json(
      { error: "Enquiry submission unavailable." },
      { status: 403 },
    );
  if (parsed.data.website)
    return NextResponse.json({ message: "Enquiry received." });
  if (!(await verifyTurnstile(parsed.data.turnstileToken, request)))
    return NextResponse.json(
      { error: "Please complete the verification challenge." },
      { status: 403 },
    );

  const agency = await prisma.agency.findFirst({
    where: { id: parsed.data.agencyId, status: "APPROVED" },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
  if (!agency)
    return NextResponse.json(
      { error: "This agency is not currently available." },
      { status: 404 },
    );
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  const [activeSubscription, leadsThisMonth, basicPlan] = await Promise.all([
    prisma.subscription.findFirst({
      where: { agencyId: agency.id, status: "ACTIVE", OR: [{ endDate: null }, { endDate: { gte: new Date() } }] },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.enquiry.count({
      where: { agencyId: agency.id, createdAt: { gte: startOfMonth } },
    }),
    prisma.plan.findUnique({ where: { name: "Basic Free" } }),
  ]);
  const leadLimit = activeSubscription ? activeSubscription.plan.leadLimit : (basicPlan?.leadLimit ?? null);
  const acquisitionSource = await getConsentedAcquisitionSource(
    parsed.data.acquisitionSource,
  );
  const enquiry = await prisma.enquiry.create({
    data: {
      agencyId: agency.id,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      message: parsed.data.message,
      consentGiven: true,
      consentAt: new Date(),
      consentPolicyVersion: "enquiry-consent-v1-draft",
      acquisitionSource: acquisitionSource ?? undefined,
      sourceIpHash: hashBlockValue(clientIp),
      source: "WEB",
      preferredStartDate: parsed.data.preferredStartDate,
      budget: parsed.data.budget,
    },
  });
  await sendOutboundLeadEvent("lead.created", {
    enquiryId: enquiry.id,
    agencyId: agency.id,
    source: "WEB",
  }).catch(() => false);
  const summaryQueued = await enqueueJob({ type: "lead.summary", enquiryId: enquiry.id }).catch(() => false);
  if (!summaryQueued) await summarizeLead(enquiry.id).catch(() => null);
  const waitingCount = leadLimit === null ? 0 : Math.max(0, leadsThisMonth + 1 - leadLimit);
  const emailTasks = [
    sendEmail(
      enquiry.email,
      "We received your FindMaids enquiry",
      `Your enquiry to ${agency.name} was received. The agency may contact you using the details you provided.`,
    ),
  ];
  emailTasks.push(
    sendEmail(
      agency.email,
      waitingCount > 0
        ? `New enquiry waiting for ${agency.name}`
        : `New enquiry for ${agency.name}`,
      waitingCount > 0
        ? `A new enquiry was saved and delivered to your inbox. Reference: ${enquiry.id}. ${waitingCount} lead${waitingCount === 1 ? " is" : "s are"} currently above your plan allowance. ${getLeadCapMode() === "LOCK_DETAILS" ? "Contact details are locked until you upgrade." : "Contact details remain available under the current delivery setting."} Sign in to review leads and plan options.`
        : `A new enquiry was received. Reference: ${enquiry.id}. Please sign in to review it.`,
    ),
  );
  await enqueueJob({ type: "lead.reply-draft", enquiryId: enquiry.id }).catch(
    () => false,
  );
  const emailResults = await Promise.allSettled(emailTasks);
  for (const result of emailResults) {
    if (result.status === "rejected")
      logger.error({ enquiryId: enquiry.id, errorType: result.reason instanceof Error ? result.reason.name : "unknown" }, "Unable to send enquiry email");
  }
  return NextResponse.json(
    { message: "Your enquiry has been sent." },
    { status: 201 },
  );
}
