import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { publishedMaidWhere } from "@/lib/maids";
import { sampleAgencyVisibilityWhere } from "@/lib/sample-data";
import { toHomeMaid, type HomeMaid, type HomeMaidRecord } from "@/lib/home";

/**
 * Advanced maid search: query-string parsing and the Prisma where-clause
 * builder.
 *
 * Everything here uses the existing `maids` / `agencies` tables. Structured
 * columns cover name, reference, agency, created date, off-days preference,
 * children, video, helper type, salary, nationality, overseas experience
 * (employmentHistory JSON), duties/work areas, education, languages, age,
 * marital status, height and religion. "Special care" and "Agency tags" have no
 * dedicated columns, so they are matched against the profile data that does
 * exist (duties, notes, introduction, language, religion, placement type,
 * employment history and preferences) and never require a schema change.
 */

export const MAID_RESULTS_PER_PAGE = 24;

import type { MaidSearchFilters } from "@/lib/maid-search-options";

// Option lists and URL helpers live in client-safe modules so the search form
// and results shell can import them without pulling Prisma into the browser
// bundle. Re-exported here so existing imports keep working.
export * from "@/lib/maid-search-options";
export * from "@/lib/maid-search-params";

const NATIONALITY_TOKENS: Record<string, string[]> = {
  Filipino: ["Filipino"],
  Indonesian: ["Indonesian"],
  Myanmar: ["Myanmar", "Myanmese"],
  Indian: ["Indian"],
  "Sri Lankan": ["Sri Lankan", "Sri Lanka"],
  Cambodian: ["Cambodian", "Cambodia"],
  Bangladeshi: ["Bangladeshi", "Bangladesh"],
  Nepali: ["Nepali", "Nepal"],
};

const KNOWN_NATIONALITY_TOKENS = [
  ...new Set(Object.values(NATIONALITY_TOKENS).flat()),
];

const COUNTRY_TOKENS: Record<string, string[]> = {
  Singapore: ["Singapore"],
  Malaysia: ["Malaysia"],
  "Hong Kong": ["Hong Kong"],
  Taiwan: ["Taiwan"],
  "Saudi Arabia": ["Saudi Arabia", "Saudi"],
  "Middle East": [
    "Saudi Arabia",
    "Saudi",
    "United Arab Emirates",
    "UAE",
    "Dubai",
    "Abu Dhabi",
    "Oman",
    "Kuwait",
    "Qatar",
    "Bahrain",
    "Jordan",
    "Lebanon",
    "Israel",
    "Yemen",
  ],
  "Other Countries": [
    "Brunei",
    "Thailand",
    "Japan",
    "South Korea",
    "Korea",
    "Cyprus",
    "Mauritius",
    "India",
    "Philippines",
    "Indonesia",
    "Myanmar",
  ],
};

const LANGUAGE_TOKENS: Record<string, string[]> = {
  English: ["English"],
  "Mandarin/Chinese-Dialect": ["Mandarin/Chinese-Dialect", "Mandarin"],
  "Bahasa Indonesia/Malaysia": [
    "Bahasa Indonesia/Malaysia",
    "Bahasa Indonesia",
  ],
  Hindi: ["Hindi"],
  Tamil: ["Tamil"],
};

const EDUCATION_PREFIXES: Record<string, string> = {
  "College/Degree (>=12 yrs)": "College",
  "High School (10~12 yrs)": "High School",
  "Secondary (7~9 yrs)": "Secondary",
  "Primary Level (5~6 yrs)": "Primary",
};

const DUTY_MAP: Record<string, { duties: string[]; workArea: string }> = {
  "Infants / Children": {
    duties: ["Care of infants/children", "Newborn care", "Childcare support"],
    workArea: "Care of infants/children",
  },
  Elderly: {
    duties: ["Care of elderly", "Elderly care", "Elder care support"],
    workArea: "Care of elderly",
  },
  Disabled: {
    duties: ["Care of disabled", "Disabled care"],
    workArea: "Care of disabled",
  },
  Cooking: {
    duties: ["Cooking", "Meal preparation"],
    workArea: "Cooking",
  },
  Housework: {
    duties: ["General housework", "Housekeeping"],
    workArea: "General housework",
  },
};

const SALARY_RANGES: Record<
  string,
  { gte?: number; lte?: number; lt?: number }
