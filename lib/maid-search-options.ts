/**
 * Pure, client-safe option lists for the maid search UI.
 *
 * Kept separate from `lib/maid-search.ts` (which imports Prisma) so the search
 * form and results shell can render in the browser without pulling server-only
 * modules into the client bundle.
 */

/** Helper types the existing data can be filtered by. */
export const HELPER_TYPE_OPTIONS = [
  { value: "new", label: "New Maid" },
  { value: "transfer", label: "Transfer Maid" },
  { value: "ex-singapore", label: "Ex-Singapore" },
  { value: "ex-hong-kong", label: "Ex-Hong Kong" },
  { value: "ex-taiwan", label: "Ex-Taiwan" },
  { value: "ex-middle-east", label: "Ex-Middle East" },
  { value: "ex-malaysia", label: "Ex-Malaysia" },
  { value: "home-country", label: "Home-Country Experience" },
  { value: "aps", label: "APS Maid" },
] as const;

export type HelperTypeValue = (typeof HELPER_TYPE_OPTIONS)[number]["value"];

export const CREATED_WITHIN_OPTIONS = [
  { value: "", label: "No preference" },
  { value: "3", label: "Last 3 days" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
] as const;

export const SALARY_OPTIONS = [
  { value: "under-550", label: "Under $550" },
  { value: "550-650", label: "$550 - $649" },
  { value: "650-750", label: "$650 - $749" },
  { value: "750-plus", label: "$750+" },
] as const;

export const FILTER_GROUPS = [
  {
    key: "nationality",
    title: "Nationality",
    options: [
      "Filipino",
      "Indonesian",
      "Myanmar",
      "Indian",
      "Sri Lankan",
      "Bangladeshi",
      "Cambodian",
      "Nepali",
      "Others",
    ],
  },
  {
    key: "language",
    title: "Language",
    options: [
      "English",
      "Mandarin/Chinese-Dialect",
      "Bahasa Indonesia/Malaysia",
      "Hindi",
      "Tamil",
    ],
  },
  {
    key: "age",
    title: "Age",
    options: ["21 to 25", "26 to 30", "31 to 35", "36 to 40", "41 and Above"],
  },
  {
    key: "duty",
    title: "Experience",
    options: [
      "Infants / Children",
      "Elderly",
      "Disabled",
      "Housework",
      "Cooking",
    ],
  },
  {
    key: "experience",
    title: "Worked In",
    options: [
      "Singapore",
      "Malaysia",
      "Hong Kong",
      "Taiwan",
      "Middle East",
      "Saudi Arabia",
      "Home Country",
      "Other Countries",
    ],
  },
  {
    key: "education",
    title: "Education",
    options: [
      "College/Degree (>=12 yrs)",
      "High School (10~12 yrs)",
      "Secondary (7~9 yrs)",
      "Primary Level (5~6 yrs)",
    ],
  },
  {
    key: "marital",
    title: "Marital status",
    options: ["Single", "Married", "Widowed", "Divorced", "Separated"],
  },
  {
    key: "height",
    title: "Height (cm)",
    options: ["150 and Below", "151 to 155", "156 to 160", "161 and Above"],
  },
  {
    key: "religion",
    title: "Religion",
    options: [
      "Free Thinker",
      "Christian",
      "Catholic",
      "Buddhist",
      "Muslim",
      "Hindu",
      "Sikh",
      "Others",
    ],
  },
] as const;

export type FilterGroupKey = (typeof FILTER_GROUPS)[number]["key"];

export const NO_PREFERENCE_LABEL = "No Preference";

export const SPECIAL_CARE_OPTIONS = [
  "Special needs",
  "Stroke",
  "Wheelchair",
  "Bedridden",
  "Dementia / Alzheimer's",
  "Diabetes",
  "Nursing skills",
  "Cancer",
  "Nursing / caregiver background",
  "Autism",
  "Tube feeding",
  "Kidney / dialysis",
  "Paralysis",
  "Heart disease",
  "Parkinson's",
] as const;

/** Special-care options shown before the Show more control. */
export const SPECIAL_CARE_VISIBLE_COUNT = 8;

export const AGENCY_TAG_OPTIONS = [
  "Caregiver",
  "Cooking",
  "Ex Taiwan",
  "Mandarin",
  "Muslim",
  "Child care",
  "Care for pets",
  "Ex Middle East",
  "Tamil",
  "Taken",
  "Infant care",
  "General household",
  "Finished contract",
  "Punjabi",
  "Elderly care",
  "Ex Hong Kong",
  "Transfer",
  "Mizoram",
  "Disabled care",
  "Ex Malaysia",
  "Hokkien",
  "Buddhist",
  "Nurse aide",
  "Ex Singapore",
  "Cantonese",
  "Christian",
] as const;

export const MAID_SORT_OPTIONS = [
  { value: "newest", label: "Newest profiles" },
  { value: "reference", label: "Reference A–Z" },
  { value: "agency", label: "Agency A–Z" },
] as const;

export type MaidSortKey = (typeof MAID_SORT_OPTIONS)[number]["value"];

export const MAID_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  ON_HOLD: "On hold",
  PLACED: "Placed",
};

export type MaidSearchFilters = {
  q: string;
  agencyId: string;
  createdWithin: string;
  worksOffDays: boolean;
  hasChildren: boolean;
  hasVideo: boolean;
  /** Multi-select helper types (legacy `type` param accepts one value). */
  helperTypes: string[];
  /** Result ordering; `newest` is the default. */
  sort: MaidSortKey;
  salary: string[];
  groups: Record<FilterGroupKey, string[]>;
  specialCare: string[];
  tags: string[];
};
