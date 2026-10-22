import Link from "next/link";
import { AgencyCharts } from "@/components/agency-charts";
import { DataDeletionForm } from "@/components/data-deletion-form";
import {
  AccountSettingsForm,
  AgencyProfileEditor,
  CancelRenewButton,
  ReviewReplyForm,
  ReportReviewButton,
} from "@/components/agency-dashboard-forms";
import { LeadManager } from "@/components/lead-manager";
import { Badge, Container, SectionHeading } from "@/components/site";
import { calculateProfileCompleteness, requireOwnedAgency } from "@/lib/agency";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Agency dashboard | FindMaids",
  robots: { index: false, follow: false },
};
const tabs = [
  "overview",
  "profile",
  "leads",
  "reviews",
  "billing",
  "ads",
  "analytics",
  "settings",
] as const;
type Tab = (typeof tabs)[number];

export default async function AgencyDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ agency }, params] = await Promise.all([
    requireOwnedAgency(),
    searchParams,
  ]);
  const tab = tabs.includes(params.view as Tab)
    ? (params.view as Tab)
    : "overview";
  const now = new Date();
  const chartStart = new Date(now.getTime() - 90 * 86_400_000);
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const [
    profile,
    active,
    leadCount,
    recentLeads,
    reviews,
    placements,
    payments,
    events,
    plans,
    user,
  ] = await Promise.all([
    prisma.agency.findUnique({
      where: { id: agency.id },
      include: { photos: true },
    }),
    prisma.subscription.findFirst({
      where: { agencyId: agency.id, status: "ACTIVE" },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.enquiry.count({
      where: { agencyId: agency.id, createdAt: { gte: monthStart } },
    }),
    tab === "leads"
      ? prisma.enquiry.findMany({
          where: { agencyId: agency.id },
          orderBy: { createdAt: "desc" },
          take: 250,
        })
      : Promise.resolve([]),
    prisma.review.findMany({
      where: { agencyId: agency.id, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.adPlacement.findMany({
      where: { agencyId: agency.id },
      orderBy: { startDate: "desc" },
      take: 30,
    }),
    prisma.payment.findMany({
      where: { subscription: { agencyId: agency.id } },
      include: { subscription: { include: { plan: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.analyticsEvent.findMany({
      where: {
        agencyId: agency.id,
        createdAt: { gte: chartStart },
      },
      select: { type: true, createdAt: true },
    }),
    tab === "billing"
      ? prisma.plan.findMany({
          where: { isActive: true },
          orderBy: { listingPriority: "asc" },
        })
      : Promise.resolve([]),
    prisma.user.findUnique({
      where: { id: agency.ownerId ?? "" },
      select: { name: true, email: true, notificationPreferences: true },
    }),
  ]);
  const completeness = calculateProfileCompleteness(profile ?? agency);
  const leadLimit = active?.plan.leadLimit ?? null;
  const averageRating = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;
  const views = events.filter((event) => event.type === "profile_view").length;
  const clicks = events.filter((event) =>
    ["phone_click", "whatsapp_click", "website_click"].includes(event.type),
  ).length;
  const chartData = Array.from({ length: 90 }, (_, index) => {
    const date = new Date(now.getTime() - (89 - index) * 86_400_000);
    const day = date.toISOString().slice(0, 10);
    const dayEvents = events.filter(
      (event) => event.createdAt.toISOString().slice(0, 10) === day,
    );
    return {
      date: day.slice(5),
      views: dayEvents.filter((event) => event.type === "profile_view").length,
      clicks: dayEvents.filter((event) =>
        ["phone_click", "whatsapp_click", "website_click"].includes(event.type),
      ).length,
      enquiries: 0,
    };
  });

  const nav = (
    <nav
      aria-label="Agency dashboard"
      className="flex gap-2 overflow-x-auto border-b py-3"
    >
      {tabs.map((item) => (
        <Link
          key={item}
          aria-current={tab === item ? "page" : undefined}
          href={`/agency/dashboard?view=${item}`}
          className={`shrink-0 rounded px-3 py-2 text-sm font-semibold capitalize ${tab === item ? "bg-primary text-white" : "hover:bg-muted"}`}
        >
          {item}
        </Link>
      ))}
    </nav>
  );

  if (agency.status !== "APPROVED") {
    return (
      <Container className="py-12">
        <section className="mx-auto max-w-2xl rounded-md border bg-white p-8">
          <Badge
            tone={agency.status === "NEEDS_CHANGES" ? "yellow" : "neutral"}
          >
            {agency.status === "NEEDS_CHANGES"
              ? "Needs changes"
              : "Pending approval"}
          </Badge>
          <h1 className="font-display mt-4 text-3xl font-bold">
            {agency.status === "NEEDS_CHANGES"
              ? "Update your agency profile"
              : "Your profile is under review"}
          </h1>
          <p className="text-muted-foreground mt-3 leading-7">
            {agency.adminNote ||
              "Your listing will become visible after it is approved. We will email you when the status changes."}
          </p>
          <Link
            className="bg-primary mt-5 inline-flex min-h-11 items-center rounded-md px-4 font-bold text-white"
            href="/agency/onboarding"
          >
            Review onboarding
          </Link>
          {agency.status === "NEEDS_CHANGES" && (
            <div className="mt-8">
              <AgencyProfileEditor agency={agency} />
            </div>
          )}
        </section>
      </Container>
    );
  }

  return (
    <Container className="py-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-primary text-sm font-bold uppercase">
            Agency workspace
          </p>
          <h1 className="font-display mt-1 text-3xl font-bold">
            {agency.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Agency dashboard</p>
        </div>
        <div className="min-w-52 rounded-md border bg-white p-3">
          <div className="flex justify-between text-sm">
            <span>Profile completeness</span>
            <strong>{completeness}%</strong>
          </div>
          <div className="bg-muted mt-2 h-2 overflow-hidden rounded">
            <div
              className="bg-primary h-full"
              style={{ width: `${completeness}%` }}
            />
          </div>
        </div>
      </div>
      {nav}
      <div className="pt-7">
        {tab === "overview" && (
          <>
            <SectionHeading
              eyebrow="Overview"
              title="Your agency at a glance"
              description="Performance for your approved directory profile."
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Profile views", views],
                ["Contact clicks", clicks],
                ["Enquiries this month", leadCount],
                [
                  "Average rating",
                  `${averageRating.toFixed(1)} (${reviews.length})`,
                ],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-md border bg-white p-4"
                >
                  <p className="text-muted-foreground text-sm">{label}</p>
                  <p className="mt-2 text-2xl font-bold">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-md border bg-white p-5">
                <h2 className="font-display text-xl font-bold">
                  Current listing
                </h2>
                <p className="mt-2">
                  {active?.plan.name ?? "Basic Free"}
                  {active?.endDate
                    ? ` · renews/expires ${active.endDate.toLocaleDateString("en-PH")}`
                    : ""}
                </p>
                <p className="text-muted-foreground mt-2 text-sm">
                  Lead allowance:{" "}
                  {leadLimit === null
                    ? "Unlimited"
                    : `${leadCount} / ${leadLimit} this month`}
                </p>
                <Link
                  className="text-primary mt-4 inline-block font-bold underline"
                  href="/agency/dashboard?view=billing"
                >
                  Manage billing
                </Link>
              </div>
              <div className="rounded-md border bg-white p-5">
                <h2 className="font-display text-xl font-bold">
                  Quick actions
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    className="rounded border px-3 py-2 text-sm font-semibold"
                    href="/agency/dashboard?view=profile"
                  >
                    Edit profile
                  </Link>
                  <Link
                    className="rounded border px-3 py-2 text-sm font-semibold"
                    href="/agency/dashboard?view=leads"
                  >
                    Open leads
                  </Link>
                  <Link
                    className="rounded border px-3 py-2 text-sm font-semibold"
                    href={`/agencies/${agency.slug}`}
                    target="_blank"
                  >
                    View public profile
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
        {tab === "profile" && profile && (
          <>
            <SectionHeading
              eyebrow="Profile editor"
              title="Agency details"
              description="Name and licence changes are sent for review before they appear publicly."
            />
            <AgencyProfileEditor agency={profile} />
          </>
        )}
        {tab === "leads" && (
          <>
            <SectionHeading
              eyebrow="Enquiries"
              title="Lead inbox"
              description={
                leadLimit === null
                  ? "Review and respond to enquiries sent to your agency."
                  : `Plan allowance: ${leadCount} / ${leadLimit} enquiries this month.`
              }
            />
            {leadLimit !== null && leadCount >= leadLimit && (
              <p className="mb-4 rounded-md bg-[#fff1bf] p-4 text-sm">
                Your monthly lead limit is reached. New enquiries are rejected
                with an upgrade prompt.{" "}
                <Link
                  className="font-bold underline"
                  href="/agency/dashboard?view=billing"
                >
                  Review upgrade plans
                </Link>
              </p>
            )}
            <LeadManager
              leads={recentLeads.map((lead) => ({
                ...lead,
                createdAt: lead.createdAt.toISOString(),
              }))}
            />
          </>
        )}
        {tab === "reviews" && (
          <>
            <SectionHeading
              eyebrow="Reputation"
              title="Published reviews"
              description="Reply publicly to published reviews."
            />
            {reviews.length ? (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <article
                    key={review.id}
                    className="rounded-md border bg-white p-5"
                  >
                    <div className="flex justify-between gap-3">
                      <h2 className="font-bold">{review.title}</h2>
                      <span aria-label={`${review.rating} out of 5 stars`}>
                        ★ {review.rating}/5
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6">{review.body}</p>
                    <p className="text-muted-foreground mt-2 text-xs">
                      {review.authorName} ·{" "}
                      {review.createdAt.toLocaleDateString("en-PH")}
                    </p>
                    {review.agencyReply && (
                      <p className="mt-3 rounded bg-[#f7f7f0] p-3 text-sm">
                        <strong>Your reply:</strong> {review.agencyReply}
                      </p>
                    )}
                    <ReviewReplyForm reviewId={review.id} />
                    <ReportReviewButton reviewId={review.id} />
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground rounded-md border bg-white p-6">
                No published reviews yet.
              </p>
            )}
          </>
        )}
        {tab === "billing" && (
          <>
            <SectionHeading
              eyebrow="Billing"
              title="Plan and payments"
              description="Provider-hosted checkout; FindMaids does not store card details."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-md border bg-white p-5">
                <h2 className="font-display text-xl font-bold">Current plan</h2>
                <p className="mt-2 text-lg font-semibold">
                  {active?.plan.name ?? "Basic Free"}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {active?.endDate
                    ? `Period ends ${active.endDate.toLocaleDateString("en-PH")}`
                    : "No paid plan active"}
                </p>
                {active && active.plan.priceMonthly.toNumber() > 0 && (
                  <div className="mt-4">
                    <CancelRenewButton />
                  </div>
                )}
              </section>
              <section className="rounded-md border bg-white p-5">
                <h2 className="font-display text-xl font-bold">Change plan</h2>
                <Link
                  href="/agency/billing/checkout"
                  className="bg-primary mt-4 inline-flex min-h-11 items-center rounded-md px-4 font-bold text-white"
                >
                  Compare plans and checkout
                </Link>
              </section>
            </div>
            <section className="mt-6 rounded-md border bg-white">
              <h2 className="font-display border-b p-4 text-xl font-bold">
                Invoices and payment history
              </h2>
              {payments.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#f7f7f0]">
                      <tr>
                        <th className="p-3">Invoice</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Plan</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr className="border-t" key={payment.id}>
                          <td className="p-3">{payment.invoiceNumber}</td>
                          <td className="p-3">
                            {payment.createdAt.toLocaleDateString("en-PH")}
                          </td>
                          <td className="p-3">
                            {payment.subscription.plan.name}
                          </td>
                          <td className="p-3">
                            ₱
                            {Number(payment.amount).toLocaleString("en-PH", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="p-3">{payment.status}</td>
                          <td className="p-3">
                            {payment.status === "PAID" && (
                              <a
                                className="text-primary font-semibold underline"
                                href={`/api/agency/invoices/${payment.id}`}
                              >
                                Download PDF
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground p-5 text-sm">
                  No payments yet.
                </p>
              )}
            </section>
            {plans.length > 0 && (
              <p className="text-muted-foreground mt-4 text-sm">
                Available plan records:{" "}
                {plans.map((plan) => plan.name).join(" · ")}
              </p>
            )}
          </>
        )}
        {tab === "ads" && (
          <>
            <SectionHeading
              eyebrow="Advertising"
              title="Placements"
              description="Active paid placements display a Featured / Sponsored label publicly."
            />
            <div className="overflow-x-auto rounded-md border bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f7f7f0]">
                  <tr>
                    <th className="p-3">Placement</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Dates</th>
                    <th className="p-3">Impressions</th>
                    <th className="p-3">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {placements.map((placement) => (
                    <tr className="border-t" key={placement.id}>
                      <td className="p-3">{placement.type}</td>
                      <td className="p-3">{placement.status}</td>
                      <td className="p-3">
                        {placement.startDate.toLocaleDateString("en-PH")} –{" "}
                        {placement.endDate.toLocaleDateString("en-PH")}
                      </td>
                      <td className="p-3">{placement.impressions}</td>
                      <td className="p-3">{placement.clicks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {placements.length === 0 && (
                <p className="text-muted-foreground p-5 text-sm">
                  No placements active.
                </p>
              )}
            </div>
          </>
        )}
        {tab === "analytics" && (
          <>
            <SectionHeading
              eyebrow="Analytics"
              title="Profile activity"
              description="Daily views and contact clicks for up to 90 days."
            />
            <AgencyCharts data={chartData} />
          </>
        )}
        {tab === "settings" && (
          <>
            <SectionHeading eyebrow="Account" title="Settings" />
            <AccountSettingsForm
              name={user?.name ?? null}
              email={user?.email ?? agency.email}
              preferences={user?.notificationPreferences}
            />
            <section className="mt-6 rounded-md border bg-white p-5">
              <h2 className="font-display text-xl font-bold">
                Personal data request
              </h2>
              <p className="text-muted-foreground my-2 text-sm">
                Submit a data access, correction, or deletion request. Requests
                are verified and reviewed under the retention policy. Policy
                language is a draft pending legal review.
              </p>
              <DataDeletionForm email={user?.email ?? agency.email} />
              <Link
                className="text-primary font-semibold underline"
                href="/privacy"
              >
                Read the draft Privacy notice
              </Link>
              <span className="mx-3">·</span>
              <Link
                className="text-primary font-semibold underline"
                href="/contact"
              >
                Contact support
              </Link>
            </section>
          </>
        )}
      </div>
    </Container>
  );
}
