import { FeatureFlagScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function isFeatureEnabled(
  key: string,
  agencyId?: string,
): Promise<boolean> {
  if (agencyId) {
    const agencyFlag = await prisma.featureFlag.findFirst({
      where: { key, scope: FeatureFlagScope.AGENCY, agencyId },
      select: { enabled: true },
    });
    if (agencyFlag) return agencyFlag.enabled;
  }

  const settings = prisma.adminSetting
    ? await prisma.adminSetting.findUnique({
        where: { key: "featureFlags" },
        select: { value: true },
      })
    : null;
  const configured = settings?.value;
  if (
    configured &&
    typeof configured === "object" &&
    !Array.isArray(configured)
  ) {
    const values = configured as Record<string, unknown>;
    if (typeof values[key] === "boolean") return values[key] as boolean;
  }

  const globalFlag = await prisma.featureFlag.findFirst({
    where: { key, scope: FeatureFlagScope.GLOBAL },
    select: { enabled: true },
  });
  return globalFlag?.enabled ?? false;
}
