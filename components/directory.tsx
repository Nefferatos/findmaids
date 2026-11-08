import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Languages,
  MapPin,
  Search,
  Star,
} from "lucide-react";
import { AllAgenciesEnquiryForm } from "@/components/forms";
import { PlacementImpression, TrackedLink } from "@/components/profile-actions";
import { sampleDataEnabled } from "@/lib/sample-data";
import {
  DIRECTORY_LANGUAGES,
  DIRECTORY_NATIONALITIES,
  DIRECTORY_PLACEMENT_TYPES,
  type DirectoryBanner,
  type NationalitySection,
} from "@/lib/directory";

/**
 * Compact, classic-directory building blocks shared by the public homepage and
 * the employer landing page. Everything here is rendered on the server from the
 * real directory queries in `lib/directory.ts` — no placeholder listings.
 */

export type DirectoryAgency = {
  id: string;
  name: string;
  slug: string;
  city: string;
  province: string;
  description: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  verifiedBadge: boolean;
  sponsored?: boolean;
  rating?: number;
  reviewCount?: number;
  services: string[];
  nationalitiesServed: string[];
  languages: string[];
  yearEstablished?: number | null;
};

const shortDate = new Intl.DateTimeFormat("en-SG", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function nationalitySlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function DirectoryPanel({
  title,
  href,
  actionLabel = "View all",
  note,
  id,
  children,
  className = "",
}: {
  title: string;
  href?: string;
  actionLabel?: string;
  note?: string;
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`dir-panel ${className}`}>
      <div className="dir-panel-head">
        <h2 className="dir-panel-title">{title}</h2>
        {note && <span className="dir-panel-note">{note}</span>}
        {href && (
          <Link href={href} className="dir-panel-more">
            {actionLabel}
            <ChevronRight aria-hidden="true" className="size-3" />
          </Link>
        )}
      </div>
      <div className="dir-panel-body">{children}</div>
    </section>
  );
}

