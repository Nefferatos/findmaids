import { prisma } from "@/lib/prisma";
import { maskPii } from "@/lib/ai/guardrails";
import { classifyLeadText } from "@/lib/ai/budget-policy";

export async function summarizeLead(enquiryId: string) {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    include: { agency: { select: { city: true } } },
  });
  if (!enquiry) return null;
  const signals = classifyLeadText(enquiry.message);
  const helperType = /nanny|yaya/i.test(enquiry.message)
    ? "nanny"
    : /caregiver/i.test(enquiry.message)
      ? "caregiver"
      : /helper|kasambahay/i.test(enquiry.message)
        ? "household helper"
        : null;
  const sentences = maskPii(enquiry.message)
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, 2);
  const budget = enquiry.message.match(/(?:php|₱)\s?[\d,]+(?:\.\d{1,2})?/i);
  const start = enquiry.message.match(
    /\b(?:start|begin|from)\s+(?:on\s+)?([A-Z][a-z]+\s+\d{1,2}|\d{4}-\d{2}-\d{2})/,
  );
  return prisma.enquiry.update({
    where: { id: enquiry.id },
    data: {
      aiSummary: sentences.join(" ").slice(0, 360),
      aiHelperType: helperType,
      aiLocation: enquiry.agency.city,
      aiBudgetText: budget?.[0] ?? null,
      aiStartDateText: start?.[1] ?? null,
      aiUrgency: signals.urgency ? "urgent" : "standard",
      aiQualityScore: signals.score,
      aiQualityReasons: signals.reasons,
      aiSpamProbability: signals.spam ? 0.9 : signals.complaint ? 0.65 : 0.05,
    },
  });
}
