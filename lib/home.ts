import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { publishedMaidWhere } from "@/lib/maids";
import { maidPhotoUrl } from "@/lib/maid-photo";
import { sampleAgencyVisibilityWhere } from "@/lib/sample-data";

/**
 * Homepage data sources.
 *
 * The landing page mixes two different things and they must stay separate:
 *
 *  - `getHomepageAgencyBanners` – paid agency advertising. Only approved
 *    agencies with an active paid plan *and* an uploaded banner image appear.
 *    The banner image is the agency's own artwork, shown as-is.
 *  - `getHomepageMaidRows` – individual maid profiles published by approved
 *    agencies, grouped by nationality.
 *
 * Both read the existing `Agency`/`Maid`/`Subscription`/`AdPlacement` tables;
 * no extra tables or duplicated models are introduced.
 */

/** Nationality rows shown on the homepage, in directory order. */
export const HOME_MAID_NATIONALITIES = [
  "Filipino",
  "Indonesian",
  "Myanmar",
  "Indian",
] as const;

/** Cards shown per nationality row on the homepage. */
export const HOME_MAID_ROW_SIZE = 6;

/** Paid advertising banners on the homepage (2 columns x 6 rows). */
export const HOME_BANNER_LIMIT = 12;

/** "New" tag window for a freshly posted maid profile. */
const NEW_MAID_WINDOW_DAYS = 14;

export type HomeAgencyBanner = {
  id: string;
  name: string;
  slug: string;
  city: string;
  province: string;
  /** Agency-uploaded banner artwork. Never empty for a rendered tile. */
  bannerUrl: string;
  /** True when the agency also holds an active featured ad placement. */
  featured: boolean;
  createdAt: Date;
};

export type HomeMaid = {
  id: string;
  reference: string;
  name: string;
  nationality: string;
  age: number | null;
  placementType: string;
  photoUrl: string | null;
  postedAt: Date;
  /** "Today", "2 days ago", or a short date for older profiles. */
  postedLabel: string;
  tag: "Featured" | "New" | null;
  agencyName: string | null;
  agencySlug: string | null;
};

export type HomeMaidRow = {
  nationality: string;
  title: string;
  moreLabel: string;
  moreHref: string;
  maids: HomeMaid[];
};

const DAY_MS = 86_400_000;

/**
 * Relative posting label used on maid cards. Elapsed time is used (not calendar
 * days) so "Today" and "2 days ago" behave the same in every timezone.
 */
export function postedLabel(postedAt: Date, now: Date = new Date()): string {
  const elapsed = now.getTime() - postedAt.getTime();
  if (!Number.isFinite(elapsed) || elapsed < DAY_MS) return "Today";
  const days = Math.floor(elapsed / DAY_MS);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
  }).format(postedAt);
}

/**
 * A maid card shows one tag: "Featured" when her agency holds an active paid
 * placement, otherwise "New" while the profile is fresh, otherwise nothing.
 */
export function maidTag(
  postedAt: Date,
  featured: boolean,
  now: Date = new Date(),
): HomeMaid["tag"] {
  if (featured) return "Featured";
  const elapsed = now.getTime() - postedAt.getTime();
  if (Number.isFinite(elapsed) && elapsed < NEW_MAID_WINDOW_DAYS * DAY_MS)
    return "New";
  return null;
}

/** Featured placements first, then newest agencies. */
export function orderAgencyBanners(
  banners: HomeAgencyBanner[],
): HomeAgencyBanner[] {
  return [...banners].sort(
    (left, right) =>
      Number(right.featured) - Number(left.featured) ||
      right.createdAt.getTime() - left.createdAt.getTime(),
  );
}

function bannerUrl(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Advertising banners for the homepage.
 *
 * Eligibility mirrors the paid-plan rule used elsewhere in the directory: an
 * active subscription that has started, has not ended and has at least one paid
 * invoice. Agencies are read from the `agencies` table; agencies without a
 * banner image are skipped rather than rendered as empty tiles.
 *
 * `skip` lets the page split one ordered list between the main banner grid and
 * the smaller sidebar tiles without showing the same agency twice.
 */
export async function getHomepageAgencyBanners(options?: {
  limit?: number;
  skip?: number;
}): Promise<HomeAgencyBanner[]> {
  const limit = Math.max(0, Math.min(options?.limit ?? HOME_BANNER_LIMIT, 24));
  const skip = Math.max(0, options?.skip ?? 0);
  if (limit === 0) return [];

  const now = new Date();
  const visibility = sampleAgencyVisibilityWhere();
  const rows = await prisma.agency.findMany({
    where: {
      status: "APPROVED",
      bannerUrl: { not: null },
      subscriptions: {
        some: {
          status: "ACTIVE",
          startDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gte: now } }],
          payments: { some: { status: "PAID" } },
        },
      },
      ...(visibility ? { AND: [visibility] } : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      province: true,
      bannerUrl: true,
      createdAt: true,
      adPlacements: {
        where: {
          status: "ACTIVE",
          startDate: { lte: now },
          endDate: { gte: now },
          type: { in: ["FEATURED", "HOMEPAGE"] },
        },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    // Extra rows cover agencies whose banner column is blank or whitespace.
    take: Math.min(64, (skip + limit) * 3),
  });

  const banners: HomeAgencyBanner[] = [];
  for (const agency of rows) {
    const url = bannerUrl(agency.bannerUrl);
    if (!url) continue;
    banners.push({
      id: agency.id,
      name: agency.name,
      slug: agency.slug,
      city: agency.city,
      province: agency.province,
      bannerUrl: url,
      featured: (agency.adPlacements?.length ?? 0) > 0,
      createdAt: agency.createdAt,
    });
  }
  return orderAgencyBanners(banners).slice(skip, skip + limit);
}

function ageFrom(dateOfBirth: Date | null, now: Date): number | null {
  if (!dateOfBirth) return null;
  const birthday = new Date(dateOfBirth);
  let age = now.getFullYear() - birthday.getFullYear();
  const monthDiff = now.getMonth() - birthday.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthday.getDate()))
    age -= 1;
  return age >= 18 && age <= 80 ? age : null;
}

