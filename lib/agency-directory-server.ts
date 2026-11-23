/**
 * Server-only data access for the maid-agency directory (/maid-agency).
 *
 * Reads the existing Agency/Maid/Subscription/AdPlacement tables and shapes the
 * result into the client-safe `DirectoryAgency` records defined in
 * `lib/agency-directory.ts`. Keep this file out of client components: it imports
 * Prisma (and therefore Node-only modules).
 */
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { publishedMaidWhere } from "@/lib/maids";
import { sampleAgencyVisibilityWhere } from "@/lib/sample-data";
import {
  AGENCY_LEFT_RAIL_BANNERS,
  AGENCY_RIGHT_RAIL_BANNERS,
  AGENCY_TOP_BANNERS,
  buildAgencySearchText,
  extractPostalCode,
  mergeMaidCounts,
  sortAgenciesByName,
  type AgencyDirectoryData,
  type AgencyMaidCount,
  type DirectoryAd,
  type DirectoryAgency,
} from "@/lib/agency-directory";

type AgencyRow = {
  id: string;
  name: string;
  slug: string;
  licenseNumber: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  bannerLeftUrl: string | null;
  bannerRightUrl: string | null;
  address: string;
  city: string;
  province: string;
  postalCode: string | null;
  contactPerson: string | null;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  nationalitiesServed: string[];
  services: string[];
  languages: string[];
  createdAt: Date;
  adPlacements: { id: string }[];
  subscriptions: { payments: { id: string }[] }[];
};

function cleanUrl(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function readContactPerson(value: Prisma.JsonValue | null): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const contact = (value as Record<string, unknown>).contactPerson;
  return typeof contact === "string" && contact.trim() ? contact.trim() : null;
}

/**
 * Paid banners for one slot (horizontal, left rail, right rail). Paid featured
 * placements sort first, then the newest agency - same order as the homepage.
 */
function buildBannerPool(
  agencies: DirectoryAgency[],
  pick: (agency: DirectoryAgency) => string | null,
  createdAt: Map<string, number>,
): DirectoryAd[] {
  return agencies
    .filter((agency) => agency.paid)
    .map((agency) => ({ agency, url: pick(agency) }))
    .filter((entry): entry is { agency: DirectoryAgency; url: string } =>
      Boolean(entry.url),
    )
    .sort(
      (left, right) =>
        Number(right.agency.featured) - Number(left.agency.featured) ||
        (createdAt.get(right.agency.id) ?? 0) -
          (createdAt.get(left.agency.id) ?? 0),
    )
    .map((entry) => ({
      id: entry.agency.id,
      name: entry.agency.name,
      slug: entry.agency.slug,
      bannerUrl: entry.url,
    }));
}

/**
 * Everything the directory page needs in one round trip.
 */
