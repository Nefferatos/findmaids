import { requireOwnedAgency } from "@/lib/agency";
import { agencyMenuItem } from "@/lib/agency-menu";
import { AgencyPageHeading } from "@/components/agency/agency-page-heading";
import { AgencyPasswordForm } from "@/components/agency-password-form";

export const metadata = {
  title: "Change Password | FindMaids",
  robots: { index: false, follow: false },
};

export default async function AgencyChangePasswordPage() {
  const { readOnly } = await requireOwnedAgency();

  return (
    <AgencyPageHeading item={agencyMenuItem("password")}>
      {readOnly ? (
        <p className="border border-[#e0c060] bg-[#fff7d6] p-3 text-[12px]">
          Read-only admin impersonation: the password cannot be changed in this
          session.
        </p>
      ) : (
        <AgencyPasswordForm />
      )}
    </AgencyPageHeading>
  );
}
