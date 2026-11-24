import { faqEntries } from "@/components/content-pages";
import {
  BrowseMaidListingSection,
  HomeHero,
  HowItWorksSection,
  LicensedAgenciesSection,
  MaidsByNationalitySection,
  NewsFaqSection,
  type HomeNewsItem,
} from "@/components/home-sections";
import { getHomePageData } from "@/lib/home";
import { logger } from "@/lib/logger";

// Public pages are rendered per request: no ISR, so paid placements, agency
// approvals and newly published maids are always current.
export const dynamic = "force-dynamic";

/**
 * Upper bound for the landing-page data query. A stalled Hyperdrive connection
 * would otherwise keep the response open until the Workers runtime cancels it
 * (Error 1101); the page then renders its static sections instead.
 */
const LANDING_DATA_TIMEOUT_MS = 8_000;

export const metadata = {
  title: "Singapore maid agency directory | FindMaids",
  description:
    "Browse maid profiles by nationality, compare approved maid agencies in Singapore, and send your requirements to agencies directly.",
  openGraph: {
    title: "FindMaids | Singapore maid agency directory",
    description:
      "Compare approved agencies, browse maid listings by nationality and contact agencies directly.",
    type: "website",
  },
};

const newsItems: HomeNewsItem[] = [
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
  let data: Awaited<ReturnType<typeof getHomePageData>> = {
    banners: [],
    sidebarBanners: [],
    maidRows: [],
  };
  try {
    // The landing page must never hang the Worker: if a database query stalls,
    // render the hero and static sections instead of returning Error 1101.
    data = await Promise.race([
      getHomePageData(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Landing page data timed out")),
          LANDING_DATA_TIMEOUT_MS,
        ),
      ),
    ]);
  } catch (error) {
    logger.error(
      {
        errorType: error instanceof Error ? error.name : "unknown",
        reason: error instanceof Error ? error.message : "unknown",
      },
      "Unable to load landing page data",
    );
  }

  return (
    <div className="home-shell">
      <HomeHero />
      <LicensedAgenciesSection banners={data.banners} />
      <MaidsByNationalitySection
        rows={data.maidRows}
        sidebarBanners={data.sidebarBanners}
      />
      <BrowseMaidListingSection />
      <HowItWorksSection />
      <NewsFaqSection news={newsItems} faqs={faqEntries} />
    </div>
  );
}
