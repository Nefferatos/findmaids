import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { hasBlockedPattern } from "@/lib/moderation";
import { enqueueJob } from "@/lib/jobs/queue";
import { sendOutboundLeadEvent } from "@/lib/jobs/outbound";
import { summarizeLead } from "@/lib/jobs/lead-summary";
import { getLeadCapMode } from "@/lib/leads/cap";
import { getConsentedAcquisitionSource } from "@/lib/attribution-consent";
import { acquisitionSourceSchema } from "@/lib/attribution";

export const createEnquiryInput = z.object({
  agencyId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  email: z.string().email(),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(5).max(4000),
  consentGiven: z.literal(true),
  acquisitionSource: acquisitionSourceSchema.optional(),
});
export type CreateEnquiryInput = z.infer<typeof createEnquiryInput>;

export async function createEnquiry(input: CreateEnquiryInput) {
  const enquiry = createEnquiryInput.parse(input);
  if (await hasBlockedPattern({ email: enquiry.email, phone: enquiry.phone }))
    throw new Error("Enquiry submission is unavailable.");
  const agency = await prisma.agency.findFirst({
    where: { id: enquiry.agencyId, status: "APPROVED" },
    select: { id: true, name: true, email: true },
  });
  if (!agency) throw new Error("This approved agency could not be found.");
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const [active, count, basic] = await Promise.all([
    prisma.subscription.findFirst({
      where: { agencyId: agency.id, status: "ACTIVE", OR: [{ endDate: null }, { endDate: { gte: new Date() } }] },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.enquiry.count({
      where: { agencyId: agency.id, createdAt: { gte: start } },
    }),
    prisma.plan.findUnique({ where: { name: "Basic Free" } }),
  ]);
  const leadLimit = active ? active.plan.leadLimit : (basic?.leadLimit ?? null);
  const waitingCount = leadLimit === null ? 0 : Math.max(0, count + 1 - leadLimit);
  const acquisitionSource = await getConsentedAcquisitionSource(
    enquiry.acquisitionSource,
  );
  const created = await prisma.enquiry.create({
    data: {
      agencyId: agency.id,
      name: enquiry.name,
      email: enquiry.email,
      phone: enquiry.phone || null,
      message: enquiry.message,
      consentGiven: true,
      consentAt: new Date(),
      consentPolicyVersion: "enquiry-consent-v1-draft",
      acquisitionSource: acquisitionSource ?? undefined,
      source: "CHAT",
    },
    select: { id: true },
  });
  await Promise.allSettled([
    sendEmail(
      enquiry.email,
      "We received your FindMaids enquiry",
      `Your enquiry to ${agency.name} was received. The agency may contact you using the details you provided.`,
    ),
    sendEmail(
      agency.email,
      waitingCount > 0
        ? `New enquiry waiting for ${agency.name}`
        : `New enquiry for ${agency.name}`,
      waitingCount > 0
        ? `A chat enquiry was saved and delivered to your inbox. Reference: ${created.id}. ${waitingCount} lead${waitingCount === 1 ? " is" : "s are"} currently above your plan allowance. ${getLeadCapMode() === "LOCK_DETAILS" ? "Contact details are locked until you upgrade." : "Contact details remain available under the current delivery setting."} Sign in to review leads and plan options.`
        : `A new enquiry was received via the FindMaids assistant. Reference: ${created.id}. Please sign in to review it.`,
    ),
  ]);
  const summaryQueued = await enqueueJob({ type: "lead.summary", enquiryId: created.id }).catch(() => false);
  if (!summaryQueued) await summarizeLead(created.id).catch(() => null);
  await enqueueJob({ type: "lead.reply-draft", enquiryId: created.id }).catch(() => false);
  await sendOutboundLeadEvent("lead.created", {
    enquiryId: created.id,
    agencyId: agency.id,
    source: "CHAT",
  }).catch(() => false);
  return { accepted: true, reference: created.id };
}
