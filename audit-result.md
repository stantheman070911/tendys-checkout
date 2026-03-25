Executive Summary

This repo is materially stronger than a typical MVP. Local verification is clean: npm test passed at 36 files / 166 tests, npm run lint, npx tsc --noEmit, npm run build, and npm audit --json reported 0 known dependency vulnerabilities. I also applied three high-leverage fixes: background work is now bound to the request lifecycle via fire-and-forget.ts (line 1), LINE webhook processing now uses that same safe path in route.ts (line 1), arrival notifications now reject cross-round mismatches in route.ts (line 1), and stock restoration now uses deterministic product ordering plus shared helpers in orders.ts (line 4).

CTO sign-off is still not justified yet. The main reasons are operational, not stylistic: the public abuse controls are not production-safe across instances, the real end-to-end flow is explicitly still unverified in the project’s own roadmap, and a few security/validation edges remain too loose for a confident production sign-off.

Top Issues Blocking CTO Sign-Off

Public rate limiting is process-local only. lib/rate-limit.ts (line 1) stores counters in an in-memory Map, so limits reset on cold start and do not coordinate across serverless instances. That weakens abuse protection on /api/submit-order, /api/lookup, /api/report-payment, /api/cancel-order, and /api/public-order/access.
Real production flow is still not validated. roadmap.md (line 43) leaves the full Supabase smoke test unchecked, and the final verification checklist in roadmap.md (line 139) is still open. For a system that depends on Supabase, Resend, LINE, cookies, and public identity flows, this is a sign-off blocker.
Secret management still falls back to the Supabase service-role secret. Admin sessions in supabase-admin.ts (line 37) and public-order access tokens in public-order-access.ts (line 38) both fall back to SUPABASE_SERVICE_ROLE_KEY. That is functional, but it couples unrelated trust domains and is below production-grade secret hygiene.
Prioritized Findings With Evidence

P1 Open Reliability/Security: in-memory throttling in lib/rate-limit.ts (line 1) is the biggest architectural gap. Impact is high, effort is medium if replaced with Redis or DB-backed buckets.
P1 Open Production readiness: manual and integration verification are incomplete per roadmap.md (line 43) and roadmap.md (line 157). This matters because the hardest failures here are cross-system, not unit-level.
P1 Fixed Reliability: background notification work previously depended on globalThis.waitUntil only; it is now scheduled via Next’s after() in fire-and-forget.ts (line 7) and used by LINE webhook processing in route.ts (line 35).
P1 Fixed Correctness: /api/notify-arrival previously trusted productId and roundId independently; it now rejects mismatches in route.ts (line 42).
P1 Fixed Reliability/Cleanup: stock decrement and restore logic was duplicated raw SQL; it now reuses shared helpers and restores in deterministic product order in orders.ts (line 105) and orders.ts (line 984), which reduces deadlock risk during concurrent cancels.
P2 Open Security: secret fallback coupling remains in supabase-admin.ts (line 37) and public-order-access.ts (line 38).
P2 Open Correctness/Maintainability: request validation is still inconsistent and hand-rolled. Examples: round PUT can trim a blank name without rejecting it in app/api/rounds/route.ts (line 171), and product PUT forwards a trimmed round_id without non-empty validation in app/api/products/route.ts (line 224).
P3 Open Maintainability: major client flows are still too large and state-dense. StorefrontClient.tsx (line 42), OrdersPageClient.tsx (line 55), and ShipmentsPageClient.tsx (line 33) are serviceable but harder to evolve safely.
P3 Open Cleanup/Documentation: roadmap text says /api/lookup returns signed detail URLs in roadmap.md (line 89), but current runtime returns order summaries in app/api/lookup/route.ts (line 58) and the UI submits through app/lookup/page.tsx (line 139). The flow still works, but docs and code have drifted.
Cleanup And Technical Debt Findings

Structural cleanup applied: replaced duplicated stock SQL in orders.ts (line 383) with shared helpers from products.ts (line 101).
Reliability-related cleanup applied: centralized background-task lifecycle handling in fire-and-forget.ts (line 7).
Correctness-related cleanup applied: normalized and trimmed productId / roundId once in notify-arrival/route.ts (line 26).
Testing debt improved: added focused coverage in fire-and-forget.test.ts, notify-arrival/route.test.ts, and orders.test.ts.
Concrete Code-Level Recommendations

