import { PlanEditor } from "@/components/admin-tools";
import { Container, SectionHeading } from "@/components/site";
import { requireAdminPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
export const metadata = {
  title: "Plans | FindMaids Admin",
  robots: { index: false, follow: false },
};
export default async function PlansPage() {
  await requireAdminPermission("plans");
  const plans = await prisma.plan.findMany({
    include: { _count: { select: { subscriptions: true } } },
    orderBy: { listingPriority: "asc" },
  });
  return (
    <Container className="py-8">
      <SectionHeading
        eyebrow="Subscriptions"
        title="Plans"
        description="Prices are provisional Singapore-dollar test values and not approved launch pricing."
      />
      <PlanEditor
        initialPlans={plans.map((plan) => ({
          ...plan,
          priceMonthly: Number(plan.priceMonthly),
          priceYearly: Number(plan.priceYearly),
          aiMonthlyBudgetSgd:
            plan.aiMonthlyBudgetSgd === null
              ? null
              : Number(plan.aiMonthlyBudgetSgd),
        }))}
      />
    </Container>
  );
}
