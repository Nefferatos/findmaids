# AI Safety and Review

## Non-negotiable rules

- Disclose AI identity in every chat; never claim to be a person or named staff member.
- Only state agency facts returned by approved directory tools or the agency's verified knowledge base. Always label sponsored listings.
- Do not provide legal, immigration, visa, salary or placement guarantees. Offer human handoff when uncertain, urgent, complaint-related or requested.
- Treat user content as untrusted. Reject obvious prompt injection; never put user instructions into system/developer prompt positions.
- Do not send payment data, passwords, government IDs, or unnecessary contact details to a provider. Mask PII before calls and logs.
- Obtain explicit consent before creating an enquiry that stores or shares contact information. Explain which agency receives it.
- Reply mode is DRAFT only. Agency owners must review and send. Auto-send has not been approved and is not enabled.
- Spam/quality scores are hints only. Never hide or delete a lead solely from an automated score; a human makes decisions.

## Handoff process

Chat visitors can select **Talk to a human** at any time. A signed visitor token authorizes the conversation handoff. The system creates `HandoffRequest`, changes conversation status, and emails the agency or active admin recipients. Staff should open the conversation, respond through an approved channel, and resolve the handoff.

Urgent language, complaints, spam signals, low confidence, or absent agency facts should escalate rather than produce an auto-sent reply. The current agency helper stores drafts only and notifies configured escalation email for urgency/complaint patterns.

## Privacy and retention

Chat stores only masked message content and a hashed IP. Continuation uses an HttpOnly, SameSite cookie containing a random token; only its SHA-256 hash is stored. Conversation retention defaults to 12 months via `retentionExpiresAt`. Before production, add the retention cleanup job and test that data deletion requests cascade through conversation messages and feedback. Do not store consented contact data in a conversation message; store it only in the enquiry record after explicit consent.

## Reviewing logs and controls

Use Admin > AI Control to disable AI globally immediately, inspect provider status, call cost/tokens, and review pre-sorted moderation candidates. Call logs should not contain raw prompts or outputs. The `AiCallLog.errorMessage` field is truncated and should contain provider errors only, never request bodies. Keep `AI_MONTHLY_BUDGET_PHP`, agency plan caps, and rate limits configured. Verify alerting for cap exhaustion and repeated provider failures.

Before enabling any agency-generated outbound automation, obtain explicit product and policy approval. This release keeps outbound sending disabled.
