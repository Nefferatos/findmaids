import Link from "next/link";
import { AgencyBannerTile } from "@/components/agency-banner-tile";
import { MaidResultCard } from "@/components/maid-result-card";
import { MaidSearchForm } from "@/components/maid-search-form";
import { MaidSearchShell } from "@/components/maid-search-shell";
import { MaidSortSelect } from "@/components/maid-sort-select";
import { getHomepageAgencyBanners, type HomeAgencyBanner } from "@/lib/home";
import { logger } from "@/lib/logger";
import {
  getMaidSearchAgencies,
  maidFilterChips,
  maidSearchHref,
  maidSearchQueryString,
  parseMaidSearchParams,
  searchMaids,
  MAID_RESULTS_PER_PAGE,
  type MaidSearchResult,
} from "@/lib/maid-search";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Search maids | FindMaids",
  description:
    "Search maid profiles by name, reference code, helper type, nationality, language, age, salary, experience or agency. FindMaids lists profiles published by approved Singapore maid agencies.",
};

type SearchParams = Record<string, string | string[] | undefined>;

function currentPage(params: SearchParams) {
  const value = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export default async function MaidSearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = parseMaidSearchParams(params);
  const page = currentPage(params);

  let result: MaidSearchResult = { maids: [], total: 0, page, pages: 1 };
  let agencies: { id: string; name: string }[] = [];
  let banners: HomeAgencyBanner[] = [];
  let failed = false;
  try {
    [result, agencies, banners] = await Promise.all([
      searchMaids(filters, { page }),
      getMaidSearchAgencies(),
      getHomepageAgencyBanners({ limit: 3 }),
    ]);
  } catch (error) {
    failed = true;
    logger.error(
      { errorType: error instanceof Error ? error.name : "unknown" },
      "Unable to run the maid search",
    );
  }

  const queryString = maidSearchQueryString(filters);
  const agencyName =
    agencies.find((agency) => agency.id === filters.agencyId)?.name ?? null;
  const chips = maidFilterChips(filters, { agencyName });
  const rangeStart =
    result.total === 0 ? 0 : (result.page - 1) * MAID_RESULTS_PER_PAGE + 1;
  const rangeEnd = Math.min(result.total, result.page * MAID_RESULTS_PER_PAGE);

  return (
    <div className="fm-search-page fm-explorer">
      <nav className="fm-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">›</span>
        <span>Search maids</span>
      </nav>

      <header className="fm-explorer-head">
        <h1 className="fm-explorer-title">
          Search Maids
          <span className="fm-explorer-badge">
            {result.total.toLocaleString()} available
          </span>
        </h1>
        <p className="fm-explorer-desc">
          Browse maid profiles published by approved Singapore maid agencies.
          Filter by helper type, nationality, language, age, salary, care
          experience or agency, then open a profile to contact the agency
          directly.
        </p>
      </header>

      <div
        className="fm-active-filters"
        aria-label="Active filters"
        hidden={chips.length === 0}
      >
        {chips.length > 0 && (
          <>
            <span className="fm-active-filters-label">Active filters</span>
            {chips.map((chip) => (
              <Link
                key={chip.key}
                href={chip.href}
                className="fm-active-chip"
                aria-label={`Remove filter: ${chip.label}`}
              >
                {chip.label}
                <span aria-hidden="true">×</span>
              </Link>
            ))}
            <Link href="/maids/search" className="fm-active-clear">
              Clear all
            </Link>
          </>
        )}
      </div>

      <MaidSearchShell
        activeCount={chips.length}
        filters={
          <MaidSearchForm
            agencies={agencies}
            defaults={filters}
            signature={queryString}
          />
        }
        results={
          <>
            <div className="fm-results-toolbar">
              <p
                className="fm-results-summary"
                role="status"
                aria-live="polite"
              >
                {failed ? (
                  "Search is temporarily unavailable."
                ) : result.total === 0 ? (
                  "No maids match these filters."
                ) : (
                  <>
                    Showing <strong>{rangeStart}</strong>–
                    <strong>{rangeEnd}</strong> of{" "}
                    <strong>{result.total.toLocaleString()}</strong>{" "}
                    {result.total === 1 ? "maid" : "maids"}
                  </>
                )}
                {result.pages > 1 && (
                  <span className="fm-results-page-info">
                    Page {result.page} of {result.pages}
                  </span>
                )}
              </p>
              <MaidSortSelect value={filters.sort} baseQuery={queryString} />
            </div>

            {failed ? (
              <div className="fm-empty">
                <h2>We couldn&apos;t run this search</h2>
                <p>
                  The maid search is temporarily unavailable. Please refresh the
                  page or try again in a moment.
                </p>
                <Link href="/maids/search" className="fm-btn fm-btn-orange">
                  Reset search
                </Link>
              </div>
            ) : result.maids.length > 0 ? (
              <div className="fm-maid-grid">
                {result.maids.map((maid) => (
                  <MaidResultCard key={maid.id} maid={maid} />
                ))}
              </div>
            ) : (
              <div className="fm-empty">
                <h2>No maids match those filters</h2>
                <p>
                  Try removing a filter or widening the salary, age or
                  nationality ranges. Approved agencies publish new profiles
                  regularly.
                </p>
                <Link href="/maids/search" className="fm-btn fm-btn-orange">
                  Clear all filters
                </Link>
              </div>
            )}

            {result.pages > 1 && (
              <nav className="fm-pagination" aria-label="Pagination">
                {result.page > 1 && (
                  <Link
                    className="fm-page-link"
                    href={maidSearchHref(filters, result.page - 1)}
                    rel="prev"
                  >
                    Previous
                  </Link>
                )}
                {Array.from({ length: result.pages }, (_, index) => index + 1)
                  .filter(
                    (number) =>
                      number === 1 ||
                      number === result.pages ||
                      Math.abs(number - result.page) <= 2,
                  )
                  .map((number) => (
                    <Link
                      key={number}
                      href={maidSearchHref(filters, number)}
                      className={`fm-page-link${number === result.page ? "is-current" : ""}`}
                      aria-current={number === result.page ? "page" : undefined}
                    >
                      {number}
                    </Link>
                  ))}
                {result.page < result.pages && (
                  <Link
                    className="fm-page-link"
                    href={maidSearchHref(filters, result.page + 1)}
                    rel="next"
                  >
                    Next
                  </Link>
                )}
              </nav>
            )}

            <p className="fm-results-note">
              Listing published maid profiles from approved agencies. Confirm
              availability, fees and terms directly with the agency.
            </p>
          </>
        }
      />

      {banners.length > 0 && (
        <section
          className="fm-featured-agencies"
          aria-label="Featured agencies"
        >
          <p className="fm-ads-label">FEATURED AGENCIES</p>
          <div className="fm-featured-grid">
            {banners.map((banner) => (
              <AgencyBannerTile
                key={banner.id}
                banner={banner}
                variant="compact"
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
