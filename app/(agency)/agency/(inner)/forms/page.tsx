import { requireOwnedAgency } from "@/lib/agency";
import { agencyMenuItem } from "@/lib/agency-menu";
import { prisma } from "@/lib/prisma";
import { AgencyPageHeading } from "@/components/agency/agency-page-heading";
import { AgencyContractBuilder } from "@/components/agency-contract-builder";

export const metadata = {
  title: "Employment Contracts & Forms | FindMaids",
  robots: { index: false, follow: false },
};

export default async function AgencyFormsPage() {
  const { agency } = await requireOwnedAgency();
  const maids = await prisma.maid.findMany({
    where: { agencyId: agency.id },
    orderBy: { reference: "asc" },
  });

  return (
    <AgencyPageHeading item={agencyMenuItem("contracts")}>
      <h2 className="text-[15px] font-bold text-[#1f3a7a]">
        Available documents
      </h2>
      <ul className="mt-2 mb-5 list-disc pl-5 text-[12.5px]">
        <li>
          Employment contract — choose a maid below, then print or save as PDF.
        </li>
        <li>
          Maid biodata summary — same builder, switch the document type, then
          print or save as PDF.
        </li>
      </ul>
      <AgencyContractBuilder
        agency={{
          name: agency.name,
          licenseNumber: agency.licenseNumber,
          address: agency.address,
          city: agency.city,
          province: agency.province,
          phone: agency.phone,
          email: agency.email,
        }}
        maids={maids.map((maid) => ({
          id: maid.id,
          reference: maid.reference,
          nationality: maid.nationality,
          languages: maid.languages,
          duties: maid.duties,
          monthlySalary: maid.monthlySalary,
          placementType: maid.placementType,
          availableFrom: maid.availableFrom,
        }))}
      />
    </AgencyPageHeading>
  );
}
