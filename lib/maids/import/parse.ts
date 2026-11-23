import type { MaidDraftPatch } from "@/lib/maids/draft";
import type { MaidImportReview } from "@/lib/maids/import/types";
import {
  importNormalisers as N,
  type RuleParseResult,
} from "@/lib/maids/import/parse-rules";
import {
  parseEmploymentHistory,
  parseIntroduction,
  parseLanguages,
  parseMedical,
  parsePreferences,
  parsePrivateInfo,
  parseWorkAreas,
} from "@/lib/maids/import/sections";

type FieldKey = keyof MaidDraftPatch;

type FieldDefinition = {
  key: FieldKey;
  label: string;
  aliases: string[];
};

const FIELD_DEFINITIONS: FieldDefinition[] = [
  {
    key: "fullName",
    label: "Full name",
    aliases: [
      "full name",
      "name of maid",
      "maid name",
      "helper name",
      "name of helper",
      "name of fdw",
      "fdw name",
      "name",
    ],
  },
  {
    key: "reference",
    label: "Reference code",
    aliases: [
      "reference",
      "reference code",
      "reference no",
      "ref no",
      "ref",
      "biodata no",
      "registration no",
      "maid code",
      "code",
    ],
  },
  {
    key: "placementType",
    label: "Maid type",
    aliases: [
      "type",
      "maid type",
      "helper type",
      "employment category",
      "category",
      "type of maid",
      "placement type",
    ],
  },
  {
    key: "nationality",
    label: "Nationality",
    aliases: ["nationality", "country of origin", "citizenship"],
  },
  {
    key: "dateOfBirth",
    label: "Date of birth",
    aliases: ["date of birth", "dob", "d o b", "birth date", "birthday"],
  },
  { key: "age", label: "Age", aliases: ["age", "current age"] },
  {
    key: "placeOfBirth",
    label: "Place of birth",
    aliases: ["place of birth", "birth place", "born in"],
  },
  {
    key: "height",
    label: "Height",
    aliases: ["height", "height cm", "height in cm"],
  },
  {
    key: "weight",
    label: "Weight",
    aliases: ["weight", "weight kg", "weight in kg"],
  },
  { key: "religion", label: "Religion", aliases: ["religion", "faith"] },
  {
    key: "maritalStatus",
    label: "Marital status",
    aliases: ["marital status", "marriage", "civil status"],
  },
  {
    key: "children",
    label: "Number of children",
    aliases: [
      "number of children",
      "no of children",
      "children",
      "no of kids",
      "kids",
    ],
  },
  {
    key: "siblings",
    label: "Number of siblings",
    aliases: ["number of siblings", "no of siblings", "siblings"],
  },
  {
    key: "homeAddress",
    label: "Home address",
    aliases: ["home address", "address", "residential address"],
  },
  {
    key: "airportRepatriation",
    label: "Airport / repatriation",
    aliases: [
      "name of port",
      "airport",
      "airport repatriation",
      "repatriation",
      "departure airport",
    ],
  },
  {
    key: "educationLevel",
    label: "Education level",
    aliases: [
      "education",
      "education level",
      "highest education",
      "qualification",
    ],
  },
  {
    key: "status",
    label: "Status",
    aliases: ["status", "availability status"],
  },
  {
    key: "availableFrom",
    label: "Available from",
    aliases: ["available from", "available date"],
  },
  {
    key: "availability",
    label: "Availability",
    aliases: ["availability", "interview availability"],
  },
  {
    key: "contractEnds",
    label: "Contract ends",
    aliases: ["contract ends", "contract end", "contract expiry"],
  },
  {
    key: "offDaysPerMonth",
    label: "Off days per month",
    aliases: ["off days", "off day", "off days per month", "days off"],
  },
  {
    key: "monthlySalary",
    label: "Monthly salary",
    aliases: ["monthly salary", "salary", "salary per month"],
  },
  {
    key: "expectedSalary",
    label: "Expected salary",
    aliases: ["expected salary", "asking salary"],
  },
  {
    key: "presentSalary",
    label: "Present salary",
    aliases: ["present salary", "current salary"],
  },
  {
    key: "foodHandlingPreferences",
    label: "Food handling",
    aliases: ["food handling", "food handling preferences", "food preference"],
  },
  {
    key: "dietaryRestrictions",
    label: "Dietary restrictions",
    aliases: ["dietary restrictions", "dietary requirement", "diet"],
  },
  {
    key: "introduction",
    label: "Introduction",
    aliases: ["introduction", "public introduction", "summary"],
  },
  {
    key: "sgExperience",
    label: "Singapore experience",
    aliases: ["singapore experience", "sg experience", "worked in singapore"],
  },
  {
    key: "indianMaidCategory",
    label: "Indian maid category",
    aliases: ["indian maid category", "indian category"],
  },
];

