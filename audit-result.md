# Production Readiness Audit — tendycheckout

## Historical Record

Two CTO review cycles ran on 2026-03-26. The full back-and-forth is preserved in git history on the `staging` branch. Key outcomes from those cycles:

- UUID validation was added to `orders`, `products`, `orders-by-product`, `notification-logs`, and `orders/print-batch` routes.
- `submit-order` was moved onto the shared `parseJsonBody` + Zod parsing path.
- `fireAndForget()` was changed to register a deferred callback with `after()` instead of starting immediately.
- `picomatch` advisory was remediated via `overrides` in `package.json`.
- Staging tooling was fixed: smoke targets `STAGING_BASE_URL` only, supports Vercel protection bypass, artifact script refuses to run on URL mismatch.
- A staging smoke run against the preview deployment (`staging-smoke-20260326110505`) failed at `POST /api/submit-order` with `503 Ordering is temporarily unavailable` because `PUBLIC_ORDER_ACCESS_SECRET` was not configured on the preview deployment.

---

## Current Verification — 2026-03-28

### Gate Results

| Gate | Result |
|------|--------|
| `npm test` | **44 files / 211 tests — all passed** |
| `npm run lint` | Passed |
| `npx tsc --noEmit` | Passed |
| `npm run build` | Passed |
| `npm run test:e2e` | Passed (2 tests) |
| `npm audit --json` | **0 vulnerabilities** |

### Changes Since Last CTO Review (2026-03-26)

**P1 — UUID validation normalized across all admin routes**

The prior remediation covered 6 routes. The following 9 were still accepting arbitrary strings for ID parameters and would produce `500`s from the database layer on malformed input. All are now on `uuidStringSchema`:

| Route | Parameter |
|-------|-----------|
| `orders/[id]/route.ts` | `id` (path param) |
| `export-csv/route.ts` | `roundId` (query param) |
| `confirm-order/route.ts` | `orderId` |
| `quick-confirm/route.ts` | `orderId` |
| `batch-confirm/route.ts` | `orderIds[]` |
| `confirm-shipment/route.ts` | `orderId` / `orderIds[]` |
| `notify-arrival/route.ts` | `productId`, `roundId` |
| `rounds/route.ts` | `id` (PUT) |
| `suppliers/route.ts` | `id` (PUT, DELETE) |

Each fixed route has a corresponding malformed-UUID test case that asserts `400` and confirms the DB layer is never called.

**P1 — submit-order local UUID_RE removed**

`submit-order/route.ts` previously defined a local `UUID_RE` regex and used `superRefine` blocks for `round_id`, `submission_key`, and `product_id`. These are now replaced with `uuidStringSchema("field")` from `lib/validation.ts`. The local `UUID_RE` constant is deleted.

**P2 — brace-expansion advisory resolved**

`npm audit` reported 1 moderate advisory (`brace-expansion < 1.1.13` via `eslint` and `< 5.0.5` via `eslint-config-next`). Pinned via `overrides` in `package.json`. Audit is now clean.

**P2 — fireAndForget fallback is now lazy**

The `catch` branch in `fire-and-forget.ts` previously called `runTask()` immediately and passed the already-running promise to `waitUntil`. Changed to `Promise.resolve().then(() => runTask())` so the task starts only when the runtime's scheduler picks it up, matching the semantics of the primary `after()` path. The test for this branch was updated accordingly.

**P3 — ADMIN_EMAILS parse cached**

`isAllowedAdminEmail` in `supabase-admin.ts` previously split and normalized `process.env.ADMIN_EMAILS` on every call. Now cached in a module-level `Set` on first call.

### Open Items

**Must resolve before final production sign-off:**

1. Configure `PUBLIC_ORDER_ACCESS_SECRET` (and all other required env vars) on the staging/preview Vercel deployment.
2. Rerun `npm run staging:smoke` against the preview deployment and confirm `"status": "passed"` in the summary JSON.
3. Rerun `npm run staging:artifacts` with the passing smoke run ID; confirm the manifest `siteUrl` matches the staging URL.
4. Attach the resulting artifact bundle to this document.

**Manual/provider proofs still required (per `docs/staging-smoke-runbook.md`):**

- Real LINE binding with a human account + screenshot of delivered LINE push notification.
- Spreadsheet-app (Excel/Numbers) visual verification of the exported CSV — check encoding, column alignment, and Chinese characters.
- Remaining browser/provider screenshots listed in the runbook.

### Known Tactical Patches (not blockers)

- `picomatch` and `brace-expansion` overrides in `package.json` are patches, not permanent solutions. Track against upstream `tailwindcss` / `vitest` / `eslint` dependency upgrades.
- Bearer-token fallback in `verifyAdminSession` (`supabase-admin.ts:131-135`) is used by staging tooling and the initial session-establishment flow. The dual-path is intentional; document in `CLAUDE.md` before production launch.
- `products/route.ts` (lines 19-20) still contains a local `UUID_RE` used in `nullableSupplierIdSchema`. Supplier_id IS validated for UUID format when non-null — the validation is correct, but stylistically inconsistent with the shared `uuidStringSchema`. Clean up when next touching this file. (P3, not a blocker.)

---

## CTO Conditional Sign-off — 2026-03-28

All code-side claims from the 2026-03-28 verification were independently verified TRUE with zero discrepancies.

### Staging Smoke — PASSED 2026-03-28

| Item | Result |
|------|--------|
| Run ID | `20260328072334` |
| Base URL | `https://tendys-checkout-git-staging-letstanleycook911-4248s-projects.vercel.app/` |
| Status | **passed** |
| Smoke summary | `artifacts/staging-smoke-20260328072334.json` |
| Artifact bundle | `artifacts/staging-20260328072334/` |

Smoke coverage: supplier create → round create → product create → delivery order → pickup order → lookup (2 results) → payment report → payment confirm → arrival notification → shipment confirm → cancel.

Artifact bundle contents:
- `lookup-results.png` — public lookup results page
- `order-detail.png` — signed order detail page
- `orders-export.csv` — admin CSV export
- `notification-logs.json` — notification log entries
- `shipment-print-popup.png` — shipment print popup screenshot
- `shipment-print-popup.html` — shipment print popup HTML

**All CTO conditions satisfied on code + automated staging side.**

### Remaining Manual/Provider Proofs

Still required per `docs/staging-smoke-runbook.md` before final production launch:

- Real LINE binding with a human account + screenshot of delivered LINE push notification.
- Spreadsheet-app (Excel/Numbers) visual verification of the exported CSV — check encoding, column alignment, and Chinese characters.
- Remaining browser/provider screenshots listed in the runbook.
