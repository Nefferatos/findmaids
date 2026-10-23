# FindMaids Go-To-Market Plan

**Purpose:** Validate whether FindMaids can deliver measurable enquiries to independent agencies, then test willingness to pay for visibility and operational tools. This is a working plan, not a market study. All counts, prices, dates and conversion goals below are hypotheses to validate with Uncle Ricky and agencies.

## Guardrails

- Build supply, prove employer demand and agency outcomes, then sell paid placement.
- Never invent or imply traffic, lead volume, licensing status, endorsements, guarantees, or testimonials.
- Do not scrape another directory or copy content. Use agency-submitted material or their own public pages, record the source, get permission where needed, and let the agency review/claim its profile.
- “Verified” is earned through a documented manual license review. Payment must never buy a verification badge or suppress complaints/reviews.
- Founding feedback/testimonials are optional. Ask for honest feedback; do not require a positive testimonial in exchange for a free period. Obtain permission before publishing any quote.
- Keep paid checkout off until production readiness, payment tests, and terms/refund policy are approved. Keep AI and WhatsApp off until separately configured and approved. AI reply mode remains human-approved DRAFT only; no auto-send.
- Do not promise agencies a guaranteed lead count, placement, response time, or recruitment outcome.

## Decisions to Validate With Uncle Ricky

Resolve these before public acquisition or paid sales:

1. Is the directory for local placement, overseas placement, or both? Which agency/license categories can be listed, and which government registries or qualified reviewers verify each category?
2. Who owns agency acquisition, profile review, sales, support, complaints, and privacy requests? What service hours and response targets can the team actually meet?
3. What is the approved refund/credit policy when an agency receives no leads or materially fewer leads than expected?
4. Is revenue limited to subscription/ad fees, or could commission ever be considered? Keep commission out of public claims until legally and operationally decided.
5. Who is accountable for license verification, renewal checks, takedowns, and agency disputes?
6. Confirm over-cap handling before enabling `LEAD_CAP_MODE=LOCK_DETAILS`. Default is `DELIVER_ALL`; valid enquiries are saved and agencies notified above cap. In lock mode, only over-allowance lead details are hidden from the owning agency until upgrade. The current count uses all stored enquiries in the UTC calendar month. Confirm the cap basis, upgrade entitlements, disclosure wording and legal review before enabling.
7. Confirm the 3-month founding offer, eligibility, start/end dates, testimonial language/permission, paid-plan trial, and treatment of existing subscriptions.
8. Approve final plan names, feature entitlements, price points, tax display, yearly discount, cancellation and refund terms after interviews.
9. Decide whether the AI chat is enabled for the public soft launch. It currently requires explicit feature flags/provider configuration; the mock provider is not a production matching service.

Record decisions, owner, date, and evidence in a meeting note before changing production plans or legal text.

## Phase A: Seed the Directory (Weeks 1-3)

### Research and qualification

- Build an initial prospect list of 50-100 licensed agencies, starting in Metro Manila, then Cebu and Davao, subject to team capacity.
- Sources may include public government registries, agency-owned websites and agency-owned social pages. Do not crawl or copy a competing directory. Save source URL/date and the agency's own public contact route.
- Verify license status using the appropriate official source for the agreed placement category. Record reviewer, registry/source, date checked, result, expiry/renewal date if available, and evidence reference. Escalate ambiguous records; do not mark them Verified.
- Contact agencies using their published business contact channel. Identify the sender and purpose; honor opt-outs and platform/group rules. Avoid unsolicited bulk messaging.

### Founding Agency offer

Proposed test offer: a free listing for three months in exchange for profile feedback and an optional, honest testimonial. Make the optional nature of testimonials clear. No positive statement is required, and no quote is published without separate permission. Define the offer in writing before outreach.

Support self-service claim/edit where available; otherwise draft a profile from agency-supplied facts, send it for review, and obtain written approval before publication. Do not publish unconfirmed claims, copied marketing text, private contact data, or unlicensed media.

**Hypothesis target:** 20-30 approved, complete profiles before public launch. Treat this as a capacity and quality goal, not permission to lower verification standards. If the team cannot verify the number, reduce the target or extend the phase.

### Suggested prospect stages

Use a restricted-access spreadsheet initially; do not imply the admin panel is a sales CRM.

| Agency | City | Placement category | Contact/source | License check owner/date | Stage | Last touch | Next action/date | Opt-out | Notes |
| ------ | ---- | ------------------ | -------------- | ------------------------ | ----- | ---------- | ---------------- | ------- | ----- |

