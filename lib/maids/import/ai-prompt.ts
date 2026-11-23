import { z } from "zod";
import {
  INTERVIEW_OPTIONS,
  LANGUAGE_KEYS,
  MAID_STATUS_OPTIONS,
  OTHER_INFORMATION_KEYS,
  PAST_ILLNESS_KEYS,
  WORK_AREA_KEYS,
} from "@/lib/maid-profile";

export const MAID_IMPORT_PROMPT_VERSION = "maid-biodata.v1";

/** Text sent to the model is trimmed: biodata is small and this bounds cost. */
export const AI_TEXT_LIMIT = 40_000;

const text = (max: number) => z.string().trim().max(max).nullable().optional();
const numeric = z.union([z.string(), z.number()]).nullable().optional();

export const aiBiodataSchema = z.object({
  fullName: text(120),
  reference: text(40),
  placementType: text(80),
  nationality: text(60),
  dateOfBirth: text(20),
  age: numeric,
  placeOfBirth: text(120),
  heightCm: numeric,
  weightKg: numeric,
  religion: text(40),
  maritalStatus: text(40),
  childrenCount: numeric,
  siblingsCount: numeric,
  homeAddress: text(400),
  airportRepatriation: text(120),
  educationLevel: text(80),
  status: text(20),
  availableFrom: text(60),
  availability: text(120),
  contractEnds: text(40),
  offDaysPerMonth: numeric,
  monthlySalary: numeric,
  expectedSalary: numeric,
  presentSalary: numeric,
  foodHandlingPreferences: text(120),
  dietaryRestrictions: text(120),
  introduction: text(8000),
  sgExperience: z.boolean().nullable().optional(),
  indianMaidCategory: text(60),
  privateInfo: text(4000),
  languages: z.record(z.string(), z.string()).nullable().optional(),
  workAreas: z
    .record(
      z.string(),
      z.object({
        rating: z.union([z.string(), z.number(), z.null()]).optional(),
        note: text(400),
        willing: z.boolean().nullable().optional(),
        experience: z.boolean().nullable().optional(),
        years: text(20),
      }),
    )
    .nullable()
    .optional(),
  employment: z
    .array(
      z.object({
        from: text(20),
        to: text(20),
        employer: text(120),
        country: text(80),
        duties: text(1000),
        remarks: text(400),
      }),
    )
    .nullable()
    .optional(),
  otherInformation: z.record(z.string(), z.boolean()).nullable().optional(),
  interviewOptions: z.array(z.string().max(80)).nullable().optional(),
  pastIllnesses: z.record(z.string(), z.boolean()).nullable().optional(),
  otherIllnesses: text(400),
  allergies: text(400),
  physicalDisabilities: text(400),
  otherRemarks: text(2000),
  conflicts: z
    .array(
      z.object({ field: z.string().max(60), message: z.string().max(400) }),
    )
    .nullable()
    .optional(),
});

export type AiBiodata = z.infer<typeof aiBiodataSchema>;

const AI_JSON_SHAPE = `{
  "fullName": string|null, "reference": string|null, "placementType": string|null,
  "nationality": string|null, "dateOfBirth": "YYYY-MM-DD"|null, "age": number|null,
  "placeOfBirth": string|null, "heightCm": number|null, "weightKg": number|null,
  "religion": string|null, "maritalStatus": string|null, "childrenCount": number|null,
  "siblingsCount": number|null, "homeAddress": string|null, "airportRepatriation": string|null,
  "educationLevel": string|null, "status": "AVAILABLE"|"ON_HOLD"|"PLACED"|null,
  "availableFrom": string|null, "availability": string|null, "contractEnds": string|null,
  "offDaysPerMonth": number|null, "monthlySalary": number|null, "expectedSalary": number|null,
  "presentSalary": number|null, "foodHandlingPreferences": string|null,
  "dietaryRestrictions": string|null, "introduction": string|null,
  "sgExperience": boolean|null, "indianMaidCategory": string|null, "privateInfo": string|null,
  "languages": { "<language>": "<level>" }|null,
  "workAreas": { "<area>": { "rating": 1-5|null, "note": string|null, "willing": boolean|null, "experience": boolean|null, "years": string|null } }|null,
  "employment": [{ "from": string|null, "to": string|null, "employer": string|null, "country": string|null, "duties": string|null, "remarks": string|null }]|null,
  "otherInformation": { "<question>": boolean }|null,
  "interviewOptions": string[]|null,
  "pastIllnesses": { "<illness>": boolean }|null,
  "otherIllnesses": string|null, "allergies": string|null, "physicalDisabilities": string|null,
  "otherRemarks": string|null,
  "conflicts": [{ "field": string, "message": string }]|null
}`;

export const MAID_IMPORT_SYSTEM_PROMPT = [
  "You extract structured maid biodata from an agency document.",
  "Rules:",
  "1. Use ONLY information explicitly present in the document. Never guess or invent.",
  "2. If a value is missing or unclear, return null for it.",
  "3. Preserve names, places and wording exactly; fix only obvious spacing.",
  "4. Dates must be ISO YYYY-MM-DD. Heights in cm (100-220). Weights in kg (25-200).",
  "5. Distinguish willingness from experience: never mark experience true just because the maid is willing.",
  "6. Employment history: one object per employer, never merged. Use year strings for from/to.",
  "7. Do not write marketing copy. `introduction` may only reproduce the document's own introduction text.",
  "8. If the document gives conflicting values for one field, choose the most explicit one and add an entry to `conflicts`.",
  "9. Return one JSON object only, matching this shape:",
  AI_JSON_SHAPE,
  `Work area keys: ${WORK_AREA_KEYS.join(", ")}.`,
  `Interview options: ${INTERVIEW_OPTIONS.join(" | ")}.`,
  `Past illness keys: ${PAST_ILLNESS_KEYS.join(", ")}.`,
  `Other information keys: ${OTHER_INFORMATION_KEYS.join(", ")}.`,
  `Status values: ${MAID_STATUS_OPTIONS.map((option) => option.value).join(", ")}.`,
  `Language keys: ${LANGUAGE_KEYS.join(", ")}.`,
].join("\n");
