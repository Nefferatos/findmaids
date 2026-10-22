import { FeatureFlagScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function isFeatureEnabled(key: string, agencyId?: string): Promise<boolean> {
  if (agencyId) {
    const agencyFlag = await prisma.featureFlag.findFirst({
      where: { key, scope: FeatureFlagScope.AGENCY, agencyId },
      select: { enabled: true },
    });
    if (agencyFlag) return agencyFlag.enabled;
  }

  const globalFlag = await prisma.featureFlag.findFirst({
    where: { key, scope: FeatureFlagScope.GLOBAL },
    select: { enabled: true },
  });
  return globalFlag?.enabled ?? false;
}