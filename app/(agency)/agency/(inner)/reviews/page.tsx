import { requireOwnedAgency } from "@/lib/agency";
import { agencyMenuItem } from "@/lib/agency-menu";
import { prisma } from "@/lib/prisma";
import { AgencyPageHeading } from "@/components/agency/agency-page-heading";
import {
  ReportReviewButton,
  ReviewReplyForm,
} from "@/components/agency-dashboard-forms";

export const metadata = {
  title: "Reviews | FindMaids",
  robots: { index: false, follow: false },
};

export default async function AgencyReviewsPage() {
  const { agency } = await requireOwnedAgency();
  const reviews = await prisma.review.findMany({
    where: { agencyId: agency.id, status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <AgencyPageHeading item={agencyMenuItem("reviews")}>
      {reviews.length ? (
        <ul className="space-y-5">
          {reviews.map((review) => (
            <li key={review.id} className="border-b border-[#dddddd] pb-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold">{review.title}</p>
                <p className="text-[12px]">
                  {"★".repeat(review.rating)}
                  {"☆".repeat(Math.max(0, 5 - review.rating))}
                </p>
              </div>
              <p className="mt-1 text-[11.5px] text-[#666]">
                {review.authorName} ·{" "}
                {review.createdAt.toLocaleDateString("en-SG", {
                  timeZone: "Asia/Singapore",
                })}
              </p>
              <p className="mt-2 text-[12.5px]">{review.body}</p>
              {review.agencyReply ? (
                <p className="mt-2 bg-[#f2f2f2] p-2 text-[12.5px]">
                  <strong>Your reply:</strong> {review.agencyReply}
                </p>
              ) : null}
              <ReviewReplyForm reviewId={review.id} />
              <div className="mt-2">
                <ReportReviewButton reviewId={review.id} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-[#666]">No published reviews yet.</p>
      )}
    </AgencyPageHeading>
  );
}
