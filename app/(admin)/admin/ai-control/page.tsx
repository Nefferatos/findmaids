import { AdminAiControl } from "@/components/admin-ai-control";
import { Container, SectionHeading } from "@/components/site";
import { requireAdminPermission } from "@/lib/admin-auth";
export const metadata = {
  title: "AI Control | FindMaids Admin",
  robots: { index: false, follow: false },
};
export default async function AiControlPage() {
  await requireAdminPermission("settings");
  return (
    <Container className="py-8">
      <SectionHeading
        eyebrow="Safety and usage"
        title="AI Control"
        description="Control feature availability, review masked provider usage, and disable AI globally."
      />
      <AdminAiControl />
    </Container>
  );
}
