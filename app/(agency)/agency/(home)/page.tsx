import { requireOwnedAgency } from "@/lib/agency";
import { prisma } from "@/lib/prisma";
import { AgencyHomeMenu } from "@/components/agency/agency-home-menu";

export const metadata = {
  title: "Maid Agency Account Management | FindMaids",
  robots: { index: false, follow: false },
};

/** Launcher page at /agency. */
export default async function AgencyHomePage() {
  const { agency } = await requireOwnedAgency();
  const counts = await prisma.maid.groupBy({
    by: ["published"],
    where: { agencyId: agency.id },
    _count: { _all: true },
  });
  const visible = counts.find((row) => row.published)?._count._all ?? 0;
  const hidden = counts.find((row) => !row.published)?._count._all ?? 0;

  return (
    <AgencyHomeMenu
      agencyName={agency.name}
      visible={visible}
      hidden={hidden}
    />
  );
}
