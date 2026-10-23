# Performance Validation

## Current evidence

- Public home, directory, and agency-profile pages declare five-minute revalidation. Search-param directory responses and database-dependent ISR behavior need production-mode verification.
- Profile media is decoded/re-encoded to WebP at upload. Public rendering uses `next/image` but currently opts out of Next optimization (`unoptimized`); assess storage CDN/responsive variants before enabling remote optimization.
- Agency dashboard does not perform a clear per-row query N+1, but its analytics query fetches the entire 90-day event set and loops repeatedly in memory. Directory ranking currently loads a bounded candidate set but prior implementation may fetch all candidates; measure before changing ranking semantics.
- Added `(agencyId, createdAt)` enquiry/analytics, Agency createdAt, and HNSW `vector_cosine_ops` indexes in migration `20261023090000_launch_hardening`. These have not been applied or validated against Supabase; review query plans and index build impact before production.
- No Redis data cache is implemented; Redis currently backs background jobs. No k6 or Lighthouse result has been collected.

## Required staging measurement

1. Populate a staging dataset representative of expected agencies, enquiries, reviews, subscriptions, placements, and analytics. Never load-test production without separate written approval.
2. Run `npx prisma migrate deploy`, then capture `EXPLAIN (ANALYZE, BUFFERS)` for directory filters/ranking, profile lookup, and dashboard counts on staging. Record row count, plan, p50/p95 and index usage.
3. Run Lighthouse mobile against home, `/agencies`, and an approved profile in production build mode. Target >=90 Performance per requested gate; also record LCP, CLS, INP, TBT, image bytes and test device/network profile.
4. Start at 1 VU, then increase gradually with `k6 run tests/load/public-flows.js`. Set `BASE_URL`, `AGENCY_SLUG`, `CITY`. Add `ENABLE_CHAT_LOAD=1` only with chat flag enabled and bounded mock provider; add `ENABLE_ENQUIRY_LOAD=1`, `AGENCY_ID`, and email delivery disabled only on isolated staging. Create unique disposable test records and clean them after each run.
5. Record p95 latency, error rate, throughput, DB connections, Redis queue depth, CPU/memory, and first breaking point. Stop on elevated errors, resource saturation, real provider calls, or any production endpoint.

## Result record

Status: **NOT RUN**. No real staging host, approved data set, or load authorization was supplied. Lighthouse 90+ is a manual acceptance gate, not a claimed result. Add dated artifacts and tuning decisions here after authorized staging runs.
