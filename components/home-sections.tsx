import Link from "next/link";
import {
  ArrowRight,
  Baby,
  Building2,
  ChevronRight,
  Clock,
  HeartHandshake,
  Languages,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { AgencyBannerTile, FeaturedAgencyTile } from "@/components/agency-banner-tile";
import { MaidCard } from "@/components/maid-card";
import {
  DIRECTORY_LANGUAGES,
  DIRECTORY_PLACEMENT_TYPES,
} from "@/lib/directory";
import {
  HOME_MAID_NATIONALITIES,
  type FeaturedAgency,
  type HomeAgencyBanner,
  type HomeMaidRow,
} from "@/lib/home";

export type HomeNewsItem = {
  title: string;
  href: string;
  summary: string;
};

function SectionHead({
  id,
  title,
  description,
  href,
  linkLabel,
}: {
  id?: string;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2
          id={id}
          className="font-display text-2xl font-bold tracking-tight sm:text-3xl"
        >
          {title}
        </h2>
        {description && (
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
            {description}
          </p>
        )}
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="text-primary inline-flex items-center gap-1 text-sm font-bold hover:underline"
        >
          {linkLabel}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      )}
    </div>
  );
}

/** Login-free search card: every field maps to the /maid-agency directory filters. */
function MaidSearchCard() {
  return (
    <section
      id="maid-search"
      aria-labelledby="maid-search-title"
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] sm:p-5"
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]"
        >
          <Search className="size-4" />
        </span>
        <div>
          <h2
            id="maid-search-title"
            className="font-display text-lg leading-tight font-bold"
          >
            Search maid agencies
          </h2>
          <p className="text-muted-foreground text-[0.7rem]">
            Agency name, road, postal code, licence no. or nationality
          </p>
        </div>
      </div>
      <form action="/maid-agency" method="get" className="mt-4 grid gap-3">
        <label className="grid gap-1 text-xs font-semibold">
          Agency name, road or postal code
          <input
            name="q"
            type="search"
            placeholder="e.g. Casa Care or 208783"
            className="min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-normal"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold">
            Maid type
            <select
              name="service"
              defaultValue=""
              className="min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm font-normal"
            >
              <option value="">Any type</option>
              {DIRECTORY_PLACEMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold">
            Nationality
            <select
              name="nationality"
              defaultValue=""
              className="min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm font-normal"
            >
              <option value="">Any nationality</option>
              {HOME_MAID_NATIONALITIES.map((nationality) => (
                <option key={nationality} value={nationality}>
                  {nationality}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="grid gap-1 text-xs font-semibold">
          Language
          <select
            name="language"
            defaultValue=""
            className="min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm font-normal"
          >
            <option value="">Any language</option>
            {DIRECTORY_LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-bold text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary-strong)]"
        >
          <Search aria-hidden="true" className="size-4" />
          Search agencies
        </button>
        <p className="text-muted-foreground text-[0.68rem] leading-4">
          Results show approved agencies and the maid profiles they publish.
        </p>
      </form>
    </section>
  );
}

export function HomeHero() {
  return (
    <section className="home-hero relative overflow-hidden rounded-2xl border border-[var(--border)] p-5 sm:p-8 lg:p-10">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:gap-10">
        <div>
          <p className="text-primary text-xs font-extrabold tracking-[0.14em] uppercase">
            Singapore maid directory
          </p>
          <h1 className="font-display mt-3 text-3xl leading-[1.1] font-bold tracking-tight text-balance sm:text-4xl lg:text-[2.6rem]">
            Find a maid agency you can compare with confidence
          </h1>
          <p className="text-muted-foreground mt-4 max-w-xl text-sm leading-6 sm:text-base">
            Browse maid profiles by nationality, shortlist approved agencies and
            send your requirements once. FindMaids is a directory — you deal
            directly with each independent agency.
          </p>
          <div className="mt-6">
            <p className="text-muted-foreground text-[0.7rem] font-bold tracking-wide uppercase">
              Browse by nationality
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {HOME_MAID_NATIONALITIES.map((nationality) => (
                <Link
                  key={nationality}
                  href={`/maid-agency?nationality=${encodeURIComponent(nationality)}`}
                  className="home-quick-link"
                >
                  {nationality} maids
                </Link>
              ))}
              <Link href="/maid-agency" className="home-quick-link">
                All nationalities
              </Link>
            </div>
          </div>
          <p className="text-muted-foreground mt-6 text-xs">
            Free for employers. Agency profiles are reviewed before they are
            listed.
          </p>
        </div>
        <MaidSearchCard />
      </div>
    </section>
  );
}

/** Section 2: paid agency banners, two columns of artwork tiles. */
export function LicensedAgenciesSection({
  banners,
  featuredAgencies,
}: {
  banners: HomeAgencyBanner[];
  featuredAgencies: FeaturedAgency[];
}) {
  // Paid artwork keeps the top slots; approved agencies that publish maid
  // profiles fill the rest. That is how At The Agency - the agency with the
  // migrated inventory - stays featured without inventing a subscription.
  const paidIds = new Set(banners.map((banner) => banner.id));
  const featured = featuredAgencies
    .filter((agency) => !paidIds.has(agency.id))
    .slice(0, Math.max(0, 4 - banners.length));
  const hasTiles = banners.length > 0 || featured.length > 0;
  return (
    <section aria-labelledby="licensed-agencies">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-extrabold tracking-[0.14em] text-[var(--accent-strong)] uppercase">
            Featured maid agencies
          </p>
          <h2
            id="licensed-agencies"
            className="font-display mt-1 text-2xl font-bold tracking-tight sm:text-3xl"
          >
            Licensed agencies
          </h2>
        </div>
        <Link
          href="/maid-agency"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-bold transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
        >
          View all maid agencies
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
      {hasTiles ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
          {banners.map((banner) => (
            <AgencyBannerTile key={banner.id} banner={banner} />
          ))}
          {featured.map((agency) => (
            <FeaturedAgencyTile key={agency.id} agency={agency} />
          ))}
        </div>
      ) : (
        <div className="mt-4 flex min-h-[170px] flex-col justify-center gap-3 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-6 sm:min-h-[190px] sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="font-display text-base font-bold">
              Agency banner space available
            </p>
            <p className="text-muted-foreground mt-1 max-w-md text-sm leading-6">
              Approved agencies with an active plan can display their own banner
              artwork here, with a link to their profile.
            </p>
          </div>
          <Link
            href="/advertise"
            className="bg-primary text-primary-foreground inline-flex min-h-10 w-fit shrink-0 items-center justify-center rounded-lg px-4 text-sm font-bold"
          >
            Advertise your agency
          </Link>
        </div>
      )}
    </section>
  );
}

