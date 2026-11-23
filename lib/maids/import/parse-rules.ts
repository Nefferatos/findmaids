import {
  LANGUAGE_KEYS,
  MAID_EDUCATION_LEVELS,
  MAID_MARITAL_STATUSES,
  MAID_RELIGIONS,
  MAID_TYPES,
  OTHER_INFORMATION_KEYS,
  PAST_ILLNESS_KEYS,
  WORK_AREA_KEYS,
  ageFromDateOfBirth,
} from "@/lib/maid-profile";
import type { MaidDraftPatch, WorkAreaDraft } from "@/lib/maids/draft";
import type { MaidImportReview } from "@/lib/maids/import/types";

/**
 * Deterministic (no-AI) biodata parser.
 *
 * Reads labelled lines and table rows ("Label | value", "Label: value") plus a
 * few well-known sections (languages, work areas, employment history,
 * introduction, medical). It never guesses: a value is only produced when the
 * document actually contains it, and anything ambiguous is reported for review.
 */

export type RuleParseResult = {
  draft: MaidDraftPatch;
  found: string[];
  review: MaidImportReview[];
  warnings: string[];
};

const canonical = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();

type Normalised<T> = { value: T; review?: string };

const clean = (value: string) =>
  value
    .replace(/\s*\|\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

const firstNumber = (value: string) => {
  const match = /-?\d+(?:\.\d+)?/.exec(value.replace(/,/g, ""));
  return match ? Number(match[0]) : null;
};

const clampText = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

const asBoolean = (value: string): boolean | null => {
  const normalised = value.toLowerCase();
  if (/\b(yes|true|y|✓|✔|available|willing|able|has|with)\b/.test(normalised))
    return true;
  if (/\b(no|false|n|✗|✘|none|nil|not|without)\b/.test(normalised))
    return false;
  return null;
};

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

/** `DD/MM/YYYY`, `YYYY-MM-DD`, `12 March 1993`, `March 1993` → `YYYY-MM-DD`. */
export function parseDocumentDate(raw: string): Normalised<string> | null {
  const value = raw.replace(/(\d)(st|nd|rd|th)/gi, "$1").trim();
  if (!value) return null;

  // PDF date boxes: "2 d 6 d 0 m 4 m 0 y 2 y" (and a following "Age: 24").
  // Strip the d/m/y guides, cut a second label, then read the digits in order.
  const boxed = value
    .replace(/\b(?:age|sex|gender)\b\s*:.*$/i, " ")
    .replace(/\b[dmy]\b\.?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (/^\d(?:\s*\d){5,7}$/.test(boxed)) {
    const digits = boxed.replace(/\s+/g, "");
    const day = Number(digits.slice(0, 2));
    const month = Number(digits.slice(2, 4));
    let year: number;
    if (digits.length === 6) {
      const shortYear = Number(digits.slice(4, 6));
      const currentShortYear = new Date().getUTCFullYear() % 100;
      year =
        shortYear <= currentShortYear ? 2000 + shortYear : 1900 + shortYear;
    } else {
      year = Number(digits.slice(4, 8));
    }
    const currentYear = new Date().getUTCFullYear();
    if (
      day >= 1 &&
      day <= 31 &&
      month >= 1 &&
      month <= 12 &&
      year >= 1900 &&
      year <= currentYear
    )
      return {
        value: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        review: `Read the boxed date "${raw}" as day/month/year.`,
      };
  }

  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(value);
  if (iso) {
    const [, year, month, day] = iso;
    return {
      value: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
    };
  }

  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(value);
  if (dmy) {
    const first = Number(dmy[1]);
    const second = Number(dmy[2]);
    const build = (day: number, month: number) =>
      `${dmy[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (first > 12) return { value: build(first, second) };
    if (second > 12) return { value: build(second, first) };
    // Singapore biodata sheets are day-first; flag the ambiguous ones.
    return {
      value: build(first, second),
      review: `"${raw}" is ambiguous; read as day/month/year. Check the date.`,
    };
  }

  const named = /^(\d{1,2})?[\s-]*([A-Za-z]{3,9})\.?[\s,-]+(\d{4})$/.exec(
    value,
  );
  if (named && MONTHS[named[2].toLowerCase()]) {
    const month = String(MONTHS[named[2].toLowerCase()]).padStart(2, "0");
    const day = named[1] ? String(Number(named[1])).padStart(2, "0") : "01";
    return { value: `${named[3]}-${month}-${day}` };
  }

  return null;
}

/** Accepts `160`, `160 cm`, `1.6 m`, `5'3"`. */
export function parseHeightCm(raw: string): Normalised<string> | null {
  const value = raw.toLowerCase();
  const feetInches = /(\d)\s*'\s*(\d{1,2})?"?/.exec(value);
  if (feetInches && !/cm|\bm\b/.test(value)) {
    const total =
      Number(feetInches[1]) * 30.48 + Number(feetInches[2] ?? 0) * 2.54;
    return { value: String(Math.round(total)) };
  }
  const number = firstNumber(value);
  if (number === null) return null;
  const cm =
    /\bm\b|metre|meter/.test(value) && number < 3
      ? Math.round(number * 100)
      : number;
  if (!Number.isFinite(cm) || cm < 100 || cm > 220)
    return {
      value: "",
      review: `Height "${clean(raw)}" is outside 100-220 cm; left blank.`,
    };
  return { value: String(Math.round(cm)) };
}

export function parseWeightKg(raw: string): Normalised<string> | null {
  const number = firstNumber(raw);
  if (number === null) return null;
  if (number < 25 || number > 200)
    return {
      value: "",
      review: `Weight "${clean(raw)}" is outside 25-200 kg; left blank.`,
    };
  return { value: String(Math.round(number)) };
}

export function parseMoney(raw: string): Normalised<string> | null {
  const number = firstNumber(raw.replace(/\$/g, ""));
  if (number === null || number <= 0 || number > 100_000) return null;
  return { value: String(Math.round(number)) };
}

export function parseCount(
  raw: string,
  max: number,
): Normalised<string> | null {
  const number = firstNumber(raw);
  if (number === null || number < 0 || number > max) return null;
  return { value: String(Math.round(number)) };
}

const matchOption = (options: readonly string[], raw: string) => {
  const value = canonical(raw);
  if (!value) return null;
  const exact = options.find((option) => canonical(option) === value);
  if (exact) return exact;
  return (
    options.find(
      (option) =>
        value.includes(canonical(option)) || canonical(option).includes(value),
    ) ?? null
  );
};

export function parseNationality(raw: string): Normalised<string> | null {
  const value = raw.toLowerCase();
  const map: Array<[RegExp, string]> = [
    [/filipin|philippin/, "Filipino maid"],
    [/indonesia/, "Indonesian maid"],
    [/myanmar|burmese|burma/, "Myanmar maid"],
    [/india|indian/, "Indian maid"],
  ];
  for (const [pattern, nationality] of map)
    if (pattern.test(value)) return { value: nationality };
  return {
    value: clampText(clean(raw), 60),
    review: `Unrecognised nationality "${clean(raw)}".`,
  };
}

export function parseMaidType(raw: string): Normalised<string> | null {
  const value = raw.toLowerCase();
  if (/transfer/.test(value)) return { value: "Transfer maid" };
  if (/\baps\b/.test(value)) return { value: "APS maid" };
  if (/middle\s*east/.test(value)) return { value: "Ex-Middle East maid" };
  if (/taiwan/.test(value)) return { value: "Ex-Taiwan maid" };
  if (/ex[\s-]*(sg|singapore)/.test(value))
    return { value: "Ex-Singapore maid" };
  if (/new/.test(value)) return { value: "New maid" };
  const option = matchOption(MAID_TYPES, raw);
  return option
    ? { value: option }
    : {
        value: clampText(clean(raw), 80),
        review: `Unrecognised maid type "${clean(raw)}".`,
      };
}

export function parseReligion(raw: string): Normalised<string> | null {
  const option = matchOption(MAID_RELIGIONS, raw);
  if (option) return { value: option };
  return {
    value: clampText(clean(raw), 40),
    review: `Unrecognised religion "${clean(raw)}".`,
  };
}

export function parseMaritalStatus(raw: string): Normalised<string> | null {
  const option = matchOption(MAID_MARITAL_STATUSES, raw);
  return option
    ? { value: option }
    : {
        value: clampText(clean(raw), 40),
        review: `Unrecognised marital status "${clean(raw)}".`,
      };
}

export function parseEducationLevel(raw: string): Normalised<string> | null {
  const value = raw.toLowerCase().replace(/\{[^}]*\}/g, " ");
  const grade = /grade\s*(1[0-2]|[1-9])\b/.exec(value);
  if (grade) {
    const number = Number(grade[1]);
    if (number <= 6) return { value: "Primary (1-6 yrs)" };
    if (number <= 9) return { value: "Secondary Level (7-9 yrs)" };
    return { value: "High School (10-12 yrs)" };
  }
  if (/college|degree|university|diploma|bachelor/.test(value))
    return { value: "College/Degree (>=13 yrs)" };
  if (/secondary|sec\s*[34]|7\s*[-~–]\s*9/.test(value))
    return { value: "Secondary Level (7-9 yrs)" };
  if (/primary/.test(value)) return { value: "Primary (1-6 yrs)" };
  if (/high\s*school|10\s*[-~–]\s*12|o[\s-]*level/.test(value))
    return { value: "High School (10-12 yrs)" };
  const option = matchOption(MAID_EDUCATION_LEVELS, raw);
  return option
    ? { value: option }
    : {
        value: clampText(clean(raw), 80),
        review: `Education "${clean(raw)}" is not a standard level.`,
      };
}

export function parseStatus(
  raw: string,
): Normalised<"AVAILABLE" | "ON_HOLD" | "PLACED"> | null {
  const value = raw.toLowerCase();
  if (/placed|employed/.test(value)) return { value: "PLACED" };
  if (/reserved|hold|pending|booked/.test(value)) return { value: "ON_HOLD" };
  if (/available|active|open/.test(value)) return { value: "AVAILABLE" };
  return null;
}

const PROFICIENCY_MAP: Array<[RegExp, string]> = [
  [/^(none|no|nil|zero|0)$/i, "Zero"],
  [/basic|little|beginner|simple/i, "Little"],
  [/poor|weak/i, "Poor"],
  [/fair|average|moderate|conversational/i, "Fair"],
  [/good|competent/i, "Good"],
  [/excellent|fluent|native|advanced/i, "Excellent"],
];

export function parseProficiency(raw: string): Normalised<string> | null {
  const value = clean(raw);
  if (!value) return null;
  for (const [pattern, level] of PROFICIENCY_MAP)
    if (pattern.test(value)) return { value: level };
  return {
    value: clampText(value, 20),
    review: `Unrecognised language level "${value}".`,
  };
}

/** Shared by the rules parser and the AI validator. */
export const importNormalisers = {
  canonical,
  clean,
  asBoolean,
  parseDocumentDate,
  parseHeightCm,
  parseWeightKg,
  parseMoney,
  parseCount,
  parseNationality,
  parseMaidType,
  parseReligion,
  parseMaritalStatus,
  parseEducationLevel,
  parseStatus,
  parseProficiency,
  ageFromDateOfBirth,
  LANGUAGE_KEYS,
  WORK_AREA_KEYS,
  OTHER_INFORMATION_KEYS,
  PAST_ILLNESS_KEYS,
};

export type { MaidDraftPatch, WorkAreaDraft, MaidImportReview };
