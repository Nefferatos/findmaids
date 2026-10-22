import { z } from "zod";

export const getAgencyDetailsInput = z.object({ slug: z.string().trim().min(1).max(120) });
export type GetAgencyDetailsInput = z.infer<typeof getAgencyDetailsInput>;

export async function getAgencyDetails(input: GetAgencyDetailsInput) {
  const query = getAgencyDetailsInput.parse(input);
  return { agency: null, query };
}