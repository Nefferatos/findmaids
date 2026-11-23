/**
 * Vocabulary and shapes for the full maid biodata profile.
 *
 * The field set mirrors the agency CSV export (`maids_rows.csv`) so existing
 * records can be entered without losing information. Everything here is pure
 * data — safe to import from client components, route handlers and the public
 * directory pages.
 */

export const MAID_TYPES = [
  "New maid",
  "Ex-Singapore maid",
  "Ex-Taiwan maid",
  "Ex-Middle East maid",
  "Transfer maid",
  "APS maid",
] as const;

export const MAID_NATIONALITIES = [
  "Filipino maid",
  "Indonesian maid",
  "Indian maid",
  "Myanmar maid",
] as const;

export const MAID_RELIGIONS = [
  "Catholic",
  "Christian",
  "Buddhist",
  "Hindu",
  "Muslim",
  "Others",
] as const;

export const MAID_MARITAL_STATUSES = [
  "Single",
  "Married",
  "Divorced",
  "Widowed",
  "Separated",
] as const;

export const MAID_EDUCATION_LEVELS = [
  "Primary (1-6 yrs)",
  "Secondary Level (7-9 yrs)",
  "High School (10-12 yrs)",
  "College/Degree (>=13 yrs)",
] as const;

/** Columns of the CSV `language_skills` object. */
export const LANGUAGE_KEYS = [
  "Hindi",
  "Tamil",
  "English",
  "Mandarin/Chinese-Dialect",
  "Bahasa Indonesia/Malaysia",
] as const;

/** Proficiency values used by the CSV (`Zero`, `Poor`, `Little`, `Fair`, `Good`). */
export const LANGUAGE_PROFICIENCIES = [
  "Zero",
  "Little",
  "Poor",
  "Fair",
  "Good",
  "Excellent",
] as const;

/** Rows of the CSV `work_areas` object. */
export const WORK_AREA_KEYS = [
  "Cooking",
  "Care of elderly",
  "Care of disabled",
  "General housework",
  "Care of infants/children",
  "Other skills, if any",
  "Language abilities (spoken)",
] as const;

/** CSV `availabilityInterviewOptions` values. */
export const INTERVIEW_OPTIONS = [
  "FDW can be interviewed by phone",
  "FDW can be interviewed by video-conference",
  "FDW can be interviewed in person",
  "FDW is not available for interview",
] as const;

/** CSV `otherInformation` questions. */
export const OTHER_INFORMATION_KEYS = [
  "Able to eat pork?",
  "Able to handle pork?",
  "Willing to wash car?",
  "Able to care for dog/cat?",
  "Able to do simple sewing?",
  "Able to do gardening work?",
  "Willing to work on off-days with compensation?",
] as const;

/** CSV `pastIllnesses` keys (MOM medical form). */
export const PAST_ILLNESS_KEYS = [
  "(I) Mental illness",
  "(II) Epilepsy",
  "(III) Asthma",
  "(IV) Diabetes",
  "(V) Hypertension",
  "(VI) Tuberculosis",
  "(VII) Heart disease",
  "(VIII) Malaria",
  "(IX) Operations",
] as const;

export const INDIAN_MAID_CATEGORIES = [
  "Mizoram maid",
  "Darjeeling maid",
  "Manipur maid",
  "Others",
] as const;

/** Status labels shown in the agency portal (the CSV uses available/reserved). */
export const MAID_STATUS_OPTIONS = [
  { value: "AVAILABLE", label: "Available" },
  { value: "ON_HOLD", label: "On hold / reserved" },
  { value: "PLACED", label: "Placed" },
] as const;

export type MaidLanguageSkills = Record<string, string>;

export type MaidWorkArea = {
  rating: number | null;
  note: string;
  willing: boolean;
  experience: boolean;
  yearsOfExperience: string;
};

export type MaidWorkAreas = Record<string, MaidWorkArea>;

export type MaidEmployment = {
  from: string;
  to: string;
  employer: string;
  country: string;
  duties: string;
  remarks: string;
};

export type MaidPreferences = {
  sgExperience: boolean;
  offDaysPerMonth: string;
  indianMaidCategory: string;
  referredBy: string;
  interviewedBy: string;
  privateInfo: string;
  availabilityRemark: string;
  availabilityInterviewOptions: string[];
  otherInformation: Record<string, boolean>;
  workAreaNotes: Record<string, string>;
};

export type MaidMedical = {
  pastIllnesses: Record<string, boolean>;
  otherIllnesses: string;
  allergies: string;
  physicalDisabilities: string;
  otherRemarks: string;
};

export type MaidAgencyContact = {
  companyName: string;
  contactPerson: string;
  phone: string;
  licenseNo: string;
  homeCountryContactNumber: string;
};

/**
 * Shape the agency portal works with. JSON columns are stored as free-form
 * Prisma values, so every field is normalised before it reaches the form.
 */
export type AgencyMaid = {
  id: string;
  reference: string;
  fullName: string | null;
  nationality: string;
  age: number | null;
  dateOfBirth: string | Date | null;
  placeOfBirth: string | null;
  heightCm: number | null;
  weightKg: number | null;
  religion: string | null;
  maritalStatus: string | null;
  childrenCount: number | null;
  siblingsCount: number | null;
  homeAddress: string | null;
  airportRepatriation: string | null;
  educationLevel: string | null;
  languages: string[];
  placementType: string;
  experienceYears: number | null;
  duties: string[];
  monthlySalary: number | null;
  expectedSalary: number | null;
  presentSalary: number | null;
  status: "AVAILABLE" | "ON_HOLD" | "PLACED";
  availableFrom: string | null;
  availability: string | null;
  contractEnds: string | null;
  offDaysPerMonth: number | null;
  foodHandlingPreferences: string | null;
  dietaryRestrictions: string | null;
  introduction: string | null;
  notes: string | null;
  videoUrl: string | null;
  photoUrl: string | null;
  photoUrls: string[];
  photoThumbnailUrls: string[];
  photoPortraitUrls: string[];
  languageSkills: MaidLanguageSkills;
  preferences: MaidPreferences;
  workAreas: MaidWorkAreas;
  employmentHistory: MaidEmployment[];
  medicalInfo: MaidMedical;
  agencyContact: MaidAgencyContact;
  published: boolean;
};

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const bool = (value: unknown) => value === true;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function emptyLanguageSkills(): MaidLanguageSkills {
  return Object.fromEntries(LANGUAGE_KEYS.map((key) => [key, ""]));
}

export function emptyWorkAreas(): MaidWorkAreas {
  return Object.fromEntries(
    WORK_AREA_KEYS.map((key) => [
      key,
      {
        rating: null,
        note: "",
        willing: false,
        experience: false,
        yearsOfExperience: "",
      },
    ]),
  );
}

export function emptyPreferences(): MaidPreferences {
  return {
    sgExperience: false,
    offDaysPerMonth: "",
    indianMaidCategory: "",
    referredBy: "",
    interviewedBy: "",
    privateInfo: "",
    availabilityRemark: "",
    availabilityInterviewOptions: [],
    otherInformation: Object.fromEntries(
      OTHER_INFORMATION_KEYS.map((key) => [key, false]),
    ),
    workAreaNotes: {},
  };
}

export function emptyMedical(): MaidMedical {
  return {
    pastIllnesses: Object.fromEntries(
      PAST_ILLNESS_KEYS.map((key) => [key, false]),
    ),
    otherIllnesses: "",
    allergies: "",
    physicalDisabilities: "",
    otherRemarks: "",
  };
}

export function emptyAgencyContact(): MaidAgencyContact {
  return {
    companyName: "",
    contactPerson: "",
    phone: "",
    licenseNo: "",
    homeCountryContactNumber: "",
  };
}

/** Tolerant readers: a CSV import may have different keys or missing rows. */
export function readLanguageSkills(value: unknown): MaidLanguageSkills {
  const source = record(value);
  const merged = emptyLanguageSkills();
  for (const [key, proficiency] of Object.entries(source)) {
    merged[key] = text(proficiency);
  }
  return merged;
}

export function readWorkAreas(value: unknown): MaidWorkAreas {
  const source = record(value);
  const merged = emptyWorkAreas();
  for (const [key, raw] of Object.entries(source)) {
    const area = record(raw);
    const rating = Number(area.rating);
    merged[key] = {
      rating:
        Number.isFinite(rating) && rating > 0 ? Math.min(5, rating) : null,
      note: text(area.note),
      willing: bool(area.willing),
      experience: bool(area.experience),
      yearsOfExperience: text(area.yearsOfExperience),
    };
  }
  return merged;
}

export function readEmploymentHistory(value: unknown): MaidEmployment[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).map((raw) => {
    const entry = record(raw);
    return {
      from: text(entry.from),
      to: text(entry.to),
      employer: text(entry.employer),
      country: text(entry.country),
      duties: text(entry.duties),
      remarks: text(entry.remarks),
    };
  });
}

export function readPreferences(value: unknown): MaidPreferences {
  const source = record(value);
  const base = emptyPreferences();
  const other = record(source.otherInformation);
  const notes = record(source.workAreaNotes);
  const options = Array.isArray(source.availabilityInterviewOptions)
    ? source.availabilityInterviewOptions.filter(
        (item): item is string => typeof item === "string",
      )
    : base.availabilityInterviewOptions;
  return {
    sgExperience: bool(source.sgExperience),
    offDaysPerMonth: text(source.offDaysPerMonth),
    indianMaidCategory: text(source.indianMaidCategory),
    referredBy: text(source.referredBy),
    interviewedBy: text(source.interviewedBy),
    privateInfo: text(source.privateInfo),
    availabilityRemark: text(source.availabilityRemark),
    availabilityInterviewOptions: options,
    otherInformation: {
      ...base.otherInformation,
      ...Object.fromEntries(
        Object.entries(other).map(([key, flag]) => [key, bool(flag)]),
      ),
    },
    workAreaNotes: {
      ...base.workAreaNotes,
      ...Object.fromEntries(
        Object.entries(notes).map(([key, note]) => [key, text(note)]),
      ),
    },
  };
}

export function readMedical(value: unknown): MaidMedical {
  const source = record(value);
  const base = emptyMedical();
  const illnesses = record(source.pastIllnesses);
  return {
    pastIllnesses: {
      ...base.pastIllnesses,
      ...Object.fromEntries(
        Object.entries(illnesses).map(([key, flag]) => [key, bool(flag)]),
      ),
    },
    otherIllnesses: text(source.otherIllnesses),
    allergies: text(source.allergies),
    physicalDisabilities: text(source.physicalDisabilities),
    otherRemarks: text(source.otherRemarks),
  };
}

export function readAgencyContact(value: unknown): MaidAgencyContact {
  const source = record(value);
  return {
    companyName: text(source.companyName),
    contactPerson: text(source.contactPerson),
    phone: text(source.phone),
    licenseNo: text(source.licenseNo),
    homeCountryContactNumber: text(source.homeCountryContactNumber),
  };
}

/** `YYYY-MM-DD` for `<input type="date">`, tolerant of Date and ISO strings. */
export function dateInputValue(value: string | Date | null | undefined) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const match = /^\d{4}-\d{2}-\d{2}/.exec(value.trim());
  return match ? match[0] : "";
}

/** Whole years between a birth date and today (null when unknown). */
export function ageFromDateOfBirth(
  value: string | Date | null | undefined,
): number | null {
  const iso = dateInputValue(value);
  if (!iso) return null;
  const born = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const month = now.getUTCMonth() - born.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < born.getUTCDate())) {
    age -= 1;
  }
  return age >= 0 && age <= 120 ? age : null;
}

