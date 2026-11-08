import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRankingWeights, rotateFeatured, scoreAgency } from "@/lib/ranking";
import { sampleAgencyVisibilityWhere } from "@/lib/sample-data";

export type DirectoryFilters = {
  keyword?: string;
  city?: string;
  province?: string;
  services: string[];
  nationalities: string[];
  language?: string;
  rating?: number;
  verified?: boolean;
  sort: "recommended" | "top-rated" | "newest";
  page: number;
};

export function buildAgencyWhere(
  filters: DirectoryFilters,
): Prisma.AgencyWhereInput {
  const and: Prisma.AgencyWhereInput[] = [];
  // The keyword box on the directory search form matches agency names,
  // descriptions and listed services. It lives in `AND` so it can be combined
  // with the location `OR` group below.
  if (filters.keyword)
    and.push({
      OR: [
        { name: { contains: filters.keyword, mode: "insensitive" } },
        {
          description: {
            contains: filters.keyword,
            mode: "insensitive",
          },
        },
        { services: { has: filters.keyword } },
      ],
    });
  // Demonstration rows are hidden everywhere except local/preview environments.
  const sampleVisibility = sampleAgencyVisibilityWhere();
  if (sampleVisibility) and.push(sampleVisibility);

  return {
    status: "APPROVED",
    ...(filters.city
      ? {
          OR: [
            { city: { contains: filters.city, mode: "insensitive" } },
            { province: { contains: filters.city, mode: "insensitive" } },
            { serviceLocations: { has: filters.city } },
          ],
        }
      : {}),
    ...(and.length ? { AND: and } : {}),
    ...(filters.province
      ? { province: { contains: filters.province, mode: "insensitive" } }
      : {}),
    ...(filters.services.length
      ? { services: { hasEvery: filters.services } }
      : {}),
    ...(filters.nationalities.length
      ? { nationalitiesServed: { hasSome: filters.nationalities } }
      : {}),
    ...(filters.language ? { languages: { has: filters.language } } : {}),
    ...(filters.verified ? { verifiedBadge: true } : {}),
  };
}

export function parseDirectoryFilters(
  params: Record<string, string | string[] | undefined>,
): DirectoryFilters {
  const get = (key: string) =>
    Array.isArray(params[key]) ? params[key]?.[0] : params[key];
  const rating = Number(get("rating"));
  const page = Number(get("page"));
  const sort = get("sort");
  const services = Array.isArray(params.service)
    ? params.service
    : params.service
      ? [params.service]
      : [];
  const nationalities = Array.isArray(params.nationality)
    ? params.nationality
    : params.nationality
      ? [params.nationality]
      : [];

  return {
    keyword: get("q")?.trim().slice(0, 80) || undefined,
    city: get("city")?.trim() || undefined,
    province: get("province")?.trim() || undefined,
    services: services.slice(0, 10),
    nationalities: nationalities.slice(0, 10),
    language: get("language")?.trim() || undefined,
    rating:
      Number.isInteger(rating) && rating >= 1 && rating <= 5
        ? rating
        : undefined,
    verified: get("verified") === "true",
    sort: sort === "top-rated" || sort === "newest" ? sort : "recommended",
    page: Number.isInteger(page) && page > 0 ? Math.min(page, 1000) : 1,
  };
}

