import { INTERVIEW_OPTIONS } from "@/lib/maid-profile";
import type { MaidDraftPatch, WorkAreaDraft } from "@/lib/maids/draft";
import type { MaidImportReview } from "@/lib/maids/import/types";
import { importNormalisers as N } from "@/lib/maids/import/parse-rules";
import {
  AI_TEXT_LIMIT,
  MAID_IMPORT_SYSTEM_PROMPT,
  aiBiodataSchema,
  type AiBiodata,
} from "@/lib/maids/import/ai-prompt";
import { getAiProvider } from "@/lib/ai/provider";

const toNumberString = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? String(Math.round(number)) : undefined;
};

/** Converts the model's JSON into the same draft shape the form uses. */
function toDraft(parsed: AiBiodata, review: MaidImportReview[]) {
  const draft: Record<string, unknown> = {};
  const setText = (
    key: string,
    value: string | null | undefined,
    max: number,
  ) => {
    const trimmed = value?.trim();
    if (trimmed) draft[key] = trimmed.slice(0, max);
  };

  setText("fullName", parsed.fullName, 120);
  setText("reference", parsed.reference, 40);
  setText("placeOfBirth", parsed.placeOfBirth, 120);
  setText("homeAddress", parsed.homeAddress, 400);
  setText("airportRepatriation", parsed.airportRepatriation, 120);
  setText("availableFrom", parsed.availableFrom, 60);
  setText("availability", parsed.availability, 120);
  setText("contractEnds", parsed.contractEnds, 40);
  setText("foodHandlingPreferences", parsed.foodHandlingPreferences, 120);
  setText("dietaryRestrictions", parsed.dietaryRestrictions, 120);
  setText("introduction", parsed.introduction, 8000);
  setText("privateInfo", parsed.privateInfo, 4000);
  setText("otherIllnesses", parsed.otherIllnesses, 400);
  setText("allergies", parsed.allergies, 400);
  setText("physicalDisabilities", parsed.physicalDisabilities, 400);
  setText("otherRemarks", parsed.otherRemarks, 2000);
  setText("indianMaidCategory", parsed.indianMaidCategory, 60);

  const mapped = [
    ["placementType", parsed.placementType, N.parseMaidType],
    ["nationality", parsed.nationality, N.parseNationality],
    ["religion", parsed.religion, N.parseReligion],
    ["maritalStatus", parsed.maritalStatus, N.parseMaritalStatus],
    ["educationLevel", parsed.educationLevel, N.parseEducationLevel],
  ] as const;
  for (const [key, value, parser] of mapped) {
    if (!value?.trim()) continue;
    const normalised = parser(value);
    if (!normalised?.value) continue;
    draft[key] = normalised.value;
    if (normalised.review)
      review.push({ field: key, label: key, message: normalised.review });
  }

  if (parsed.status?.trim()) {
    const status = N.parseStatus(parsed.status);
    if (status) draft.status = status.value;
  }
  if (parsed.dateOfBirth?.trim()) {
    const date = N.parseDocumentDate(parsed.dateOfBirth);
    if (date) {
      draft.dateOfBirth = date.value;
      const age = N.ageFromDateOfBirth(date.value);
      if (age !== null) draft.age = String(age);
    }
  }
  if (parsed.heightCm !== null && parsed.heightCm !== undefined) {
    const height = N.parseHeightCm(String(parsed.heightCm));
    if (height?.value) draft.height = height.value;
  }
  if (parsed.weightKg !== null && parsed.weightKg !== undefined) {
    const weight = N.parseWeightKg(String(parsed.weightKg));
    if (weight?.value) draft.weight = weight.value;
  }

  for (const [key, value] of [
    ["age", parsed.age],
    ["children", parsed.childrenCount],
    ["siblings", parsed.siblingsCount],
    ["offDaysPerMonth", parsed.offDaysPerMonth],
    ["monthlySalary", parsed.monthlySalary],
    ["expectedSalary", parsed.expectedSalary],
    ["presentSalary", parsed.presentSalary],
  ] as const) {
    const number = toNumberString(value);
    if (number !== undefined) draft[key] = number;
  }

  if (parsed.sgExperience === true || parsed.sgExperience === false)
    draft.sgExperience = parsed.sgExperience;
  return draft;
}

