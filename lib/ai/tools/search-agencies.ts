import { z } from "zod";

export const searchAgenciesInput = z.object({
  city: z.string().trim().min(1).optional(),
  services: z.array(z.string().trim().min(1)).max(10).default([]),
  limit: z.number().int().min(1).max(20).default(10),
});

export type SearchAgenciesInput = z.infer<typeof searchAgenciesInput>;

export async function searchAgencies(input: SearchAgenciesInput) {
  const query = searchAgenciesInput.parse(input);
  return { agencies: [], query, sponsoredListingsDisclosed: true };
}
