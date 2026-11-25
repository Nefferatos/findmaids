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
    featuredAgencies: [],
  };
  try {
    // No Promise.race here: a racing timer left the database promise running
    // after the response, which the Workers runtime reports as "promise created
    // by a request that has since ended" and sometimes cancels the *next*
    // request as hung (Error 1101). Prisma is bounded instead (connection,
    // statement and query timeouts in lib/prisma.ts), and a failure renders the
    // static sections.
    data = await getHomePageData();
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
      <LicensedAgenciesSection
        banners={data.banners}
        featuredAgencies={data.featuredAgencies}
      />
      <MaidsByNationalitySection
        rows={data.maidRows}
        sidebarBanners={data.sidebarBanners}
        featuredAgencies={data.featuredAgencies}
      />
      <BrowseMaidListingSection />
      <HowItWorksSection />
      <NewsFaqSection news={newsItems} faqs={faqEntries} />
    </div>
  );
}