Replace lib/rate-limit.ts (line 1) with a shared backing store. Redis is the cleanest option; Postgres can work if you accept more write load.
Require dedicated ADMIN_SESSION_SECRET and PUBLIC_ORDER_ACCESS_SECRET in production; stop falling back to the service-role key in supabase-admin.ts (line 37) and public-order-access.ts (line 38).
Add a shared request-validation layer and use it in app/api/rounds/route.ts (line 51) and app/api/products/route.ts (line 50) to eliminate inconsistent trimming/blank/format handling.
Split StorefrontClient.tsx (line 42) into cart state, checkout form state, and autofill hooks/components. Do the same for OrdersPageClient.tsx (line 55) and ShipmentsPageClient.tsx (line 33).
Close the roadmap gap with a real Supabase/LINE/Resend smoke run and browser-level coverage for CSV download and shipment print, which are already called out in roadmap.md (line 157).
Optimization Roadmap By Impact vs Effort

High impact / medium effort: distributed rate limiting.
High impact / medium effort: real end-to-end smoke automation against staging Supabase + notification providers.
Medium impact / low effort: dedicated secrets for admin sessions and public-order access.
Medium impact / low effort: shared validators for route inputs.
Medium impact / medium effort: split large client components and extract duplicated URL-sync logic from OrdersPageClient.tsx (line 37) and ShipmentsPageClient.tsx (line 15).
Medium impact / high effort: finish the “true DB-side thin rows” item already listed in roadmap.md (line 161).


# CTO Sign-Off Remediation Plan

## Summary
- Fix the remaining sign-off blockers in four ordered workstreams: distributed abuse protection, secret/config hardening, contract/validation cleanup, and verification closeout.
- Preserve current public/admin behavior unless the current code is drifting from the documented contract; in that case, move runtime back to the documented contract instead of rewriting docs down to the weaker implementation.
- Keep the pass targeted: no broad UI redesign, no route-contract churn beyond the specific lookup/access improvement, and no schema changes unless needed for the DB-side thin-row optimization.