const FIELD_BY_ALIAS = new Map<string, FieldDefinition>();
const FIELD_BY_KEY = new Map<string, FieldDefinition>();
for (const definition of FIELD_DEFINITIONS) {
  FIELD_BY_KEY.set(definition.key, definition);
  for (const alias of definition.aliases)
    if (!FIELD_BY_ALIAS.has(N.canonical(alias)))
      FIELD_BY_ALIAS.set(N.canonical(alias), definition);
}

/**
 * Form labels often carry list numbers ("1. Name:") and extra qualifiers
 * ("Residential address in home country:"). Strip the numbering, then accept
 * an exact alias or the longest alias that prefixes the label.
 */
function resolveField(rawLabel: string): FieldDefinition | undefined {
  const label = N.canonical(
    rawLabel.replace(/^\s*(?:[A-Za-z]{0,2}\d{1,3}[.)]?|[-*•]+)\s*/, ""),
  );
  if (!label) return undefined;
  const exact = FIELD_BY_ALIAS.get(label);
  if (exact) return exact;

  let best: { definition: FieldDefinition; length: number } | undefined;
  for (const [alias, definition] of FIELD_BY_ALIAS) {
    if (alias.length < 4 || !label.startsWith(alias)) continue;
    if (!best || alias.length > best.length)
      best = { definition, length: alias.length };
  }
  return best?.definition;
}

