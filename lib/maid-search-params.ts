import {
  AGENCY_TAG_OPTIONS,
  FILTER_GROUPS,
  HELPER_TYPE_OPTIONS,
  MAID_SORT_OPTIONS,
  SALARY_OPTIONS,
  SPECIAL_CARE_OPTIONS,
  type FilterGroupKey,
  type MaidSearchFilters,
  type MaidSortKey,
} from "@/lib/maid-search-options";

/**
 * Client-safe parsing and link helpers for the maid search.
 *
 * The Prisma query lives in `lib/maid-search.ts`; this module only deals with
 * the URL contract so the filter form can build links without importing the
 * database client. `lib/maid-search.ts` re-exports everything here for the
 * existing imports.
 */

const GROUP_KEYS = FILTER_GROUPS.map((group) => group.key);
const HELPER_VALUES = new Set<string>(
  HELPER_TYPE_OPTIONS.map((option) => option.value),
);
const SORT_VALUES = new Set<string>(
  MAID_SORT_OPTIONS.map((option) => option.value),
);

/** Old bookmarked values still resolve to their current filter. */
const LEGACY_GROUP_VALUES: Partial<
  Record<FilterGroupKey, Record<string, string>>
> = {
  nationality: { Myanmese: "Myanmar" },
  duty: {
    "Care for Infant": "Infants / Children",
    "Care for Young Children": "Infants / Children",
    "Care for Elderly/Disabled": "Elderly",
    "General Housekeeping": "Housework",
  },
};

const LEGACY_HELPER_TYPES: Record<string, string> = {
  none: "",
  "ex-singapore-maid": "ex-singapore",
};

export function emptyMaidSearchFilters(): MaidSearchFilters {
  return {
    q: "",
    agencyId: "",
    createdWithin: "",
    worksOffDays: false,
    hasChildren: false,
    hasVideo: false,
    helperTypes: [],
    sort: "newest",
    salary: [],
    groups: Object.fromEntries(GROUP_KEYS.map((key) => [key, []])) as Record<
      FilterGroupKey,
      string[]
    >,
    specialCare: [],
    tags: [],
  };
}

function readValues(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string[] {
  const raw = params[key];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

export function parseMaidSearchParams(
  params: Record<string, string | string[] | undefined>,
): MaidSearchFilters {
  const filters = emptyMaidSearchFilters();

  for (const group of FILTER_GROUPS) {
    const allowed = new Set<string>(group.options);
    const legacy = LEGACY_GROUP_VALUES[group.key] ?? {};
    filters.groups[group.key] = [
      ...new Set(
        readValues(params, group.key)
          .map((value) => legacy[value] ?? value)
          .filter((value) => allowed.has(value)),
      ),
    ];
  }

  const specialCare = new Set<string>(SPECIAL_CARE_OPTIONS);
  const tags = new Set<string>(AGENCY_TAG_OPTIONS);
  const single = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };

  filters.q = single("q").trim().slice(0, 80);
  filters.agencyId = single("agency").trim();
  filters.createdWithin = single("within").trim();
  filters.worksOffDays = single("offdays") === "1";
  filters.hasChildren = single("children") === "1";
  filters.hasVideo = single("video") === "1";
  filters.helperTypes = [
    ...new Set(
      readValues(params, "type")
        .map((value) => LEGACY_HELPER_TYPES[value] ?? value)
        .filter((value) => HELPER_VALUES.has(value)),
    ),
  ];
  const sort = single("sort").trim();
  filters.sort = (SORT_VALUES.has(sort) ? sort : "newest") as MaidSortKey;
  filters.salary = readValues(params, "salary");
  filters.specialCare = readValues(params, "specialCare").filter((value) =>
    specialCare.has(value),
  );
  filters.tags = readValues(params, "tags").filter((value) => tags.has(value));

  return filters;
}

/** Canonical query string for links (results page, paging, chips, sorting). */
export function maidSearchQueryString(filters: MaidSearchFilters): string {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.agencyId) query.set("agency", filters.agencyId);
  if (filters.createdWithin) query.set("within", filters.createdWithin);
  if (filters.worksOffDays) query.set("offdays", "1");
  if (filters.hasChildren) query.set("children", "1");
  if (filters.hasVideo) query.set("video", "1");
  filters.helperTypes.forEach((value) => query.append("type", value));
  if (filters.sort && filters.sort !== "newest")
    query.set("sort", filters.sort);
  filters.salary.forEach((value) => query.append("salary", value));
  for (const group of FILTER_GROUPS)
    filters.groups[group.key].forEach((value) =>
      query.append(group.key, value),
    );
  filters.specialCare.forEach((value) => query.append("specialCare", value));
  filters.tags.forEach((value) => query.append("tags", value));
  return query.toString();
}