## Key Changes
- `Distributed rate limiting`: Replace the in-memory `Map` limiter with a store-backed `RateLimitStore` behind the existing `checkRateLimit` API so route call sites stay almost unchanged. Use Upstash Redis in production via `@upstash/redis`, fixed-window counters keyed as `tendy:{route}:{identifier}:{windowBucket}`, and return `retryAfterSeconds` from bucket expiry. Keep an in-memory adapter only for dev/test. Apply the shared limiter to `/api/submit-order`, `/api/lookup`, `/api/report-payment`, `/api/cancel-order`, `/api/public-order/access`, and `/api/checkout-profile/lookup`.
- `Rate-limit config`: Add `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `RATE_LIMIT_PREFIX` config. In production, missing Redis config should fail closed for public rate-limited routes with a clear 503/config error path rather than silently downgrading to per-instance memory behavior.
- `Secret isolation`: Remove all fallback from admin/public token signing to `SUPABASE_SERVICE_ROLE_KEY`. `ADMIN_SESSION_SECRET` must be the only production signing secret for admin cookies, and `PUBLIC_ORDER_ACCESS_SECRET` must be the only production signing secret for public-order access. In dev/test only, use explicit local fallback constants per domain and emit a one-time warning so the domains stay separated even outside production.
- `Secret validation`: Add a small server-only config helper that validates required production env vars on first use and produces deterministic error messages. Update deployment docs and env examples to make the two secrets mandatory for production.
- `Shared request validation`: Introduce Zod-based parsers for JSON bodies, query params, and form data in a shared validation module. Preserve the current `{ error: string }` response envelope and current status-code semantics so the frontend does not need a broad rewrite.
- `Validation migration scope`: Migrate every route that parses request body/form data or accepts user-supplied filtering identifiers. This includes public identity/payment/order routes, admin mutation routes, and CRUD routes for rounds/products/suppliers. Explicitly fix blank-name rejection in round updates and blank/invalid `round_id` rejection in product updates.
- `Lookup contract alignment`: Restore the documented signed-detail flow. `/api/lookup` should return `detail_url` for each result. Add `GET /api/public-order/access` that accepts a signed token, validates it, sets the same order-scoped cookie used today, and redirects to clean `/order/[orderNumber]`. Keep `POST /api/public-order/access` for direct-visit manual unlock forms. Update the lookup page to use direct links/buttons instead of hidden-form reposting.
- `Documentation alignment`: Update `roadmap.md`, handoff/docs, and any related tests so they describe the restored lookup contract and the new production secret/rate-limit requirements accurately.
- `Targeted client refactor`: Split `StorefrontClient` into extracted hooks/components for cart state, checkout form submission, and checkout autofill. Split `OrdersPageClient` into extracted URL-sync/search, CSV export/download, and order-mutation helpers. Split `ShipmentsPageClient` into extracted URL-sync/search, batch-print, and grouped-shipment state helpers. Keep current screens, route params, and visual structure unchanged.
- `Shared admin URL-sync cleanup`: Replace the duplicated `updateQueryString` + debounced router-sync logic in orders and shipments with one shared hook/util so future filtering/pagination changes happen in one place.
- `DB-side thin rows`: Finish the backlog item by changing the admin order-list query to compute `items_preview` in SQL and stop hydrating full `order_items` for list rows. Keep `/api/orders/[id]` as the detail expansion path. Preserve the current list response shape.
- `Verification closeout`: Add Playwright coverage for the missing browser-level admin flows called out in the roadmap: CSV preflight/download and shipment batch print. Use a forged test admin cookie and request interception/mocked API responses where provider behavior is not the subject of the test.
- `Staging smoke workflow`: Add an executable staging smoke script for setup/exercise/teardown of the core round flow against a staging deployment, plus a strict manual checklist for provider-dependent steps that cannot be safely or reliably automated end to end. The manual checklist must cover Supabase auth, checkout, lookup/unlock, payment report, admin confirm, arrival notify, shipment notify, LINE binding, CSV export, and round close.
- `Roadmap closeout rules`: Do not mark the unchecked roadmap items complete until the staging smoke run has been executed and evidence captured. Store the final checklist/runbook in repo docs so sign-off is repeatable.

## Public APIs, Interfaces, and Config
- `/api/lookup` response adds `detail_url` per order result while keeping the existing order summary fields.
- `/api/public-order/access` gains a signed-token `GET` entrypoint; existing manual `POST` behavior remains.
- `checkRateLimit` keeps its current call shape so existing routes remain stable, but internally delegates to a store adapter.
- Add production env requirements: `ADMIN_SESSION_SECRET`, `PUBLIC_ORDER_ACCESS_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- Add a shared validation layer and shared error formatter, but keep existing client-visible error envelope and HTTP status expectations intact.

## Test Plan
- Unit tests for Redis-backed rate limiting: first-hit allow, threshold block, TTL expiry, route isolation, retry-after accuracy, and dev/test adapter fallback.
- Unit tests for secret helpers: production missing-secret failure, production success with dedicated secrets, and non-production isolated fallback behavior.
- Route tests for validation migration: blank/whitespace names, invalid UUIDs, null/empty optional fields, and preserved error payload shape.
- Route tests for lookup/access contract: `/api/lookup` returns `detail_url`, signed `GET /api/public-order/access` sets the cookie and redirects, manual `POST` unlock still works, and invalid/expired tokens fail safely.
- Query tests for DB-side thin rows: list rows use precomputed preview text, pagination metadata remains correct, and detail loading still returns full items from `/api/orders/[id]`.
- Playwright tests for admin CSV download and shipment batch print using a test admin cookie and deterministic API mocking.
- Staging smoke execution against real Supabase/Resend/LINE configuration with a recorded checklist covering the unchecked roadmap items before sign-off.
- Final gate: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, Playwright suite, and completed staging checklist with artifacts.

## Assumptions and Defaults
- Redis choice is Upstash Redis because the app is Vercel/serverless-oriented and needs low-friction shared state.
- Validation standard is Zod, not ad hoc helpers.
- Browser-level flow coverage uses Playwright, not only Vitest DOM.
- Client refactor is targeted extraction only; no broad route or visual redesign is in scope.
- Production secret enforcement is strict; dev/test may use explicit insecure local fallback constants, but production never falls back to the Supabase service-role key.
- The lookup flow should match the documented signed-detail design rather than preserving the current hidden-form repost implementation.

