import Image from "next/image";
import Link from "next/link";
import { Check, MapPin, Star } from "lucide-react";
import { PlacementImpression, TrackedLink } from "@/components/profile-actions";

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
    <div className="mb-7 max-w-2xl">
      {eyebrow && (
        <p className="text-primary mb-2 text-sm font-bold tracking-wider uppercase">
          {eyebrow}
        </p>
      )}
      <h2 className="font-display text-3xl font-bold sm:text-4xl">{title}</h2>
      {description && (
        <p className="text-muted-foreground mt-3 leading-7">{description}</p>
      )}
    </div>
  );
}

export function Header() {
  return (
    <header className="bg-background/95 border-b">
      <Container className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-2">
        <Link
          href="/"
          aria-label="FindMaids home"
          className="font-display text-primary text-2xl font-bold"
        >
          Find<span className="text-foreground">Maids</span>
        </Link>
        <nav
          aria-label="Main navigation"
          className="order-3 flex w-full items-center justify-center gap-6 border-t py-2 text-sm font-semibold md:order-none md:w-auto md:border-0 md:py-0"
        >
          <Link href="/agencies">Find an agency</Link>
          <Link href="/guides">Guides</Link>
          <Link href="/about">About</Link>
        </nav>
        <div className="flex items-center gap-1">
          <Link
            href="/login"
            className="hover:bg-muted min-h-10 rounded-md px-3 py-2 text-sm font-semibold"
          >
            Login
          </Link>
          <Link
            href="/advertise"
            className="bg-primary text-primary-foreground min-h-10 rounded-md px-3 py-2 text-sm font-semibold hover:brightness-90"
          >
            Advertise With Us
          </Link>
        </div>
      </Container>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t bg-[#eef1e8] py-10">
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
              agencies in the Philippines.
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
            </ul>
          </div>
        </div>
        <p className="text-muted-foreground mt-8 border-t pt-5 text-xs leading-5">
          FindMaids is a directory and advertising platform. It does not recruit
          workers, employ domestic workers, or guarantee an agency’s services or
          outcomes. Please verify agency details independently.
        </p>
        <p className="text-muted-foreground mt-3 text-xs">
          © {new Date().getFullYear()} FindMaids
        </p>
      </Container>
    </footer>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-h-[65vh]">{children}</main>
      <Footer />
    </>
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
    green: "bg-[#dceee4] text-[#15583d]",
    yellow: "bg-[#fff1bf] text-[#674d00]",
    neutral: "bg-muted text-foreground",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-bold ${styles[tone]}`}
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
  homepageFeatured?: boolean;
  rating?: number;
  reviewCount?: number;
};

export function AgencyCard({ agency }: { agency: AgencyCardData }) {
  return (
    <article className="flex h-full flex-col rounded-md border bg-white p-5 shadow-sm">
      {agency.sponsored && <PlacementImpression agencyIds={[agency.id]} />}
      <div className="mb-4 flex flex-wrap gap-2">
        {agency.sponsored && <Badge tone="yellow">Featured / Sponsored</Badge>}
        {agency.verifiedBadge && (
          <Badge>
            <Check aria-hidden="true" className="size-3.5" />
            Verified
          </Badge>
        )}
      </div>
      <div className="flex items-start gap-3">
        <div className="bg-muted text-primary relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-md text-lg font-bold">
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
          <h3 className="font-display text-xl font-bold">
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
        <RatingStars
          rating={agency.rating ?? 0}
          count={agency.reviewCount ?? 0}
        />
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
    <div className="rounded-md border border-dashed bg-white px-6 py-12 text-center">
      <h2 className="font-display text-xl font-bold">{title}</h2>
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
    <nav aria-label="Pagination" className="mt-8 flex justify-center gap-2">
      {Array.from({ length: pages }, (_, i) => i + 1).map((number) => (
        <Link
          key={number}
          href={makeHref(number)}
          aria-current={number === page ? "page" : undefined}
          className={`rounded border px-3 py-2 text-sm font-semibold ${number === page ? "bg-primary text-white" : "hover:bg-muted bg-white"}`}
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
      className="animate-pulse rounded-md border bg-white p-5"
    >
      <div className="bg-muted h-5 w-1/2 rounded" />
      <div className="bg-muted mt-4 h-4 w-1/3 rounded" />
      <div className="bg-muted mt-6 h-16 rounded" />
    </div>
  );
}
