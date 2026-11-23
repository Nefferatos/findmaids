import { requireOwnedAgency } from "@/lib/agency";
import { agencyMenuItem } from "@/lib/agency-menu";
import { prisma } from "@/lib/prisma";
import { AGENCY_MAID_LIMIT } from "@/lib/maids";
import { toAgencyMaid } from "@/lib/maid-profile";
import { AgencyPageHeading } from "@/components/agency/agency-page-heading";
import { AgencyMaidManager } from "@/components/agency-maid-manager";

export const metadata = {
  title: "Add Maids | FindMaids",
  robots: { index: false, follow: false },
};

export default async function AgencyAddMaidPage() {
  const { agency, readOnly } = await requireOwnedAgency();
  const maids = await prisma.maid.findMany({
    where: { agencyId: agency.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return (
    <AgencyPageHeading item={agencyMenuItem("add-maids")}>
      <AgencyMaidManager
        initialMaids={maids.map(toAgencyMaid)}
        limit={AGENCY_MAID_LIMIT}
        readOnly={readOnly}
        mode="add"
      />
    </AgencyPageHeading>
  );
}
