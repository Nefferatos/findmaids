/**
 * Shared data shapes and pure helpers for the public maid-agency directory
 * (/maid-agency).
 *
 * This module stays free of server-only imports so the client search component
 * can use it directly. The database query lives in
 * `lib/agency-directory-server.ts`.
 */

/** Nationalities offered as directory filters (same set as the homepage). */
export const AGENCY_NATIONALITIES = [
  "Filipino",
  "Indonesian",
  "Myanmar",
  "Indian",
] as const;

/**
 * Singapore planning areas used by the "Area" select. Each option value is
 * `latitude,longitude`, so the client can sort by distance without a lookup.
 */
export const AGENCY_AREAS: {
  name: string;
  latitude: number;
  longitude: number;
}[] = [
  { name: "Ang Mo Kio", latitude: 1.3691, longitude: 103.8454 },
  { name: "Bedok", latitude: 1.3236, longitude: 103.9273 },
  { name: "Bishan", latitude: 1.3508, longitude: 103.8485 },
  { name: "Bukit Batok", latitude: 1.3496, longitude: 103.7498 },
  { name: "Bukit Merah", latitude: 1.2819, longitude: 103.8239 },
  { name: "Bukit Timah", latitude: 1.3294, longitude: 103.8021 },
  { name: "Choa Chu Kang", latitude: 1.3852, longitude: 103.7447 },
  { name: "Clementi", latitude: 1.3162, longitude: 103.7649 },
  { name: "Hougang", latitude: 1.3612, longitude: 103.8863 },
  { name: "Jurong East", latitude: 1.3329, longitude: 103.7436 },
  { name: "Jurong West", latitude: 1.3404, longitude: 103.709 },
  { name: "Kallang", latitude: 1.3111, longitude: 103.862 },
  { name: "Katong", latitude: 1.3048, longitude: 103.904 },
  { name: "Marine Parade", latitude: 1.302, longitude: 103.9053 },
  { name: "Orchard", latitude: 1.3048, longitude: 103.8318 },
  { name: "Pasir Ris", latitude: 1.3732, longitude: 103.949 },
  { name: "Punggol", latitude: 1.4043, longitude: 103.9023 },
  { name: "Queenstown", latitude: 1.2942, longitude: 103.8058 },
  { name: "Sembawang", latitude: 1.4491, longitude: 103.8185 },
  { name: "Sengkang", latitude: 1.3911, longitude: 103.8952 },
  { name: "Serangoon", latitude: 1.3554, longitude: 103.872 },
  { name: "Tampines", latitude: 1.3496, longitude: 103.9568 },
  { name: "Toa Payoh", latitude: 1.3343, longitude: 103.8563 },
  { name: "Woodlands", latitude: 1.4382, longitude: 103.789 },
  { name: "Yishun", latitude: 1.4304, longitude: 103.8354 },
];

/** How many agency cards appear before an in-grid featured ad slot. */
export const AGENCY_AD_INTERVAL = 8;

/** Banner counts for the two rails and the top stack. */
export const AGENCY_TOP_BANNERS = 3;
export const AGENCY_LEFT_RAIL_BANNERS = 5;
export const AGENCY_RIGHT_RAIL_BANNERS = 4;

export type AgencyMaidCount = { nationality: string; count: number };

export type DirectoryAgency = {
  id: string;
  name: string;
  slug: string;
  licenseNumber: string | null;
  logoUrl: string | null;
  address: string;
  city: string;
  province: string;
  postalCode: string | null;
  contactPerson: string | null;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  /** True when the agency holds an active paid plan (mirrors the homepage). */
  paid: boolean;
  /** True when a paid featured placement is running right now. */
  featured: boolean;
  bannerUrl: string | null;
  bannerLeftUrl: string | null;
  bannerRightUrl: string | null;
  nationalitiesServed: string[];
  /** Placement / service types the agency lists (e.g. "Full-time placement"). */
  services: string[];
  /** Languages the agency lists (e.g. "Mandarin"). */
  languages: string[];
  /** Approved + published maids only, sorted most to least. */
  maidCounts: AgencyMaidCount[];
  /** Lower-cased text used by the instant search box. */
  searchText: string;
};

export type DirectoryAd = {
  id: string;
  name: string;
  slug: string;
  bannerUrl: string;
};

export type AgencyDirectoryData = {
  agencies: DirectoryAgency[];
  total: number;
  topBanners: DirectoryAd[];
  leftBanners: DirectoryAd[];
  rightBanners: DirectoryAd[];
  /** Extra paid banners used by the in-grid ad slots and the mobile row. */
  featuredPool: DirectoryAd[];
};

