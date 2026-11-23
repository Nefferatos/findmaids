import Link from "next/link";
import { requireOwnedAgency } from "@/lib/agency";
import { agencyMenuItem } from "@/lib/agency-menu";
import { prisma } from "@/lib/prisma";
import { AgencyPageHeading } from "@/components/agency/agency-page-heading";
import { CancelRenewButton } from "@/components/agency-dashboard-forms";

export const metadata = {
  title: "Billing & plan | FindMaids",
  robots: { index: false, follow: false },
};

const sgd = new Intl.NumberFormat("en-SG", {
  style: "currency",
  currency: "SGD",
});

export default async function AgencyBillingPage() {
  const { agency } = await requireOwnedAgency();
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const [active, payments, plans, leadCount, basicPlan] = await Promise.all([
    prisma.subscription.findFirst({
      where: { agencyId: agency.id, status: "ACTIVE" },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.findMany({
      where: { subscription: { agencyId: agency.id } },
      include: { subscription: { include: { plan: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { listingPriority: "asc" },
    }),
    prisma.enquiry.count({
      where: { agencyId: agency.id, createdAt: { gte: monthStart } },
    }),
    prisma.plan.findUnique({ where: { name: "Basic Free" } }),
  ]);
  const leadLimit = active?.plan.leadLimit ?? basicPlan?.leadLimit ?? null;

  return (
    <AgencyPageHeading item={agencyMenuItem("billing")}>
      <h2 className="text-[15px] font-bold text-[#1f3a7a]">Current plan</h2>
      <p className="mt-1 text-[13px] font-bold">
        {active?.plan.name ?? "Basic Free"}
      </p>
      <p className="mt-1 text-[12px]">
        {active?.endDate
          ? `Renews/expires ${active.endDate.toLocaleDateString("en-SG", { timeZone: "Asia/Singapore" })}`
          : "No renewal date on file."}
      </p>
      <p className="mt-1 text-[12px] text-[#666]">
        This month: {leadCount} enquiries
        {leadLimit === null ? "" : ` of ${leadLimit}`}
      </p>
      {active ? (
        <div className="mt-3">
          <CancelRenewButton />
        </div>
      ) : null}

      <h2 className="mt-6 text-[15px] font-bold text-[#1f3a7a]">Payments</h2>
      {payments.length ? (
        <div className="mt-2 overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>
                    {payment.createdAt.toLocaleDateString("en-SG", {
                      timeZone: "Asia/Singapore",
                    })}
                  </td>
                  <td>{payment.subscription.plan.name}</td>
                  <td>{sgd.format(payment.amount.toNumber())}</td>
                  <td>{payment.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-2 text-[12.5px] text-[#666]">No payments yet.</p>
      )}

      {plans.length ? (
        <p className="mt-4 text-[12px] text-[#666]">
          Available plans: {plans.map((plan) => plan.name).join(" · ")}
        </p>
      ) : null}
      <Link href="/agency/billing/checkout" className="ag-btn">
        Change plan
      </Link>
    </AgencyPageHeading>
  );
}
