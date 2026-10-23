export const defaultFoundingPeriodDays = 90;
export const foundingReminderDays = [14, 3] as const;

export function foundingReminderType(days: number, endDate: Date) {
  return `FOUNDING_END_${days}D_${endDate.toISOString().slice(0, 10)}`;
}

export function foundingReminderWindow(days: number, now: Date) {
  const target = new Date(now.getTime() + days * 86_400_000);
  const start = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()));
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

export function foundingPeriodExpired(endDate: Date | null, now = new Date()) {
  return Boolean(endDate && endDate <= now);
}
