import Link from "next/link";
import {
  AgencyCard,
  Container,
  EmptyState,
  Pagination,
  SectionHeading,
} from "@/components/site";
import { getDirectoryPage, parseDirectoryFilters } from "@/lib/directory";
 import { logger } from "@/lib/logger";

export const revalidate = 300;
export const metadata = {
  title: "Maid agencies in the Philippines | FindMaids",
  description:
    "Browse approved agency profiles by location, services, languages, and more.",
  openGraph: {
    title: "Browse agencies | FindMaids",
    description:
      "Compare approved domestic staffing agencies across the Philippines.",
  },
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AgenciesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = parseDirectoryFilters(params);
  let result: Awaited<ReturnType<typeof getDirectoryPage>> = {
    agencies: [],
    total: 0,
    pages: 1,
  };
  try {
    result = await getDirectoryPage(filters);
  } catch (error) {
      logger.error({ errorType: error instanceof Error ? error.name : "unknown" }, "Unable to load directory results");
  }
  const query = new URLSearchParams();
  if (filters.city) query.set("city", filters.city);
  if (filters.province) query.set("province", filters.province);
  filters.services.forEach((service) => query.append("service", service));
  filters.nationalities.forEach((nationality) =>
    query.append("nationality", nationality),
  );
  if (filters.language) query.set("language", filters.language);
  if (filters.rating) query.set("rating", String(filters.rating));
  if (filters.verified) query.set("verified", "true");
  if (filters.sort !== "recommended") query.set("sort", filters.sort);
  const makeHref = (page: number) => {
    const paged = new URLSearchParams(query);
    paged.set("page", String(page));
    return `/agencies?${paged.toString()}`;
  };

  return (
    <Container className="py-10 sm:py-14">
      <SectionHeading
        eyebrow="Agency directory"
        title="Find an agency"
        description="Only approved directory profiles are shown. Listings marked Featured / Sponsored have an active paid placement."
      />
      <div className="grid gap-8 lg:grid-cols-[250px_1fr]">
        <aside>
          <form
            action="/agencies"
            className="space-y-4 rounded-md border bg-white p-4"
          >
            <h2 className="font-display text-xl font-bold">Filters</h2>
            <label className="block text-sm font-semibold">
              City
              <input
                className="mt-1 min-h-10 w-full rounded border px-3"
                name="city"
                defaultValue={filters.city}
              />
            </label>
            <label className="block text-sm font-semibold">
              Province
              <input
                className="mt-1 min-h-10 w-full rounded border px-3"
                name="province"
                defaultValue={filters.province}
              />
            </label>
            <fieldset>
              <legend className="text-sm font-semibold">Services</legend>
              <div className="mt-2 space-y-2">
                {[
                  "Full-time placement",
                  "Part-time placement",
                  "Live-in placement",
                  "Newborn care",
                ].map((service) => (
                  <label
                    key={service}
                    className="flex min-h-9 items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="service"
                      value={service}
                      defaultChecked={filters.services.includes(service)}
                    />
                    {service}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold">
                Nationalities served
              </legend>
              <div className="mt-2 space-y-2">
                {["Filipino", "Indonesian", "Sri Lankan"].map((nationality) => (
                  <label
                    key={nationality}
                    className="flex min-h-9 items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="nationality"
                      value={nationality}
                      defaultChecked={filters.nationalities.includes(
                        nationality,
                      )}
                    />
                    {nationality}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block text-sm font-semibold">
              Language
              <input
                className="mt-1 min-h-10 w-full rounded border px-3"
                name="language"
                defaultValue={filters.language}
                placeholder="e.g. Filipino"
              />
            </label>
            <label className="block text-sm font-semibold">
              Minimum rating
              <select
                className="mt-1 min-h-10 w-full rounded border px-3"
                name="rating"
                defaultValue={filters.rating ?? ""}
              >
                <option value="">Any rating</option>
                {[5, 4, 3, 2, 1].map((rating) => (
                  <option key={rating} value={rating}>
                    {rating}+ stars
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-h-10 items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                name="verified"
                value="true"
                defaultChecked={filters.verified}
              />
              Verified agencies
            </label>
            <label className="block text-sm font-semibold">
              Sort by
              <select
                className="mt-1 min-h-10 w-full rounded border px-3"
                name="sort"
                defaultValue={filters.sort}
              >
                <option value="recommended">Recommended</option>
                <option value="top-rated">Top-rated</option>
                <option value="newest">Newest</option>
              </select>
            </label>
            <button className="bg-primary min-h-11 w-full rounded-md px-4 font-bold text-white">
              Apply filters
            </button>
            <Link
              href="/agencies"
              className="text-primary block py-2 text-center text-sm font-semibold underline"
            >
              Clear filters
            </Link>
          </form>
        </aside>
        <section aria-label="Agency results">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {result.total} {result.total === 1 ? "agency" : "agencies"} found
            </p>
          </div>
          {result.agencies.length ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {result.agencies.map((agency) => (
                  <AgencyCard key={agency.id} agency={agency} />
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title="No agencies match those filters"
              description="Try adjusting your location or service filters."
              action={
                <Link
                  className="text-primary font-bold underline"
                  href="/agencies"
                >
                  Clear filters
                </Link>
              }
            />
          )}
          <Pagination
            page={filters.page}
            pages={result.pages}
            makeHref={makeHref}
          />
        </section>
      </div>
    </Container>
  );
}
