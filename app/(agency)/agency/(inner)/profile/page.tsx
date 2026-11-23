import { requireOwnedAgency } from "@/lib/agency";
import { prisma } from "@/lib/prisma";
import { agencyMenuItem } from "@/lib/agency-menu";
import { AgencyPageHeading } from "@/components/agency/agency-page-heading";
import { AgencyProfileEditor } from "@/components/agency-dashboard-forms";

export const metadata = {
  title: "Agency Profile | FindMaids",
  robots: { index: false, follow: false },
};

export default async function AgencyProfilePage() {
  const { agency } = await requireOwnedAgency();
  const profile = await prisma.agency.findUnique({
    where: { id: agency.id },
    include: { photos: true },
  });

  return (
    <AgencyPageHeading item={agencyMenuItem("profile")}>
      <p className="mb-4 text-[12px] text-[#666]">
        Name and licence changes are sent for review before they appear
        publicly.
      </p>
      <AgencyProfileEditor agency={profile ?? agency} />
    </AgencyPageHeading>
  );
}