Stages: identified, qualified, contacted, replied, profile drafted, profile approved, published, pilot feedback, paid discussion, paying, declined, do-not-contact. Store only necessary business contact information, limit access, and define a deletion/review date.

## Phase B: Bring Employers (Weeks 2-8)

### Channels

- Publish practical SEO content: choosing an agency, questions to ask, cost/process explainers, FAQs, and location pages. Use original editorial content and agency-confirmed facts. Do not imply legal/immigration advice or guarantee fees/outcomes.
- Participate in relevant Facebook groups/pages only where group rules permit; identify FindMaids, answer genuinely, avoid bulk posting, and stop on moderator/user request.
- Test small Facebook/Google campaigns only after domain, privacy/cookie consent, analytics consent, support coverage, and landing-page accuracy are ready. Start with a capped budget approved by the owner.
- Position the assistant as an optional way to explore approved listings only after the live provider, grounding, disclosures, consent, kill switch, budget cap, and support path have been tested. Do not advertise a live AI matching capability while flags are off or only MockProvider is active.

### Measurement

Review weekly by source and city. Use a consistent period and define unique visitors consistently before comparing weeks.

| Metric                           | Definition / current status                                                                                                                                                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public visitors                  | Anonymous first-visit events count only after explicit analytics consent; raw unconsented page traffic is intentionally not tracked. Use consented analytics and campaign aggregates, and disclose limitations. |
| Chat starts                      | Anonymous, analytics-consent-gated `CHAT_OPENED` events are available in admin reports; unique visitor estimates cover only consented visitors.                                                                 |
| Enquiries per agency/week        | Existing enquiry records grouped by agency and creation date; distinguish submitted, valid, spam/blocklisted and duplicate leads.                                                                               |
| Agency response rate/time        | Internal first-response timestamps are recorded on status change from NEW, changed non-empty note, or sent reply. Validate usage and thresholds in pilot; do not display publicly or promise an SLA.            |
| Profile views and contact clicks | Existing dashboard analytics; events are emitted only with analytics consent. Verify counts in staging and account for consent coverage.                                                                        |
| Qualified lead                   | Define with agencies before reporting (e.g., valid contact, relevant location/service, consent present); do not equate an AI score with qualification.                                                          |
| AI cost                          | Review AI call logs and budgets only after a real provider is enabled; MockProvider produces no meaningful usage-cost evidence.                                                                                 |

Set the minimum “steady stream” target with Uncle Ricky after the first two weeks of baseline data. Report range, sample size, source mix, consent coverage, invalid leads, and date range; avoid implying every agency has the same result.

The ADMIN Prospect Tracker and founding-period workflow are available for internal sales operations. Prospect contact records require a documented business-contact source; `DO_NOT_CONTACT` is sticky; no outreach is sent from the tracker. Founding grant/expiry does not charge. Reminder/expiry emails remain disabled unless the owner explicitly enables `FOUNDING_PERIOD_EMAILS_ENABLED=true`.

## Phase C: Test Paid Plans (After 4-6 Weeks of Observed Leads)

Prices below are hypotheses. Do customer interviews, competitor price research, and willingness-to-pay tests before publishing or changing the live catalog.

| Plan hypothesis | Possible value                                                                          | Starting price hypothesis (PHP/month) | Validation notes                                                                                                                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------- | ------------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Basic           | Free listing, limited photos and monthly lead allowance                                 |                                  Free | Current sample catalog has 3 photos and 10 enquiries/month; production catalog must be owner-reviewed. Above allowance, leads are still saved/notified. Details stay available in default `DELIVER_ALL`; optional `LOCK_DETAILS` locks only over-cap details. |
| Gold            | More visibility, photos, reporting/export, one eligible sponsored placement             |                          ₱1,500-3,000 | Current sample catalog is ₱999/month, 10 photos, 100 leads, priority ranking and one featured slot; it does not grant Verified status. Lead CSV export currently exists. Validate actual incremental value before changing price.                             |
| Platinum        | Highest eligible placement, homepage/featured inventory, analytics, agency reply drafts |                          ₱4,000-8,000 | Current sample catalog is ₱1,999/month. Inventory is limited; define slot availability and labels. AI drafts require flags/provider/budget and stay owner-approved. No automated send.                                                                        |

