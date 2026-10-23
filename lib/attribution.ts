import { z } from "zod";

export const acquisitionSourceSchema = z.object({
  anonymousVisitorId: z.string().uuid().optional(),
  utmSource: z.string().trim().max(120).optional(),
  utmMedium: z.string().trim().max(120).optional(),
  utmCampaign: z.string().trim().max(160).optional(),
  referrer: z.string().url().max(500).optional(),
  sourceCategory: z.enum(["FACEBOOK", "GOOGLE", "DIRECT", "REFERRAL", "OTHER"]).optional(),
}).strict();

export type AcquisitionSource = z.infer<typeof acquisitionSourceSchema>;

export function classifyAcquisitionSource(source: AcquisitionSource): AcquisitionSource["sourceCategory"] {
  const origin = `${source.utmSource ?? ""} ${source.referrer ?? ""}`.toLowerCase();
  if (/facebook|fb\.com|instagram|meta/.test(origin)) return "FACEBOOK";
  if (/google|g\.co/.test(origin)) return "GOOGLE";
  if (!source.referrer && !source.utmSource) return "DIRECT";
  return source.referrer ? "REFERRAL" : "OTHER";
}

export function boundedAcquisitionSource(input: unknown) {
  const parsed = acquisitionSourceSchema.safeParse(input);
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    sourceCategory: parsed.data.sourceCategory ?? classifyAcquisitionSource(parsed.data),
  };
}
