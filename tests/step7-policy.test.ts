import { afterEach, describe, expect, it } from "vitest";
import { classifyAcquisitionSource, boundedAcquisitionSource } from "@/lib/attribution";
import { getLeadCapMode, isLeadDetailsLocked, countLockedLeads } from "@/lib/leads/cap";
import { calculateResponseMetrics } from "@/lib/leads/response-metrics";
import { canPerformProspectOutreach, prospectStages } from "@/lib/leads/prospect-policy";
import { defaultFoundingPeriodDays, foundingPeriodExpired, foundingReminderType, foundingReminderWindow } from "@/lib/leads/founding-period";
import { shouldSetFirstRespondedAt } from "@/lib/leads/response-action";

const originalLeadCapMode = process.env.LEAD_CAP_MODE;
afterEach(() => {
  if (originalLeadCapMode === undefined) delete process.env.LEAD_CAP_MODE;
  else process.env.LEAD_CAP_MODE = originalLeadCapMode;
});

describe("Step 7 product policies", () => {
  it("defaults to deliver-all and only locks excess details in LOCK_DETAILS mode", () => {
    delete process.env.LEAD_CAP_MODE;
    expect(getLeadCapMode()).toBe("DELIVER_ALL");
    expect(isLeadDetailsLocked({ mode: getLeadCapMode(), monthlyLimit: 2, chronologicalPosition: 3 })).toBe(false);
    expect(isLeadDetailsLocked({ mode: "LOCK_DETAILS", monthlyLimit: 2, chronologicalPosition: 3 })).toBe(true);
    expect(countLockedLeads("LOCK_DETAILS", 2, 5)).toBe(3);
    expect(countLockedLeads("DELIVER_ALL", 2, 5)).toBe(0);
  });

  it("calculates first response average and 24-hour share", () => {
    const created = new Date("2026-10-01T00:00:00Z");
    const metrics = calculateResponseMetrics([
      { createdAt: created, firstRespondedAt: new Date(created.getTime() + 60 * 60_000) },
      { createdAt: created, firstRespondedAt: new Date(created.getTime() + 30 * 60 * 60_000) },
      { createdAt: created, firstRespondedAt: null },
    ]);
    expect(metrics).toMatchObject({ total: 3, responded: 2, averageMinutes: 930 });
    expect(metrics.within24HoursPercent).toBeCloseTo(100 / 3, 10);
  });

  it("records first response on first status change or added note, but not no-op edits", () => {
    expect(shouldSetFirstRespondedAt({ previousStatus: "NEW", nextStatus: "CONTACTED", previousNotes: null })).toBe(true);
    expect(shouldSetFirstRespondedAt({ previousStatus: "NEW", previousNotes: null, nextNotes: "Called agency contact" })).toBe(true);
    expect(shouldSetFirstRespondedAt({ previousStatus: "CONTACTED", nextStatus: "CLOSED", previousNotes: null })).toBe(false);
    expect(shouldSetFirstRespondedAt({ previousStatus: "NEW", nextStatus: "NEW", previousNotes: "same", nextNotes: "same" })).toBe(false);
  });

  it("classifies acquisition source without accepting contact data", () => {
    expect(classifyAcquisitionSource({ utmSource: "facebook" })).toBe("FACEBOOK");
    expect(classifyAcquisitionSource({ referrer: "https://www.google.com/search?q=maid" })).toBe("GOOGLE");
    expect(classifyAcquisitionSource({})).toBe("DIRECT");
    expect(boundedAcquisitionSource({ email: "person@example.test", anonymousVisitorId: "bad" })).toBeNull();
  });

  it("prevents outreach at suppressed prospect stages", () => {
    expect(prospectStages).toContain("DO_NOT_CONTACT");
    expect(canPerformProspectOutreach("DO_NOT_CONTACT")).toBe(false);
    expect(canPerformProspectOutreach("DECLINED")).toBe(false);
    expect(canPerformProspectOutreach("INTERESTED")).toBe(true);
  });

  it("uses a 90-day founding default and deterministic reminder windows", () => {
    const now = new Date("2026-10-24T12:00:00Z");
    expect(defaultFoundingPeriodDays).toBe(90);
    expect(foundingReminderType(14, new Date("2027-01-22T12:00:00Z"))).toBe("FOUNDING_END_14D_2027-01-22");
    expect(foundingReminderWindow(3, now).end.getTime() - foundingReminderWindow(3, now).start.getTime()).toBe(86_400_000);
    expect(foundingPeriodExpired(new Date("2026-10-24T11:59:00Z"), now)).toBe(true);
    expect(foundingPeriodExpired(new Date("2026-10-25T00:00:00Z"), now)).toBe(false);
  });
});
