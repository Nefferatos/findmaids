import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/agency-dashboard-forms";
import { Container, SectionHeading } from "@/components/site";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Choose a plan | FindMaids",
  robots: { index: false, follow: false },
};

export default async function AgencyCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    redirect("/login?callbackUrl=%2Fagency%2Fbilling%2Fcheckout");
  const [{ plan: initialPlanId }, plans, agency] = await Promise.all([
    searchParams,
    prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { listingPriority: "asc" },
    }),
    prisma.agency.findUnique({
      where: { ownerId: session.user.id },
      select: { status: true },
    }),
  ]);
  if (!agency || agency.status !== "APPROVED") redirect("/agency/onboarding");
  return (
    <Container className="max-w-3xl py-10">
      <SectionHeading
        eyebrow="Agency billing"
        title="Choose a listing plan"
        description="Upgrade visibility and listing capacity. Downgrades are scheduled for renewal; eligible upgrades are prorated."
      />
      <CheckoutForm
        initialPlanId={initialPlanId}
        plans={plans.map((plan) => ({
          ...plan,
          priceMonthly: plan.priceMonthly.toNumber(),
          priceYearly: plan.priceYearly.toNumber(),
        }))}
      />
      <p className="text-muted-foreground mt-4 text-xs leading-5">
        Checkout is hosted by the payment provider. Card and wallet credentials
        are never stored in FindMaids.
      </p>
    </Container>
  );
}
