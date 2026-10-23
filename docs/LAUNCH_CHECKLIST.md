# Launch Checklist

Do not launch until all blocking items are signed off. Draft legal text and unverified infrastructure are blockers.

## Legal

- [ ] Philippine counsel reviews and approves Privacy Policy, Terms, Cookie Policy, enquiry consent, retention, refunds, and agency disclaimers.
- [ ] Confirm NPC registration applicability/status and complete public registration details.
- [ ] Name the DPO; publish monitored DPO email/address.
- [ ] Approve data inventory, lawful basis, retention schedule, processor agreements, and cross-border transfer notices.

## Payments

- [ ] Verify PayMongo business account and live-mode eligibility.
- [ ] Verify live keys in secret manager; test-mode keys only in staging.
- [ ] Configure webhook URL and secret; replay and duplicate delivery tests pass.
- [ ] Verify invoice sequence, tax wording with accountant, bank account details, refund procedure, and reconciliation permissions.
- [ ] Perform an approved small real payment and refund test.
- [ ] Owner performs PayMongo live activation, an approved small real charge/refund, invoice review, and bank detail confirmation.

## Email

- [ ] Verify sending domain and sender address.
- [ ] Publish SPF, DKIM, and DMARC DNS records; validate alignment and deliverability.
- [ ] Test account verification, reset, enquiry, agency notification, privacy request, and moderation templates on mobile and Gmail/Outlook.
- [ ] Confirm bounce/complaint handling and support mailbox ownership.
- [ ] Owner verifies DNS for the custom domain, SPF, DKIM, and DMARC; test real delivery with Gmail and Outlook.

## Security

- [ ] Set strong unique production secrets; verify none in source, artifacts, or deployment logs.
- [ ] Verify CSP/HSTS and all security headers on HTTPS, including required third-party assets.
- [ ] Configure trusted proxy headers and body-size limits; verify Turnstile server validation.
- [ ] Review tenant isolation, ADMIN TOTP enrollment, password reset invalidation, CSRF, rate limits, and webhook replay/idempotency in staging.
- [ ] Complete historical secret scan and independent penetration test; resolve high/critical findings.
- [ ] Keep AI/chat/WhatsApp/email features disabled until a named approver enables staged flags.

## Performance

- [ ] Lighthouse mobile score >=90 on home, directory, agency profile with production-like data; archive reports.
- [ ] EXPLAIN ANALYZE directory/ranking/dashboard queries on representative dataset; accept indexes only after measuring.
- [ ] k6 load test passes agreed RPS, p95 and error thresholds; record breaking point and capacity limits.
- [ ] Test mobile image sizes, font loading, CLS/LCP, keyboard and screen-reader flows.
- [ ] Complete manual Lighthouse, contrast, keyboard/screen-reader, and real iOS/Android/desktop browser QA; not measurable from this local DB/browser setup.

## SEO

- [ ] Set `NEXT_PUBLIC_SITE_URL` to canonical HTTPS domain; verify canonical/Open Graph previews.
- [ ] Validate sitemap.xml and robots.txt, submit sitemap to Google Search Console, verify 301 redirects.
- [ ] Validate LocalBusiness/FAQ structured data and remove any unverified claims.
- [ ] Configure GA4 only after valid analytics consent and legal approval.

## Content

- [ ] Replace seed/sample content with approved real FAQs, static pages, plans, agency policies and support details.
- [ ] Confirm agency descriptions, logo/media rights, license fields and sponsored labels.
- [ ] Confirm production has no sample users, enquiries, or seed agency records.

## Monitoring

- [ ] Configure Sentry project, release/environment tags, PII scrubbing, and alert routing.
- [ ] Add uptime monitor for `/api/health`; test DB/Redis failure alerts.
- [ ] Alert on payment/webhook failures, queue failures/backlog, AI spend thresholds, elevated error rate, and expiring domain/SSL.
- [ ] Confirm request-ID structured logs and log retention/access policy.

## Backups

- [ ] Configure daily database backups/PITR and approved retention.
- [ ] Enable storage versioning or separate object backups for public/private buckets.
- [ ] Complete isolated restore drill and record RPO/RTO in `BACKUP_RESTORE.md`.
- [ ] Owner configures/verifies backup retention and completes a staging restore drill; this remains a launch blocker.

## Support

- [ ] Publish support and DPO contacts; staff support mailbox and escalation rota.
- [ ] Train staff on agency approval, dispute handling, privacy requests, payments, refunds, and incident runbook.
- [ ] Confirm WhatsApp Business account, vendor webhook/signature contract, approved templates and opt-in. Keep feature flag OFF until completed.
- [ ] Set status page/maintenance communications and on-call owners.
- [ ] Verify `security@findmaids.ph` exists, is monitored, and update `.well-known/security.txt` if the final reporting address differs.