/** Splits a line into (label, value) pairs, including `a | b | c` table rows. */
function splitPairs(line: string): Array<[string, string]> {
  if (line.includes("|")) {
    const cells = line
      .split("|")
      .map((cell) => N.clean(cell))
      .filter(Boolean);
    const pairs: Array<[string, string]> = [];
    for (let index = 0; index + 1 < cells.length; index += 1)
      pairs.push([cells[index], cells[index + 1]]);
    return pairs;
  }
  const colon = /^([^:]{2,60}?)\s*:\s*(.+)$/.exec(line);
  if (colon) return [[colon[1], colon[2]]];
  const dash = /^([A-Za-z][A-Za-z ./()'?#&+-]{1,60}?)\s+[–-]\s+(.+)$/.exec(
    line,
  );
  if (dash) return [[dash[1], dash[2]]];
  const spaced = /^([A-Za-z][A-Za-z ./()'?#&+-]{1,60}?)\s{2,}(.+)$/.exec(line);
  if (spaced) return [[spaced[1], spaced[2]]];
  return [];
}

type NormalisedField = { value?: unknown; review?: string; skip?: boolean };

function normaliseField(key: FieldKey, raw: string): NormalisedField {
  const text = N.clean(raw);
  if (!text) return { skip: true };
  // OCR can leave leading underlines/box borders before a value.
  const noisy = (value: string) => value.replace(/^[\s_|~•·]+(?=\S)/, "");
  // Form placeholder dashes are not values.
  if (/^[-–—.]+$/.test(text)) return { skip: true };
  // Form PDFs often render each digit in its own box: "1 6 0 cm 5 0 kg".
  const compact = text.replace(/(?<=\d)[ \t]+(?=\d)/g, "");
  const withReview = (result: { value: string; review?: string } | null) =>
    result && result.value !== ""
      ? { value: result.value, review: result.review }
      : { skip: true, review: result?.review };

  switch (key) {
    case "fullName":
      return /^\d|\d{3,}/.test(text)
        ? { skip: true }
        : { value: noisy(text).replace(/\s+/g, " ").slice(0, 120) };
    case "reference":
      return { value: text.slice(0, 40) };
    case "placementType":
      return withReview(N.parseMaidType(text));
    case "nationality":
      return withReview(N.parseNationality(text));
    case "dateOfBirth":
      return withReview(N.parseDocumentDate(text));
    case "age": {
      const age = N.parseCount(compact, 99)?.value;
      return age ? { value: age } : { skip: true };
    }
    case "placeOfBirth":
    case "homeAddress":
      return { value: noisy(text).slice(0, 400) };
    case "airportRepatriation":
      return {
        value: noisy(text)
          .replace(/\s+[0-9]$/, "")
          .slice(0, 120),
      };
    case "height":
      return withReview(N.parseHeightCm(compact));
    case "weight": {
      const beforeKg = /(\d{1,3}(?:\.\d+)?)\s*kg\b/i.exec(compact)?.[1];
      return withReview(N.parseWeightKg(beforeKg ?? compact));
    }
    case "religion":
      return withReview(N.parseReligion(text));
    case "maritalStatus":
      return withReview(N.parseMaritalStatus(text));
    case "children":
    case "siblings": {
      const count = N.parseCount(compact, 30)?.value;
      return count === undefined ? { skip: true } : { value: count };
    }
    case "educationLevel":
      return withReview(N.parseEducationLevel(text));
    case "status": {
      const status = N.parseStatus(text)?.value;
      return status ? { value: status } : { skip: true };
    }
    case "availableFrom":
    case "availability":
    case "contractEnds":
      return { value: text.slice(0, 120) };
    case "offDaysPerMonth": {
      const days = N.parseCount(text, 31)?.value;
      return days === undefined ? { skip: true } : { value: days };
    }
    case "monthlySalary":
    case "expectedSalary":
    case "presentSalary": {
      const money = N.parseMoney(text)?.value;
      return money ? { value: money } : { skip: true };
    }
    case "foodHandlingPreferences": {
      const value = noisy(text)
        .replace(/\s*\bothers?\s*:?\s*$/i, "")
        .replace(/^[0OQ\s]+|[0OQ\s]+$/g, "")
        .trim();
      return value ? { value: value.slice(0, 120) } : { skip: true };
    }
    case "dietaryRestrictions":
      return { value: noisy(text).slice(0, 120) };
    case "introduction":
      return text.length >= 40
        ? { value: text.slice(0, 8000) }
        : { skip: true };
    case "sgExperience": {
      const flag = N.asBoolean(text);
      return flag === null ? { skip: true } : { value: flag };
    }
    case "indianMaidCategory":
      return { value: text.slice(0, 60) };
    default:
      return { skip: true };
  }
}

export const IMPORTANT_FIELDS: Array<[FieldKey, string]> = [
  ["fullName", "Full name"],
  ["reference", "Reference code"],
  ["placementType", "Maid type"],
  ["nationality", "Nationality"],
  ["dateOfBirth", "Date of birth"],
  ["height", "Height"],
  ["weight", "Weight"],
  ["religion", "Religion"],
  ["maritalStatus", "Marital status"],
  ["educationLevel", "Education level"],
  ["languages", "Languages"],
  ["introduction", "Introduction"],
];

/** Reads a whole biodata document (PDF/DOCX text) into a form draft. */
export function parseMaidBiodata(text: string): RuleParseResult {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const draft: Record<string, unknown> = {};
  const review: MaidImportReview[] = [];
  const warnings: string[] = [];
  const candidates = new Map<FieldKey, { value: unknown; label: string }[]>();

  const push = (key: FieldKey, label: string, value: unknown) => {
    const list = candidates.get(key) ?? [];
    list.push({ value, label });
    candidates.set(key, list);
  };

  for (const line of lines) {
    for (const [rawLabel, rawValue] of splitPairs(line)) {
      const definition = resolveField(rawLabel);
      if (!definition) continue;
      if (rawValue.length > 400 && definition.key !== "introduction") continue;
      // "Height & weight: 160 cm 50 kg" carries two fields in one value.
      const definitions =
        definition.key === "height" && /weight/i.test(rawLabel)
          ? [definition, FIELD_BY_KEY.get("weight")].filter(
              (entry): entry is FieldDefinition => Boolean(entry),
            )
          : [definition];
      for (const target of definitions) {
        const normalised = normaliseField(target.key, rawValue);
        if (normalised.review)
          review.push({
            field: target.key,
            label: target.label,
            message: normalised.review,
          });
        if (
          normalised.skip ||
          normalised.value === undefined ||
          normalised.value === ""
        )
          continue;
        push(target.key, target.label, normalised.value);
      }
    }
  }

  // Conflicts: keep the first value, flag the rest for manual review.
  for (const [key, values] of candidates) {
    const distinct = [...new Set(values.map((entry) => String(entry.value)))];
    if (distinct.length > 1) {
      review.push({
        field: key,
        label: values[0].label,
        message: `Conflicting values found: ${distinct
          .slice(0, 3)
          .map((value) => `"${value}"`)
          .join(" / ")}. Kept the first one.`,
      });
    }
    draft[key] = values[0].value;
  }

  const languages = parseLanguages(lines);
  if (Object.keys(languages.skills).length > 0) {
    draft.languageSkills = languages.skills;
    draft.languages = Object.entries(languages.skills)
      .filter(([, level]) => level && level !== "Zero")
      .map(([language]) => language)
      .join(", ");
  }
  review.push(...languages.review);

  const areas = parseWorkAreas(lines);
  if (Object.keys(areas.areas).length > 0) draft.workAreas = areas.areas;
  review.push(...areas.review);

  const employment = parseEmploymentHistory(lines);
  if (employment.length > 0) draft.employment = employment;

  const introduction = parseIntroduction(lines);
  if (
    introduction &&
    String(draft.introduction ?? "").length < introduction.length
  )
    draft.introduction = introduction;

  const medical = parseMedical(lines);
  if (Object.keys(medical.pastIllnesses).length > 0)
    draft.pastIllnesses = medical.pastIllnesses;
  if (medical.otherIllnesses) draft.otherIllnesses = medical.otherIllnesses;
  if (medical.allergies) draft.allergies = medical.allergies;
  if (medical.physicalDisabilities)
    draft.physicalDisabilities = medical.physicalDisabilities;
  if (medical.otherRemarks) draft.otherRemarks = medical.otherRemarks;
  review.push(...medical.review);

  const preferences = parsePreferences(lines);
  if (Object.keys(preferences.otherInformation).length > 0)
    draft.otherInformation = preferences.otherInformation;
  if (preferences.interviewOptions.length > 0)
    draft.interviewOptions = preferences.interviewOptions;
  if (
    preferences.sgExperience !== undefined &&
    draft.sgExperience === undefined
  )
    draft.sgExperience = preferences.sgExperience;
  if (preferences.offDays && !draft.offDaysPerMonth)
    draft.offDaysPerMonth = preferences.offDays;
  review.push(...preferences.review);

  const privateInfo = parsePrivateInfo(lines);
  if (privateInfo) draft.privateInfo = privateInfo;

  // A birth date is authoritative; cross-check a separately stated age.
  const dateOfBirth =
    typeof draft.dateOfBirth === "string" ? draft.dateOfBirth : "";
  const statedAge = typeof draft.age === "string" ? Number(draft.age) : null;
  if (dateOfBirth) {
    const computed = N.ageFromDateOfBirth(dateOfBirth);
    if (computed !== null) {
      draft.age = String(computed);
      if (statedAge !== null && Math.abs(statedAge - computed) > 1)
        review.push({
          field: "dateOfBirth",
          label: "Age",
          message: `The document says age ${statedAge}, but the birth date gives ${computed}. Check the date.`,
        });
    }
  }

  const found = Object.keys(draft);

  if (found.length <= 3)
    warnings.push(
      "Very little structure was recognised. Check every field, or type the details manually.",
    );
  if (!("languages" in draft))
    warnings.push("No language proficiencies were found in the document.");
  if (Object.keys(areas.areas).length === 0)
    warnings.push("No skills or work-area ratings were found.");

  return { draft: draft as MaidDraftPatch, found, review, warnings };
}
