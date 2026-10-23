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
      ? { city: { contains: filters.city, mode: "insensitive" } }
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
          OR: [{ endDate: null }, { endDate: { gte: now } }],
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
    const score = scoreAgency({
      id: agency.id,
      listingPriority: Math.max(
        0,
        ...agency.subscriptions.map(
          (subscription) =>
            subscription.foundingAgency &&
            subscription.foundingPeriodEndsAt &&
            subscription.foundingPeriodEndsAt > now
              ? Math.max(subscription.plan.listingPriority, 10)
              : subscription.plan.listingPriority,
        ),
        ...(agency.foundingAgency && agency.foundingPeriodEndsAt && agency.foundingPeriodEndsAt > now ? [10] : []),
      ),
      rating: average,
      reviewCount: agency.reviews.length,
      profileCompleteness:
        agency.profileCompleteness > 0
          ? agency.profileCompleteness / 100
          : completeness,
      daysSinceActivity: (Date.now() - agency.updatedAt.getTime()) / 86_400_000,
    }, weights);
    return {
      ...agency,
      rating: average,
      reviewCount: agency.reviews.length,
      score,
      sponsored: agency.adPlacements.length > 0,
      homepageFeatured: agency.adPlacements.some(
        (placement) => placement.type === "HOMEPAGE",
      ),
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