- Yearly billing at approximately two months free is a hypothesis. Confirm unit economics, tax display, cancellation/refund terms, and price presentation with finance and counsel.
- Honor the founding-agency free period in writing. Before expiry, send each agency a factual report of its own consented/aggregated views, clicks, valid enquiries, invalid/duplicate counts, and period. Do not promise conversion or leads.
- Only offer “first month free” to a paid-plan prospect if the terms, billing start, cancellation, and checkout behavior are implemented and approved. The current app does not establish that offer automatically.
- Compare agencies’ actual directory/advertising spend through interviews and public rate cards; record source/date. Do not assert competitor prices without evidence.
- Test price bands with interviews or a clearly labeled pilot offer; do not silently alter the production plan catalog.

## Agency Pitch and Follow-up

Use only measured data for the specific agency and time period. Never fill the placeholders with estimates presented as fact.

1. “Employers in [city] search online for agencies. From [start date] to [end date], your FindMaids profile received [verified views] consented/recorded views and [N] enquiries.”
2. Show the agency owner their own dashboard and explain measurement limits (analytics consent and manually managed lead status).
3. “Gold is being tested at [approved price]. It includes [verified current entitlements]. Sponsored placement is labeled. Verified status is separately reviewed and is never purchased.”
4. State exact trial, renewal, cancellation and refund terms only after approved.
5. Follow up once within two business days and once around day seven only if the agency has not opted out; stop immediately on request.

## Connecting the Applicant/Lead Auto-Reply Idea

Reuse infrastructure carefully, not business semantics. Public employer enquiries, agency sales prospects, and applicant contacts are distinct data subjects, consent purposes, records, and permissions.

- Do not send applicant CVs or personal data to the agency-sales workflow. Do not route agency prospects into employer enquiry records.
- Use separate webhook event names, secrets, data schemas, retention, and opt-in/opt-out handling for each workflow. The current signed outbound events concern platform lead events; they are not a complete agency-prospect CRM or applicant workflow.
- For sales enquiries, begin with a human-reviewed draft/notification after explicit contact consent. Auto-send is not implemented or approved; WhatsApp requires Business account setup, opt-in and template approval. Do not reuse a credential across n8n/Make scenarios.
- If n8n/Make is selected later, minimize fields, mask unnecessary personal data, verify webhook signature/replay/idempotency, and document processor/location/retention with counsel.

## Trust and Complaints

- Display Verified only after a documented human license check. Record what was checked and when; define re-check schedule and badge expiry/revocation rules.
- Sponsored/paid placements are clearly labeled and do not influence the Verified decision, review moderation, complaint visibility, or complaint outcomes.
- Provide a clear complaint/report route. Admin reviews reports; document evidence, response, decision, appeal route, and repeat-issue escalation. Do not let a paid tier hide complaints or buy reviews.
- State clearly that FindMaids is a directory/advertising platform, not a recruiter or employer. Legal wording awaits counsel approval.

## Weekly Metrics and Decision Gate

Track approved/complete agencies, paying agencies, paid conversion, recurring revenue, churn/cancellations/refunds, consented visitors, chat starts, enquiries by source/agency, valid-lead rate, agency first-response rate/time, published/reported reviews, and AI cost per assisted enquiry. Mark unavailable metrics “not measured” rather than estimating.

At each weekly review, decide: continue, change channel/offer, pause a city/category, or stop. Require a minimum observation window and sample size before comparing tiers. Document interview notes without unnecessary personal data.

## 90-Day Sequence

| Weeks | Focus                                                                                                              | Gate                                                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 1-3   | Build and qualify 50-100 prospect list; publish 20-30 genuinely verified complete profiles if capacity supports it | Approved category/license criteria, owner contact, consent, and profile approval process ready              |
| 3-4   | Soft launch public directory; begin original content and permitted community outreach                              | Step 6 launch checklist signed; health, support, privacy, backups and payments are ready                    |
| 4-8   | Measure consented traffic and valid enquiries; collect optional feedback; fix operational issues                   | Agency-level report is accurate; no lead promises without measured evidence                                 |
| 8-10  | Discuss conversion with founding agencies; test Gold/Platinum price hypotheses                                     | At least 4-6 weeks of usable lead evidence; pricing/refund/legal terms approved                             |
| 10-13 | Expand cities selectively; consider draft reply pilots for paying agencies                                         | Manual license-review capacity, provider/privacy approval, AI budget, human review and kill switch verified |

Dates should be anchored to actual launch readiness, not the tentative Step 6 calendar. Do not expand cities or enable AI solely to meet a date.
