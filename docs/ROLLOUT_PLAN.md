# Soft Launch Rollout Plan

For agency acquisition, lead validation, pricing hypotheses, outreach safeguards, and metric definitions, see [GO_TO_MARKET_PLAN.md](GO_TO_MARKET_PLAN.md).

Dates are relative to the actual production readiness sign-off; no calendar date is committed while legal, host, DNS, payment, backup and live test gates are incomplete.

## T-14 to T-7: staging sign-off

- Complete every blocking item in `LAUNCH_CHECKLIST.md`.
- Use a separate staging DB and provider test credentials; complete migration, restore, webhook replay, accessibility, Lighthouse and load test evidence.
- Invite 3-5 friendly agencies for staging onboarding and moderated feedback. Do not expose real enquiries or payment details.
- Keep AI, WhatsApp and inbound automation flags OFF; confirm kill switch and support escalation.

## T-3 to T-1: production preparation

- Confirm approved legal text, DPO/NPC details, DNS/TLS, SPF/DKIM/DMARC, backups, alerts, support coverage and incident contacts.
- Deploy app and additive migrations in the chosen maintenance window; run read-only smoke tests and verify `/api/health`.
- Create verified ADMIN through the secure procedure, enroll TOTP, configure real plans/FAQs, and remove test data.
- Invite the agency cohort with clear support channel and no paid obligations during the initial observation window.

## Day 0: public directory soft launch

- Open public browsing and approved agency profiles. Keep checkout gated until the PayMongo live-mode checklist and real small payment/refund test are signed off.
- Monitor uptime, 5xx rate, DB pool, page latency, enquiries, complaints, and support response time.
- Revert/disable exposure if material errors, privacy incidents, or inaccurate listings occur.

## Week 1: gradual exposure

- Days 1-2: public site and agency profile updates only; daily review of errors, performance and support.
- Days 3-4: enable paid plan checkout only after payment and refund checks pass; reconcile every initial payment manually.
- Days 5-7: consider AI chat only after provider/privacy/eval sign-off, low traffic feature flag, cost cap, and named human support coverage. Keep agency reply drafts disabled until agency training and quality review. Draft mode remains owner-approved only.
- WhatsApp/email inbound stays OFF until vendor account, signatures, replay protection, opt-in, approved templates and support path are verified.

## Success metrics and stop conditions

- Availability >= 99.5% during pilot; p95 public page response < 2s and API p95 < 1s at agreed pilot load (targets to be adjusted after baseline).
- Zero unauthorized tenant access, unapproved automated sends, critical security incidents, or unreconciled payment anomalies.
- > = 3 active friendly agencies; onboarding completion, verified profile completeness, qualified enquiry response time, and complaint/refund rate recorded daily.
- Stop rollout for data exposure, payment mismatch, repeated 5xx, failed backup/restore confidence, unsafe AI response, or unresolved high/critical dependency issue. Follow `RUNBOOK.md`.

## Proposed calendar

Tentative 2026 dates, conditional on all legal, hosting, DNS, payment, backup, and security gates being signed off:

- Oct 26-Nov 6: staging hardening, legal/vendor configuration, load and restore drills.
- Nov 9-13: invite 3-5 friendly agencies; public directory only, daily monitoring.
- Nov 16-20: paid plans only after live payment/refund sign-off; reconcile initial payments manually.
- Nov 23-27: consider low-volume AI chat only after privacy/provider approval; keep agency drafts and WhatsApp disabled until separate review.
- Nov 30-Dec 4: week-one monitoring window for the cohort if rollout slips; no automatic sending at any point.

These are planning dates, not authorization to deploy. Re-baseline with the owner once hosting and legal decisions are made.
