import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAgency: vi.fn(),
  findSubscription: vi.fn(),
  findBasicPlan: vi.fn(),
  countEnquiries: vi.fn(),
  createEnquiry: vi.fn(),
  sendEmail: vi.fn(),
  enqueueJob: vi.fn(),
  summarizeLead: vi.fn(),
  sendOutbound: vi.fn(),
  hasBlockedPattern: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {
  agency: { findFirst: mocks.findAgency },
  subscription: { findFirst: mocks.findSubscription },
  plan: { findUnique: mocks.findBasicPlan },
  enquiry: { count: mocks.countEnquiries, create: mocks.createEnquiry },
} }));
vi.mock("@/lib/email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/lib/jobs/queue", () => ({ enqueueJob: mocks.enqueueJob }));
vi.mock("@/lib/jobs/lead-summary", () => ({ summarizeLead: mocks.summarizeLead }));
vi.mock("@/lib/jobs/outbound", () => ({ sendOutboundLeadEvent: mocks.sendOutbound }));
vi.mock("@/lib/moderation", () => ({ hasBlockedPattern: mocks.hasBlockedPattern }));
vi.mock("@/lib/attribution-consent", () => ({ getConsentedAcquisitionSource: vi.fn().mockResolvedValue(null) }));

import { createEnquiry } from "@/lib/ai/tools/create-enquiry";

describe("above-cap lead delivery", () => {
  const originalMode = process.env.LEAD_CAP_MODE;
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findAgency.mockResolvedValue({ id: "agency-a", name: "Agency A", email: "agency-a@example.test" });
    mocks.findSubscription.mockResolvedValue({ plan: { leadLimit: 2 } });
    mocks.findBasicPlan.mockResolvedValue({ leadLimit: 2 });
    mocks.countEnquiries.mockResolvedValue(2);
    mocks.createEnquiry.mockResolvedValue({ id: "enquiry-new" });
    mocks.sendEmail.mockResolvedValue(undefined);
    mocks.enqueueJob.mockResolvedValue(false);
    mocks.summarizeLead.mockResolvedValue(null);
    mocks.sendOutbound.mockResolvedValue(false);
    mocks.hasBlockedPattern.mockResolvedValue(false);
  });
  afterEach(() => {
    if (originalMode === undefined) delete process.env.LEAD_CAP_MODE;
    else process.env.LEAD_CAP_MODE = originalMode;
  });

  it.each(["DELIVER_ALL", "LOCK_DETAILS"] as const)("saves, counts and notifies above-cap enquiries in %s mode", async (mode) => {
    process.env.LEAD_CAP_MODE = mode;
    await expect(createEnquiry({
      agencyId: "agency-a",
      name: "Employer",
      email: "employer@example.test",
      message: "Need a nanny in Makati.",
      consentGiven: true,
    })).resolves.toMatchObject({ accepted: true });
    expect(mocks.createEnquiry).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ agencyId: "agency-a", source: "CHAT" }) }));
    expect(mocks.sendEmail).toHaveBeenCalledWith("agency-a@example.test", expect.stringContaining("waiting"), expect.stringContaining(mode === "LOCK_DETAILS" ? "locked" : "remain available"));
    expect(mocks.countEnquiries).toHaveBeenCalledTimes(1);
  });
});
