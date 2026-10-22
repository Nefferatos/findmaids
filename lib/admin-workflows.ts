import type { AgencyStatus, PaymentStatus } from "@prisma/client";

const agencyTransitions: Record<AgencyStatus, AgencyStatus[]> = {
  PENDING: ["APPROVED", "NEEDS_CHANGES", "REJECTED", "SUSPENDED"],
  NEEDS_CHANGES: ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"],
  APPROVED: ["SUSPENDED", "PENDING"],
  REJECTED: ["PENDING", "SUSPENDED"],
  SUSPENDED: ["APPROVED", "PENDING", "REJECTED"],
};

export function transitionAgencyStatus(current: AgencyStatus, next: AgencyStatus) {
  if (current === next) return current;
  if (!agencyTransitions[current].includes(next)) throw new Error(`Invalid agency transition: ${current} -> ${next}`);
  return next;
}

export type BankPaymentCheck = "EXACT" | "PARTIAL" | "MISMATCH" | "DUPLICATE_REFERENCE" | "EXPIRED";
export function classifyBankPayment(input: { expected: number; received: number; reference: string; duplicateReference: boolean; expiresAt: Date | null; now?: Date }): BankPaymentCheck {
  if (input.duplicateReference) return "DUPLICATE_REFERENCE";
  if (input.expiresAt && input.expiresAt < (input.now ?? new Date())) return "EXPIRED";
  if (!Number.isFinite(input.received) || input.received <= 0 || !input.reference.trim()) return "MISMATCH";
  if (Math.round(input.received * 100) === Math.round(input.expected * 100)) return "EXACT";
  if (input.received < input.expected) return "PARTIAL";
  return "MISMATCH";
}

export function calculateRefund(previousRefunded: number, originalAmount: number, requested: number, confirmed: boolean) {
  if (!confirmed) throw new Error("Refund requires explicit ADMIN confirmation.");
  if (![previousRefunded, originalAmount, requested].every(Number.isFinite) || requested <= 0 || requested > originalAmount - previousRefunded) throw new Error("Refund amount exceeds the unrefunded amount.");
  const refunded = Math.round((previousRefunded + requested) * 100) / 100;
  return { refunded, fullyRefunded: refunded >= Math.round(originalAmount * 100) / 100, remaining: Math.max(0, Math.round((originalAmount - refunded) * 100) / 100) };
}

export function paymentStatusAfterReconciliation(check: BankPaymentCheck): PaymentStatus {
  if (check === "EXACT") return "PAID";
  if (check === "PARTIAL") return "PARTIAL";
  if (check === "EXPIRED") return "EXPIRED";
  return "PENDING_BANK_TRANSFER";
}
