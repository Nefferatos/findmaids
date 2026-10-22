import { ReviewModerationQueue } from "@/components/admin-review-queues";
import { Container, SectionHeading } from "@/components/site";
import { requireAdminPermission } from "@/lib/admin-auth";
import { reviewFlags } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Review moderation | FindMaids Admin", robots: { index: false, follow: false } };

export default async function AdminReviewsPage() {
  await requireAdminPermission("reviews");
  const [pending, reported] = await Promise.all([
    prisma.review.findMany({ where: { status: "PENDING" }, include: { agency: { select: { id: true, name: true, slug: true } } }, orderBy: { createdAt: "asc" }, take: 300 }),
    prisma.review.findMany({ where: { status: "PUBLISHED", reportedAt: { not: null } }, include: { agency: { select: { id: true, name: true, slug: true } } }, orderBy: { reportedAt: "asc" }, take: 300 }),
  ]);
  const reviews = [...pending, ...reported];
  const data = await Promise.all(reviews.map(async (review) => ({ ...review, createdAt: review.createdAt.toISOString(), flags: await reviewFlags(review) })));
  return <Container className="py-8"><SectionHeading eyebrow="Moderation" title="Review queue" description="Rule-based flags identify links, configured keywords, and duplicate text. Human moderators make final decisions."/><ReviewModerationQueue initialReviews={data}/></Container>;
}
