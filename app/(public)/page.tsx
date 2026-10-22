import Link from "next/link";
import Image from "next/image";
import { Search, ShieldCheck, UsersRound, ArrowRight } from "lucide-react";
import {
  AgencyCard,
  Container,
  EmptyState,
  SectionHeading,
} from "@/components/site";
import { getDirectoryPage, parseDirectoryFilters } from "@/lib/directory";
import { PlacementImpression, TrackedLink } from "@/components/profile-actions";

export const revalidate = 300;
export const metadata = {
  title: "Find trusted maid agencies in the Philippines | FindMaids",
  description:
    "Compare independent domestic staffing agencies across the Philippines. Explore services, reviews, and verified agency profiles.",
  openGraph: {
    title: "FindMaids | Find an agency for your home",
    description: "Explore independent maid agencies across the Philippines.",
    type: "website",
  },
};

export default async function HomePage() {
  let featured: Awaited<ReturnType<typeof getDirectoryPage>>["agencies"] = [];
  let homepageFeature: (typeof featured)[number] | undefined;
  let topRated: typeof featured = [];
  try {
    const filters = parseDirectoryFilters({ sort: "recommended" });
    const result = await getDirectoryPage(filters, 6);
    featured = result.agencies.filter((agency) => agency.sponsored).slice(0, 3);
    homepageFeature = result.agencies.find((agency) => agency.homepageFeatured);
    topRated = (
      await getDirectoryPage({ ...filters, sort: "top-rated" }, 6)
    ).agencies.slice(0, 3);
  } catch (error) {
    console.error("Unable to load agency homepage sections", error);
  }

  return (
    <>
      <section className="relative overflow-hidden border-b bg-[#e8f0e6] py-16 sm:py-24">
        <Container className="grid items-center gap-10 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="text-primary text-sm font-bold tracking-wider uppercase">
              A clearer way to compare agencies
            </p>
            <h1 className="font-display mt-4 max-w-2xl text-4xl leading-tight font-bold sm:text-5xl">
              Find the right <span className="text-primary">home support</span>{" "}
              for your family.
            </h1>
            <p className="text-muted-foreground mt-5 max-w-xl text-lg leading-8">
              Explore independent domestic staffing agencies across the
              Philippines, compare their services, and contact the agency
              directly.
            </p>
            <form
              action="/agencies"
              className="mt-8 grid gap-3 rounded-md border bg-white p-3 shadow-sm sm:grid-cols-[1fr_1fr_auto]"
            >
              <label className="sr-only" htmlFor="home-city">
                City or province
              </label>
              <input
                id="home-city"
                name="city"
                placeholder="City or province"
                className="min-h-12 rounded border px-3"
              />
              <label className="sr-only" htmlFor="home-service">
                Service type
              </label>
              <select
                id="home-service"
                name="service"
                defaultValue=""
                className="min-h-12 rounded border px-3"
              >
                <option value="">Any service</option>
                <option>Full-time placement</option>
                <option>Part-time placement</option>
                <option>Live-in placement</option>
              </select>
              <button className="bg-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-5 font-bold text-white">
                <Search aria-hidden="true" className="size-4" /> Search agencies
              </button>
            </form>
            <p className="text-muted-foreground mt-3 text-sm">
              Browse agencies in{" "}
              <Link
                className="text-primary font-semibold underline"
                href="/agencies?province=Metro+Manila"
              >
                Metro Manila
              </Link>
              ,{" "}
              <Link
                className="text-primary font-semibold underline"
                href="/agencies?province=Cebu"
              >
                Cebu
              </Link>
              , and{" "}
              <Link
                className="text-primary font-semibold underline"
                href="/agencies?province=Davao+del+Sur"
              >
                Davao
              </Link>
              .
            </p>
          </div>
          <div className="relative min-h-72 overflow-hidden rounded-md border bg-[#d9e6d7] p-7 sm:min-h-96">
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "radial-gradient(#176b4d 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
              aria-hidden="true"
            />
            <div className="relative flex h-full min-h-60 flex-col justify-between rounded-md border border-white/70 bg-white/90 p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="text-primary grid size-12 place-items-center rounded-full bg-[#dceee4]">
                  <ShieldCheck aria-hidden="true" />
                </div>
                <div>
                  <p className="font-bold">Clear information</p>
                  <p className="text-muted-foreground text-sm">
                    Compare agency profiles
                  </p>
                </div>
              </div>
              <div>
                <p className="font-display text-3xl font-bold">
                  Your search, made clearer.
                </p>
                <p className="text-muted-foreground mt-2 max-w-sm">
                  Listings belong to independent agencies. Check credentials and
                  discuss terms directly with them.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="bg-primary size-2 rounded-full" />
                Independent directory
              </div>
            </div>
          </div>
        </Container>
      </section>
      {homepageFeature && (
        <section className="border-b bg-[#f0f3e9] py-5">
          <Container>
            <article className="grid overflow-hidden rounded-md border bg-white sm:grid-cols-[240px_1fr]">
              <PlacementImpression agencyIds={[homepageFeature.id]} />
              <div className="relative min-h-36 bg-[#dce8dc]">
                {homepageFeature.bannerUrl && (
                  <Image
                    src={homepageFeature.bannerUrl}
                    alt={`${homepageFeature.name} featured banner`}
                    fill
                    sizes="240px"
                    className="object-cover"
                    unoptimized
                  />
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="text-primary text-xs font-bold uppercase">
                    Featured / Sponsored
                  </p>
                  <h2 className="font-display mt-1 text-2xl font-bold">
                    {homepageFeature.name}
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {homepageFeature.city}, {homepageFeature.province}
                  </p>
                </div>
                <TrackedLink
                  agencyId={homepageFeature.id}
                  eventType="placement_click"
                  href={`/agencies/${homepageFeature.slug}`}
                  className="bg-primary inline-flex min-h-11 items-center rounded-md px-4 font-bold text-white"
                >
                  View agency
                </TrackedLink>
              </div>
            </article>
          </Container>
        </section>
      )}
      <section className="py-14">
        <Container>
          <SectionHeading
            eyebrow="Featured listings"
            title="Agencies to explore"
            description="Sponsored placements are labeled. Review each profile and contact agencies directly to confirm details."
          />
          {featured.length ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                {featured.map((agency) => (
                  <AgencyCard key={agency.id} agency={agency} />
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title="Agency listings are being prepared"
              description="There are no approved listings available yet."
              action={
                <Link
                  className="text-primary font-bold underline"
                  href="/agencies"
                >
                  Browse the directory
                </Link>
              }
            />
          )}
        </Container>
      </section>
      <section className="bg-white py-14">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              eyebrow="Community reviews"
              title="Top-rated profiles"
              description="Ratings reflect published user reviews and are not a guarantee of service quality."
            />
            <Link
              href="/agencies?sort=top-rated"
              className="text-primary mb-7 inline-flex items-center gap-2 font-bold"
            >
              See all agencies{" "}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          {topRated.length ? (
            <div className="grid gap-4 md:grid-cols-3">
              {topRated.map((agency) => (
                <AgencyCard key={agency.id} agency={agency} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">
              Ratings will appear as reviews are published.
            </p>
          )}
        </Container>
      </section>
      <section className="py-14">
        <Container>
          <SectionHeading
            eyebrow="Explore by need"
            title="Start with the kind of support you need"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Full-time placement",
              "Part-time placement",
              "Live-in placement",
              "Newborn care",
            ].map((label) => (
              <Link
                key={label}
                href={`/agencies?service=${encodeURIComponent(label)}`}
                className="hover:border-primary rounded-md border bg-white p-5 font-semibold"
              >
                {label}
                <span className="text-muted-foreground mt-2 block text-sm font-normal">
                  Compare agencies offering this service
                </span>
              </Link>
            ))}
          </div>
        </Container>
      </section>
      <section className="bg-[#e8f0e6] py-14">
        <Container>
          <SectionHeading
            eyebrow="How it works"
            title="A simple way to get started"
          />
          <div className="grid gap-8 md:grid-cols-3">
            {[
              ["01", "Search", "Filter by location and services."],
              ["02", "Compare", "Review agency details and published reviews."],
              ["03", "Connect", "Send an enquiry to the agency you choose."],
            ].map(([number, title, body]) => (
              <div key={number} className="border-primary border-t-2 pt-4">
                <p className="text-primary text-sm font-bold">{number}</p>
                <h3 className="font-display mt-2 text-xl font-bold">{title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>
      <section className="py-14">
        <Container className="grid gap-8 md:grid-cols-[1fr_1fr]">
          <div>
            <SectionHeading
              eyebrow="Trust and transparency"
              title="A directory, not a recruiter"
              description="FindMaids provides a space for independent agencies to share information. We do not employ, recruit, or guarantee services. Verify licences, terms, and suitability directly with each agency."
            />
            <Link href="/about" className="text-primary font-bold underline">
              Learn about FindMaids
            </Link>
          </div>
          <div className="rounded-md border bg-white p-6">
            <UsersRound aria-hidden="true" className="text-primary size-7" />
            <h3 className="font-display mt-4 text-2xl font-bold">
              Are you an agency?
            </h3>
            <p className="text-muted-foreground mt-2 leading-7">
              Create a profile so families can discover your services.
            </p>
            <Link
              href="/advertise"
              className="bg-primary mt-5 inline-flex min-h-11 items-center gap-2 rounded-md px-4 font-bold text-white"
            >
              Advertise with us{" "}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
