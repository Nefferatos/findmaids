import { requireOwnedAgency } from "@/lib/agency";
import { agencyMenuItem } from "@/lib/agency-menu";
import { AgencyPageHeading } from "@/components/agency/agency-page-heading";
import { AgencyAiSettings } from "@/components/agency-ai-settings";

export const metadata = {
  title: "AI assistant | FindMaids",
  robots: { index: false, follow: false },
};

export default async function AgencyAiAssistantPage() {
  await requireOwnedAgency();

  return (
    <AgencyPageHeading item={agencyMenuItem("ai-assistant")}>
      <AgencyAiSettings />
    </AgencyPageHeading>
  );
}
