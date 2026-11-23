import { requireOwnedAgency } from "@/lib/agency";
import { agencyMenuItem } from "@/lib/agency-menu";
import { prisma } from "@/lib/prisma";
import { AgencyPageHeading } from "@/components/agency/agency-page-heading";

export const metadata = {
  title: "Advertising | FindMaids",
  robots: { index: false, follow: false },
};

const dateFmt = (value: Date) =>
  value.toLocaleDateString("en-SG", { timeZone: "Asia/Singapore" });

export default async function AgencyAdvertisingPage() {
  const { agency } = await requireOwnedAgency();
  const placements = await prisma.adPlacement.findMany({
    where: { agencyId: agency.id },
    orderBy: { startDate: "desc" },
    take: 30,
  });

  return (
    <AgencyPageHeading item={agencyMenuItem("advertising")}>
      {placements.length ? (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Start</th>
                <th>End</th>
                <th>Impressions</th>
                <th>Clicks</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {placements.map((placement) => (
                <tr key={placement.id}>
                  <td>{placement.type}</td>
                  <td>{dateFmt(placement.startDate)}</td>
                  <td>{dateFmt(placement.endDate)}</td>
                  <td>{placement.impressions}</td>
                  <td>{placement.clicks}</td>
                  <td>{placement.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[12.5px] text-[#666]">No placements active.</p>
      )}
    </AgencyPageHeading>
  );
}
