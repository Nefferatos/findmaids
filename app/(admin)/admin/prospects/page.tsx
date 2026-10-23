import { AdminProspects } from "@/components/admin-prospects";
import { Container, SectionHeading } from "@/components/site";
import { requireAdminPermission } from "@/lib/admin-auth";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Prospects | FindMaids Admin", robots: { index: false, follow: false } };

export default async function ProspectsPage() {
  await requireAdminPermission("prospects");
  const owners = await prisma.user.findMany({ where: { role: { in: [UserRole.ADMIN, UserRole.STAFF] }, disabled: false }, select: { id: true, name: true, email: true }, orderBy: { email: "asc" } });
  return (
    <Container className="py-8">
      <SectionHeading eyebrow="Agency acquisition" title="Prospect tracker" description="Track business contacts and follow-up dates. No outreach messages are sent from this tracker." />
      <AdminProspects owners={owners} />
    </Container>
  );
}
