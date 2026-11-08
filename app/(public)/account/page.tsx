import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  AgencyBannerList,
  ContactAllAgenciesPanel,
  DirectoryPanel,
  DirectoryTrustNote,
  FeaturedAgencyRail,
  MaidCategoryList,
  MaidNewsList,
  MaidSearchPanel,
  NationalitySections,
  RecentListings,
  RequirementsPanel,
  type MaidNewsItem,
} from "@/components/directory";
import { DIRECTORY_NATIONALITIES, getDirectoryHomeData } from "@/lib/directory";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Employer centre | FindMaids",
  description:
    "Search maid agencies, review your enquiries, and manage your FindMaids employer account.",
};

const statusLabels: Record<string, string> = {
  NEW: "Sent",
  CONTACTED: "Agency replied",
  CLOSED: "Closed",
};

const roleLabels: Record<string, string> = {
  VISITOR: "Employer",
  AGENCY: "Agency owner",
  STAFF: "FindMaids staff",
  ADMIN: "Administrator",
};

const newsItems: MaidNewsItem[] = [
  {
    title: "How to compare maid agency profiles before you call",
    href: "/guides/choosing-an-agency",
    summary: "A practical checklist for shortlisting agencies.",
  },
  {
    title: "Preparing questions for an agency interview",
    href: "/guides/preparing-for-a-conversation",
    summary: "What to ask about duties, rest days and replacements.",
  },
  {
    title: "Maid agency enquiries answered",
    href: "/faq",
    summary: "How listings, reviews and enquiries work on FindMaids.",
  },
];

export default async function AccountPage() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) redirect("/login?callbackUrl=/account");

  const role = session.user.role ?? "VISITOR";
  const enquiries = await prisma.enquiry.findMany({
    where: { email },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      status: true,
      createdAt: true,
      message: true,
      agency: { select: { name: true, slug: true } },
    },
  });

  let data: Awaited<ReturnType<typeof getDirectoryHomeData>> | null = null;
  try {
    data = await getDirectoryHomeData({ perSection: 5, bannerLimit: 4 });
  } catch (error) {
    logger.error(
      { errorType: error instanceof Error ? error.name : "unknown" },
      "Unable to load employer directory data",
    );
  }

  const sections = data?.sections ?? [];
  const agencies = data?.agencies ?? [];
  const nationalities = data?.nationalities ?? [...DIRECTORY_NATIONALITIES];
  const services = data?.services.map((entry) => entry.service) ?? [];
  const banners = data?.banners ?? [];
  const recent = data?.recent ?? [];
  const featured = data?.featured.length
    ? data.featured
    : agencies.slice(0, 5);
  const displayName = session.user.name?.trim() || email;

  return (
    <div className="dir-shell">
      <div className="dir-employer-bar">
        <div className="dir-employer-welcome">
          <p className="dir-employer-kicker">Employer centre</p>
          <h1 className="dir-employer-title">Welcome back, {displayName}</h1>
          <p className="dir-employer-note">
            {roleLabels[role] ?? role} · {session.user.email}
          </p>
        </div>
        <nav aria-label="Employer shortcuts" className="dir-employer-links">
          <a href="#maid-search" className="dir-chip">
            Search maid
          </a>
          <a href="#your-enquiries" className="dir-chip">
            Your enquiries ({enquiries.length})
          </a>
          <Link href="/agencies" className="dir-chip">
            All agencies
          </Link>
          {role === "AGENCY" && (
            <Link href="/agency/dashboard" className="dir-chip">
              Agency dashboard
            </Link>
          )}
          {(role === "ADMIN" || role === "STAFF") && (
            <Link href="/admin" className="dir-chip">
              Admin area
            </Link>
          )}
        </nav>
      </div>

      <div className="dir-grid">
        <div className="dir-main">
          <div className="dir-col">
            <MaidSearchPanel
              nationalities={nationalities}
              services={services}
            />

            <AgencyBannerList banners={banners} limit={3} />

            <NationalitySections sections={sections} />

            <DirectoryPanel
              id="your-enquiries"
              title="Your enquiries"
              href="/agencies"
              actionLabel="Contact more agencies"
            >
              {enquiries.length === 0 ? (
                <p className="dir-empty">
                  You have not contacted an agency yet. Use the search above or
                  the contact form to send your requirements to approved
                  agencies.
                </p>
              ) : (
                <ul className="dir-enquiry-list">
                  {enquiries.map((enquiry) => (
                    <li key={enquiry.id}>
                      <div className="dir-enquiry-head">
                        <Link
                          href={`/agencies/${enquiry.agency.slug}`}
                          className="dir-enquiry-agency"
                        >
                          {enquiry.agency.name}
                        </Link>
                        <span className="dir-recent-meta">
                          {enquiry.createdAt.toLocaleDateString("en-SG", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <p className="dir-enquiry-message">{enquiry.message}</p>
                      <p className="dir-enquiry-status">
                        {statusLabels[enquiry.status] ?? enquiry.status}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </DirectoryPanel>

            <DirectoryPanel title="Your account">
              <dl className="dir-account-list">
                <div>
                  <dt>Name</dt>
                  <dd>{session.user.name ?? "—"}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{session.user.email}</dd>
                </div>
                <div>
                  <dt>Signed in as</dt>
                  <dd>{roleLabels[role] ?? role}</dd>
                </div>
              </dl>
              <ul className="dir-link-list dir-link-list-inline">
                <li>
                  <Link href="/agencies">Browse agencies</Link>
                </li>
                <li>
                  <Link href="/privacy">Privacy policy</Link>
                </li>
                <li>
                  <Link href="/contact">Contact FindMaids</Link>
                </li>
                {role === "AGENCY" && (
                  <li>
                    <Link href="/agency/dashboard">Agency dashboard</Link>
                  </li>
                )}
                {(role === "ADMIN" || role === "STAFF") && (
                  <li>
                    <Link href="/admin">Admin area</Link>
                  </li>
                )}
              </ul>
            </DirectoryPanel>

            <DirectoryPanel
              title="Maid news & guides"
              href="/guides"
              actionLabel="All guides"
            >
              <MaidNewsList items={newsItems} />
            </DirectoryPanel>

            <DirectoryTrustNote />
          </div>
          <div className="dir-rail">
            <RequirementsPanel signedIn />
            <DirectoryPanel
              title="Maid categories"
              href="/agencies"
              actionLabel="All listings"
            >
              <MaidCategoryList
                nationalities={nationalities}
                services={services}
              />
            </DirectoryPanel>
            <DirectoryPanel
              title="Recent maid listings"
              href="/agencies?sort=newest"
              actionLabel="See all"
            >
              <RecentListings agencies={recent} />
            </DirectoryPanel>
          </div>
        </div>
        <aside className="dir-aside">
          <ContactAllAgenciesPanel
            defaultName={session.user.name ?? ""}
            defaultEmail={session.user.email ?? ""}
          />
          <FeaturedAgencyRail agencies={featured} />
          {banners.length > 3 && (
            <AgencyBannerList banners={banners.slice(3)} limit={2} />
          )}
        </aside>

      </div>
    </div>
  );
}

