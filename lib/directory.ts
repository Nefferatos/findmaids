import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRankingWeights, rotateFeatured, scoreAgency } from "@/lib/ranking";

export type DirectoryFilters = {
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
    where: { status: "APPROVED" },
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