/** Great-circle distance in kilometres. */
export function haversineKm(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
): number {
  const radius = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(endLat - startLat);
  const dLng = toRadians(endLng - startLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(startLat)) *
      Math.cos(toRadians(endLat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Parses an `<option value>` such as `1.3691,103.8454`. */
export function parseAreaValue(
  value: string,
): { latitude: number; longitude: number } | null {
  const [lat, lng] = value.split(",").map((part) => Number(part));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { latitude: lat, longitude: lng };
}

/** Singapore addresses end with a six-digit postal code. */
export function extractPostalCode(address: string): string | null {
  const match = address.match(/(?:s(?:ingapore)?\s*)?(\d{6})\s*$/i);
  return match?.[1] ?? null;
}

/** Canonical spelling for the nationalities agencies use in their profiles. */
const NATIONALITY_ALIASES: Record<string, string> = {
  filipino: "Filipino",
  filipina: "Filipino",
  philippines: "Filipino",
  indonesian: "Indonesian",
  indonesia: "Indonesian",
  myanmar: "Myanmar",
  burmese: "Myanmar",
  indian: "Indian",
};

/**
 * Legacy rows store values such as "Indian maid" or "Myanmar helper". Directory
 * counts are shown per nationality, so map those variants onto one label before
 * counting or filtering.
 */
export function normaliseNationality(value: string): string {
  const cleaned = value
    .trim()
    .replace(/\s+(maid|helper|fdw|domestic worker)s?$/i, "")
    .trim();
  if (!cleaned) return "";
  const alias = NATIONALITY_ALIASES[cleaned.toLowerCase()];
  if (alias) return alias;
  return cleaned
    .toLowerCase()
    .replace(/(^|\s)\S/g, (character) => character.toUpperCase());
}

/** Adds up counts per canonical nationality and sorts largest first. */
export function mergeMaidCounts(counts: AgencyMaidCount[]): AgencyMaidCount[] {
  const merged = new Map<string, number>();
  for (const entry of counts) {
    const nationality = normaliseNationality(entry.nationality);
    if (!nationality || entry.count <= 0) continue;
    merged.set(nationality, (merged.get(nationality) ?? 0) + entry.count);
  }
  return [...merged.entries()]
    .map(([nationality, count]) => ({ nationality, count }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.nationality.localeCompare(right.nationality),
    );
}

/** "25 Indian / 13 Indonesian / 5 Filipino / 4 Myanmar" (largest first). */
export function formatMaidCounts(counts: AgencyMaidCount[]): string {
  return mergeMaidCounts(counts)
    .map((entry) => `${entry.count} ${entry.nationality}`)
    .join(" \u00b7 ");
}

export function buildAgencySearchText(agency: {
  name: string;
  address: string;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  licenseNumber?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  nationalitiesServed?: string[];
  services?: string[];
  languages?: string[];
}): string {
  return [
    agency.name,
    agency.address,
    agency.city,
    agency.province,
    agency.postalCode,
    agency.licenseNumber,
    agency.contactPerson,
    agency.phone,
    ...(agency.nationalitiesServed ?? []),
    ...(agency.services ?? []),
    ...(agency.languages ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Case-insensitive partial match across the pre-built search text. */
export function agencyMatchesQuery(
  agency: Pick<DirectoryAgency, "searchText">,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return needle.split(/\s+/).every((word) => agency.searchText.includes(word));
}

/** Nationality filter: only agencies that actually have maids of that origin. */
export function agencyHasNationality(
  agency: Pick<DirectoryAgency, "maidCounts">,
  nationality: string,
): boolean {
  if (!nationality) return true;
  return agency.maidCounts.some(
    (entry) =>
      entry.count > 0 &&
      entry.nationality.toLowerCase() === nationality.toLowerCase(),
  );
}

/** Placement-type filter, matched against the services the agency lists. */
export function agencyOffersService(
  agency: Pick<DirectoryAgency, "services">,
  service: string,
): boolean {
  if (!service) return true;
  const needle = service.trim().toLowerCase();
  return agency.services.some((entry) => entry.toLowerCase() === needle);
}

/** Language filter, matched against the languages the agency lists. */
export function agencySpeaksLanguage(
  agency: Pick<DirectoryAgency, "languages">,
  language: string,
): boolean {
  if (!language) return true;
  const needle = language.trim().toLowerCase();
  return agency.languages.some((entry) => entry.toLowerCase() === needle);
}

/** Directory default order: 0-9 first, then A-Z, ignoring punctuation. */
export function sortAgenciesByName(
  agencies: DirectoryAgency[],
): DirectoryAgency[] {
  const key = (name: string) =>
    name
      .trim()
      .replace(/^[^0-9a-z]+/i, "")
      .toLowerCase();
  return [...agencies].sort((left, right) =>
    key(left.name).localeCompare(key(right.name), "en", {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

/** Distance from an area, or null when the agency has no coordinates. */
export function distanceFromArea(
  agency: Pick<DirectoryAgency, "latitude" | "longitude">,
  area: { latitude: number; longitude: number } | null,
): number | null {
  if (!area || agency.latitude === null || agency.longitude === null)
    return null;
  return haversineKm(
    area.latitude,
    area.longitude,
    agency.latitude,
    agency.longitude,
  );
}

/**
 * Sort by distance from the selected area. Agencies without coordinates keep
 * alphabetical order at the end so the list never jumps around unpredictably.
 */
export function sortAgenciesByDistance(
  agencies: DirectoryAgency[],
  area: { latitude: number; longitude: number } | null,
): DirectoryAgency[] {
  if (!area) return sortAgenciesByName(agencies);
  const withDistance = agencies.map((agency) => ({
    agency,
    distance: distanceFromArea(agency, area),
  }));
  withDistance.sort((left, right) => {
    if (left.distance === null && right.distance === null)
      return left.agency.name.localeCompare(right.agency.name, "en", {
        numeric: true,
        sensitivity: "base",
      });
    if (left.distance === null) return 1;
    if (right.distance === null) return -1;
    return left.distance - right.distance;
  });
  return withDistance.map((entry) => entry.agency);
}

/** Search, nationality, placement-type and language filters, before ordering. */
export function filterAgencies(
  agencies: DirectoryAgency[],
  filters: {
    query?: string;
    nationality?: string;
    service?: string;
    language?: string;
  },
): DirectoryAgency[] {
  return agencies.filter(
    (agency) =>
      agencyMatchesQuery(agency, filters.query ?? "") &&
      agencyHasNationality(agency, filters.nationality ?? "") &&
      agencyOffersService(agency, filters.service ?? "") &&
      agencySpeaksLanguage(agency, filters.language ?? ""),
  );
}

/** "1.2 km" / "980 m" label used on the cards. */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km)) return "";
  if (km < 1) return `${Math.max(50, Math.round(km * 1000))} m`;
  return `${km.toFixed(1)} km`;
}
