import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Sparkles, Star } from "lucide-react";
import { Container } from "@/components/site";
import { DirectoryPanel } from "@/components/directory";
import { sampleDataEnabled } from "@/lib/sample-data";
import {
  demoAgencies,
  demoAgencyLeads,
  demoAgencyNames,
  demoAgencyOverview,
  demoAgencyReviews,
  demoRosterNationalities,
  filterDemoAgencyRoster,
  type DemoMaidStatus,
} from "@/lib/demo-listings";

export const metadata = {
  title: "Sample agency dashboard | FindMaids",
  description:
    "A fictional preview of the FindMaids agency workspace, including a sample maid roster.",
  robots: { index: false, follow: false },
};

const statusTone: Record<DemoMaidStatus, string> = {
  Available: "dir-status-available",
  "On hold": "dir-status-hold",
  Placed: "dir-status-placed",
};

const statusOptions: DemoMaidStatus[] = ["Available", "On hold", "Placed"];

export default async function SampleAgencyDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    agency?: string;
    nationality?: string;
    status?: string;
  }>;
}) {
  const params = await searchParams;
  // Sample data is a local/preview tool: hide the page on any live deployment.
  if (!sampleDataEnabled()) notFound();
  const names = demoAgencyNames();
  const selectedAgency =
    params.agency && names.includes(params.agency) ? params.agency : names[0];
  const nationality = params.nationality?.trim() ?? "";
  const status = params.status?.trim() ?? "";
  const roster = filterDemoAgencyRoster({
    agency: selectedAgency,
    nationality: nationality || undefined,
    status: status || undefined,
  });
  const fullRoster = filterDemoAgencyRoster({ agency: selectedAgency });
  const nationalities = demoRosterNationalities(selectedAgency);
  const profile = demoAgencies.find((agency) => agency.name === selectedAgency);
  const filtersActive = Boolean(nationality || status);

  return (
    <Container className="py-5 sm:py-6">
      <div className="demo-notice mb-3 rounded border p-3">
        <p className="flex items-center gap-2 text-sm font-bold">
          <Sparkles aria-hidden="true" className="size-4" />
          Sample agency account — fictional preview
        </p>
        <p className="mt-1 text-xs leading-5">
          This page shows what a maid agency sees inside FindMaids. Every agency,
          maid, lead and review below is fictional and is not stored in the
          database. Nothing here is available for placement or contact.
        </p>
      </div>

      <div className="dir-employer-bar">
        <div>
          <p className="dir-employer-kicker">Agency workspace · sample</p>
          <h1 className="dir-employer-title">{selectedAgency}</h1>
          <p className="dir-employer-note">
            {profile?.area ?? "Singapore"} · {demoAgencyOverview.planName} plan ·{" "}
            {demoAgencyOverview.profileCompleteness}% profile completeness
          </p>
        </div>
        <nav aria-label="Sample agency shortcuts" className="dir-employer-links">
          <a href="#sample-maids" className="dir-chip">
            Your maids ({fullRoster.length})
          </a>
          <a href="#sample-leads" className="dir-chip">
            Leads
          </a>
          <Link
            href="/login?callbackUrl=/agency/dashboard"
            className="dir-chip"
          >
            Open the real dashboard
          </Link>
          <Link href="/sample/maids" className="dir-chip">
            Sample maid profiles
          </Link>
        </nav>
      </div>

      <div className="dir-grid">
        <div className="dir-main">
          <div className="dir-col">
            <DirectoryPanel title="At a glance" note="Last 30 days">
              <div className="dir-stat-grid">
                {[
                  ["Profile views", demoAgencyOverview.profileViews30d],
                  ["Contact clicks", demoAgencyOverview.contactClicks30d],
                  [
                    "Enquiries this month",
                    demoAgencyOverview.enquiriesThisMonth,
                  ],
                  [
                    "Responded within 24h",
                    `${demoAgencyOverview.respondedWithin24h}%`,
                  ],
                  [
                    "Average rating",
                    `${demoAgencyOverview.averageRating.toFixed(1)} (${demoAgencyOverview.reviewCount})`,
                  ],
                ].map(([label, value]) => (
                  <div key={String(label)} className="dir-stat">
                    <p className="dir-stat-label">{label}</p>
                    <p className="dir-stat-value">{value}</p>
                  </div>
                ))}
              </div>
            </DirectoryPanel>
            <DirectoryPanel
              id="sample-maids"
              title="Your maids"
              note={`${roster.length} of ${fullRoster.length} shown`}
            >
              <form
                action="/sample/agency-dashboard"
                method="get"
                className="dir-search"
              >
                <label className="dir-field">
                  <span>Agency</span>
                  <select name="agency" defaultValue={selectedAgency}>
                    {names.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="dir-field">
                  <span>Nationality</span>
                  <select name="nationality" defaultValue={nationality}>
                    <option value="">All nationalities</option>
                    {nationalities.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="dir-field">
                  <span>Status</span>
                  <select name="status" defaultValue={status}>
                    <option value="">All statuses</option>
                    {statusOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="dir-search-actions">
                  <button type="submit" className="dir-btn-primary">
                    Apply filters
                  </button>
                  <Link
                    href="/sample/agency-dashboard"
                    className="dir-btn-outline"
                  >
                    Clear
                  </Link>
                </div>
              </form>

              <ul className="dir-maid-list">
                {roster.map((maid) => (
                  <li key={maid.reference} className="dir-maid">
                    <span className="dir-maid-avatar" aria-hidden="true">
                      {maid.reference.slice(-3)}
                    </span>
                    <div className="dir-maid-main">
                      <h3 className="dir-maid-title">
                        Sample maid {maid.reference.slice(-3)}
                        <span
                          className={`dir-status ${statusTone[maid.status]}`}
                        >
                          {maid.status}
                        </span>
                      </h3>
                      <p className="dir-maid-meta">
                        {maid.nationality} · Age {maid.age} ·{" "}
                        {maid.placementType}
                      </p>
                      <p className="dir-maid-line">
                        <span className="dir-card-label">Languages</span>
                        {maid.languages.join(", ")}
                      </p>
                      <p className="dir-maid-line">
                        <span className="dir-card-label">Duties</span>
                        {maid.duties.join(", ")}
                      </p>
                      <p className="dir-maid-line">
                        <span className="dir-card-label">Experience</span>
                        {maid.experienceYears} years · available{" "}
                        {maid.availableFrom.toLowerCase()}
                      </p>
                    </div>
                    <div className="dir-maid-side">
                      <span className="dir-maid-rate">
                        S${maid.monthlySalarySgd}/mo
                      </span>
                      <span className="dir-maid-hint">Fictional record</span>
                    </div>
                  </li>
                ))}
              </ul>
              {roster.length === 0 && (
                <p className="dir-empty">
                  No sample maids match those filters.{" "}
                  {filtersActive && (
                    <Link
                      href="/sample/agency-dashboard"
                      className="underline"
                    >
                      Clear the filters
                    </Link>
                  )}
                </p>
              )}
              <p className="dir-trust">
                Roster records are illustrative only: no real person, photo,
                salary commitment or availability is represented. Agencies add
                their own workers through the agency dashboard in production.
              </p>
            </DirectoryPanel>

            <DirectoryPanel id="sample-leads" title="Lead inbox" note="Sample">
              <ul className="dir-enquiry-list">
                {demoAgencyLeads.map((lead) => (
                  <li key={lead.reference}>
                    <div className="dir-enquiry-head">
                      <span className="dir-enquiry-agency">{lead.name}</span>
                      <span className="dir-recent-meta">{lead.received}</span>
                    </div>
                    <p className="dir-enquiry-message">{lead.summary}</p>
                    <p className="dir-enquiry-status">{lead.status}</p>
                  </li>
                ))}
              </ul>
            </DirectoryPanel>

            <DirectoryPanel
              title="How your listing appears in the directory"
              href="/sample/agencies"
              actionLabel="Sample cards"
            >
              <div className="dir-listing-preview">
                <h3 className="dir-card-title">
                  {selectedAgency}
                  <span className="dir-flag">Verified (sample)</span>
                </h3>
                <p className="dir-card-meta">{profile?.area}</p>
                <p className="dir-card-line">{profile?.description}</p>
                <p className="dir-card-line">
                  <span className="dir-card-label">Services</span>
                  {profile?.services.join(", ")}
                </p>
                <p className="dir-card-line">
                  <span className="dir-card-label">Nationalities</span>
                  {profile?.nationalities.join(", ")}
                </p>
                <p className="dir-card-line">
                  <span className="dir-card-label">Languages</span>
                  {profile?.languages.join(", ")}
                </p>
                <span className="dir-rating">
                  <Star aria-hidden="true" className="size-3" />
                  {demoAgencyOverview.averageRating.toFixed(1)}
                  <em>({demoAgencyOverview.reviewCount} reviews)</em>
                </span>
              </div>
            </DirectoryPanel>

          </div>
          <div className="dir-rail">
            <DirectoryPanel title="Current listing">
              <p className="dir-card-line">
                <span className="dir-card-label">Plan</span>
                {demoAgencyOverview.planName}
              </p>
              <p className="dir-card-line">
                <span className="dir-card-label">Renews</span>
                {demoAgencyOverview.renewsOn}
              </p>
              <p className="dir-card-line">
                <span className="dir-card-label">Lead allowance</span>
                {demoAgencyOverview.enquiriesThisMonth} /{" "}
                {demoAgencyOverview.leadAllowance} this month
              </p>
              <Link
                href="/login?callbackUrl=/agency/dashboard"
                className="dir-btn-outline dir-btn-block"
              >
                Manage billing (sign in)
              </Link>
            </DirectoryPanel>

            <DirectoryPanel title="Quick actions">
              <ul className="dir-link-list">
                <li>
                  <Link href="/login?callbackUrl=/agency/dashboard">
                    Edit profile
                  </Link>
                </li>
                <li>
                  <Link href="/login?callbackUrl=/agency/dashboard">
                    Open leads
                  </Link>
                </li>
                <li>
                  <Link href="/login?callbackUrl=/agency/dashboard">
                    Add or update maids
                  </Link>
                </li>
                <li>
                  <Link href="/login?callbackUrl=/agency/dashboard">
                    Review analytics
                  </Link>
                </li>
                <li>
                  <Link href="/agencies">View the public directory</Link>
                </li>
              </ul>
            </DirectoryPanel>

            <DirectoryPanel title="Latest reviews" note="Sample">
              <ul className="dir-recent-list">
                {demoAgencyReviews.map((review) => (
                  <li key={review.author}>
                    <span className="dir-recent-name">
                      {review.title} · {review.rating}/5
                    </span>
                    <span className="dir-recent-meta">
                      {review.body} — {review.author}
                    </span>
                  </li>
                ))}
              </ul>
            </DirectoryPanel>
          </div>
        </div>
        <aside className="dir-aside">
          <DirectoryPanel title="About this sample">
            <p className="dir-empty">
              Real agency owners sign in and manage their approved profile,
              enquiries, reviews and plan. This page reuses the same layout with
              fictional data so the design can be reviewed without a database.
            </p>
            <Link href="/advertise" className="dir-btn-primary dir-btn-block">
              Join as a maid agency
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
            <Link
              href="/login?callbackUrl=/agency/dashboard"
              className="dir-btn-outline dir-btn-block"
            >
              Agency login
            </Link>
          </DirectoryPanel>

          <DirectoryPanel title="Other samples" href="/sample/maids">
            <ul className="dir-link-list">
              <li>
                <Link href="/sample/maids">Sample maid profiles</Link>
              </li>
              <li>
                <Link href="/sample/agencies">Sample agency cards</Link>
              </li>
              <li>
                <Link href="/agencies">Live agency directory</Link>
              </li>
              <li>
                <Link href="/">Public homepage</Link>
              </li>
            </ul>
          </DirectoryPanel>
        </aside>

      </div>
    </Container>
  );
}