export async function getDirectoryPage(
  filters: DirectoryFilters,
  pageSize = 12,
) {
  const where = buildAgencyWhere(filters);
  const now = new Date();
  const weights = await getRankingWeights();
  const agencies = await prisma.agency.findMany({
    where,
    include: {
      photos: { select: { id: true }, take: 1 },
      reviews: { where: { status: "PUBLISHED" }, select: { rating: true } },
      subscriptions: {
        where: {
          status: "ACTIVE",
          startDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gte: now } }],
          payments: { some: { status: "PAID" } },
        },
        include: { plan: { select: { listingPriority: true } } },
      },
      adPlacements: {
        where: {
          status: "ACTIVE",
          startDate: { lte: now },
          endDate: { gte: now },
        },
        select: { id: true, type: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  let enriched = agencies.map((agency) => {
    const average = agency.reviews.length
      ? agency.reviews.reduce((sum, review) => sum + review.rating, 0) /
        agency.reviews.length
      : 0;
    const completeness =
      [
        agency.description,
        agency.logoUrl,
        agency.bannerUrl,
        agency.licenseNumber,
        agency.website,
        agency.whatsapp,
        agency.photos.length > 0,
      ].filter(Boolean).length / 7;
    const score = scoreAgency(
      {
        id: agency.id,
        listingPriority: Math.max(
          0,
          ...agency.subscriptions.map((subscription) =>
            subscription.foundingAgency &&
            subscription.foundingPeriodEndsAt &&
            subscription.foundingPeriodEndsAt > now
              ? Math.max(subscription.plan.listingPriority, 10)
              : subscription.plan.listingPriority,
          ),
          ...(agency.foundingAgency &&
          agency.foundingPeriodEndsAt &&
          agency.foundingPeriodEndsAt > now
            ? [10]
            : []),
        ),
        rating: average,
        reviewCount: agency.reviews.length,
        profileCompleteness:
          agency.profileCompleteness > 0
            ? agency.profileCompleteness / 100
            : completeness,
        daysSinceActivity:
          (Date.now() - agency.updatedAt.getTime()) / 86_400_000,
      },
      weights,
    );
    return {
      ...agency,
      rating: average,
      reviewCount: agency.reviews.length,
      score,
      sponsored:
        agency.subscriptions.length > 0 && agency.adPlacements.length > 0,
    };
  });

  if (filters.rating)
    enriched = enriched.filter((agency) => agency.rating >= filters.rating!);
  const total = enriched.length;
  let sorted = enriched;
  if (filters.sort === "recommended")
    sorted = [...enriched].sort((a, b) => b.score - a.score);
  if (filters.sort === "top-rated")
    sorted = [...enriched].sort(
      (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount,
    );
  const featured = rotateFeatured(sorted.filter((agency) => agency.sponsored));
  const ranked = [...featured, ...sorted.filter((agency) => !agency.sponsored)];
  const pageAgencies = ranked.slice(
    (filters.page - 1) * pageSize,
    filters.page * pageSize,
  );

  return {
    agencies: pageAgencies,
    total,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getHomepagePremiumBanners(limit = 4) {
  const now = new Date();
  const agencies = await prisma.agency.findMany({
    where: {
      status: "APPROVED",
      ...(sampleAgencyVisibilityWhere()
        ? { AND: [sampleAgencyVisibilityWhere()!] }
        : {}),
      adPlacements: {
        some: {
          type: "HOMEPAGE",
          status: "ACTIVE",
          startDate: { lte: now },
          endDate: { gte: now },
        },
      },
      subscriptions: {
        some: {
          status: "ACTIVE",
          startDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gte: now } }],
          payments: { some: { status: "PAID" } },
        },
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      province: true,
      description: true,
      bannerUrl: true,
      adPlacements: {
        where: {
          type: "HOMEPAGE",
          status: "ACTIVE",
          startDate: { lte: now },
          endDate: { gte: now },
        },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: Math.max(1, Math.min(limit, 12)),
  });
  return rotateFeatured(agencies, now);
}

export async function getPopularAgencyServices(limit = 4) {
  const agencies = await prisma.agency.findMany({
    where: {
      status: "APPROVED",
      ...(sampleAgencyVisibilityWhere()
        ? { AND: [sampleAgencyVisibilityWhere()!] }
        : {}),
    },
    select: { services: true },
  });
  const counts = new Map<string, number>();
  for (const agency of agencies) {
    for (const service of new Set(agency.services)) {
      counts.set(service, (counts.get(service) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([service, agencyCount]) => ({ service, agencyCount }))
    .sort(
      (a, b) =>
        b.agencyCount - a.agencyCount || a.service.localeCompare(b.service),
    )
    .slice(0, Math.max(1, Math.min(limit, 12)));
}
/**
 * Nationality groupings used by the classic three-column directory layout.
 * The order mirrors the way Singapore maid directories list placements; any
 * additional nationality stored on an agency profile is appended dynamically.
 */
export const DIRECTORY_NATIONALITIES = [
  "Filipino",
  "Indonesian",
  "Myanmar",
  "Indian",
  "Sri Lankan",
] as const;

/** Placement types the directory exposes as "maid type" filters. */
export const DIRECTORY_PLACEMENT_TYPES = [
  "Full-time placement",
  "Part-time placement",
  "Live-in placement",
  "Newborn care",
] as const;

/** Languages offered as quick picks on the compact search form. */
export const DIRECTORY_LANGUAGES = [
  "English",
  "Mandarin",
  "Malay",
  "Tamil",
  "Tagalog",
  "Bahasa Indonesia",
  "Burmese",
] as const;

export type NationalitySection<T> = {
  nationality: string;
  agencies: T[];
  total: number;
  moreHref: string;
};

function normaliseNationalities(values: readonly string[]) {
  return values
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

/**
 * Groups approved listings into nationality sections for the homepage and the
 * employer landing page. Agencies are real directory records: a listing shows
 * up under every nationality the agency declares in `nationalitiesServed`.
 */
export function groupAgenciesByNationality<
  T extends { nationalitiesServed: string[] },
>(agencies: T[], perSection = 5): NationalitySection<T>[] {
  const sections: NationalitySection<T>[] = [];
  const claimed = new Set<T>();
  for (const nationality of DIRECTORY_NATIONALITIES) {
    const key = nationality.toLowerCase();
    const matches = agencies.filter((agency) =>
      normaliseNationalities(agency.nationalitiesServed).includes(key),
    );
    if (matches.length === 0) continue;
    for (const agency of matches) claimed.add(agency);
    sections.push({
      nationality,
      agencies: matches.slice(0, Math.max(1, perSection)),
      total: matches.length,
      moreHref: `/agencies?nationality=${encodeURIComponent(nationality)}`,
    });
  }
  const remaining = agencies.filter((agency) => !claimed.has(agency));
  if (remaining.length > 0) {
    sections.push({
      nationality: "Other nationalities",
      agencies: remaining.slice(0, Math.max(1, perSection)),
      total: remaining.length,
      moreHref: "/agencies",
    });
  }
  return sections;
}

/**
 * Nationalities that can be offered as filters: the standard directory list
 * plus anything else an approved agency has published.
 */
export function directoryNationalities(
  agencies: { nationalitiesServed: string[] }[],
): string[] {
  const seen = new Map<string, string>();
  for (const nationality of DIRECTORY_NATIONALITIES) {
    seen.set(nationality.toLowerCase(), nationality);
  }
  for (const agency of agencies) {
    for (const raw of agency.nationalitiesServed) {
      const value = raw.trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (!seen.has(key)) seen.set(key, value);
    }
  }
  return [...seen.values()];
}

export type DirectoryBanner = {
  id: string;
  name: string;
  slug: string;
  city: string;
  province: string;
  description: string;
  bannerUrl: string | null;
  sponsored: boolean;
};

/**
 * Advertising banners for the directory columns. Paid homepage placements come
 * first and stay labelled as featured; the remaining slots show approved
 * agencies that have uploaded a profile banner so the column is never filled
 * with placeholder artwork.
 */
export async function getDirectoryAdBanners(
  limit = 4,
): Promise<DirectoryBanner[]> {
  const paid = await getHomepagePremiumBanners(limit);
  const banners: DirectoryBanner[] = paid.map((agency) => ({
    id: agency.id,
    name: agency.name,
    slug: agency.slug,
    city: agency.city,
    province: agency.province,
    description: agency.description,
    bannerUrl: agency.bannerUrl,
    sponsored: true,
  }));
  if (banners.length >= limit) return banners.slice(0, limit);

  const fill = await prisma.agency.findMany({
    where: {
      status: "APPROVED",
      bannerUrl: { not: null },
      ...(sampleAgencyVisibilityWhere()
        ? { AND: [sampleAgencyVisibilityWhere()!] }
        : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      province: true,
      description: true,
      bannerUrl: true,
    },
    orderBy: { updatedAt: "desc" },
    take: Math.max(1, Math.min(limit * 3, 12)),
  });
  const known = new Set(banners.map((banner) => banner.id));
  for (const agency of fill) {
    if (banners.length >= limit) break;
    if (known.has(agency.id)) continue;
    if (!agency.bannerUrl || agency.bannerUrl.trim() === "") continue;
    known.add(agency.id);
    banners.push({ ...agency, sponsored: false });
  }
  return banners;
}

/**
 * Everything the classic directory columns need, fetched once per render:
 * nationality sections, recent listings, featured placements and navigation
 * counts. Shared by the public homepage and the employer landing page.
 */
export async function getDirectoryHomeData(options?: {
  perSection?: number;
  bannerLimit?: number;
}) {
  const perSection = options?.perSection ?? 5;
  const bannerLimit = options?.bannerLimit ?? 4;
  const [page, banners, services] = await Promise.all([
    getDirectoryPage(parseDirectoryFilters({ sort: "recommended" }), 200),
    getDirectoryAdBanners(bannerLimit),
    getPopularAgencyServices(8),
  ]);
  const agencies = page.agencies;
  const recent = [...agencies]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);
  return {
    agencies,
    total: page.total,
    sections: groupAgenciesByNationality(agencies, perSection),
    nationalities: directoryNationalities(agencies),
    banners,
    services,
    recent,
    featured: agencies.filter((agency) => agency.sponsored).slice(0, 5),
  };
}

