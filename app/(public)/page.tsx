import Link from "next/link";
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
import {
  DIRECTORY_NATIONALITIES,
  getDirectoryHomeData,
} from "@/lib/directory";
import { sampleDataEnabled } from "@/lib/sample-data";
import { logger } from "@/lib/logger";

export const revalidate = 300;

export const metadata = {
  title: "Singapore maid agency directory | FindMaids",
  description:
    "Search approved maid agencies in Singapore by nationality, placement type and language. Compare maid listings and send your requirements to approved agencies.",
  openGraph: {
    title: "FindMaids | Singapore maid agency directory",
    description:
      "Browse maid agencies by nationality, compare listings, and contact approved agencies.",
    type: "website",
  },
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

export default async function HomePage() {
  let data: Awaited<ReturnType<typeof getDirectoryHomeData>> | null = null;
  try {
    data = await getDirectoryHomeData({ perSection: 5, bannerLimit: 4 });
  } catch (error) {
    logger.error(
      { errorType: error instanceof Error ? error.name : "unknown" },
      "Unable to load directory homepage data",
    );
  }

  const sections = data?.sections ?? [];
  const agencies = data?.agencies ?? [];
  const nationalities = data?.nationalities ?? [...DIRECTORY_NATIONALITIES];
  const services = data?.services.map((entry) => entry.service) ?? [];
  const banners = data?.banners ?? [];
  const recent = data?.recent ?? [];
  const featured = data?.featured.length ? data.featured : agencies.slice(0, 5);

  return (
    <div className="dir-shell">
      <div className="dir-grid">
        <div className="dir-main">
          <div className="dir-col">
            <div className="dir-intro">
              <h1 className="dir-h1">Singapore maid agency directory</h1>
              <p className="dir-intro-text">
                Browse {data?.total ?? 0} approved maid agencies by nationality,
                placement type and language. FindMaids lists independent agencies
                — contact them directly or send your requirements to every
                agency at once.
              </p>
            </div>

            <MaidSearchPanel
              nationalities={nationalities}
              services={services}
            />

            <AgencyBannerList banners={banners} limit={3} />

            <NationalitySections sections={sections} />

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
            <RequirementsPanel />
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
            <DirectoryPanel title="For maid agencies">
              <p className="dir-empty">
                List your agency with photos, services and placement details so
                families can find you.
              </p>
              <Link href="/advertise" className="dir-btn-outline dir-btn-block">
                Join as a maid agency
              </Link>
              {sampleDataEnabled() && (
                <Link
                  href="/sample/agency-dashboard"
                  className="dir-promo-link"
                >
                  Preview a sample agency account
                </Link>
              )}
            </DirectoryPanel>
          </div>
        </div>

        <aside className="dir-aside">
          <ContactAllAgenciesPanel />
          <FeaturedAgencyRail agencies={featured} />
          {banners.length > 3 && (
            <AgencyBannerList banners={banners.slice(3)} limit={2} />
          )}
        </aside>
      </div>
    </div>
  );
}