export type HomeMaidRecord = {
  id: string;
  reference: string;
  fullName: string | null;
  nationality: string;
  age: number | null;
  dateOfBirth: Date | null;
  placementType: string;
  photoUrl: string | null;
  photoUrls: string[];
  photoThumbnailUrls: string[];
  photoPortraitUrls: string[];
  createdAt: Date;
  agency: {
    name: string;
    slug: string;
    adPlacements: { id: string }[];
  } | null;
};

export function toHomeMaid(maid: HomeMaidRecord, now: Date): HomeMaid {
  // Legacy `/uploads/...` paths are skipped so a card never renders a broken
  // image; it shows the maid's initials instead. See lib/maid-photo.ts.
  const photo = maidPhotoUrl(maid);
  const featured = (maid.agency?.adPlacements?.length ?? 0) > 0;
  return {
    id: maid.id,
    reference: maid.reference,
    name: maid.fullName?.trim() || `Maid ${maid.reference}`,
    nationality: maid.nationality,
    age: maid.age ?? ageFrom(maid.dateOfBirth, now),
    placementType: maid.placementType,
    photoUrl: photo,
    postedAt: maid.createdAt,
    postedLabel: postedLabel(maid.createdAt, now),
    tag: maidTag(maid.createdAt, featured, now),
    agencyName: maid.agency?.name ?? null,
    agencySlug: maid.agency?.slug ?? null,
  };
}

/**
 * Latest maids for each homepage nationality.
 *
 * Eligibility is the same public visibility rule used by the agency profile
 * and the directory keyword search (`publishedMaidWhere`), narrowed to maids
 * whose agency is approved. Rows with no maids are omitted so an empty
 * nationality never leaves a blank band on the page.
 */
export async function getHomepageMaidRows(options?: {
  perRow?: number;
}): Promise<HomeMaidRow[]> {
  const perRow = Math.max(
    1,
    Math.min(options?.perRow ?? HOME_MAID_ROW_SIZE, 12),
  );
  const now = new Date();
  const visibility = sampleAgencyVisibilityWhere();
  const agencyWhere: Prisma.AgencyWhereInput = {
    status: "APPROVED",
    ...(visibility ? { AND: [visibility] } : {}),
  };

  // Queried one nationality at a time: Hyperdrive limits how many connections a
  // single Worker request may open, and four parallel queries plus the banner
  // query was enough to exhaust it and hang the landing page.
  const rows: HomeMaidRow[] = [];
  for (const nationality of HOME_MAID_NATIONALITIES) {
    const maids = await prisma.maid.findMany({
      where: {
        ...publishedMaidWhere(),
        nationality: { contains: nationality, mode: "insensitive" },
        agency: agencyWhere,
      },
      select: {
        id: true,
        reference: true,
        fullName: true,
        nationality: true,
        age: true,
        dateOfBirth: true,
        placementType: true,
        photoUrl: true,
        photoUrls: true,
        photoThumbnailUrls: true,
        photoPortraitUrls: true,
        createdAt: true,
        agency: {
          select: {
            name: true,
            slug: true,
            adPlacements: {
              where: {
                status: "ACTIVE",
                startDate: { lte: now },
                endDate: { gte: now },
                type: {
                  in: ["FEATURED", "HOMEPAGE", "SEARCH", "CATEGORY_TOP"],
                },
              },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: perRow,
    });

    const row: HomeMaidRow = {
      nationality,
      title: `${nationality} maids`,
      moreLabel: `more ${nationality.toLowerCase()} maids`,
      moreHref: `/agencies?nationality=${encodeURIComponent(nationality)}`,
      maids: maids.map((maid) =>
        toHomeMaid(maid as unknown as HomeMaidRecord, now),
      ),
    };
    rows.push(row);
  }

  return rows.filter((row) => row.maids.length > 0);
}

/**
 * Everything the landing page needs, in one call. Banner fetching pulls a few
 * extra rows so the sidebar can show different agencies from the main grid.
 */
export async function getHomePageData(options?: {
  bannerLimit?: number;
  sidebarLimit?: number;
  perRow?: number;
}) {
  const bannerLimit = Math.max(
    0,
    Math.min(options?.bannerLimit ?? HOME_BANNER_LIMIT, HOME_BANNER_LIMIT),
  );
  const sidebarLimit = Math.max(0, Math.min(options?.sidebarLimit ?? 4, 8));

  const [banners, maidRows] = await Promise.all([
    getHomepageAgencyBanners({ limit: bannerLimit + sidebarLimit }),
    getHomepageMaidRows({ perRow: options?.perRow ?? HOME_MAID_ROW_SIZE }),
  ]);

  return {
    banners: banners.slice(0, bannerLimit),
    sidebarBanners: banners.slice(bannerLimit, bannerLimit + sidebarLimit),
    maidRows,
  };
}
