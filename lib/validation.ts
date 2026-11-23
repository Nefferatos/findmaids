import { z } from "zod";
import { acquisitionSourceSchema } from "@/lib/attribution";

export const enquirySubmissionSchema = z
  .object({
    agencyId: z.string().min(1).optional(),
    allAgencies: z.boolean().optional(),
    name: z.string().trim().min(2).max(100),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    phone: z.string().trim().max(40).optional().or(z.literal("")),
    message: z.string().trim().min(5).max(4000),
    consentGiven: z
      .union([z.literal(true), z.literal("on"), z.literal("true")])
      .transform(() => true),
    preferredStartDate: z
      .union([z.iso.date(), z.literal("")])
      .optional()
      .transform((value) => (value ? new Date(value) : null)),
    budget: z.preprocess(
      (value) => (value === undefined || value === "" ? null : Number(value)),
      z.number().finite().min(0).max(100_000_000).nullable(),
    ),
    website: z.string().max(0).optional(),
    turnstileToken: z.string().optional(),
    acquisitionSource: acquisitionSourceSchema.optional(),
  })
  .refine((value) => Boolean(value.agencyId) !== Boolean(value.allAgencies), {
    message: "Select one agency or all approved agencies.",
    path: ["agencyId"],
  });

export const reviewSubmissionSchema = z.object({
  agencyId: z.string().min(1),
  authorName: z.string().trim().min(2).max(100),
  reviewerEmail: z
    .string()
    .trim()
    .email()
    .max(254)
    .optional()
    .or(z.literal("")),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(10).max(3000),
});

/** Media URL rules shared by the agency profile and maid photo uploads. */
export function isAllowedMediaUrl(value: string) {
  if (value.startsWith("/uploads/") && !value.includes("..")) return true;
  try {
    const url = new URL(value);
    const storageUrl = process.env.SUPABASE_URL;
    return Boolean(
      storageUrl &&
      url.protocol === "https:" &&
      url.origin === new URL(storageUrl).origin &&
      url.pathname.includes("/storage/v1/object/public/"),
    );
  } catch {
    return false;
  }
}

export const maidStatusValues = ["AVAILABLE", "ON_HOLD", "PLACED"] as const;

const optionalCount = (min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).nullable().optional();

/** Optional free-text column from the CSV (empty string means "not set"). */
const optionalText = (max: number) => z.string().trim().max(max).optional();

const mediaUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => isAllowedMediaUrl(value), {
    message: "Upload the photo through the dashboard.",
  });

const mediaUrlList = z.array(mediaUrlSchema).max(8).optional();

/** `{ "Cooking": { rating, note, ... } }` — CSV `work_areas`. */
const workAreasSchema = z.record(
  z.string().trim().max(80),
  z.object({
    rating: z.coerce.number().int().min(0).max(5).nullable().optional(),
    note: z.string().trim().max(400).optional(),
    willing: z.boolean().optional(),
    experience: z.boolean().optional(),
    yearsOfExperience: z.string().trim().max(20).optional(),
  }),
);

/** CSV `skills_preferences` (extra info, interview options, private notes). */
const maidPreferencesSchema = z.object({
  sgExperience: z.boolean().optional(),
  offDaysPerMonth: z.string().trim().max(10).optional(),
  indianMaidCategory: z.string().trim().max(60).optional(),
  referredBy: z.string().trim().max(120).optional(),
  interviewedBy: z.string().trim().max(120).optional(),
  privateInfo: z.string().trim().max(4000).optional(),
  availabilityRemark: z.string().trim().max(400).optional(),
  availabilityInterviewOptions: z
    .array(z.string().trim().max(80))
    .max(6)
    .optional(),
  otherInformation: z.record(z.string().trim().max(80), z.boolean()).optional(),
  workAreaNotes: z
    .record(z.string().trim().max(80), z.string().max(400))
    .optional(),
});

/** CSV `employment_history` rows. */
const maidEmploymentSchema = z.object({
  from: z.string().trim().max(20).optional(),
  to: z.string().trim().max(20).optional(),
  employer: z.string().trim().max(120).optional(),
  country: z.string().trim().max(80).optional(),
  duties: z.string().trim().max(1000).optional(),
  remarks: z.string().trim().max(400).optional(),
});

/** CSV `introduction.pastIllnesses` + medical remarks. */
const maidMedicalSchema = z.object({
  pastIllnesses: z.record(z.string().trim().max(80), z.boolean()).optional(),
  otherIllnesses: z.string().trim().max(400).optional(),
  allergies: z.string().trim().max(400).optional(),
  physicalDisabilities: z.string().trim().max(400).optional(),
  otherRemarks: z.string().trim().max(2000).optional(),
});

/** CSV `agency_contact`. */
const maidAgencyContactSchema = z.object({
  companyName: z.string().trim().max(160).optional(),
  contactPerson: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  licenseNo: z.string().trim().max(60).optional(),
  homeCountryContactNumber: z.string().trim().max(40).optional(),
});

const maidFields = {
  reference: z.string().trim().min(1).max(40),
  fullName: optionalText(120),
  nationality: z.string().trim().min(2).max(60),
  age: optionalCount(18, 70),
  dateOfBirth: z
    .union([z.iso.date(), z.literal("")])
    .optional()
    .transform((value) => (value ? new Date(`${value}T00:00:00.000Z`) : null)),
  placeOfBirth: optionalText(120),
  heightCm: optionalCount(0, 300),
  weightKg: optionalCount(0, 300),
  religion: optionalText(40),
  maritalStatus: optionalText(40),
  childrenCount: optionalCount(0, 30),
  siblingsCount: optionalCount(0, 30),
  homeAddress: optionalText(400),
  airportRepatriation: optionalText(120),
  educationLevel: optionalText(80),
  languages: z
    .array(z.string().trim().min(1).max(40))
    .min(1)
    .max(12)
    .optional(),
  placementType: z.string().trim().min(2).max(80),
  experienceYears: optionalCount(0, 50),
  duties: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  monthlySalary: optionalCount(0, 100_000),
  expectedSalary: optionalCount(0, 100_000),
  presentSalary: optionalCount(0, 100_000),
  status: z.enum(maidStatusValues).optional(),
  availableFrom: optionalText(60),
  availability: optionalText(120),
  contractEnds: optionalText(40),
  offDaysPerMonth: optionalCount(0, 31),
  foodHandlingPreferences: optionalText(120),
  dietaryRestrictions: optionalText(120),
  introduction: optionalText(8000),
  languageSkills: z
    .record(z.string().trim().max(60), z.string().max(20))
    .optional(),
  preferences: maidPreferencesSchema.optional(),
  workAreas: workAreasSchema.optional(),
  employmentHistory: z.array(maidEmploymentSchema).max(30).optional(),
  medicalInfo: maidMedicalSchema.optional(),
  agencyContact: maidAgencyContactSchema.optional(),
  photoUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => value === "" || isAllowedMediaUrl(value), {
      message: "Upload the photo through the dashboard.",
    })
    .optional(),
  photoUrls: mediaUrlList,
  photoThumbnailUrls: mediaUrlList,
  photoPortraitUrls: mediaUrlList,
  videoUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => value === "" || isAllowedMediaUrl(value), {
      message: "Upload the video through the dashboard.",
    })
    .optional(),
  notes: optionalText(2000),
  published: z.boolean().optional(),
};

/** Payload an agency sends to add a maid profile. */
export const maidCreateSchema = z.object(maidFields);

/** Payload an agency sends to change one of its maid profiles. */
export const maidUpdateSchema = z
  .object(maidFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });
