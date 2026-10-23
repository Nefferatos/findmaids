# Operations Runbook

## Site down or degraded

1. Check the external uptime alert and `/api/health`; distinguish database, Redis/queue, and app status.
2. Check host status, recent deployment, database connectivity/pool saturation, Redis, and error tracking.
3. If caused by a release, stop rollout and redeploy the last known-good immutable release. Do not roll back a database migration without a reviewed reverse migration/restore plan.
4. If database/storage is unavailable, disable new writes only through the approved maintenance procedure; preserve logs and incident timeline.
5. Communicate status and next update through the status channel. Record resolution and follow-up.

## Payment webhook failing

1. Do not manually mark provider payments paid based only on an email or browser return URL.
2. Check signature verification errors, provider event ID, provider dashboard, and idempotency record.
3. Verify clock/time synchronization and current secret version; rotate only through a coordinated provider configuration change.
4. Replay using the provider's test/retry facility only after confirming duplicate event handling. Reconcile any uncertain payment manually with evidence and ADMIN audit trail.
5. Escalate suspected charge mismatch or duplicate refund to finance owner and PayMongo support.

## AI misbehaving

1. ADMIN opens `/admin/ai-control` and enables the global kill switch; verify provider requests stop.
2. Keep feature flags disabled; do not delete logs before investigation. Logs should contain masked data only.
3. Capture prompt version, feature, model/provider, timestamp, masked conversation reference and reproducible eval case. Do not copy raw PII into tickets.
4. Route urgent/unsafe cases to a human; review provider/webhook credentials and spend limits.
5. Fix, add regression eval, verify MockProvider and staging provider, then obtain explicit approval before gradual re-enable. Auto-send is not enabled.

## Suspected data breach

1. Notify incident lead and DPO immediately; preserve evidence, access logs, request IDs, and provider audit events.
2. Contain compromised credentials/accounts and revoke sessions/keys using the secret manager. Avoid destructive cleanup.
3. Determine affected systems, data categories, subjects, access window and processors with counsel/DPO.
4. Follow the approved NPC/data-subject notification assessment and legal timelines. Do not make unreviewed public statements.
5. Restore only from verified clean backups; rotate secrets; document decisions, notifications, and corrective actions.

## Agency dispute or safety complaint

1. Preserve the relevant listing/review/enquiry and audit history; restrict access to authorized staff.
2. Follow the published moderation and escalation process. Do not treat AI score as a decision.
3. Contact parties through verified channels, record evidence and actions, and escalate safety/legal allegations to the designated lead.
4. Apply suspension/removal only under the approved policy and retain documented rationale.

## Refund request

1. Verify requester and payment ownership; inspect payment status, provider transaction, invoice, refund balance, and prior actions.
2. Follow approved refund policy and finance approval thresholds. Refund via PayMongo only where provider supports it; never request card details.
3. Record reason, exact amount, provider reference, actor, timestamp and audit event. Verify receipt and subscription effect.
4. Escalate duplicate, partial, disputed or chargeback cases to finance and provider support.