/** Section 3: maid rows by nationality plus the small agency ad sidebar. */
export function MaidsByNationalitySection({
  rows,
  sidebarBanners,
  featuredAgencies,
}: {
  rows: HomeMaidRow[];
  sidebarBanners: HomeAgencyBanner[];
  featuredAgencies: FeaturedAgency[];
}) {
  // Without a paid sidebar banner the rail used to vanish. It now falls back to
  // the real featured agencies, so the flagship agency keeps a visible slot.
  const railAgencies = featuredAgencies
    .filter(
      (agency) => !sidebarBanners.some((banner) => banner.id === agency.id),
    )
    .slice(0, 2);
  const hasRail = sidebarBanners.length > 0 || railAgencies.length > 0;
  return (
    <section aria-labelledby="maids-by-nationality">
      <div
        className={
          hasRail
            ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start"
            : "grid gap-6"
        }
      >
        <div className="min-w-0">
          <SectionHead
            id="maids-by-nationality"
            title="Maids by nationality"
            description="Recently published profiles from approved agencies, newest first."
            href="/agencies"
            linkLabel="Browse all maid listings"
          />
          {rows.length > 0 ? (
            <div className="mt-5 space-y-8">
              {rows.map((row) => (
                <div key={row.nationality}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-display text-lg font-bold sm:text-xl">
                      {row.title}
                    </h3>
                    <Link
                      href={row.moreHref}
                      className="text-primary inline-flex items-center gap-0.5 text-xs font-bold hover:underline"
                    >
                      {row.moreLabel}
                      <ChevronRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  </div>
                  <div className="maid-row mt-3">
                    {row.maids.map((maid) => (
                      <MaidCard key={maid.id} maid={maid} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-5 text-sm leading-6">
              Maid profiles appear here as approved agencies publish them.{" "}
              <Link
                href="/agencies"
                className="text-primary font-bold underline"
              >
                Browse the agency directory
              </Link>{" "}
              or send your requirements and let approved agencies contact you.
            </p>
          )}
        </div>
        {hasRail && (
          <aside
            aria-labelledby="featured-agencies"
            className="lg:sticky lg:top-4 lg:self-start"
          >
            <h2
              id="featured-agencies"
              className="font-display text-base font-bold"
            >
              Featured agencies
            </h2>
            <div className="ad-row mt-3">
              {sidebarBanners.map((banner) => (
                <div key={banner.id}>
                  <AgencyBannerTile banner={banner} variant="compact" />
                </div>
              ))}
              {railAgencies.map((agency) => (
                <div key={agency.id}>
                  <FeaturedAgencyTile agency={agency} variant="compact" />
                </div>
              ))}
            </div>
            <Link
              href="/agencies?sort=top-rated"
              className="text-primary mt-3 inline-flex items-center gap-1 text-xs font-bold hover:underline"
            >
              Top-rated agencies
              <ChevronRight aria-hidden="true" className="size-3.5" />
            </Link>
          </aside>
        )}
      </div>
    </section>
  );
}

const browseTiles = [
  {
    label: "Most recent",
    detail: "Newest listings",
    href: "/agencies?sort=newest",
    icon: Clock,
  },
  {
    label: "Filipino maids",
    detail: "By nationality",
    href: "/agencies?nationality=Filipino",
    icon: Users,
  },
  {
    label: "Indonesian maids",
    detail: "By nationality",
    href: "/agencies?nationality=Indonesian",
    icon: Users,
  },
  {
    label: "Myanmar maids",
    detail: "By nationality",
    href: "/agencies?nationality=Myanmar",
    icon: Users,
  },
  {
    label: "Indian maids",
    detail: "By nationality",
    href: "/agencies?nationality=Indian",
    icon: Users,
  },
  {
    label: "English-speaking",
    detail: "By language",
    href: "/agencies?language=English",
    icon: Languages,
  },
  {
    label: "Mandarin-speaking",
    detail: "By language",
    href: "/agencies?language=Mandarin",
    icon: Languages,
  },
  {
    label: "Infant care",
    detail: "By skill",
    href: "/agencies?q=infant",
    icon: Baby,
  },
  {
    label: "Elderly care",
    detail: "By skill",
    href: "/agencies?q=elderly",
    icon: HeartHandshake,
  },
  {
    label: "Part-time placement",
    detail: "By type",
    href: "/agencies?service=Part-time+placement",
    icon: Clock,
  },
  {
    label: "Cooking",
    detail: "By skill",
    href: "/agencies?q=cooking",
    icon: Sparkles,
  },
  {
    label: "All agencies",
    detail: "Full directory",
    href: "/agencies",
    icon: Building2,
  },
];

/** Section 4: category link tiles. */
export function BrowseMaidListingSection() {
  return (
    <section aria-labelledby="browse-maid-listings">
      <SectionHead
        id="browse-maid-listings"
        title="Browse maid listings"
        description="Jump straight to the part of the directory you need."
      />
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {browseTiles.map(({ label, detail, href, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className="group flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-xs)] transition-colors hover:border-[var(--primary)]"
          >
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--muted)] text-[var(--primary)]"
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{label}</span>
              <span className="text-muted-foreground block text-[0.7rem]">
                {detail}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

const steps = [
  {
    title: "Search",
    body: "Filter published maid profiles by nationality, language and placement type.",
    icon: Search,
  },
  {
    title: "Shortlist and interview",
    body: "Shortlist the profiles that fit and arrange interviews with the agency.",
    icon: Users,
  },
  {
    title: "Hire via the agency",
    body: "Confirm fees, contract terms and paperwork directly with the agency you choose.",
    icon: HeartHandshake,
  },
];

/** Section 5: three step cards. */
export function HowItWorksSection() {
  return (
    <section aria-labelledby="how-it-works">
      <SectionHead
        id="how-it-works"
        title="How it works"
        description="FindMaids is a directory. Agencies are independent third parties."
      />
      <ol className="mt-4 grid gap-4 sm:grid-cols-3">
        {steps.map(({ title, body, icon: Icon }, index) => (
          <li
            key={title}
            className="home-step-card flex flex-col gap-3 rounded-xl border border-[var(--border)] p-5"
          >
            <span className="home-step-number" aria-hidden="true">
              {index + 1}
            </span>
            <div>
              <h3 className="font-display flex items-center gap-2 text-lg font-bold">
                <Icon aria-hidden="true" className="text-primary size-4" />
                {title}
              </h3>
              <p className="text-muted-foreground mt-1 text-sm leading-6">
                {body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Section 6: maid news beside the common questions accordion. */
export function NewsFaqSection({
  news,
  faqs,
}: {
  news: HomeNewsItem[];
  faqs: { question: string; answer: string }[];
}) {
  return (
    <section>
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <SectionHead
            id="maid-news"
            title="Maid news & guides"
            href="/guides"
            linkLabel="All guides"
          />
          <ul className="mt-4 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            {news.map((item) => (
              <li
                key={item.href}
                className="border-b border-[var(--border)] p-4 last:border-b-0"
              >
                <Link
                  href={item.href}
                  className="text-sm font-semibold hover:text-[var(--primary)] hover:underline"
                >
                  {item.title}
                </Link>
                <p className="text-muted-foreground mt-1 text-xs leading-5">
                  {item.summary}
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <SectionHead
            id="common-questions"
            title="Common questions"
            href="/faq"
            linkLabel="All questions"
          />
          <div className="mt-4 space-y-2">
            {faqs.map((entry) => (
              <details
                key={entry.question}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <summary className="cursor-pointer text-sm font-semibold">
                  {entry.question}
                </summary>
                <p className="text-muted-foreground mt-2 text-xs leading-5">
                  {entry.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
