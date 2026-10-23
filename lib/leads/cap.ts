export type LeadCapMode = "DELIVER_ALL" | "LOCK_DETAILS";

export function getLeadCapMode(value = process.env.LEAD_CAP_MODE): LeadCapMode {
  return value === "LOCK_DETAILS" ? "LOCK_DETAILS" : "DELIVER_ALL";
}

export function isLeadDetailsLocked(input: {
  mode: LeadCapMode;
  monthlyLimit: number | null;
  chronologicalPosition: number;
}) {
  return (
    input.mode === "LOCK_DETAILS" &&
    input.monthlyLimit !== null &&
    input.chronologicalPosition > input.monthlyLimit
  );
}

export function countLockedLeads(
  mode: LeadCapMode,
  monthlyLimit: number | null,
  monthlyLeadCount: number,
) {
  if (mode !== "LOCK_DETAILS" || monthlyLimit === null) return 0;
  return Math.max(0, monthlyLeadCount - monthlyLimit);
}
