import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, MapPin } from "lucide-react";
import { TrackedLink } from "@/components/profile-actions";
import type { DirectoryAd } from "@/lib/agency-directory";
import type { FeaturedAgency, HomeAgencyBanner } from "@/lib/home";

/**
 * A paid agency advertising banner.
 *
 * The agency uploads the whole banner (logo, phone number, tagline) as one
 * image, so the tile renders that image as-is on a neutral surface instead of
 * re-building it from agency fields. Only agencies with an active paid plan and
 * a banner reach this component (see `getHomepageAgencyBanners` and
 * `getAgencyDirectory`).
 *
 * Variants:
 *  - `grid`    – homepage "Licensed agencies" tile: 700x90 artwork + name row.
 *  - `compact` – small sidebar tile used by maid search.
 *  - `wide`    – fixed-height strip used by maid search.
 *  - `stack`   – full-width 700x90 horizontal banner with a Featured label.
 */
export function AgencyBannerTile({
  banner,
  variant = "grid",
}: {
  banner: HomeAgencyBanner;
  variant?: "grid" | "compact" | "wide" | "stack";
}) {
  if (!banner.bannerUrl) return null;
  const href = `/agencies/${banner.slug}`;
  const label = `${banner.name} agency profile`;
  const wide = variant === "wide";
  const mediaClass =
    variant === "grid" || variant === "stack"
      ? "relative block aspect-[700/90] w-full bg-[var(--muted)]"
      : wide
        ? "relative block h-[120px] w-full bg-[var(--muted)]"
        : "relative block aspect-[16/9] w-full bg-[var(--muted)]";
  const sizes =
    variant === "grid" || variant === "stack"
      ? "(min-width: 1024px) 560px, (min-width: 640px) 48vw, 100vw"
      : wide
        ? "(min-width: 1024px) 600px, 100vw"
        : "(min-width: 1024px) 240px, (min-width: 640px) 46vw, 82vw";

  const media = (
    <>
      <span className={mediaClass}>
        <Image
          src={banner.bannerUrl}
          alt={`${banner.name} advertising banner`}
          fill
          sizes={sizes}
          loading="lazy"
          className="object-contain"
          unoptimized
        />
      </span>
      {variant === "compact" && (
        <span className="absolute top-2 left-2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[0.58rem] font-extrabold tracking-[0.06em] text-[#3a2e00] uppercase shadow-sm">
          Featured
        </span>
      )}
    </>
  );

  const mediaLinkClass =
    variant === "grid"
      ? "relative block after:absolute after:inset-0 after:content-['']"
      : "relative block";

  return (
    <article
      className={`group relative overflow-hidden bg-[var(--surface)] transition-shadow duration-200 ${
        variant === "stack"
          ? "rounded-lg border border-[var(--border)] p-1.5 shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-sm)]"
          : variant === "grid"
            ? "rounded-xl border border-[var(--border)] p-1.5 shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-sm)]"
            : "rounded-xl border border-[var(--border)] shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-sm)]"
      }`}
    >
      {variant === "stack" && (
        <p className="fm-agency-top-ad-label">Featured</p>
      )}
      {banner.featured ? (
        <TrackedLink
          agencyId={banner.id}
          eventType="placement_click"
          href={href}
          aria-label={label}
          className={mediaLinkClass}
        >
          {media}
        </TrackedLink>
      ) : (
        <Link href={href} aria-label={label} className={mediaLinkClass}>
          {media}
        </Link>
      )}
      {variant === "grid" || variant === "compact" ? (
        <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-2 py-1.5">
          <Link
            href={href}
            aria-label={label}
            className="truncate text-xs font-bold hover:text-[var(--primary)] hover:underline"
          >
            {banner.name}
          </Link>
          {variant === "grid" ? (
            <span className="text-muted-foreground shrink-0 text-[0.6rem] font-bold tracking-[0.12em] uppercase">
              Featured
            </span>
          ) : (
            <span className="text-muted-foreground truncate text-[0.68rem]">
              {banner.city}
            </span>
          )}
        </div>
      ) : null}
    </article>
  );
}

