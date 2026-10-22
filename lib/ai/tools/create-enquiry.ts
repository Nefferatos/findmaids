import { z } from "zod";

export const createEnquiryInput = z.object({
  agencyId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  email: z.string().email(),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(5).max(4000),
  consentGiven: z.literal(true),
});
export type CreateEnquiryInput = z.infer<typeof createEnquiryInput>;

export async function createEnquiry(input: CreateEnquiryInput) {
  const enquiry = createEnquiryInput.parse(input);
  return { accepted: true, reference: `mock-${Date.now()}`, enquiry };
}
