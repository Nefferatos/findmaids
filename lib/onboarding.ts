import { z } from "zod";

export const onboardingDraftSchema = z.object({
  name: z.string().trim().max(160).optional(),
  slug: z.string().trim().max(120).optional(),
  description: z.string().trim().max(5000).optional(),
  yearEstablished: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce
      .number()
      .int()
      .min(1800)
      .max(new Date().getUTCFullYear())
      .nullable()
      .optional(),
  ),
  licenseNumber: z.string().trim().max(160).optional(),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(120).optional(),
  province: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  whatsapp: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(254).optional().or(z.literal("")),
  website: z.string().trim().max(255).optional(),
  facebook: z.string().trim().max(255).optional(),
  services: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  nationalitiesServed: z
    .array(z.string().trim().min(1).max(80))
    .max(20)
    .optional(),
  languages: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  logoUrl: z.string().startsWith("/uploads/").max(300).optional(),
  bannerUrl: z.string().startsWith("/uploads/").max(300).optional(),
  photos: z
    .array(
      z.object({
        url: z.string().startsWith("/uploads/").max(300),
        caption: z.string().max(160).optional(),
      }),
    )
    .max(25)
    .optional(),
});

export const onboardingSubmissionSchema = onboardingDraftSchema.extend({
  name: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(50).max(5000),
  address: z.string().trim().min(3).max(300),
  city: z.string().trim().min(2).max(120),
  province: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(40),
  email: z.string().trim().email().max(254),
  services: z.array(z.string()).min(1).max(20),
  nationalitiesServed: z.array(z.string()).min(1).max(20),
  languages: z.array(z.string()).min(1).max(20),
});

export function createSlug(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}
