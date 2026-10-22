import { ApprovalQueue } from "@/components/admin-review-queues";
import { Container, SectionHeading } from "@/components/site";
import { requireAdminPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { approvalQueueAgeHours } from "@/lib/agency-review";

export const metadata = { title: "Agency approvals | FindMaids Admin", robots: { index: false, follow: false } };

export default async function AdminApprovalsPage() {
  await requireAdminPermission("approvals");
  const agencies = await prisma.agency.findMany({ where: { status: "PENDING" }, include: { photos: { orderBy: { sortOrder: "asc" } }, reviews: { where: { status: "PUBLISHED" }, take: 5 }, owner: { select: { email: true, name: true } } }, orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }], take: 300 });
  const items = await Promise.all(agencies.map(async (agency) => {
    const duplicateSignals = [
      ...(agency.licenseNumber ? [{ licenseNumber: agency.licenseNumber }] : []),
      { phone: agency.phone },
      { email: agency.email },
      { AND: [{ name: { equals: agency.name, mode: "insensitive" as const } }, { address: { equals: agency.address, mode: "insensitive" as const } }] },
    ];
    const duplicates = await prisma.agency.findMany({ where: { id: { not: agency.id }, OR: duplicateSignals }, select: { id: true, name: true, slug: true }, take: 10 });
    const submitted = agency.submittedAt ?? agency.createdAt;
    const waitHours = approvalQueueAgeHours(submitted);
    return { ...agency, submittedAt: agency.submittedAt?.toISOString() ?? null, createdAt: agency.createdAt.toISOString(), waitHours, slaBreached: waitHours > 48, duplicates };
  }));
  return <Container className="py-8"><SectionHeading eyebrow="Agency workflow" title="Approvals" description="Oldest submissions first. SLA warning appears after 48 hours."/><ApprovalQueue initialAgencies={items}/></Container>;
}
