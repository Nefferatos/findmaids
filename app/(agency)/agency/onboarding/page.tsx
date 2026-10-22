import { AgencyOnboarding } from "@/components/agency-onboarding";
import { Container } from "@/components/site";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import Link from "next/link";

export const metadata = {
  title: "Agency profile setup | FindMaids",
  robots: { index: false, follow: false },
};

export default async function AgencyOnboardingPage() {
  const user = await requireRole(["AGENCY"]);
  const [agency, draft] = await Promise.all([
    prisma.agency.findUnique({ where: { ownerId: user.id } }),
    prisma.agencyOnboardingDraft.findUnique({ where: { userId: user.id } }),
  ]);
  if (agency)
    return (
      <Container className="py-12">
        <section className="mx-auto max-w-2xl rounded-md border bg-white p-8">
          <p className="text-primary text-sm font-bold uppercase">
            Agency profile status
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold">
            {agency.status === "APPROVED"
              ? "Approved"
              : agency.status === "NEEDS_CHANGES"
                ? "Changes requested"
                : agency.status === "SUSPENDED"
                  ? "Suspended"
                  : "Pending approval"}
          </h1>
          <p className="text-muted-foreground mt-4 leading-7">
            {agency.status === "APPROVED"
              ? "Your listing is approved. Manage your agency from the dashboard."
              : agency.status === "NEEDS_CHANGES"
                ? "Please review the note below and update your profile."
                : "Your profile is with our review team. We will email you when the status changes."}
          </p>
          {agency.adminNote && (
            <p className="mt-4 rounded-md bg-[#fff1bf] p-4 text-sm">
              <strong>Review note:</strong> {agency.adminNote}
            </p>
          )}
          <Link
            href="/agency/dashboard"
            className="bg-primary mt-6 inline-flex min-h-11 items-center rounded-md px-4 font-bold text-white"
          >
            Open agency dashboard
          </Link>
        </section>
      </Container>
    );
  return (
    <Container className="py-10">
      <AgencyOnboarding
        initialData={(draft?.data as Record<string, unknown>) ?? {}}
        initialStep={draft?.currentStep ?? 1}
      />
    </Container>
  );
}
