import { z } from "zod";

export const enquirySubmissionSchema = z.object({
  agencyId: z.string().min(1),
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
});

export const reviewSubmissionSchema = z.object({
  agencyId: z.string().min(1),
  authorName: z.string().trim().min(2).max(100),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(10).max(3000),
});
