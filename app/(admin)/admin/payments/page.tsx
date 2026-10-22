import { AdminPaymentsQueue } from "@/components/admin-payments-queue";
import { Container, SectionHeading } from "@/components/site";
import { requireAdminPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Payments | FindMaids Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPaymentsPage() {
  await requireAdminPermission("payments");
  const include = {
    subscription: {
      include: { agency: { select: { name: true, email: true } }, plan: true },
    },
  } as const;
  const [pending, paid] = await Promise.all([
    prisma.payment.findMany({
      where: { status: { in: ["PENDING_BANK_TRANSFER", "PARTIAL"] } },
      include,
      orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
      take: 500,
    }),
    prisma.payment.findMany({
      where: { status: "PAID" },
      include,
      orderBy: { paidAt: "desc" },
      take: 100,
    }),
  ]);
  const data = [...pending, ...paid].map((payment) => ({
    ...payment,
    amount: Number(payment.amount),
    receivedAmount:
      payment.receivedAmount === null ? null : Number(payment.receivedAmount),
    refundAmount:
      payment.refundAmount === null ? null : Number(payment.refundAmount),
    expiresAt: payment.expiresAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
  }));
  return (
    <Container className="py-8">
      <SectionHeading
        eyebrow="Billing operations"
        title="Payments and reconciliation"
        description="Review bank transfer proofs, reconcile exact/partial payments, and keep an auditable payment record."
      />
      <AdminPaymentsQueue initialPayments={data} />
    </Container>
  );
}
