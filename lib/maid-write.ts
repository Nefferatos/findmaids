import type { Prisma } from "@/lib/generated/prisma/client";
import type { z } from "zod";
import { ageFromDateOfBirth } from "@/lib/maid-profile";
import type { maidCreateSchema } from "@/lib/validation";

export type MaidInput = z.infer<typeof maidCreateSchema>;

/**
 * Maps a validated maid payload onto Prisma columns.
 *
 * Only keys present in the payload are written, so the same helper serves
 * `POST` (create) and `PATCH` (partial update). Empty strings become `NULL` so
 * blank CSV cells never show up as empty values in the portal.
 */
export function maidColumns(
  input: Partial<MaidInput>,
): Prisma.MaidUncheckedUpdateInput {
  const columns: Record<string, unknown> = {};
  const setText = (key: string, value: string | undefined) => {
    if (value !== undefined) columns[key] = value.trim() || null;
  };
  const setJson = (key: string, value: unknown) => {
    if (value !== undefined) columns[key] = value as Prisma.InputJsonValue;
  };
  const setIfDefined = (key: string, value: unknown) => {
    if (value !== undefined) columns[key] = value;
  };

  setIfDefined("reference", input.reference);
  setText("fullName", input.fullName);
  setIfDefined("nationality", input.nationality);
  setText("placeOfBirth", input.placeOfBirth);
  setText("religion", input.religion);
  setText("maritalStatus", input.maritalStatus);
  setText("homeAddress", input.homeAddress);
  setText("airportRepatriation", input.airportRepatriation);
  setText("educationLevel", input.educationLevel);
  setIfDefined("placementType", input.placementType);
  setText("availableFrom", input.availableFrom);
  setText("availability", input.availability);
  setText("contractEnds", input.contractEnds);
  setText("foodHandlingPreferences", input.foodHandlingPreferences);
  setText("dietaryRestrictions", input.dietaryRestrictions);
  setText("introduction", input.introduction);
  setText("notes", input.notes);
  setText("photoUrl", input.photoUrl);
  setText("videoUrl", input.videoUrl);

  setIfDefined("heightCm", input.heightCm);
  setIfDefined("weightKg", input.weightKg);
  setIfDefined("childrenCount", input.childrenCount);
  setIfDefined("siblingsCount", input.siblingsCount);
  setIfDefined("experienceYears", input.experienceYears);
  setIfDefined("monthlySalary", input.monthlySalary);
  setIfDefined("expectedSalary", input.expectedSalary);
  setIfDefined("presentSalary", input.presentSalary);
  setIfDefined("offDaysPerMonth", input.offDaysPerMonth);
  setIfDefined("status", input.status);
  setIfDefined("published", input.published);
  setIfDefined("languages", input.languages);
  setIfDefined("duties", input.duties);
  setIfDefined("photoUrls", input.photoUrls);
  setIfDefined("photoThumbnailUrls", input.photoThumbnailUrls);
  setIfDefined("photoPortraitUrls", input.photoPortraitUrls);

  setJson("languageSkills", input.languageSkills);
  setJson("preferences", input.preferences);
  setJson("workAreas", input.workAreas);
  setJson("employmentHistory", input.employmentHistory);
  setJson("medicalInfo", input.medicalInfo);
  setJson("agencyContact", input.agencyContact);

  // A birth date is the source of truth for age; fall back to the manual field.
  if (input.dateOfBirth !== undefined) {
    columns.dateOfBirth = input.dateOfBirth;
    const derived = ageFromDateOfBirth(input.dateOfBirth);
    if (derived !== null) columns.age = derived;
  } else if (input.age !== undefined) {
    columns.age = input.age;
  }

  // The first gallery photo doubles as the card thumbnail.
  if (
    input.photoUrl !== undefined &&
    !input.photoUrl.trim() &&
    input.photoUrls &&
    input.photoUrls.length > 0
  ) {
    columns.photoUrl = input.photoUrls[0];
  }

  return columns as Prisma.MaidUncheckedUpdateInput;
}