> = {
  "under-550": { lt: 550 },
  "550-650": { gte: 550, lte: 649 },
  "650-750": { gte: 650, lte: 749 },
  "750-plus": { gte: 750 },
};

const AGE_RANGES: Record<string, [number, number]> = {
  "21 to 25": [21, 25],
  "26 to 30": [26, 30],
  "31 to 35": [31, 35],
  "36 to 40": [36, 40],
  "41 and Above": [41, 80],
};

const HEIGHT_RANGES: Record<string, { gte?: number; lte?: number }> = {
  "150 and Below": { lte: 150 },
  "151 to 155": { gte: 151, lte: 155 },
  "156 to 160": { gte: 156, lte: 160 },
  "161 and Above": { gte: 161 },
};

const SPECIAL_CARE_KEYWORDS: Record<string, string[]> = {
  "Special needs": ["special need", "special care"],
  Bedridden: ["bedridden"],
  "Nursing skills": ["nursing"],
  Autism: ["autism"],
  Paralysis: ["paralys", "paralyz"],
  Stroke: ["stroke"],
  "Dementia / Alzheimer's": ["dementia", "alzheimer"],
  Cancer: ["cancer"],
  "Tube feeding": ["tube feed", "ng tube"],
  "Heart disease": ["heart disease", "heart condition"],
  Wheelchair: ["wheelchair"],
  Diabetes: ["diabetes", "diabetic"],
  "Nursing / caregiver background": ["nurse", "caregiver"],
  "Kidney / dialysis": ["kidney", "dialysis"],
  "Parkinson's": ["parkinson"],
};

function textCondition(keyword: string): Prisma.MaidWhereInput {
  return {
    OR: [
      { notes: { contains: keyword, mode: "insensitive" } },
      { introduction: { contains: keyword, mode: "insensitive" } },
    ],
  };
}

function dutyCondition(duties: string[]): Prisma.MaidWhereInput {
  return { duties: { hasSome: duties } };
}

function languageCondition(languages: string[]): Prisma.MaidWhereInput {
  return { languages: { hasSome: languages } };
}

function countryCondition(countries: string[]): Prisma.MaidWhereInput {
  return {
    employmentHistory: {
      array_contains: countries.map((country) => ({ country })),
    },
  };
}

function religionCondition(religion: string): Prisma.MaidWhereInput {
  return { religion: { equals: religion, mode: "insensitive" } };
}

const OFF_DAYS_KEYS = [
  "Willing to work on off-days with compensation?",
  "Willing to work on off-days with  compensation?",
  "Can work on off-days with compensation?",
];

function offDaysCondition(): Prisma.MaidWhereInput {
  return {
    OR: OFF_DAYS_KEYS.map((key) => ({
      preferences: {
        path: ["otherInformation", key],
        equals: true,
      },
    })),
  };
}

const elderlyDuties = [
  "Care of elderly",
  "Elderly care",
  "Elder care support",
  "Care of disabled",
];

/**
 * "Agency tags" reuse existing profile fields: duties, languages, religion,
 * placement type, employment history and preferences. There is no dedicated
 * tag column, so each label maps onto the closest stored attribute.
 */
