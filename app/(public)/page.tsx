import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Languages,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import {
  AgencyCard,
  Container,
  EmptyState,
  SectionHeading,
} from "@/components/site";
import {
  getDirectoryPage,
  getPopularAgencyServices,
  getHomepagePremiumBanners,
  parseDirectoryFilters,
} from "@/lib/directory";
import { PlacementImpression, TrackedLink } from "@/components/profile-actions";
import { logger } from "@/lib/logger";
import { demoMaidProfiles } from "@/lib/demo-listings";

export const revalidate = 300;
export const metadata = {
  title: "Find trusted maid agencies in Singapore | FindMaids",
  description:
    "Compare Singapore-based domestic staffing agencies and explore their services, reviews, and profiles.",
  openGraph: {
    title: "FindMaids | Find an agency for your home",
    description: "Explore independent maid agencies based in Singapore.",
    type: "website",
  },
};

export default async function HomePage() {
  let agenciesToExplore: Awaited<
    ReturnType<typeof getDirectoryPage>
  >["agencies"] = [];
  let homepagePremiumBanners: Awaited<
    ReturnType<typeof getHomepagePremiumBanners>
  > = [];
  let topRated: typeof agenciesToExplore = [];
  let popularServices: Awaited<ReturnType<typeof getPopularAgencyServices>> =
    [];
  try {
    const filters = parseDirectoryFilters({ sort: "recommended" });
    const [result, rated, banners, services] = await Promise.all([
      getDirectoryPage(filters, 6),
      getDirectoryPage({ ...filters, sort: "top-rated" }, 12),
      getHomepagePremiumBanners(4),
      getPopularAgencyServices(4),
    ]);
    agenciesToExplore = result.agencies;
    topRated = rated.agencies
      .filter((agency) => agency.rating > 0 && agency.reviewCount > 0)
      .slice(0, 3);
    homepagePremiumBanners = banners;
    popularServices = services;
  } catch (error) {
    logger.error(
      { errorType: error instanceof Error ? error.name : "unknown" },
      "Unable to load agency homepage sections",
    );
  }

  return (
    <>
      <section className="home-hero relative isolate overflow-hidden border-b py-14 sm:py-20 lg:py-24">
        <div aria-hidden="true" className="home-hero-orb home-hero-orb-one" />
        <div aria-hidden="true" className="home-hero-orb home-hero-orb-two" />
        <Container className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
          <div className="max-w-2xl">
            <p className="border-primary/20 text-primary inline-flex items-center gap-2 rounded-full border bg-white/70 px-3 py-1.5 text-xs font-bold tracking-wider uppercase shadow-sm">
              <span className="home-hero-status-dot" aria-hidden="true" />A
              clearer way to compare agencies
            </p>
            <h1 className="font-display mt-5 max-w-2xl text-4xl leading-[1.08] font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Find the right <span className="text-primary">home support</span>{" "}
              for your family.
            </h1>
            <p className="text-muted-foreground mt-5 max-w-xl text-base leading-7 sm:text-lg sm:leading-8">
              Explore independent domestic staffing agencies based in Singapore,
              compare their services, and contact agencies about local or
              overseas needs.
            </p>
            <form
              action="/agencies"
              className="shadow-foreground/5 mt-8 grid gap-3 rounded-2xl border bg-white p-4 shadow-xl sm:grid-cols-[1fr_1fr] lg:grid-cols-[1fr_1fr_auto] lg:items-end"
            >
              <label className="block text-xs font-bold">
                Location
                <input
                  id="home-city"
                  name="city"
                  placeholder="Region or service location"
                  className="bg-background mt-1.5 min-h-12 w-full rounded-lg border px-3 text-sm font-normal"
                />
              </label>
              <label className="block text-xs font-bold">
                Agency service
                <select
                  id="home-service"
                  name="service"
                  defaultValue=""
                  className="bg-background mt-1.5 min-h-12 w-full rounded-lg border px-3 text-sm font-normal"
                >
                  <option value="">Any service</option>
                  {popularServices.map(({ service }) => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </select>
              </label>
              <button className="bg-primary text-primary-foreground inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 font-bold transition hover:brightness-95 sm:col-span-2 lg:col-span-1">
                <Search aria-hidden="true" className="size-4" />
                Search agencies
              </button>
            </form>
            <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
              <span className="font-semibold">Popular:</span>
              <Link className="home-quick-link" href="/agencies?city=Singapore">
                Singapore agencies
              </Link>
              {popularServices.slice(0, 3).map(({ service }) => (
                <Link
                  key={service}
                  className="home-quick-link"
                  href={`/agencies?service=${encodeURIComponent(service)}`}
                >
                  {service}
                </Link>
              ))}
            </div>
          </div>
          <div className="home-hero-visual relative min-h-72 overflow-hidden rounded-3xl border p-5 sm:min-h-96 sm:p-7">
            <div
              className="home-hero-dots absolute inset-0"
              style={{
                backgroundSize: "22px 22px",
              }}
              aria-hidden="true"
            />
            <div className="home-hero-card relative flex h-full min-h-64 flex-col justify-between rounded-2xl border p-6 shadow-xl sm:min-h-80 sm:p-8">
              <div className="flex items-center gap-3">
                <div className="text-primary bg-muted grid size-12 place-items-center rounded-2xl">
                  <ShieldCheck aria-hidden="true" />
                </div>
                <div>
                  <p className="font-bold">Compare with confidence</p>
                  <p className="text-muted-foreground text-sm">
                    Clear, approved agency profiles
                  </p>
                </div>
              </div>
              <div>
                <p className="font-display max-w-sm text-3xl leading-tight font-bold sm:text-4xl">
                  The right questions make all the difference.
                </p>
                <p className="text-muted-foreground mt-3 max-w-sm text-sm leading-6 sm:text-base">
                  Listings belong to independent agencies. Check credentials and
                  discuss terms directly with them.
                </p>
              </div>
              <div className="flex items-center gap-2 border-t pt-4 text-sm font-semibold">
                <ShieldCheck
                  aria-hidden="true"
                  className="text-primary size-4"
                />
                Independent directory · Singapore
              </div>
            </div>
          </div>
        </Container>
      </section>
      <section className="py-10 sm:py-14">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              eyebrow="Approved agencies"
              title="Agencies to explore"
              description="Browse approved agency profiles. Paid featured placements are clearly labeled."
            />
            <Link
              href="/agencies"
              className="text-primary mb-7 inline-flex items-center gap-2 font-bold"
            >
              View all agencies
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          {agenciesToExplore.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {agenciesToExplore.map((agency) => (
                <AgencyCard key={agency.id} agency={agency} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Agency listings are being prepared"
              description="There are no approved agency profiles available right now."
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
      <section
        aria-labelledby="sample-maids-heading"
        className="home-demo-section border-b py-10 sm:py-14"
      >
        <Container>
          <div className="demo-notice mb-8 rounded-2xl border p-5 sm:p-6">
            <p className="flex items-center gap-2 font-bold">
              <Sparkles aria-hidden="true" className="size-5" />
              Sample listings — fictional examples only
            </p>
            <p className="mt-2 text-sm leading-6">
              These five sample maid profiles are fictional layout examples.
              They are not real people, available workers, or database listings,
              and are separate from the live agency directory.
            </p>
          </div>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-primary text-xs font-bold tracking-wide uppercase">
                Sample profiles
              </p>
              <h2
                id="sample-maids-heading"
                className="font-display mt-1 text-2xl font-bold sm:text-3xl"
              >
                Example maid profiles
              </h2>
            </div>
            <Link
              href="/sample/maids"
              className="text-primary inline-flex min-h-10 items-center gap-2 font-bold"
            >
              View all sample profiles
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {demoMaidProfiles.map((profile) => (
              <article
                key={profile.reference}
                className="site-agency-card overflow-hidden rounded-2xl border bg-white shadow-sm"
              >
                <div className="bg-muted/60 flex items-center gap-3 border-b p-4">
                  <div
                    aria-hidden="true"
                    className="border-primary/15 bg-background text-primary grid size-12 shrink-0 place-items-center rounded-xl border"
                  >
                    <span className="font-display text-sm font-bold">
                      {profile.reference.slice(-2)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-primary text-[10px] font-bold tracking-wide uppercase">
                      Sample · fictional
                    </p>
                    <h4 className="font-display truncate text-base font-bold">
                      Example profile {profile.reference.slice(-2)}
                    </h4>
                    <p className="text-muted-foreground text-xs">
                      Ref. {profile.reference}
                    </p>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="site-badge-green rounded-full px-2.5 py-1 text-xs font-bold">
                      {profile.nationality}
                    </span>
                    <span className="site-badge-yellow rounded-full px-2.5 py-1 text-xs font-bold">
                      Age {profile.age}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-3 flex items-start gap-2 text-xs leading-5">
                    <Languages
                      aria-hidden="true"
                      className="text-primary mt-0.5 size-3.5 shrink-0"
                    />
                    {profile.languages.join(", ")}
                  </p>
                  <p className="text-muted-foreground mt-2 text-xs leading-5">
                    {profile.placementType} · {profile.duties[0]}
                  </p>
                  <p className="mt-3 border-t pt-3 text-xs font-semibold">
                    Example agency: {profile.agency}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </section>
      {homepagePremiumBanners.length > 0 && (
        <section className="bg-muted border-b py-8 sm:py-10">
          <Container>
            <div className="space-y-4">
              {homepagePremiumBanners.map((agency) => (
                <article
                  key={agency.id}
                  className="shadow-foreground/5 grid overflow-hidden rounded-2xl border bg-white shadow-lg sm:grid-cols-[minmax(220px,0.7fr)_1fr]"
                >
                  <PlacementImpression agencyIds={[agency.id]} />
                  <div className="bg-muted relative min-h-36">
                    {agency.bannerUrl && (
                      <Image
                        src={agency.bannerUrl}
                        alt={`${agency.name} agency banner`}
                        fill
                        sizes="(max-width: 640px) 100vw, 35vw"
                        className="object-cover"
                        unoptimized
                      />
                    )}
                    {!agency.bannerUrl && (
                      <div
                        aria-hidden="true"
                        className="from-primary/20 via-muted to-accent/30 absolute inset-0 grid place-items-center bg-gradient-to-br"
                      >
                        <span className="font-display text-primary text-5xl font-bold">
                          {agency.name.slice(0, 1)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
                    <div className="min-w-0 flex-1">
                      <p className="text-primary text-xs font-bold tracking-wide uppercase">
                        Premium agency
                      </p>
                      <h2 className="font-display mt-1 text-2xl font-bold">
                        {agency.name}
                      </h2>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {agency.city}, {agency.province}
                      </p>
                      <p className="text-muted-foreground mt-2 line-clamp-2 text-sm leading-6">
                        {agency.description}
                      </p>
                    </div>
                    <TrackedLink
                      agencyId={agency.id}
                      eventType="placement_click"
                      href={`/agencies/${agency.slug}`}
                      className="bg-primary inline-flex min-h-11 items-center justify-center rounded-md px-4 font-bold text-white"
                    >
                      View agency
                    </TrackedLink>
                  </div>
                </article>
              ))}
            </div>
          </Container>
        </section>
      )}
      <section className="bg-white py-14">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              eyebrow="Practical guides"
              title="Prepare for your agency conversations"
              description="Use these guides to compare profiles and prepare questions."
            />
            <Link
              href="/guides"
              className="text-primary mb-7 inline-flex items-center gap-2 font-bold"
            >
              Explore all guides
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                slug: "choosing-an-agency",
                title: "A practical checklist for choosing an agency",
                description:
                  "Compare agency information and prepare useful questions.",
              },
              {
                slug: "preparing-for-a-conversation",
                title: "Preparing for a conversation with an agency",
                description:
                  "Discuss responsibilities, expectations, and personal information clearly.",
              },
            ].map((guide) => (
              <article
                key={guide.slug}
                className="home-guide-card rounded-2xl border p-5 sm:p-6"
              >
                <p className="text-primary text-xs font-bold tracking-wide uppercase">
                  Guide
                </p>
                <h3 className="font-display mt-2 text-xl font-bold">
                  <Link
                    className="hover:underline"
                    href={`/guides/${guide.slug}`}
                  >
                    {guide.title}
                  </Link>
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {guide.description}
                </p>
              </article>
            ))}
          </div>
        </Container>
      </section>
      <section className="bg-white py-14">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              eyebrow="Community reviews"
              title="Top-rated agencies"
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
            eyebrow="Browse agency services"
            title="Explore by service"
            description="See which approved agencies list each service in their profiles."
          />
          {popularServices.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {popularServices.slice(0, 4).map(({ service, agencyCount }) => (
                <Link
                  key={service}
                  href={`/agencies?service=${encodeURIComponent(service)}`}
                  className="home-service-card hover:border-primary rounded-xl border bg-white p-5 font-semibold transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  {service}
                  <span className="text-muted-foreground mt-2 block text-sm font-normal">
                    {agencyCount} approved{" "}
                    {agencyCount === 1 ? "agency lists" : "agencies list"} this
                    service
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">
              Agency service categories will appear here as approved profiles
              are added.
            </p>
          )}
        </Container>
      </section>
      <section className="bg-muted py-14">
        <Container>
          <SectionHeading
            eyebrow="How it works"
            title="A simple way to get started"
          />
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["01", "Search", "Filter by location and services."],
              ["02", "Compare", "Review agency details and published reviews."],
              ["03", "Connect", "Send an enquiry to the agency you choose."],
            ].map(([number, title, body]) => (
              <div
                key={number}
                className="home-step-card rounded-2xl border p-6 sm:p-7"
              >
                <p className="home-step-number">{number}</p>
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
        <Container>
          <div className="grid gap-8 md:grid-cols-[1fr_1fr]">
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
            <div className="home-agency-callout rounded-2xl border p-6 sm:p-8">
              <div className="text-primary bg-muted grid size-12 place-items-center rounded-xl">
                <UsersRound aria-hidden="true" className="size-6" />
              </div>
              <h3 className="font-display mt-4 text-2xl font-bold">
                Are you an agency?
              </h3>
              <p className="text-muted-foreground mt-2 leading-7">
                Create a profile so families can discover your services.
              </p>
              <Link
                href="/advertise"
                className="bg-primary text-primary-foreground mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg px-4 font-bold"
              >
                Advertise with us{" "}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </div>
          <div className="home-demo-links mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 sm:px-6">
            <div>
              <p className="font-display text-lg font-bold">
                Want to preview listing layouts?
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                These clearly labeled examples are fictional and not connected
                to the live directory.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/sample/maids"
                className="text-primary min-h-10 rounded-lg border px-4 py-2 text-sm font-bold"
              >
                Sample maid profiles
              </Link>
              <Link
                href="/sample/agencies"
                className="text-primary min-h-10 rounded-lg border px-4 py-2 text-sm font-bold"
              >
                Sample agencies
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
