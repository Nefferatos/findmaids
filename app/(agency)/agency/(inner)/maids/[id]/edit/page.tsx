import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwnedAgency } from "@/lib/agency";
import { agencyMenuItem } from "@/lib/agency-menu";
import { prisma } from "@/lib/prisma";
import { AGENCY_MAID_LIMIT } from "@/lib/maids";
import { toAgencyMaid } from "@/lib/maid-profile";
import { AgencyPageHeading } from "@/components/agency/agency-page-heading";
import { AgencyMaidManager } from "@/components/agency-maid-manager";

export const metadata = {
  title: "Edit maid | FindMaids",
  robots: { index: false, follow: false },
};

export default async function AgencyEditMaidPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { agency, readOnly } = await requireOwnedAgency();
  const maid = await prisma.maid.findFirst({
    where: { id, agencyId: agency.id },
  });
  if (!maid) notFound();
  const profile = toAgencyMaid(maid);

  return (
    <AgencyPageHeading
      item={agencyMenuItem("manage-maids")}
      title={`Edit maid ${profile.fullName || profile.reference}`}
      description="Update this maid's biodata, photos and visibility, or remove the profile."
    >
      <p className="mb-3 text-[12px] text-[#666]">
        <Link href="/agency/maids" className="underline">
          ← Back to all maids
        </Link>
      </p>
      <AgencyMaidManager
        initialMaids={[profile]}
        limit={AGENCY_MAID_LIMIT}
        readOnly={readOnly}
        mode="manage"
        openMaidId={profile.id}
      />
    </AgencyPageHeading>
  );
}