const TAG_CONDITIONS: Record<string, Prisma.MaidWhereInput> = {
  Caregiver: {
    OR: [
      dutyCondition(elderlyDuties),
      textCondition("caregiver"),
      textCondition("nurse"),
    ],
  },
  Cooking: dutyCondition(["Cooking", "Meal preparation"]),
  "Ex Taiwan": {
    OR: [
      countryCondition(["Taiwan"]),
      { placementType: { contains: "Taiwan", mode: "insensitive" } },
    ],
  },
  Mandarin: languageCondition(["Mandarin/Chinese-Dialect", "Mandarin"]),
  Muslim: religionCondition("Muslim"),
  "Child care": dutyCondition([
    "Care of infants/children",
    "Childcare support",
    "Newborn care",
  ]),
  "Care for pets": {
    preferences: {
      path: ["otherInformation", "Able to care for dog/cat?"],
      equals: true,
    },
  },
  "Ex Middle East": {
    OR: [
      countryCondition(COUNTRY_TOKENS["Middle East"]),
      { placementType: { contains: "Middle East", mode: "insensitive" } },
    ],
  },
  Tamil: languageCondition(["Tamil"]),
  Taken: { status: "PLACED" },
  "Infant care": dutyCondition(["Care of infants/children", "Newborn care"]),
  "General household": dutyCondition(["General housework", "Housekeeping"]),
  "Finished contract": {
    OR: [
      { availability: { contains: "finish", mode: "insensitive" } },
      { contractEnds: { not: null } },
    ],
  },
  Punjabi: languageCondition(["Punjabi"]),
  "Elderly care": dutyCondition([
    "Care of elderly",
    "Elderly care",
    "Elder care support",
  ]),
  "Ex Hong Kong": {
    OR: [
      countryCondition(["Hong Kong"]),
      { placementType: { contains: "Hong Kong", mode: "insensitive" } },
    ],
  },
  Transfer: { placementType: { contains: "Transfer", mode: "insensitive" } },
  Mizoram: {
    OR: [
      {
        preferences: {
          path: ["indianMaidCategory"],
          string_contains: "Mizoram",
        },
      },
      { placeOfBirth: { contains: "Mizoram", mode: "insensitive" } },
    ],
  },
  "Disabled care": dutyCondition(["Care of disabled"]),
  "Ex Malaysia": {
    OR: [
      countryCondition(["Malaysia"]),
      { placementType: { contains: "Malaysia", mode: "insensitive" } },
    ],
  },
  Hokkien: languageCondition(["Hokkien"]),
  Buddhist: religionCondition("Buddhist"),
  "Nurse aide": {
    OR: [textCondition("nurse"), textCondition("nursing")],
  },
  "Ex Singapore": {
    OR: [
      countryCondition(["Singapore"]),
      { placementType: { contains: "Ex-Singapore", mode: "insensitive" } },
      { placementType: { contains: "Ex Singapore", mode: "insensitive" } },
      { preferences: { path: ["sgExperience"], equals: true } },
    ],
  },
  Cantonese: languageCondition(["Cantonese"]),
  Christian: religionCondition("Christian"),
};

const KNOWN_RELIGIONS = [
  "Free Thinker",
  "Christian",
  "Catholic",
  "Buddhist",
  "Muslim",
  "Hindu",
  "Sikh",
];

function nationalityCondition(value: string): Prisma.MaidWhereInput | null {
  if (value === "Others") {
    return {
      NOT: KNOWN_NATIONALITY_TOKENS.map((token) => ({
        nationality: { contains: token, mode: "insensitive" },
      })),
    };
  }
  const tokens = NATIONALITY_TOKENS[value];
  if (!tokens) return null;
  return {
    OR: tokens.map((token) => ({
      nationality: { contains: token, mode: "insensitive" },
    })),
  };
}

function religionGroupCondition(value: string): Prisma.MaidWhereInput | null {
  if (value === "Others") {
    return {
      NOT: KNOWN_RELIGIONS.map((religion) => religionCondition(religion)),
    };
  }
  return religionCondition(value);
}

function experienceCondition(value: string): Prisma.MaidWhereInput | null {
  if (value === "Home Country") {
    return {
      OR: [
        { employmentHistory: { equals: [] } },
        { employmentHistory: { equals: Prisma.DbNull } },
      ],
    };
  }
  const tokens = COUNTRY_TOKENS[value];
  return tokens ? countryCondition(tokens) : null;
}

function helperTypeCondition(value: string): Prisma.MaidWhereInput | null {
  switch (value) {
    case "new":
      return {
        OR: [
          { placementType: { equals: "New maid", mode: "insensitive" } },
          {
            placementType: {
              contains: "New to Singapore",
              mode: "insensitive",
            },
          },
        ],
      };
    case "transfer":
      return { placementType: { contains: "transfer", mode: "insensitive" } };
    case "ex-singapore":
      return {
        OR: [
          {
            placementType: {
              contains: "ex-singapore",
              mode: "insensitive",
            },
          },
          TAG_CONDITIONS["Ex Singapore"],
        ],
      };
    case "ex-hong-kong":
      return TAG_CONDITIONS["Ex Hong Kong"];
    case "ex-taiwan":
      return TAG_CONDITIONS["Ex Taiwan"];
    case "ex-middle-east":
      return TAG_CONDITIONS["Ex Middle East"];
    case "ex-malaysia":
      return TAG_CONDITIONS["Ex Malaysia"];
    case "home-country":
      return experienceCondition("Home Country");
    case "aps":
      return { placementType: { contains: "APS", mode: "insensitive" } };
    default:
      return null;
  }
}