/** Compact search form wired to the existing /agencies directory filters. */
export function MaidSearchPanel({
  nationalities,
  services,
  className = "",
}: {
  nationalities?: string[];
  services?: string[];
  className?: string;
}) {
  const nationalityOptions = nationalities?.length
    ? nationalities
    : [...DIRECTORY_NATIONALITIES];
  const maidTypes = [
    ...new Set<string>([...DIRECTORY_PLACEMENT_TYPES, ...(services ?? [])]),
  ];

  return (
    <section id="maid-search" className={`dir-panel ${className}`}>
      <div className="dir-panel-head">
        <h2 className="dir-panel-title">Search maid</h2>
        <span className="dir-panel-note">
          {nationalityOptions.length} nationalities
        </span>
        <Link href="/agencies" className="dir-panel-more">
          Advanced search
          <ChevronRight aria-hidden="true" className="size-3" />
        </Link>
      </div>
      <form action="/agencies" method="get" className="dir-search">
        <label className="dir-field dir-field-wide">
          <span>Keyword</span>
          <input
            type="search"
            name="q"
            placeholder="Agency, skill or area e.g. newborn care"
          />
        </label>
        <label className="dir-field">
          <span>Maid type</span>
          <select name="service" defaultValue="">
            <option value="">Any maid type</option>
            {maidTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="dir-field">
          <span>Nationality</span>
          <select name="nationality" defaultValue="">
            <option value="">Any nationality</option>
            {nationalityOptions.map((nationality) => (
              <option key={nationality} value={nationality}>
                {nationality}
              </option>
            ))}
          </select>
        </label>
        <label className="dir-field">
          <span>Language</span>
          <select name="language" defaultValue="">
            <option value="">Any language</option>
            {DIRECTORY_LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
        </label>
        <div className="dir-search-actions">
          <button type="submit" className="dir-btn-primary">
            <Search aria-hidden="true" className="size-3.5" />
            Search maid now
          </button>
          <Link href="#contact-agencies" className="dir-btn-outline">
            Request maid
          </Link>
        </div>
        <p className="dir-search-note">
          Off-day and rest-day preferences are agreed directly with each agency.
        </p>
      </form>
    </section>
  );
}


/** Horizontal agency advertisement banner with a clean fallback. */
export function AgencyBanner({ banner }: { banner: DirectoryBanner }) {
  const href = `/agencies/${banner.slug}`;
  const label = `${banner.name} agency advertisement`;
  const media = banner.bannerUrl ? (
    <Image
      src={banner.bannerUrl}
      alt={label}
      fill
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 640px"
      className="object-cover"
      unoptimized
    />
  ) : (
    <span className="dir-banner-fallback" aria-hidden="true">
      <span className="dir-banner-initial">{banner.name.slice(0, 1)}</span>
      <span className="dir-banner-fallback-text">{banner.name}</span>
    </span>
  );

  return (
    <article className="dir-banner">
      {banner.sponsored ? (
        <TrackedLink
          agencyId={banner.id}
          eventType="placement_click"
          href={href}
          aria-label={label}
          className="dir-banner-media"
        >
          <PlacementImpression agencyIds={[banner.id]} />
          {media}
          <span className="dir-banner-tag">Featured</span>
        </TrackedLink>
      ) : (
        <Link href={href} aria-label={label} className="dir-banner-media">
          {media}
          <span className="dir-banner-tag dir-banner-tag-plain">Agency</span>
        </Link>
      )}
      <div className="dir-banner-meta">
        <Link href={href} className="dir-banner-name">
          {banner.name}
        </Link>
        <span className="dir-banner-place">
          {banner.city}, {banner.province}
        </span>
      </div>
    </article>
  );
}

export function AgencyBannerList({
  banners,
  limit = 3,
}: {
  banners: DirectoryBanner[];
  limit?: number;
}) {
  const visible = banners.slice(0, limit);
  if (visible.length === 0) {
    return (
      <div className="dir-banner-fallback-panel">
        <p className="font-bold">Agency advertising space</p>
        <p>
          Approved agencies can request a banner slot.{" "}
          <Link href="/advertise" className="underline">
            Join as a maid agency
          </Link>
          .
        </p>
      </div>
    );
  }
  return (
    <div className="dir-banner-list">
      {visible.map((banner) => (
        <AgencyBanner key={banner.id} banner={banner} />
      ))}
    </div>
  );
}


/** One compact listing row used inside every nationality section. */
export function DirectoryListingRow({
  agency,
  nationality,
}: {
  agency: DirectoryAgency;
  nationality: string;
}) {
  const href = `/agencies/${agency.slug}`;
  const rating = agency.rating ?? 0;
  const reviewCount = agency.reviewCount ?? 0;
  return (
    <li className="dir-card">
      <div className="dir-card-photo">
        {agency.logoUrl ? (
          <Image
            src={agency.logoUrl}
            alt={`${agency.name} logo`}
            width={56}
            height={56}
            className="size-full object-cover"
            unoptimized
          />
        ) : (
          <span aria-hidden="true">{agency.name.slice(0, 1)}</span>
        )}
      </div>
      <div className="dir-card-main">
        <h3 className="dir-card-title">
          {agency.sponsored ? (
            <TrackedLink
              agencyId={agency.id}
              eventType="placement_click"
              href={href}
              className="dir-card-name"
            >
              {agency.name}
            </TrackedLink>
          ) : (
            <Link href={href} className="dir-card-name">
              {agency.name}
            </Link>
          )}
          {agency.verifiedBadge && (
            <span className="dir-flag">
              <Check aria-hidden="true" className="size-2.5" />
              Verified
            </span>
          )}
          {agency.sponsored && (
            <span className="dir-flag dir-flag-paid">Featured</span>
          )}
        </h3>
        <p className="dir-card-meta">
          <MapPin aria-hidden="true" className="size-3" />
          {agency.city}
          {agency.province ? `, ${agency.province}` : ""}
          {agency.yearEstablished ? ` · Est. ${agency.yearEstablished}` : ""}
        </p>
        <p className="dir-card-line">
          <span className="dir-card-label">Nationality</span>
          {agency.nationalitiesServed.length
            ? agency.nationalitiesServed.slice(0, 4).join(", ")
            : nationality}
        </p>
        <p className="dir-card-line">
          <span className="dir-card-label">Placement</span>
          {agency.services.length
            ? agency.services.slice(0, 3).join(", ")
            : "Ask agency for details"}
        </p>
        <p className="dir-card-line">
          <Languages aria-hidden="true" className="size-3" />
          {agency.languages.length
            ? agency.languages.slice(0, 4).join(", ")
            : "Languages on request"}
        </p>
      </div>
      <div className="dir-card-side">
        {reviewCount > 0 ? (
          <span className="dir-rating">
            <Star aria-hidden="true" className="size-3" />
            {rating.toFixed(1)}
            <em>({reviewCount})</em>
          </span>
        ) : (
          <span className="dir-card-muted">No reviews yet</span>
        )}
        <Link href={href} className="dir-card-link">
          Profile details
        </Link>
      </div>
    </li>
  );
}

/** Listings grouped by nationality, five cards per section by default. */
export function NationalitySections({
  sections,
  title = "Maid listings by nationality",
}: {
  sections: NationalitySection<DirectoryAgency>[];
  title?: string;
}) {
  if (sections.length === 0) {
    return (
      <DirectoryPanel
        title={title}
        href="/agencies"
        actionLabel="Browse directory"
      >
        <p className="dir-empty">
          Maid listings are prepared as agencies are approved. Browse the agency
          directory, or{" "}
          <Link href="#contact-agencies" className="underline">
            send your requirements
          </Link>{" "}
          and approved agencies will contact you.
          {sampleDataEnabled() && (
            <>
              {" "}
              You can also{" "}
              <Link href="/sample/agency-dashboard" className="underline">
                preview a sample agency account and maid roster
              </Link>
              .
            </>
          )}
        </p>
      </DirectoryPanel>
    );
  }
  return (
    <div className="space-y-2">
      {sections.map((section) => (
        <DirectoryPanel
          key={section.nationality}
          id={`${nationalitySlug(section.nationality)}-maids`}
          title={`${section.nationality} maid`}
          note={`${section.total} listing${section.total === 1 ? "" : "s"}`}
          href={section.moreHref}
          actionLabel="More listings"
        >
          <ul className="dir-list">
            {section.agencies.map((agency) => (
              <DirectoryListingRow
                key={`${section.nationality}-${agency.id}`}
                agency={agency}
                nationality={section.nationality}
              />
            ))}
          </ul>
        </DirectoryPanel>
      ))}
    </div>
  );
}


/** Centre rail: nationality and placement-type category links. */
export function MaidCategoryList({
  nationalities,
  services,
}: {
  nationalities: string[];
  services: string[];
}) {
  const placementTypes = [
    ...new Set<string>([...DIRECTORY_PLACEMENT_TYPES, ...services]),
  ];
  return (
    <div className="dir-category-groups">
      <div>
        <h3 className="dir-sub-title">By nationality</h3>
        <ul className="dir-link-list">
          {nationalities.map((nationality) => (
            <li key={nationality}>
              <Link
                href={`/agencies?nationality=${encodeURIComponent(nationality)}`}
              >
                {nationality} maid
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="dir-sub-title">By placement type</h3>
        <ul className="dir-link-list">
          {placementTypes.map((type) => (
            <li key={type}>
              <Link href={`/agencies?service=${encodeURIComponent(type)}`}>
                {type}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Centre rail: newest approved agency listings. */
export function RecentListings({ agencies }: { agencies: DirectoryAgency[] }) {
  if (agencies.length === 0) {
    return <p className="dir-empty">New listings appear here as agencies join.</p>;
  }
  return (
    <ul className="dir-recent-list">
      {agencies.map((agency) => (
        <li key={agency.id}>
          <Link href={`/agencies/${agency.slug}`} className="dir-recent-name">
            {agency.name}
          </Link>
          <span className="dir-recent-meta">
            {agency.nationalitiesServed.slice(0, 2).join(" / ") ||
              "Agency listing"}
            {agency.city ? ` · ${agency.city}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Centre rail: submit-your-requirements promo. */
export function RequirementsPanel({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <section className="dir-promo">
      <h2 className="dir-promo-title">Submit your requirements</h2>
      <p className="dir-promo-text">
        Tell us the nationality, duties and start date you need. Your request is
        sent to approved maid agencies that can help.
      </p>
      <Link href="#contact-agencies" className="dir-btn-primary dir-btn-block">
        Send requirements
        <ArrowRight aria-hidden="true" className="size-3.5" />
      </Link>
      <ul className="dir-promo-list">
        <li>Free for employers</li>
        <li>No agency commissions</li>
        <li>
          {signedIn
            ? "Saved to your account"
            : "Create an account to track replies"}
        </li>
      </ul>
      {!signedIn && (
        <Link href="/register" className="dir-promo-link">
          Create employer account
        </Link>
      )}
    </section>
  );
}

/** Right rail: compact contact form for all approved agencies. */
export function ContactAllAgenciesPanel({
  defaultName = "",
  defaultEmail = "",
}: {
  defaultName?: string;
  defaultEmail?: string;
}) {
  return (
    <section id="contact-agencies" className="dir-panel">
      <div className="dir-panel-head">
        <h2 className="dir-panel-title">Contact all maid agencies</h2>
      </div>
      <div className="dir-panel-body">
        <AllAgenciesEnquiryForm
          defaultName={defaultName}
          defaultEmail={defaultEmail}
          compact
        />
      </div>
    </section>
  );
}


/** Right rail: featured agency placements. */
export function FeaturedAgencyRail({
  agencies,
}: {
  agencies: DirectoryAgency[];
}) {
  return (
    <section className="dir-panel">
      <div className="dir-panel-head">
        <h2 className="dir-panel-title">Featured agencies</h2>
        <Link href="/agencies?sort=top-rated" className="dir-panel-more">
          Top rated
          <ChevronRight aria-hidden="true" className="size-3" />
        </Link>
      </div>
      <div className="dir-panel-body">
        {agencies.length === 0 ? (
          <p className="dir-empty">
            Featured placements appear here once agencies take an advertising
            slot.
          </p>
        ) : (
          <ol className="dir-featured-list">
            {agencies.map((agency, index) => (
              <li key={agency.id}>
                <span className="dir-featured-rank" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="dir-featured-body">
                  <Link
                    href={`/agencies/${agency.slug}`}
                    className="dir-featured-name"
                  >
                    {agency.name}
                  </Link>
                  <span className="dir-recent-meta">
                    {agency.nationalitiesServed.slice(0, 2).join(", ") ||
                      "Agency listing"}
                    {agency.rating ? ` · ${agency.rating.toFixed(1)}/5` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

export type MaidNewsItem = {
  title: string;
  href: string;
  summary: string;
  date?: Date;
};

/** Maid news / guides block shown near the bottom of the directory columns. */
export function MaidNewsList({ items }: { items: MaidNewsItem[] }) {
  return (
    <ul className="dir-news-list">
      {items.map((item) => (
        <li key={item.href}>
          <Link href={item.href} className="dir-news-title">
            {item.title}
          </Link>
          <span className="dir-recent-meta">
            {item.date ? `${shortDate.format(item.date)} · ` : ""}
            {item.summary}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Small print that keeps the directory role explicit. */
export function DirectoryTrustNote() {
  return (
    <p className="dir-trust">
      FindMaids is a directory and advertising platform for independent maid
      agencies in Singapore. We do not employ or place domestic workers, and we
      do not guarantee agency services. Verify licences and terms directly with
      each agency.{" "}
      <Link href="/about" className="underline">
        About FindMaids
      </Link>
    </p>
  );
}

