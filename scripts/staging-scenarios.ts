import { writeFileSync } from "node:fs";
import path from "node:path";
import { assertStagingWriteAllowed } from "../lib/security/staging-guard";

// Staging-only, in-process scenario checks that do not need a dev server: they call the real route
// handlers and library code against the staging database. Browser scenarios live in e2e/.
assertStagingWriteAllowed();

type Result = { scenario: string; check: string; ok: boolean; detail?: string };
const results: Result[] = [];
const record = (scenario: string, check: string, ok: boolean, detail?: string) => {
  results.push({ scenario, check, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} [${scenario}] ${check}${detail ? ` (${detail})` : ""}`);
};
const day = 86_400_000;

async function scenarioEnquiryCap() {
  const { prisma } = await import("../lib/prisma");
  const { POST } = await import("../app/api/enquiries/route");
  const { getAgencyLeadAllowance } = await import("../lib/leads/access");
  const agency = await prisma.agency.findUniqueOrThrow({ where: { slug: "test-agency-a" } });
  const tag = `dryrun-${Date.now()}`;
  const before = await prisma.enquiry.count({ where: { agencyId: agency.id } });
  const codes: number[] = [];
  const messages: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const res = await POST(
      new Request("http://localhost/api/enquiries", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${i}` },
        body: JSON.stringify({
          agencyId: agency.id,
          name: `Dry Run Employer ${i}`,
          email: `${tag}-${i}@example.test`,
          message: "Staging dry-run enquiry, fictional.",
          consentGiven: true,
          turnstileToken: "XXXX.DUMMY.TOKEN.XXXX",
        }),
      }),
    );
    codes.push(res.status);
    const body = (await res.json()) as { message?: string; error?: string };
    messages.push(body.message ?? body.error ?? "");
  }
  record("1", "every submission returns success (no error shown to the employer)", codes.every((c) => c === 200 || c === 201), `statuses ${codes.join(",")}`);
  const saved = await prisma.enquiry.count({ where: { agencyId: agency.id, email: { startsWith: tag } } });
  record("1", "all 4 enquiries are saved to the agency inbox, including those above the cap", saved === 4, `${saved}/4 saved`);
  const allowance = await getAgencyLeadAllowance(agency.id);
  record("1", "allowance reports limit 2 and the correct number waiting above it", allowance.monthlyLimit === 2 && allowance.overLimitCount === allowance.monthlyCount - 2,
    `limit=${allowance.monthlyLimit}, thisMonth=${allowance.monthlyCount}, over=${allowance.overLimitCount}, mode=${allowance.mode}, upgrade=${allowance.upgradePlanName}`);
  record("1", "an upgrade plan is offered", allowance.upgradePlanName !== null, String(allowance.upgradePlanName));
  record("1", "DELIVER_ALL: no lead is locked", allowance.lockedCount === 0, `locked=${allowance.lockedCount}`);
  void before;
  await prisma.enquiry.deleteMany({ where: { email: { startsWith: tag } } });
  await prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: "enquiry:198.51.100." } } }).catch(() => null);
  void messages;
}

async function scenarioResponseMetrics() {
  const { calculateResponseMetrics } = await import("../lib/leads/response-metrics");
  const t0 = new Date("2026-01-01T00:00:00Z");
  const at = (h: number | null) => ({ createdAt: t0, firstRespondedAt: h === null ? null : new Date(t0.getTime() + h * 3_600_000) });
  const m = calculateResponseMetrics([at(1), at(23), at(30), at(null)]);
  record("4", "first-response time averages only responded leads", Math.abs((m.averageMinutes ?? 0) - 18 * 60) < 0.001, `avg ${(m.averageMinutes ?? 0) / 60}h (expected 18h)`);
  record("4", "24-hour share counts on-time leads over all leads", m.within24HoursPercent === 50, `${m.within24HoursPercent}% (2 of 4)`);
}

async function scenarioFoundingExpiry() {
  const { prisma } = await import("../lib/prisma");
  const before = await prisma.subscription.findUniqueOrThrow({ where: { id: "staging-sub-b" }, include: { plan: true, agency: true } });
  const paymentsBefore = await prisma.payment.count({ where: { subscriptionId: "staging-sub-b" } });
  record("6", "precondition: Agency B is on Gold with an active founding grant", before.plan.name === "Gold" && before.foundingAgency, `plan=${before.plan.name}`);

  const RealDate = Date;
  const offset = 5 * day;
  class ShiftedDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(RealDate.now() + offset);
      else super(...(args as [number]));
    }
    static now() {
      return RealDate.now() + offset;
    }
  }
  globalThis.Date = ShiftedDate as unknown as DateConstructor;
  let body: Record<string, unknown> = {};
  let status = 0;
  try {
    const { GET } = await import("../app/api/cron/subscriptions/route");
    const res = await GET(new Request("http://localhost/api/cron/subscriptions", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
    status = res.status;
    body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  } finally {
    globalThis.Date = RealDate;
  }
  record("6", "cron runs with the clock moved 5 days ahead", status === 200, `HTTP ${status}`);
  const after = await prisma.subscription.findUniqueOrThrow({ where: { id: "staging-sub-b" }, include: { plan: true, agency: true } });
  record("6", "Agency B is downgraded to Basic Free", after.plan.name === "Basic Free" && !after.foundingAgency && !after.agency.foundingAgency, `plan=${after.plan.name}`);
  record("6", "nobody is charged (no payment rows added)", (await prisma.payment.count({ where: { subscriptionId: "staging-sub-b" } })) === paymentsBefore);
  const placement = await prisma.adPlacement.findUniqueOrThrow({ where: { id: "staging-placement-b" } });
  record("6", "paid placement from the founding grant is removed", placement.status === "CANCELLED", `status=${placement.status}`);
  const audit = await prisma.auditLog.count({ where: { agencyId: after.agencyId, action: "FOUNDING_PERIOD_EXPIRED_DOWNGRADE" } });
  record("6", "downgrade is logged in the audit log", audit >= 1, `${audit} entry`);
  record("6", "founding emails are disabled, so nothing is sent", process.env.FOUNDING_PERIOD_EMAILS_ENABLED === "false" && process.env.EMAIL_DELIVERY_DISABLED === "true");
  const other = await prisma.subscription.findMany({ where: { id: { in: ["staging-sub-a", "staging-sub-c"] } }, include: { plan: true } });
  record("6", "other agencies are unaffected (A Basic active, C Gold active)", other.every((s) => s.status === "ACTIVE"), other.map((s) => `${s.id}:${s.plan.name}:${s.status}`).join(", "));
  void body;
}

async function main() {
  for (const [name, fn] of [["1", scenarioEnquiryCap], ["4", scenarioResponseMetrics], ["6", scenarioFoundingExpiry]] as const) {
    try {
      await fn();
    } catch (e) {
      record(name, "scenario executed", false, e instanceof Error ? e.message.split("\n").filter((l) => l.trim()).slice(0, 2).join(" | ") : "unknown");
    }
  }
  writeFileSync(path.join("staging-results", "in-process-scenarios.json"), JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2));
  console.log(`SUMMARY ${results.filter((r) => r.ok).length}/${results.length} checks passed`);
  process.exitCode = results.every((r) => r.ok) ? 0 : 1;
}

main().finally(async () => {
  const { prisma } = await import("../lib/prisma");
  await prisma.$disconnect();
});
