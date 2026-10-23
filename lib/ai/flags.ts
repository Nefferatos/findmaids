import { FeatureFlagScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AdminSettingReader = {
  findUnique: typeof prisma.adminSetting.findUnique;
};

export async function isFeatureEnabled(
  key: string,
  agencyId?: string,
): Promise<boolean> {
  const adminSettings = (
    prisma as unknown as { adminSetting?: AdminSettingReader }
  ).adminSetting;
  const control = adminSettings
    ? await adminSettings
        .findUnique({ where: { key: "aiControl" }, select: { value: true } })
        .catch(() => null)
    : null;
  const controlValue = control?.value;
  if (
    controlValue &&
    typeof controlValue === "object" &&
    !Array.isArray(controlValue) &&
    (controlValue as Record<string, unknown>).killSwitch === true
  )
    return false;

  if (agencyId) {
    const agencyFlag = await prisma.featureFlag.findFirst({
      where: { key, scope: FeatureFlagScope.AGENCY, agencyId },
      select: { enabled: true },
    });
    if (agencyFlag) return agencyFlag.enabled;
  }

  const setting = adminSettings
    ? await adminSettings
        .findUnique({ where: { key: "featureFlags" }, select: { value: true } })
        .catch(() => null)
    : null;
  const configured = setting?.value;
  if (
    configured &&
    typeof configured === "object" &&
    !Array.isArray(configured)
  ) {
    const flags = configured as Record<string, unknown>;
    if (typeof flags[key] === "boolean") return flags[key] as boolean;
  }

  const globalFlag = await prisma.featureFlag.findFirst({
    where: { key, scope: FeatureFlagScope.GLOBAL },
    select: { enabled: true },
  });
  return globalFlag?.enabled ?? false;
}
