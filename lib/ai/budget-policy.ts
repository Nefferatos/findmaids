export type BudgetCheck = {
  allowed: boolean;
  reason: "global_budget" | "agency_budget" | null;
};
export function budgetCheck(
  globalSpend: number,
  globalCap: number,
  agencySpend?: number,
  agencyCap?: number,
): BudgetCheck {
  if (globalSpend >= globalCap)
    return { allowed: false, reason: "global_budget" };
  if (
    agencySpend !== undefined &&
    agencyCap !== undefined &&
    agencySpend >= agencyCap
  )
    return { allowed: false, reason: "agency_budget" };
  return { allowed: true, reason: null };
}

export type LeadSignals = {
  score: number;
  urgency: boolean;
  spam: boolean;
  complaint: boolean;
  reasons: string[];
};
export function classifyLeadText(message: string): LeadSignals {
  const lower = message.toLowerCase();
  const urgency =
    /urgent|asap|tomorrow|immediately|emergency|kailangan na|ngayon na/.test(
      lower,
    );
  const hasBudget = /\b\d{3,}\b|budget|php|₱/.test(lower);
  const helper = /helper|nanny|caregiver|kasambahay|yaya/.test(lower);
  const spam = /https?:\/\/|free money|crypto|viagra/i.test(message);
  const complaint = /complaint|scam|fraud|not safe|unsafe|reklamo/i.test(lower);
  const score = Math.max(
    0,
    Math.min(
      100,
      35 +
        (helper ? 25 : 0) +
        (hasBudget ? 15 : 0) +
        (urgency ? 10 : 0) -
        (spam ? 55 : 0) -
        (complaint ? 20 : 0),
    ),
  );
  return {
    score,
    urgency,
    spam,
    complaint,
    reasons: [
      helper ? "helper_type_present" : "helper_type_missing",
      hasBudget ? "budget_present" : "budget_missing",
      urgency ? "urgent_language" : "no_urgency_signal",
      spam ? "spam_pattern" : "no_obvious_spam",
      complaint ? "complaint_language" : "no_complaint_signal",
    ],
  };
}

export function decideReplyMode(input: {
  enabled: boolean;
  mode: "DRAFT" | "AUTO_SEND";
  urgency: boolean;
  spam: boolean;
  complaint: boolean;
  confidence: number;
  missingFacts: boolean;
}) {
  if (!input.enabled) return "skip" as const;
  if (
    input.urgency ||
    input.spam ||
    input.complaint ||
    input.confidence < 0.5 ||
    input.missingFacts
  )
    return "escalate" as const;
  if (input.mode === "AUTO_SEND") return "escalate" as const;
  return "draft" as const;
}