Implemented the remediation plan across the repo.

What changed:

Distributed rate limiting and strict config hardening are in lib/rate-limit.ts and lib/server-env.ts. Production now requires dedicated ADMIN_SESSION_SECRET, PUBLIC_ORDER_ACCESS_SECRET, and Upstash Redis envs; admin/public signing no longer falls back to SUPABASE_SERVICE_ROLE_KEY.
The signed lookup flow is restored end to end in app/api/lookup/route.ts, app/api/public-order/access/route.ts, app/lookup/page.tsx, and lib/public-order-access.ts. /api/lookup now returns detail_url, GET /api/public-order/access unlocks via signed token, and direct detail access uses the same cookie path.
Shared request validation is now used across the remaining hot routes via lib/validation.ts, including rounds/products/suppliers and the admin/public mutation routes that were still hand-parsed.
The admin order list hot path now uses DB-side items_preview aggregation in lib/db/orders.ts, so list rows no longer hydrate full order_items.
Client refactors landed in components/admin/OrdersPageClient.tsx, components/admin/ShipmentsPageClient.tsx, and components/StorefrontClient.tsx, with extracted hooks for admin URL sync, CSV export, shipment print, storefront cart, checkout form, and checkout autofill.
Verification/runbook artifacts were added in playwright.config.ts, e2e/admin-flows.spec.ts, scripts/staging-smoke.mjs, docs/staging-smoke-runbook.md, claude.md, roadmap.md, and .env.local.example.
Verification:

npm test passed: 39 files, 178 tests.
npm run lint passed.
npx tsc --noEmit passed.
npm run build passed.
npm run test:e2e passed: 2 Playwright tests covering admin CSV preflight/download and shipment batch print.
Remaining gap:

The codebase is materially closer to CTO sign-off, but the real staging smoke run is still not executed from this session. The executable path and manual checklist are in scripts/staging-smoke.mjs and docs/staging-smoke-runbook.md. Until that staging run is completed with Supabase/Resend/LINE evidence, I would still call sign-off “pending operational validation,” not fully closed.

已變更 63 個檔案
+3051
-1196
.env.local.example
app/admin/orders/page.tsx
app/admin/shipments/page.tsx
app/api/admin/session/route.ts
app/api/batch-confirm/route.ts
app/api/cancel-order/route.ts
app/api/checkout-profile/lookup/route.ts
app/api/confirm-order/route.ts
app/api/confirm-shipment/route.ts
app/api/lookup/route.test.ts
app/api/lookup/route.ts
app/api/notification-logs/route.ts
app/api/notify-arrival/route.ts
app/api/orders-by-product/route.ts
app/api/orders/print-batch/route.ts
app/api/orders/route.ts
app/api/products/route.ts
app/api/public-order/access/route.test.ts
app/api/public-order/access/route.ts
app/api/quick-confirm/route.ts
app/api/report-payment/route.test.ts
app/api/report-payment/route.ts
app/api/rounds/route.ts
app/api/submit-order/route.test.ts
app/api/submit-order/route.ts
app/api/suppliers/route.ts
app/api/users/lookup/route.ts
app/lookup/page.tsx
app/order/[orderNumber]/page.tsx
app/page.tsx
claude.md
components/PublicOrderPage.tsx
components/StorefrontClient.tsx
components/admin/OrdersPageClient.tsx
components/admin/ShipmentsPageClient.tsx
docs/staging-smoke-runbook.md
e2e/admin-flows.spec.ts
hooks/use-admin-csv-export.ts
hooks/use-admin-query-controls.ts
hooks/use-checkout-autofill.ts
hooks/use-shipment-batch-print.ts
hooks/use-storefront-cart.ts
hooks/use-storefront-checkout-form.ts
lib/admin/query-string.test.ts
lib/admin/query-string.ts
lib/admin/server.ts
lib/auth/supabase-admin.ts
lib/db/orders.ts
lib/public-order-access.test.ts
lib/public-order-access.ts
lib/rate-limit.test.ts
lib/rate-limit.ts
lib/server-env.test.ts
lib/server-env.ts
lib/testing/playwright-admin.ts
lib/validation.ts
package.json
playwright.config.ts
roadmap.md
scripts/staging-smoke.mjs
test-results/.gitkeep
test/setup.ts
vitest.config.ts