function salaryRangeCondition(range: {
  gte?: number;
  lte?: number;
  lt?: number;
}): Prisma.MaidWhereInput {
  return {
    OR: [
      { expectedSalary: range },
      { AND: [{ expectedSalary: null }, { monthlySalary: range }] },
    ],
  };
}

function ageCondition(
  [min, max]: [number, number],
  now: Date,
): Prisma.MaidWhereInput {
  const dobFrom = new Date(
    Date.UTC(
      now.getUTCFullYear() - max - 1,
      now.getUTCMonth(),
      now.getUTCDate() + 1,
    ),
  );
  const dobTo = new Date(
    Date.UTC(now.getUTCFullYear() - min, now.getUTCMonth(), now.getUTCDate()),
  );
  return {
    OR: [
      { age: { gte: min, lte: max } },
      { AND: [{ age: null }, { dateOfBirth: { gte: dobFrom, lte: dobTo } }] },
    ],
  };
}

export function buildMaidSearchWhere(
  filters: MaidSearchFilters,
  now: Date = new Date(),
): Prisma.MaidWhereInput {
  const and: Prisma.MaidWhereInput[] = [publishedMaidWhere()];
  const visibility = sampleAgencyVisibilityWhere();
  and.push({
    agency: {
      status: "APPROVED",
      ...(visibility ? { AND: [visibility] } : {}),
    },
  });

  if (filters.q)
    and.push({
      OR: [
        { fullName: { contains: filters.q, mode: "insensitive" } },
        { reference: { contains: filters.q, mode: "insensitive" } },
      ],
    });
  if (filters.agencyId) and.push({ agencyId: filters.agencyId });

  const days = Number(filters.createdWithin);
  if ([3, 7, 30].includes(days))
    and.push({
      createdAt: { gte: new Date(now.getTime() - days * 86_400_000) },
    });

  if (filters.worksOffDays) and.push(offDaysCondition());
  if (filters.hasChildren) and.push({ childrenCount: { gt: 0 } });
  if (filters.hasVideo) and.push({ videoUrl: { not: null } });

  const pushGroup = (conditions: Prisma.MaidWhereInput[]) => {
    if (conditions.length) and.push({ OR: conditions });
  };

  const helperConditions: Prisma.MaidWhereInput[] = [];
  for (const value of filters.helperTypes) {
    const condition = helperTypeCondition(value);
    if (condition) helperConditions.push(condition);
  }
  pushGroup(helperConditions);

  const salaryConditions = filters.salary
    .map((value) => SALARY_RANGES[value])
    .filter(Boolean)
    .map(salaryRangeCondition);
  if (salaryConditions.length) and.push({ OR: salaryConditions });

  const nationalityConditions: Prisma.MaidWhereInput[] = [];
  for (const value of filters.groups.nationality) {
    const condition = nationalityCondition(value);
    if (condition) nationalityConditions.push(condition);
  }
  pushGroup(nationalityConditions);

  const experienceConditions: Prisma.MaidWhereInput[] = [];
  for (const value of filters.groups.experience) {
    const condition = experienceCondition(value);
    if (condition) experienceConditions.push(condition);
  }
  pushGroup(experienceConditions);

  const dutyConditions: Prisma.MaidWhereInput[] = [];
  for (const value of filters.groups.duty) {
    const mapping = DUTY_MAP[value];
    if (!mapping) continue;
    dutyConditions.push({
      OR: [
        dutyCondition(mapping.duties),
        {
          workAreas: {
            path: [mapping.workArea, "experience"],
            equals: true,
          },
        },
      ],
    });
  }
  pushGroup(dutyConditions);

  const educationConditions: Prisma.MaidWhereInput[] = [];
  for (const value of filters.groups.education) {
    const prefix = EDUCATION_PREFIXES[value];
    if (!prefix) continue;
    educationConditions.push({
      educationLevel: { startsWith: prefix, mode: "insensitive" },
    });
  }
  pushGroup(educationConditions);

  const languageConditions: Prisma.MaidWhereInput[] = [];
  for (const value of filters.groups.language) {
    const tokens = LANGUAGE_TOKENS[value];
    if (tokens) languageConditions.push(languageCondition(tokens));
  }
  pushGroup(languageConditions);

  const ageConditions: Prisma.MaidWhereInput[] = [];
  for (const value of filters.groups.age) {
    const range = AGE_RANGES[value];
    if (range) ageConditions.push(ageCondition(range, now));
  }
  pushGroup(ageConditions);

  const maritalConditions: Prisma.MaidWhereInput[] = [];
  for (const value of filters.groups.marital) {
    maritalConditions.push({
      maritalStatus: { equals: value, mode: "insensitive" },
    });
  }
  pushGroup(maritalConditions);

  const heightConditions: Prisma.MaidWhereInput[] = [];
  for (const value of filters.groups.height) {
    const range = HEIGHT_RANGES[value];
    if (range) heightConditions.push({ heightCm: range });
  }
  pushGroup(heightConditions);

  const religionConditions: Prisma.MaidWhereInput[] = [];
  for (const value of filters.groups.religion) {
    const condition = religionGroupCondition(value);
    if (condition) religionConditions.push(condition);
  }
  pushGroup(religionConditions);

  const careConditions: Prisma.MaidWhereInput[] = [];
  for (const value of filters.specialCare) {
    for (const keyword of SPECIAL_CARE_KEYWORDS[value] ?? [])
      careConditions.push(textCondition(keyword));
  }
  pushGroup(careConditions);

  const tagConditions: Prisma.MaidWhereInput[] = [];
  for (const value of filters.tags) {
    const condition = TAG_CONDITIONS[value];
    if (condition) tagConditions.push(condition);
  }
  pushGroup(tagConditions);

  return { AND: and };
}

