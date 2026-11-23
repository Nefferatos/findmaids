import type { AgencyMaid } from "@/lib/maid-profile";

/**
 * Shape of the Add/Edit maid form state.
 *
 * Shared by the client form and the document-import feature so extracted
 * values can be typed against the exact fields the form edits. Numbers are
 * kept as strings because they bind directly to `<input>` elements.
 */

export type WorkAreaDraft = {
  rating: string;
  note: string;
  willing: boolean;
  experience: boolean;
  years: string;
};

export type EmploymentDraft = {
  from: string;
  to: string;
  employer: string;
  country: string;
  duties: string;
  remarks: string;
};

export type MaidDraft = {
  reference: string;
  fullName: string;
  placementType: string;
  nationality: string;
  dateOfBirth: string;
  age: string;
  placeOfBirth: string;
  height: string;
  weight: string;
  religion: string;
  maritalStatus: string;
  children: string;
  siblings: string;
  homeAddress: string;
  airportRepatriation: string;
  educationLevel: string;
  languages: string;
  duties: string;
  experienceYears: string;
  monthlySalary: string;
  expectedSalary: string;
  presentSalary: string;
  status: AgencyMaid["status"];
  availableFrom: string;
  availability: string;
  contractEnds: string;
  offDaysPerMonth: string;
  foodHandlingPreferences: string;
  dietaryRestrictions: string;
  introduction: string;
  notes: string;
  videoUrl: string;
  photoUrl: string;
  photoUrls: string[];
  published: boolean;
  languageSkills: Record<string, string>;
  interviewOptions: string[];
  otherInformation: Record<string, boolean>;
  sgExperience: boolean;
  indianMaidCategory: string;
  referredBy: string;
  interviewedBy: string;
  privateInfo: string;
  availabilityRemark: string;
  workAreas: Record<string, WorkAreaDraft>;
  employment: EmploymentDraft[];
  pastIllnesses: Record<string, boolean>;
  otherIllnesses: string;
  allergies: string;
  physicalDisabilities: string;
  otherRemarks: string;
  agencyContact: {
    companyName: string;
    contactPerson: string;
    phone: string;
    licenseNo: string;
    homeCountryContactNumber: string;
  };
};

/**
 * Partial draft produced by document extraction. Nested records only contain
 * the keys that were actually found, so the form can merge them without
 * erasing values the admin already typed.
 */
export type MaidDraftPatch = Partial<MaidDraft>;

/** First usable photo URL from an imported patch (photo or photoUrls). */
export function importedPhotoUrl(patch: MaidDraftPatch): string {
  const candidates = [
    patch.photoUrl,
    ...(Array.isArray(patch.photoUrls) ? patch.photoUrls : []),
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const value = candidate.trim();
    if (value) return value.slice(0, 500);
  }
  return "";
}

/**
 * Photo values an import should apply: only when the form has no photo yet, so
 * an admin's manual upload is never replaced by a document image.
 */
export function importedPhotoPatch(
  current: Pick<MaidDraft, "photoUrl" | "photoUrls">,
  patch: MaidDraftPatch,
): Pick<MaidDraft, "photoUrl" | "photoUrls"> | null {
  const hasPhoto = current.photoUrls.length > 0 || current.photoUrl.trim();
  if (hasPhoto) return null;
  const url = importedPhotoUrl(patch);
  return url ? { photoUrl: url, photoUrls: [url] } : null;
}
