export type SubscriptionState =
  "PENDING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";

const allowedTransitions: Record<SubscriptionState, SubscriptionState[]> = {
  PENDING: ["ACTIVE", "CANCELLED", "EXPIRED"],
  ACTIVE: ["PAST_DUE", "CANCELLED", "EXPIRED"],
  PAST_DUE: ["ACTIVE", "CANCELLED", "EXPIRED"],
  CANCELLED: ["ACTIVE", "EXPIRED"],
  EXPIRED: ["ACTIVE"],
};

export function transitionSubscription(
  current: SubscriptionState,
  next: SubscriptionState,
): SubscriptionState {
  if (current === next) return current;
  if (!allowedTransitions[current].includes(next))
    throw new Error(`Invalid subscription transition: ${current} -> ${next}`);
  return next;
}

export function calculateProration(
  currentMonthly: number,
  nextMonthly: number,
  periodStart: Date,
  periodEnd: Date,
  now = new Date(),
) {
  if (nextMonthly <= currentMonthly) return 0;
  const totalMs = periodEnd.getTime() - periodStart.getTime();
  if (totalMs <= 0) return 0;
  const remainingRatio = Math.max(
    0,
    Math.min(1, (periodEnd.getTime() - now.getTime()) / totalMs),
  );
  return (
    Math.round((nextMonthly - currentMonthly) * remainingRatio * 100) / 100
  );
}

export function invoiceNumber(year: number, sequence: number) {
  return `FM-${year}-${String(sequence).padStart(6, "0")}`;
}

export function checkLeadLimit(
  limit: number | null,
  acceptedThisPeriod: number,
) {
  if (limit === null) return { allowed: true, remaining: null };
  return {
    allowed: acceptedThisPeriod < limit,
    remaining: Math.max(0, limit - acceptedThisPeriod),
  };
}

export function reserveWebhookEvent(
  seenEventIds: Set<string>,
  eventId: string,
) {
  if (seenEventIds.has(eventId)) return false;
  seenEventIds.add(eventId);
  return true;
}
