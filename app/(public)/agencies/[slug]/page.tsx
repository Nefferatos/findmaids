import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, MapPin, Phone } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge, Container, RatingStars } from "@/components/site";
import { EnquiryForm, ReviewForm } from "@/components/forms";
import { ShareButton, TrackedLink } from "@/components/profile-actions";
import { ProfileViewTracker } from "@/components/profile-view-tracker";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agency = await prisma.agency
    .findFirst({
      where: { slug, status: "APPROVED" },
      select: { name: true, description: true, city: true, province: true },
    })
    .catch(() => null);
  if (!agency)
    return {
      title: "Agency not found | FindMaids",
      robots: { index: false, follow: false },
    };
  return {
    title: `${agency.name} | FindMaids`,
    description: `${agency.description.slice(0, 150)} Serving ${agency.city}, ${agency.province}.`,
    openGraph: {
      title: agency.name,
      description: agency.description.slice(0, 160),
      type: "website",
    },
  };
}

export default async function AgencyProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agency = await prisma.agency
    .findFirst({
      where: { slug, status: "APPROVED" },
      include: {
        photos: { orderBy: { sortOrder: "asc" } },
        reviews: {
          where: { status: "PUBLISHED" },
          orderBy: { createdAt: "desc" },
          take: 30,
        },
        adPlacements: {
          where: {
            status: "ACTIVE",
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
            type: { in: ["FEATURED", "HOMEPAGE", "SEARCH"] },
          },
          select: { id: true },
        },
      },
    })
    .catch(() => null);
  if (!agency) notFound();
  const averageRating = agency.reviews.length
    ? agency.reviews.reduce((sum, review) => sum + review.rating, 0) /
      agency.reviews.length
    : 0;
  const address = `${agency.address}, ${agency.city}, ${agency.province}, Philippines`;
  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
  const safeWebsite = (() => {
    if (!agency.website) return undefined;
    try {
      const url = new URL(
        agency.website.startsWith("http")
          ? agency.website
          : `https://${agency.website}`,
      );
      return url.protocol === "https:" || url.protocol === "http:"
        ? url.toString()
        : undefined;
    } catch {
      return undefined;
    }
  })();
  const businessData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: agency.name,
    description: agency.description,
    address: {
      "@type": "PostalAddress",
      streetAddress: agency.address,
      addressLocality: agency.city,
      addressRegion: agency.province,
      addressCountry: "PH",
    },
    telephone: agency.phone,
    url: safeWebsite,
    image: agency.logoUrl ?? undefined,
    ...(agency.reviews.length
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: averageRating.toFixed(1),
            reviewCount: agency.reviews.length,
          },
        }
      : {}),
  };

  return (
    <Container className="py-8 sm:py-12">
      <ProfileViewTracker agencyId={agency.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(businessData).replace(/</g, "\\u003c"),
        }}
      />
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground mb-6 text-sm"
      >
        <Link className="underline" href="/agencies">
          Agencies
        </Link>{" "}
        / {agency.name}
      </nav>
      <div className="relative mb-6 h-48 overflow-hidden rounded-md bg-[#dce8dc] sm:h-64">
        {agency.bannerUrl && (
          <Image
            src={agency.bannerUrl}
            alt={`${agency.name} banner`}
            fill
            sizes="100vw"
            className="object-cover"
            unoptimized
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <h1 className="font-display absolute bottom-5 left-5 flex items-center gap-3 text-3xl font-bold text-white sm:text-4xl">
          {agency.logoUrl && (
            <Image
              src={agency.logoUrl}
              alt={`${agency.name} logo`}
              width={56}
              height={56}
              className="size-14 rounded-md border border-white object-cover"
              unoptimized
            />
          )}
          {agency.name}
        </h1>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            {agency.adPlacements.length > 0 && (
              <Badge tone="yellow">Featured / Sponsored</Badge>
            )}
            {agency.verifiedBadge && (
              <Badge>
                <Check aria-hidden="true" className="size-3.5" />
                Verified
              </Badge>
            )}
            <RatingStars rating={averageRating} count={agency.reviews.length} />
          </div>
          <p className="text-muted-foreground mt-4 flex items-center gap-2">
            <MapPin aria-hidden="true" className="size-4" />
            {address}
          </p>
          <p className="mt-6 leading-7 whitespace-pre-line">
            {agency.description}
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <section>
              <h2 className="font-display text-xl font-bold">Services</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {agency.services.map((value) => (
                  <li key={value}>
                    <Badge tone="neutral">{value}</Badge>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="font-display text-xl font-bold">
                Languages and nationalities
              </h2>
              <p className="mt-3 text-sm leading-6">
                {agency.languages.join(", ") || "Contact agency"}
                <br />
                Serves:{" "}
                {agency.nationalitiesServed.join(", ") || "Contact agency"}
              </p>
            </section>
          </div>
          {agency.licenseNumber && (
            <p className="mt-6 text-sm">
              <strong>Licence number:</strong> {agency.licenseNumber}
            </p>
          )}
          <section className="mt-10">
            <h2 className="font-display text-2xl font-bold">Agency photos</h2>
            {agency.photos.length ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {agency.photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="bg-muted relative aspect-[4/3] overflow-hidden rounded-md"
                  >
                    {photo.url && (
                      <Image
                        src={photo.url}
                        alt={photo.caption || `${agency.name} agency photo`}
                        fill
                        sizes="(max-width: 640px) 50vw, 33vw"
                        className="object-cover"
                        unoptimized
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground mt-3 text-sm">
                No photos provided.
              </p>
            )}
          </section>
          <section className="mt-10">
            <h2 className="font-display text-2xl font-bold">Location</h2>
            <iframe
              title={`Map showing ${agency.name}`}
              src={mapUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="mt-4 h-64 w-full rounded-md border"
            />
          </section>
          <section className="mt-10">
            <h2 className="font-display text-2xl font-bold">
              Published reviews
            </h2>
            {agency.reviews.length ? (
              <div className="mt-4 space-y-4">
                {agency.reviews.map((review) => (
                  <article
                    key={review.id}
                    className="rounded-md border bg-white p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-bold">{review.title}</h3>
                      <RatingStars rating={review.rating} />
                    </div>
                    <p className="mt-2 text-sm leading-6">{review.body}</p>
                    <p className="text-muted-foreground mt-3 text-xs">
                      {review.authorName} ·{" "}
                      {review.createdAt.toLocaleDateString("en-PH")}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground mt-3 text-sm">
                No published reviews yet.
              </p>
            )}
            <div className="mt-6">
              <ReviewForm agencyId={agency.id} />
            </div>
          </section>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-md border bg-white p-5">
            <h2 className="font-display text-xl font-bold">
              Contact this agency
            </h2>
            <div className="mt-4 grid gap-2">
              {agency.phone && (
                <TrackedLink
                  agencyId={agency.id}
                  eventType="phone_click"
                  href={`tel:${agency.phone}`}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 font-semibold"
                >
                  <Phone aria-hidden="true" className="size-4" />
                  Call agency
                </TrackedLink>
              )}
              {agency.whatsapp && (
                <TrackedLink
                  agencyId={agency.id}
                  eventType="whatsapp_click"
                  href={`https://wa.me/${agency.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 items-center justify-center rounded-md bg-[#18794e] px-3 font-semibold text-white"
                >
                  WhatsApp
                </TrackedLink>
              )}
              {safeWebsite && (
                <TrackedLink
                  agencyId={agency.id}
                  eventType="website_click"
                  href={safeWebsite}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 items-center justify-center rounded-md border px-3 font-semibold"
                >
                  Visit website
                </TrackedLink>
              )}
            </div>
            <div className="mt-4">
              <ShareButton title={agency.name} />
            </div>
          </div>
          <EnquiryForm agencyId={agency.id} agencyName={agency.name} />
          <p className="text-muted-foreground text-xs leading-5">
            FindMaids is a directory platform. Confirm agency credentials and
            arrangements directly. Listing status is not a guarantee or
            endorsement.
          </p>
        </aside>
      </div>
    </Container>
  );
}