/**
 * `<select>` options that keep the current value visible even when it is not in
 * the standard vocabulary (a CSV import may contain `High School(10~12 yrs)`).
 */
export function withCurrentOption(
  options: readonly string[],
  current: string | null | undefined,
): string[] {
  const value = (current ?? "").trim();
  if (!value || options.includes(value)) return [...options];
  return [value, ...options];
}

const value = (row: Record<string, unknown>, key: string) => row[key];

/**
 * Normalises a Prisma row (or a JSON API response) into `AgencyMaid`, filling
 * every JSON group so the form always receives complete objects.
 */
export function toAgencyMaid(row: object): AgencyMaid {
  const source = row as Record<string, unknown>;
  const status = source.status;
  return {
    id: String(source.id ?? ""),
    reference: String(source.reference ?? ""),
    fullName: (value(source, "fullName") as string | null) ?? null,
    nationality: String(source.nationality ?? ""),
    age: (source.age as number | null) ?? null,
    dateOfBirth: (source.dateOfBirth as string | Date | null) ?? null,
    placeOfBirth: (source.placeOfBirth as string | null) ?? null,
    heightCm: (source.heightCm as number | null) ?? null,
    weightKg: (source.weightKg as number | null) ?? null,
    religion: (source.religion as string | null) ?? null,
    maritalStatus: (source.maritalStatus as string | null) ?? null,
    childrenCount: (source.childrenCount as number | null) ?? null,
    siblingsCount: (source.siblingsCount as number | null) ?? null,
    homeAddress: (source.homeAddress as string | null) ?? null,
    airportRepatriation: (source.airportRepatriation as string | null) ?? null,
    educationLevel: (source.educationLevel as string | null) ?? null,
    languages: Array.isArray(source.languages)
      ? source.languages.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    placementType: String(source.placementType ?? ""),
    experienceYears: (source.experienceYears as number | null) ?? null,
    duties: Array.isArray(source.duties)
      ? source.duties.filter((item): item is string => typeof item === "string")
      : [],
    monthlySalary: (source.monthlySalary as number | null) ?? null,
    expectedSalary: (source.expectedSalary as number | null) ?? null,
    presentSalary: (source.presentSalary as number | null) ?? null,
    status: status === "ON_HOLD" || status === "PLACED" ? status : "AVAILABLE",
    availableFrom: (source.availableFrom as string | null) ?? null,
    availability: (source.availability as string | null) ?? null,
    contractEnds: (source.contractEnds as string | null) ?? null,
    offDaysPerMonth: (source.offDaysPerMonth as number | null) ?? null,
    foodHandlingPreferences:
      (source.foodHandlingPreferences as string | null) ?? null,
    dietaryRestrictions: (source.dietaryRestrictions as string | null) ?? null,
    introduction: (source.introduction as string | null) ?? null,
    notes: (source.notes as string | null) ?? null,
    videoUrl: (source.videoUrl as string | null) ?? null,
    photoUrl: (source.photoUrl as string | null) ?? null,
    photoUrls: Array.isArray(source.photoUrls)
      ? source.photoUrls.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    photoThumbnailUrls: Array.isArray(source.photoThumbnailUrls)
      ? source.photoThumbnailUrls.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    photoPortraitUrls: Array.isArray(source.photoPortraitUrls)
      ? source.photoPortraitUrls.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    languageSkills: readLanguageSkills(source.languageSkills),
    preferences: readPreferences(source.preferences),
    workAreas: readWorkAreas(source.workAreas),
    employmentHistory: readEmploymentHistory(source.employmentHistory),
    medicalInfo: readMedical(source.medicalInfo),
    agencyContact: readAgencyContact(source.agencyContact),
    published: source.published !== false,
  };
}