/** Link to the results list, preserving filters and page. */
export function maidSearchHref(filters: MaidSearchFilters, page = 1): string {
  const query = maidSearchQueryString(filters);
  if (page > 1) {
    const params = new URLSearchParams(query);
    params.set("page", String(page));
    return `/maids/search?${params.toString()}`;
  }
  return query ? `/maids/search?${query}` : "/maids/search";
}

export type MaidFilterChip = {
  key: string;
  label: string;
  /** Link to the same search with just this filter removed. */
  href: string;
};

function cloneFilters(filters: MaidSearchFilters): MaidSearchFilters {
  return {
    ...filters,
    helperTypes: [...filters.helperTypes],
    salary: [...filters.salary],
    groups: Object.fromEntries(
      GROUP_KEYS.map((key) => [key, [...filters.groups[key]]]),
    ) as Record<FilterGroupKey, string[]>,
    specialCare: [...filters.specialCare],
    tags: [...filters.tags],
  };
}

function withQuery(filters: MaidSearchFilters): string {
  const query = maidSearchQueryString(filters);
  return query ? `/maids/search?${query}` : "/maids/search";
}

/**
 * Removable chips for every active filter. Clicking a chip keeps every other
 * selection, so employers can drop one criterion at a time.
 */
export function maidFilterChips(
  filters: MaidSearchFilters,
  options?: { agencyName?: string | null },
): MaidFilterChip[] {
  const chips: MaidFilterChip[] = [];
  const add = (
    key: string,
    label: string,
    mutate: (next: MaidSearchFilters) => void,
  ) => {
    const next = cloneFilters(filters);
    mutate(next);
    chips.push({ key, label, href: withQuery(next) });
  };

  if (filters.q)
    add("q", `Search: ${filters.q}`, (next) => {
      next.q = "";
    });
  if (filters.agencyId)
    add("agency", `Agency: ${options?.agencyName ?? "Selected"}`, (next) => {
      next.agencyId = "";
    });
  if (filters.createdWithin)
    add("within", `Posted: last ${filters.createdWithin} days`, (next) => {
      next.createdWithin = "";
    });
  if (filters.worksOffDays)
    add("offdays", "Works on off-days", (next) => {
      next.worksOffDays = false;
    });
  if (filters.hasChildren)
    add("children", "Has children", (next) => {
      next.hasChildren = false;
    });
  if (filters.hasVideo)
    add("video", "Has video", (next) => {
      next.hasVideo = false;
    });

  for (const value of filters.helperTypes) {
    const label =
      HELPER_TYPE_OPTIONS.find((option) => option.value === value)?.label ??
      value;
    add(`type-${value}`, `Helper type: ${label}`, (next) => {
      next.helperTypes = next.helperTypes.filter((item) => item !== value);
    });
  }

  for (const value of filters.salary) {
    const label =
      SALARY_OPTIONS.find((option) => option.value === value)?.label ?? value;
    add(`salary-${value}`, `Salary: ${label}`, (next) => {
      next.salary = next.salary.filter((item) => item !== value);
    });
  }

  for (const group of FILTER_GROUPS) {
    for (const value of filters.groups[group.key]) {
      add(`${group.key}-${value}`, `${group.title}: ${value}`, (next) => {
        next.groups[group.key] = next.groups[group.key].filter(
          (item) => item !== value,
        );
      });
    }
  }

  for (const value of filters.specialCare) {
    add(`care-${value}`, `Special care: ${value}`, (next) => {
      next.specialCare = next.specialCare.filter((item) => item !== value);
    });
  }

  for (const value of filters.tags) {
    add(`tag-${value}`, `Tag: ${value}`, (next) => {
      next.tags = next.tags.filter((item) => item !== value);
    });
  }

  return chips;
}

/** Number of active filters, shown on the mobile Filters button. */
export function maidActiveFilterCount(filters: MaidSearchFilters): number {
  return maidFilterChips(filters).length;
}
