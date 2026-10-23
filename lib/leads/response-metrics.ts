export type LeadResponseSample = { createdAt: Date; firstRespondedAt: Date | null };

export function calculateResponseMetrics(leads: LeadResponseSample[]) {
  const responded = leads.filter((lead) => lead.firstRespondedAt !== null);
  const elapsedMs = responded.map((lead) =>
    Math.max(0, lead.firstRespondedAt!.getTime() - lead.createdAt.getTime()),
  );
  const within24Hours = elapsedMs.filter((elapsed) => elapsed <= 24 * 60 * 60 * 1000).length;
  return {
    total: leads.length,
    responded: responded.length,
    averageMinutes: elapsedMs.length
      ? elapsedMs.reduce((sum, elapsed) => sum + elapsed, 0) / elapsedMs.length / 60_000
      : null,
    within24HoursPercent: leads.length ? (within24Hours / leads.length) * 100 : null,
  };
}
