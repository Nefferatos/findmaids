import { requireOwnedAgency } from "@/lib/agency";
import { agencyMenuItem } from "@/lib/agency-menu";
import { prisma } from "@/lib/prisma";
import { AgencyPageHeading } from "@/components/agency/agency-page-heading";
import { AccountSettingsForm } from "@/components/agency-dashboard-forms";
import { DataDeletionForm } from "@/components/data-deletion-form";

export const metadata = {
  title: "Account settings | FindMaids",
  robots: { index: false, follow: false },
};

export default async function AgencyAccountSettingsPage() {
  const { agency } = await requireOwnedAgency();
  const user = await prisma.user.findUnique({
    where: { id: agency.ownerId ?? "" },
    select: { name: true, email: true, notificationPreferences: true },
  });

  return (
    <AgencyPageHeading item={agencyMenuItem("account-settings")}>
      <AccountSettingsForm
        name={user?.name ?? null}
        email={user?.email ?? agency.email}
        preferences={user?.notificationPreferences}
      />
      <div className="mt-8 border-t border-[#dddddd] pt-5">
        <DataDeletionForm email={user?.email ?? agency.email} />
      </div>
    </AgencyPageHeading>
  );
}
