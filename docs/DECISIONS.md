# Decisions

Provisional defaults used only for the staging dry run. The final choice belongs to the owner and Uncle Ricky.

| # | Topic | Provisional default for the dry run | Final decision / owner / date |
| --- | --- | --- | --- |
| 1 | Lead cap mode | `LEAD_CAP_MODE=DELIVER_ALL`: every enquiry is delivered in full, even above the plan allowance. Monthly window is the UTC calendar month. | |
| 2 | Response metric | A first response within 24 hours counts as on time (implemented; the on-time share is calculated over all leads, so unanswered leads count against it). Slow-response threshold 48 hours, internal only (**not implemented in code yet**; recorded as a decision only). | |
| 3 | Founding Gold | 3 months, no featured-slot entitlement unless a plan already grants it. | |
| 4 | Automatic founding emails | Disabled (`FOUNDING_PERIOD_EMAILS_ENABLED=false`). Expiry notices are logged only. | |
| 5 | Prospect retention | Keep until the prospect asks for deletion or 12 months after last contact, whichever comes first. | |

Notes
- Item 3: the code default is `defaultFoundingPeriodDays = 90` in `lib/leads/founding-period.ts`, which is about 3 months.
- Items 1 and 2 are provisional until a lawyer and the business confirm the wording shown to agencies.
