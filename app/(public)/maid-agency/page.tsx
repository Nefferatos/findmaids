import Link from "next/link";
import {
  AgencyBannerTile,
  AgencyRailAd,
} from "@/components/agency-banner-tile";
import { AgencyDirectory } from "@/components/agency-directory";
import { AgencyEnquiryWidget } from "@/components/agency-enquiry-widget";
import { getAgencyDirectory } from "@/lib/agency-directory-server";
import {
  type AgencyDirectoryData,
  type DirectoryAd,
} from "@/lib/agency-directory";
import type { HomeAgencyBanner } from "@/lib/home";
import { logger } from "@/lib/logger";

// Directory results render per request so approvals, suspensions and paid
// placements are always current.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "List of maid agencies in Singapore | FindMaids",
  description:
    "Browse licensed maid agencies in Singapore by area, nationality and contact details. Compare MOM-licensed agencies and send your requirements once.",
  openGraph: {
    title: "Maid agency directory | FindMaids",
    description:
      "Compare licensed maid agencies in Singapore and contact them directly.",
  },
};

/** The top stack reuses the shared banner tile, which expects a HomeAgencyBanner. */
function toBanner(ad: DirectoryAd): HomeAgencyBanner {
  return {
    id: ad.id,
    name: ad.name,
    slug: ad.slug,
    city: "Singapore",
    province: "Singapore",
    bannerUrl: ad.bannerUrl,
    featured: false,
    createdAt: new Date(0),
  };
}

function FeaturedRail({
  banners,
  className,
}: {
  banners: DirectoryAd[];
  className: string;
}) {
  return (
    <aside
      className={`fm-agency-rail ${className}`}
      aria-label="Featured agencies"
    >
      <p className="fm-rail-label">Featured</p>
      {banners.length > 0 ? (
        banners.map((ad, index) => (
          <AgencyRailAd key={ad.id} ad={ad} slot={index} />
        ))
      ) : (
        <p className="fm-rail-agency-box">Agency banner space available.</p>
      )}
    </aside>
  );
}

type SearchParams = Record<string, string | string[] | undefined>;

function paramValue(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  return raw.trim();
}

export default async function MaidAgencyPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const initialFilters = {
    query: paramValue(params.q),
    nationality: paramValue(params.nationality),
    service: paramValue(params.service),
    language: paramValue(params.language),
  };
  const filterKey = [
    initialFilters.query,
    initialFilters.nationality,
    initialFilters.service,
    initialFilters.language,
  ].join("|");

  let data: AgencyDirectoryData = {
    agencies: [],
    total: 0,
    topBanners: [],
    leftBanners: [],
    rightBanners: [],
    featuredPool: [],
  };
  try {
    data = await getAgencyDirectory();
  } catch (error) {
    logger.error(
      { errorType: error instanceof Error ? error.name : "unknown" },
      "Unable to load maid agency directory",
    );
  }

  return (
    <div className="fm-agency-page">
      <div className="fm-agency-layout">
        <aside className="fm-agency-rail fm-agency-rail-left">
          <div className="fm-rail-agency-box">
            <p>For maid agencies</p>
            <Link href="/login" className="fm-btn">
              Maid agency login
            </Link>
            <Link href="/advertise" className="fm-rail-join">
              Join FindMaids →
            </Link>
          </div>
          <p className="fm-rail-label">Featured</p>
          {data.leftBanners.map((ad, index) => (
            <AgencyRailAd
              key={ad.id}
              ad={ad}
              slot={index}
              priority={index === 0}
            />
          ))}
        </aside>

        <div className="fm-agency-center">
          <nav className="fm-agency-breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">›</span>
            <span>Maid agency</span>
          </nav>

          <p className="fm-agency-eyebrow">Maid agency directory</p>
          <h1 className="fm-agency-title">
            List of Maid Agencies in Singapore{" "}
            <span className="fm-agency-title-count">· {data.total} listed</span>
          </h1>
          <p className="fm-agency-lead">
            Every agency below is listed by its own team and shows the maid
            profiles it publishes. Prefer to browse by location?{" "}
            <Link href="/maid-agency/map">
              find a maid agency near you on the map
            </Link>
            .
          </p>
          <p className="fm-agency-agency-line">
            Are you a maid agency? <Link href="/login">Agency login</Link> ·{" "}
            <Link href="/advertise">List your maids on FindMaids</Link>
          </p>

          <AgencyDirectory
            key={filterKey}
            agencies={data.agencies}
            featuredBanners={data.featuredPool}
            initialFilters={initialFilters}
            topAds={
              data.topBanners.length > 0 ? (
                <div
                  className="fm-agency-top-ads"
                  aria-label="Top featured agencies"
                >
                  {data.topBanners.map((ad) => (
                    <AgencyBannerTile
                      key={ad.id}
                      banner={toBanner(ad)}
                      variant="stack"
                    />
                  ))}
                </div>
              ) : null
            }
          />

          <section className="fm-agency-about" aria-labelledby="agency-about">
            <h2 id="agency-about">About maid agencies in Singapore</h2>
            <p>
              A licensed maid agency in Singapore handles the paperwork and the
              matching. Agencies arrange interviews with helpers whose profiles
              fit your household, apply for the work permit through MOM, book
              the medical check-up and brief you on the settling-in programme.
            </p>
            <p>
              Most agencies also offer replacements within a stated period if
              the placement does not work out, and some run their own training
              or orientation before the helper starts. Ask each agency how its
              replacement policy and support work before you sign.
            </p>
            <p>
              Agencies charge an agency fee for this service, separate from the
              helper&apos;s salary, insurance and other statutory costs. Fees
              and packages differ between agencies, so compare each quote and
              confirm the total in writing.{" "}
              <Link href="/maid-agency/map">View agencies on the map</Link> if
              you would rather visit in person.
            </p>
          </section>
        </div>

        <FeaturedRail
          banners={data.rightBanners}
          className="fm-agency-rail-right"
        />
      </div>

      <AgencyEnquiryWidget />
    </div>
  );
}