/** Converts the model's JSON into the same draft shape the form uses. */
function finishDraft(
  parsed: AiBiodata,
  draft: Record<string, unknown>,
  review: MaidImportReview[],
) {
  if (parsed.languages) {
    const skills: Record<string, string> = {};
    for (const [language, level] of Object.entries(parsed.languages)) {
      const normalised = N.parseProficiency(level);
      if (normalised?.value) skills[language] = normalised.value;
    }
    if (Object.keys(skills).length > 0) {
      draft.languageSkills = skills;
      draft.languages = Object.entries(skills)
        .filter(([, level]) => level && level !== "Zero")
        .map(([language]) => language)
        .join(", ");
    }
  }

  if (parsed.workAreas) {
    const areas: Record<string, WorkAreaDraft> = {};
    for (const [area, value] of Object.entries(parsed.workAreas)) {
      const rating = Number(value.rating);
      areas[area] = {
        rating:
          Number.isFinite(rating) && rating >= 1 && rating <= 5
            ? String(Math.round(rating))
            : "",
        note: value.note?.slice(0, 400) ?? "",
        willing: value.willing === true,
        experience: value.experience === true,
        years: value.years?.slice(0, 20) ?? "",
      };
    }
    if (Object.keys(areas).length > 0) draft.workAreas = areas;
  }

  if (parsed.employment?.length) {
    draft.employment = parsed.employment.slice(0, 12).map((entry) => ({
      from: entry.from ?? "",
      to: entry.to ?? "",
      employer: entry.employer ?? "",
      country: entry.country ?? "",
      duties: entry.duties ?? "",
      remarks: entry.remarks ?? "",
    }));
  }

  if (parsed.otherInformation) {
    const other = Object.fromEntries(
      Object.entries(parsed.otherInformation).filter(
        ([, value]) => typeof value === "boolean",
      ),
    );
    if (Object.keys(other).length > 0) draft.otherInformation = other;
  }

  if (parsed.interviewOptions?.length) {
    const allowed = parsed.interviewOptions.filter((option) =>
      INTERVIEW_OPTIONS.includes(option as (typeof INTERVIEW_OPTIONS)[number]),
    );
    if (allowed.length > 0) draft.interviewOptions = allowed;
  }

  if (parsed.pastIllnesses) {
    const illnesses = Object.fromEntries(
      Object.entries(parsed.pastIllnesses).filter(
        ([, value]) => typeof value === "boolean",
      ),
    );
    if (Object.keys(illnesses).length > 0) draft.pastIllnesses = illnesses;
  }

  for (const conflict of parsed.conflicts ?? [])
    review.push({
      field: conflict.field,
      label: conflict.field,
      message: conflict.message,
    });

  return draft as MaidDraftPatch;
}

/**
 * Optional AI pass. Returns `null` when no provider is configured, when the
 * call fails, or when the model does not return valid JSON — the caller then
 * falls back to the deterministic parser.
 */
export async function extractWithAi(
  documentText: string,
): Promise<{ draft: MaidDraftPatch; review: MaidImportReview[] } | null> {
  const provider = getAiProvider();
  if (provider.name === "mock") return null;

  try {
    const result = await provider.generateText({
      messages: [
        { role: "system", content: MAID_IMPORT_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Document text:\n"""\n${documentText.slice(0, AI_TEXT_LIMIT)}\n"""`,
        },
      ],
      temperature: 0,
      maxTokens: 2500,
    });
    const json = result.text
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    const parsed = aiBiodataSchema.parse(JSON.parse(json));
    const review: MaidImportReview[] = [];
    const draft = toDraft(parsed, review);
    finishDraft(parsed, draft as Record<string, unknown>, review);
    return Object.keys(draft).length === 0 ? null : { draft, review };
  } catch {
    return null;
  }
}
