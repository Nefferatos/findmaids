import Image from "next/image";
import Link from "next/link";
import { Check, MapPin, Star } from "lucide-react";
import { auth } from "@/auth";
import { PlacementImpression, TrackedLink } from "@/components/profile-actions";
import { ContactAgencyTab } from "@/components/contact-agency-tab";
import { SiteHeader, TabNav } from "@/components/site-navigation";

export function Container({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-8 max-w-2xl">
      {eyebrow && (
        <p className="text-primary mb-3 inline-flex items-center gap-2 text-xs font-extrabold tracking-[0.14em] uppercase">
          <span
            aria-hidden="true"
            className="from-primary to-accent h-[3px] w-6 rounded-full bg-gradient-to-r"
          />
          {eyebrow}
        </p>
      )}
      <h2 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="text-muted-foreground mt-3 leading-7">{description}</p>
      )}
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer border-t py-10">
      <Container>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link
              href="/"
              className="font-display text-primary text-xl font-bold"
            >
              FindMaids
            </Link>
            <p className="text-muted-foreground mt-3 max-w-xs text-sm leading-6">
              A directory connecting families with independent domestic staffing
              agencies based in Singapore and serving local or overseas needs.
            </p>
          </div>
          <div>
            <h2 className="font-semibold">Explore</h2>
            <ul className="text-muted-foreground mt-3 space-y-2 text-sm">
              <li>
                <Link href="/agencies">Agencies</Link>
              </li>
              <li>
                <Link href="/guides">Guides</Link>
              </li>
              <li>
                <Link href="/faq">FAQ</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="font-semibold">FindMaids</h2>
            <ul className="text-muted-foreground mt-3 space-y-2 text-sm">
              <li>
                <Link href="/about">About</Link>
              </li>
              <li>
                <Link href="/contact">Contact</Link>
              </li>
              <li>
                <Link href="/advertise">Advertise</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="font-semibold">Policies</h2>
            <ul className="text-muted-foreground mt-3 space-y-2 text-sm">
              <li>
                <Link href="/terms">Terms</Link>
              </li>
              <li>
                <Link href="/privacy">Privacy</Link>
              </li>
              <li>
                <Link href="/cookies">Cookies</Link>
              </li>
              <li>
                <Link href="/security">Security reporting</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t pt-5">
          <p className="text-muted-foreground max-w-4xl text-xs leading-5">
            FindMaids is a directory and advertising platform. It does not
            recruit workers, employ domestic workers, or guarantee an agency’s
            services or outcomes. Please verify agency details independently.
          </p>
          <p className="text-muted-foreground mt-3 text-xs font-medium tabular-nums">
            © {new Date().getFullYear()} FindMaids
          </p>
        </div>
      </Container>
    </footer>
  );
}

export async function SiteShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <div className="public-site">
      <SiteHeader user={session?.user ?? null} />
      <TabNav />
      <main className="min-h-[65vh]">{children}</main>
      <SiteFooter />
      <ContactAgencyTab />
    </div>
  );
}

export function Badge({
  children,
  tone = "green",
}: {
  children: React.ReactNode;
  tone?: "green" | "yellow" | "neutral";
}) {
  const styles = {
    green: "site-badge-green",
    yellow: "site-badge-yellow",
    neutral: "bg-muted text-foreground",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

export function RatingStars({
  rating,
  count,
}: {
  rating: number;
  count?: number;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 text-sm"
      aria-label={`${rating.toFixed(1)} out of 5 stars${count === undefined ? "" : `, ${count} reviews`}`}
    >
      <Star
        aria-hidden="true"
        className="size-4 fill-[#d5a500] text-[#9b7700]"
      />
      <strong>{rating.toFixed(1)}</strong>
      {count !== undefined && (
        <span className="text-muted-foreground">({count})</span>
      )}
    </span>
  );
}

export type AgencyCardData = {
  id: string;
  name: string;
  slug: string;
  city: string;
  province: string;
  description: string;
  logoUrl?: string | null;
  verifiedBadge: boolean;
  sponsored?: boolean;
  rating?: number;
  reviewCount?: number;
};

export function AgencyCard({ agency }: { agency: AgencyCardData }) {
  return (
    <article className="site-agency-card flex h-full flex-col rounded-xl border bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md sm:p-6">
      {agency.sponsored && <PlacementImpression agencyIds={[agency.id]} />}
      <div className="mb-4 flex flex-wrap gap-2">
        {agency.sponsored && <Badge tone="yellow">Featured listing</Badge>}
        {agency.verifiedBadge && (
          <Badge>
            <Check aria-hidden="true" className="size-3.5" />
            Verified
          </Badge>
        )}
      </div>
      <div className="flex items-start gap-3">
        <div className="bg-muted text-primary relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl text-lg font-bold">
          {agency.logoUrl ? (
            <Image
              src={agency.logoUrl}
              alt={`${agency.name} logo`}
              fill
              sizes="48px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <span aria-hidden="true">{agency.name.slice(0, 1)}</span>
          )}
        </div>
        <div>
          <h3 className="font-display text-xl leading-tight font-bold">
            {agency.sponsored ? (
              <TrackedLink
                agencyId={agency.id}
                eventType="placement_click"
                href={`/agencies/${agency.slug}`}
                className="hover:underline"
              >
                {agency.name}
              </TrackedLink>
            ) : (
              <Link
                href={`/agencies/${agency.slug}`}
                className="hover:underline"
              >
                {agency.name}
              </Link>
            )}
          </h3>
          <p className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
            <MapPin aria-hidden="true" className="size-3.5" />
            {agency.city}, {agency.province}
          </p>
        </div>
      </div>
      <p className="text-muted-foreground mt-4 line-clamp-3 flex-1 text-sm leading-6">
        {agency.description}
      </p>
      <div className="mt-4 flex items-center justify-between border-t pt-4">
        {agency.reviewCount ? (
          <RatingStars rating={agency.rating ?? 0} count={agency.reviewCount} />
        ) : (
          <span className="text-muted-foreground text-xs">No reviews yet</span>
        )}
        <Link
          href={`/agencies/${agency.slug}`}
          className="text-primary text-sm font-bold underline-offset-4 hover:underline"
        >
          View profile
        </Link>
      </div>
    </article>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgb(15_43_41_/_4%)]">
      <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      <p className="text-muted-foreground mx-auto mt-2 max-w-lg text-sm leading-6">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Pagination({
  page,
  pages,
  makeHref,
}: {
  page: number;
  pages: number;
  makeHref: (page: number) => string;
}) {
  if (pages < 2) return null;
  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-wrap justify-center gap-2">
      {Array.from({ length: pages }, (_, i) => i + 1).map((number) => (
        <Link
          key={number}
          href={makeHref(number)}
          aria-current={number === page ? "page" : undefined}
          className={`inline-flex min-w-10 items-center justify-center rounded-lg border px-3 py-2 text-sm font-bold transition ${
            number === page
              ? "bg-primary border-transparent text-white shadow-sm"
              : "hover:bg-muted bg-white hover:border-[var(--border-strong)]"
          }`}
        >
          {number}
        </Link>
      ))}
    </nav>
  );
}

export function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      className="animate-pulse rounded-xl border bg-white p-5 shadow-[0_1px_2px_rgb(15_43_41_/_4%)]"
    >
      <div className="bg-muted h-5 w-1/2 rounded" />
      <div className="bg-muted mt-4 h-4 w-1/3 rounded" />
      <div className="bg-muted mt-6 h-16 rounded" />
    </div>
  );
}