/**
 * A featured agency that does not (yet) have paid banner artwork.
 *
 * The homepage band previously rendered banners only, so an approved agency
 * with a migrated inventory but no uploaded artwork (At The Agency, 172
 * profiles) was invisible and the band fell back to an "advertise here"
 * placeholder. This tile shows the agency's own record instead: name, location,
 * how many profiles it publishes, and its verification badge - all real data
 * from `getFeaturedAgencies`.
 *
 * Variants mirror `AgencyBannerTile` so the two can be mixed in one grid:
 *  - `grid`    – homepage band: same 700x90 rhythm as banner artwork.
 *  - `compact` – 240px sidebar tile.
 */
export function FeaturedAgencyTile({
  agency,
  variant = "grid",
}: {
  agency: FeaturedAgency;
  variant?: "grid" | "compact";
}) {
  const href = `/agencies/${agency.slug}`;
  const label = `${agency.name} agency profile`;
  const initials = agency.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  const location = [agency.city, agency.province]
    .map((part) => part?.trim())
    .filter((part, index, list) => Boolean(part) && list.indexOf(part) === index)
    .join(", ");
  const maidLabel =
    agency.maidCount === 1 ? "1 maid profile" : `${agency.maidCount} maid profiles`;
  const mediaClass =
    variant === "grid"
      ? "relative flex aspect-[700/90] w-full items-center gap-3 overflow-hidden rounded-lg bg-[var(--muted)] px-4"
      : "relative flex aspect-[16/9] w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-[var(--muted)] px-3 text-center";

  return (
    <article
      className={`group relative overflow-hidden bg-[var(--surface)] transition-shadow duration-200 ${
        variant === "grid"
          ? "rounded-xl border border-[var(--border)] p-1.5 shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-sm)]"
          : "rounded-xl border border-[var(--border)] shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-sm)]"
      }`}
    >
      <Link href={href} aria-label={label} className={mediaClass}>
        {agency.bannerUrl ? (
          <Image
            src={agency.bannerUrl}
            alt={`${agency.name} agency artwork`}
            width={192}
            height={96}
            unoptimized
            className="h-12 w-auto max-w-[40%] shrink-0 rounded bg-white object-contain p-1 shadow-sm"
          />
        ) : (
          <span
            aria-hidden="true"
            className="text-primary font-display grid size-12 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-white text-base font-extrabold shadow-sm"
          >
            {initials}
          </span>
        )}
        <span className="min-w-0">
          <span className="font-display block truncate text-base font-bold sm:text-lg">
            {agency.name}
          </span>
          <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            {location && (
              <span className="inline-flex items-center gap-1">
                <MapPin aria-hidden="true" className="size-3" />
                {location}
              </span>
            )}
            <span>{maidLabel}</span>
          </span>
        </span>
        {agency.verifiedBadge && (
          <span className="text-primary ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-1 text-[0.6rem] font-extrabold tracking-[0.08em] uppercase shadow-sm">
            <BadgeCheck aria-hidden="true" className="size-3" />
            Verified
          </span>
        )}
      </Link>
      <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-2 py-1.5">
        <Link
          href={href}
          aria-label={label}
          className="hover:text-[var(--primary)] truncate text-xs font-bold hover:underline"
        >
          {agency.name}
        </Link>
        <span className="text-muted-foreground shrink-0 text-[0.6rem] font-bold tracking-[0.12em] uppercase">
          Featured
        </span>
      </div>
    </article>
  );
}

/** Rail slot shapes, so each banner keeps a varied but reserved height. */
const RAIL_SLOTS = ["portrait", "square", "tall", "landscape"] as const;

/**
 * A single paid banner in the left/right directory rail. The slot picks a fixed
 * aspect ratio so the column never jumps while images lazy-load.
 */
export function AgencyRailAd({
  ad,
  slot,
  priority = false,
}: {
  ad: DirectoryAd;
  slot: number;
  /** The first rail banner is above the fold, so it loads eagerly. */
  priority?: boolean;
}) {
  const shape = RAIL_SLOTS[slot % RAIL_SLOTS.length];
  return (
    <Link
      href={`/agencies/${ad.slug}`}
      aria-label={`${ad.name} agency profile`}
      className={`fm-rail-ad fm-rail-ad--${shape}`}
    >
      <Image
        src={ad.bannerUrl}
        alt={`${ad.name} advertising banner`}
        fill
        sizes="180px"
        loading={priority ? "eager" : "lazy"}
        className="object-contain"
        unoptimized
      />
    </Link>
  );
}
