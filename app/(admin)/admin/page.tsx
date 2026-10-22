import Link from "next/link";
import { Container, SectionHeading } from "@/components/site";
import { requireAdminPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Admin dashboard | FindMaids", robots: { index: false, follow: false } };

export default async function AdminPage() {
  await requireAdminPermission("dashboard");
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const [active, pendingAgencies, pendingReviews, pendingBank, newAgencies, currentRevenue, previousRevenue, activePlans, leadsByDay, churned] = await Promise.all([
    prisma.subscription.findMany({ where: { status: "ACTIVE" }, include: { plan: true } }),
    prisma.agency.count({ where: { status: "PENDING" } }),
    prisma.review.count({ where: { status: "PENDING" } }),
    prisma.payment.count({ where: { status: "PENDING_BANK_TRANSFER" } }),
    prisma.agency.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.payment.aggregate({ where: { status: "PAID", paidAt: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "PAID", paidAt: { gte: previousMonth, lt: monthStart } }, _sum: { amount: true } }),
    prisma.subscription.groupBy({ by: ["planId"], where: { status: "ACTIVE" }, _count: { id: true } }),
    prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS count FROM "Enquiry" WHERE "createdAt" >= ${new Date(now.getTime() - 14 * 86_400_000)} GROUP BY 1 ORDER BY 1`,
    prisma.subscription.count({ where: { status: { in: ["EXPIRED", "CANCELLED"] }, updatedAt: { gte: monthStart } } }),
  ]);
  const planNames = await prisma.plan.findMany({ where: { id: { in: activePlans.map((item) => item.planId) } }, select: { id: true, name: true } });
  const planName = new Map(planNames.map((plan) => [plan.id, plan.name]));
  const mrr = active.reduce((sum, subscription) => sum + (subscription.billingPeriod === "YEARLY" ? Number(subscription.plan.priceYearly) / 12 : Number(subscription.plan.priceMonthly)), 0);
  const metrics: [string, string | number][] = [["MRR (PHP)", `₱${mrr.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`], ["Revenue this month", `₱${Number(currentRevenue._sum.amount ?? 0).toLocaleString("en-PH")}`], ["Revenue last month", `₱${Number(previousRevenue._sum.amount ?? 0).toLocaleString("en-PH")}`], ["New agencies", newAgencies], ["Pending approvals", pendingAgencies], ["Pending reviews", pendingReviews], ["Pending bank transfers", pendingBank], ["Churned this month", churned]];
  return <Container className="py-8"><SectionHeading eyebrow="Administration" title="Platform overview" description="Operational metrics for agency listings, payments, and moderation."/><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([title,value])=><div key={title} className="rounded-md border bg-white p-4"><p className="text-sm text-muted-foreground">{title}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</div><div className="mt-7 grid gap-6 lg:grid-cols-2"><section className="rounded-md border bg-white p-5"><h2 className="font-display text-xl font-bold">Active subscriptions by plan</h2><ul className="mt-4 space-y-2">{activePlans.map((item)=><li key={item.planId} className="flex justify-between border-b pb-2 text-sm"><span>{planName.get(item.planId)??"Plan"}</span><strong>{item._count.id}</strong></li>)}</ul></section><section className="rounded-md border bg-white p-5"><h2 className="font-display text-xl font-bold">Leads per day · 14 days</h2><ul className="mt-4 grid grid-cols-2 gap-2 text-sm">{leadsByDay.map((item)=><li key={item.day.toISOString()} className="flex justify-between rounded bg-[#f7f7f0] p-2"><span>{item.day.toLocaleDateString("en-PH",{month:"short",day:"numeric"})}</span><strong>{Number(item.count)}</strong></li>)}</ul></section></div><div className="mt-7 flex flex-wrap gap-2">{[["Approvals","/admin/approvals"],["Bank transfers","/admin/payments"],["Reviews","/admin/reviews"],["Reports","/admin/reports"]].map(([label,href])=><Link key={href} href={href} className="min-h-10 rounded-md border bg-white px-3 py-2 text-sm font-semibold">{label}</Link>)}</div></Container>;
}