export async function getAgencyDirectory(): Promise<AgencyDirectoryData> {
  const now = new Date();
  const visibility = sampleAgencyVisibilityWhere();
  const agencyWhere: Prisma.AgencyWhereInput = {
    status: "APPROVED",
    ...(visibility ? { AND: [visibility] } : {}),
  };

  const rows = (await prisma.agency.findMany({
    where: agencyWhere,
    select: {
      id: true,
      name: true,
      slug: true,
      licenseNumber: true,
      logoUrl: true,
      bannerUrl: true,
      bannerLeftUrl: true,
      bannerRightUrl: true,
      address: true,
      city: true,
      province: true,
      postalCode: true,
      contactPerson: true,
      phone: true,
      latitude: true,
      longitude: true,
      nationalitiesServed: true,
      services: true,
      languages: true,
      createdAt: true,
      adPlacements: {
        where: {
          status: "ACTIVE",
          startDate: { lte: now },
          endDate: { gte: now },
          type: { in: ["FEATURED", "HOMEPAGE", "SEARCH", "CATEGORY_TOP"] },
        },
        select: { id: true },
        take: 1,
      },
      subscriptions: {
        where: {
          status: "ACTIVE",
          startDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
        select: {
          payments: {
            where: { status: "PAID" },
            select: { id: true },
            take: 1,
          },
        },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  })) as unknown as AgencyRow[];

  const agencyIds = rows.map((row) => row.id);

  // Maid counts per agency and nationality. Only approved agencies with
  // published, non-sample maids are counted - the same visibility rules the
  // agency profile and maid search use.
  const counts =
    agencyIds.length === 0
      ? []
      : await prisma.maid.groupBy({
          by: ["agencyId", "nationality"],
          where: { ...publishedMaidWhere(), agencyId: { in: agencyIds } },
          _count: { _all: true },
        });

  const countsByAgency = new Map<string, AgencyMaidCount[]>();
  for (const entry of counts) {
    if (!entry.nationality || entry._count._all <= 0) continue;
    const list = countsByAgency.get(entry.agencyId) ?? [];
    list.push({ nationality: entry.nationality, count: entry._count._all });
    countsByAgency.set(entry.agencyId, list);
  }

  // Contact person fallback: agencies do not always fill in the directory
  // column, but published maid biodata carries the agency contact person.
  const contactByAgency = new Map<string, string>();
  if (agencyIds.length > 0) {
    const contacts = await prisma.maid
      .findMany({
        where: {
          agencyId: { in: agencyIds },
          agencyContact: { not: Prisma.DbNull },
        },
        select: { agencyId: true, agencyContact: true },
        orderBy: { createdAt: "desc" },
        take: 2000,
      })
      .catch(() => []);
    for (const row of contacts) {
      if (contactByAgency.has(row.agencyId)) continue;
      const person = readContactPerson(row.agencyContact);
      if (person) contactByAgency.set(row.agencyId, person);
    }
  }

  const agencies: DirectoryAgency[] = rows.map((row) => {
    const maidCounts = mergeMaidCounts(countsByAgency.get(row.id) ?? []);
    const postalCode = row.postalCode ?? extractPostalCode(row.address);
    const contactPerson =
      row.contactPerson ?? contactByAgency.get(row.id) ?? null;
    const base = {
      id: row.id,
      name: row.name,
      slug: row.slug,
      licenseNumber: row.licenseNumber,
      logoUrl: row.logoUrl,
      address: row.address,
      city: row.city,
      province: row.province,
      postalCode,
      contactPerson,
      phone: row.phone,
      latitude: row.latitude,
      longitude: row.longitude,
      paid: row.subscriptions.some(
        (subscription) => subscription.payments.length > 0,
      ),
      featured: row.adPlacements.length > 0,
      bannerUrl: cleanUrl(row.bannerUrl),
      bannerLeftUrl: cleanUrl(row.bannerLeftUrl),
      bannerRightUrl: cleanUrl(row.bannerRightUrl),
      nationalitiesServed: [...row.nationalitiesServed].sort((a, b) =>
        a.localeCompare(b),
      ),
      services: [...row.services].sort((a, b) => a.localeCompare(b)),
      languages: [...row.languages].sort((a, b) => a.localeCompare(b)),
      maidCounts,
    };
    return {
      ...base,
      searchText: buildAgencySearchText(base),
    };
  });

  const ordered = sortAgenciesByName(agencies);
  const createdAt = new Map(
    rows.map((row) => [row.id, row.createdAt.getTime()]),
  );

  return {
    agencies: ordered,
    total: ordered.length,
    topBanners: buildBannerPool(
      agencies,
      (agency) => agency.bannerUrl,
      createdAt,
    ).slice(0, AGENCY_TOP_BANNERS),
    leftBanners: buildBannerPool(
      agencies,
      (agency) => agency.bannerLeftUrl ?? agency.bannerUrl,
      createdAt,
    ).slice(0, AGENCY_LEFT_RAIL_BANNERS),
    rightBanners: buildBannerPool(
      agencies,
      (agency) => agency.bannerRightUrl ?? agency.bannerUrl,
      createdAt,
    ).slice(0, AGENCY_RIGHT_RAIL_BANNERS),
    featuredPool: buildBannerPool(
      agencies,
      (agency) => agency.bannerUrl,
      createdAt,
    ).slice(0, 12),
  };
}
