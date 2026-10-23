import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, findFirst } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminSetting: { findUnique },
    featureFlag: { findFirst },
  },
}));

import { isFeatureEnabled } from "@/lib/ai/flags";

describe("AI global kill switch", () => {
  beforeEach(() => {
    findUnique.mockReset();
    findFirst.mockReset();
  });

  it("blocks all feature flags before agency or global lookup", async () => {
    findUnique.mockResolvedValueOnce({ value: { killSwitch: true } });
    await expect(isFeatureEnabled("employer_assistant", "agency-1")).resolves.toBe(false);
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("does not block enabled features when the kill switch is off", async () => {
    findUnique
      .mockResolvedValueOnce({ value: { killSwitch: false } })
      .mockResolvedValueOnce({ value: {} });
    findFirst.mockResolvedValueOnce({ enabled: true });
    await expect(isFeatureEnabled("employer_assistant")).resolves.toBe(true);
    expect(findFirst).toHaveBeenCalledTimes(1);
  });
});