/** Extra profile facts shown on the redesigned search result cards. */
export type MaidSearchMaid = HomeMaid & {
  experienceYears: number | null;
  duties: string[];
  languages: string[];
  /** Expected salary, falling back to the listed monthly salary. */
  salary: number | null;
  status: string;
};

export type MaidSearchResult = {
  maids: MaidSearchMaid[];
  total: number;
  page: number;
  pages: number;
};

function orderByForSort(
  sort: MaidSearchFilters["sort"],
): Prisma.MaidOrderByWithRelationInput[] {
  switch (sort) {
    case "reference":
      return [{ reference: "asc" }];
    case "agency":
      return [{ agency: { name: "asc" } }];
    default:
      return [{ createdAt: "desc" }];
  }
}

function buildMaidSelect(now: Date) {
  return {
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
    experienceYears: true,
    duties: true,
    languages: true,
    expectedSalary: true,
    monthlySalary: true,
    status: true,
    agency: {
      select: {
        name: true,
        slug: true,
        adPlacements: {
          where: {
            status: "ACTIVE",
            startDate: { lte: now },
            endDate: { gte: now },
          },
          select: { id: true },
          take: 1,
        },
      },
    },
  } satisfies Prisma.MaidSelect;
}

type MaidRow = Prisma.MaidGetPayload<{
  select: ReturnType<typeof buildMaidSelect>;
}>;

function toSearchMaid(maid: MaidRow, now: Date): MaidSearchMaid {
  const base = toHomeMaid(maid as unknown as HomeMaidRecord, now);
  return {
    ...base,
    experienceYears: maid.experienceYears ?? null,
    duties: maid.duties ?? [],
    languages: maid.languages ?? [],
    salary: maid.expectedSalary ?? maid.monthlySalary ?? null,
    status: maid.status,
  };
}

export async function searchMaids(
  filters: MaidSearchFilters,
  options?: { page?: number },
): Promise<MaidSearchResult> {
  const now = new Date();
  const page = Math.max(1, Math.floor(options?.page ?? 1));
  const where = buildMaidSearchWhere(filters, now);
  const skip = (page - 1) * MAID_RESULTS_PER_PAGE;
  const take = MAID_RESULTS_PER_PAGE;

  const [total, rows] = await Promise.all([
    prisma.maid.count({ where }),
    prisma.maid.findMany({
      where,
      select: buildMaidSelect(now),
      orderBy: orderByForSort(filters.sort),
      skip,
      take,
    }),
  ]);

  return {
    maids: rows.map((maid) => toSearchMaid(maid, now)),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / MAID_RESULTS_PER_PAGE)),
  };
}

/** Approved agencies that currently publish maids, for "Agency preference". */
export async function getMaidSearchAgencies(): Promise<
  { id: string; name: string }[]
> {
  const visibility = sampleAgencyVisibilityWhere();
  return prisma.agency.findMany({
    where: {
      status: "APPROVED",
      maids: { some: publishedMaidWhere() },
      ...(visibility ? { AND: [visibility] } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 200,
  });
}
