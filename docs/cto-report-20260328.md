# Production Readiness Report
**Project:** tendycheckout — 生鮮團購訂購系統
**Date:** 2026-03-28
**Prepared by:** Engineering
**CTO Decision: SIGNED OFF** ✓

> Archived historical snapshot only.
> This document is not the current approval source. Use `roadmap.md` for live release status.

---

## Executive Summary

All code-side findings across both 2026-03-28 CTO review rounds have been resolved and independently verified TRUE. The staging smoke run passed completely against the `staging` branch preview deployment. All 6 artifact files were captured and verified. Automated gates are clean. Required env vars are confirmed set on Vercel for both Preview and Production scopes.

**The codebase is production-ready. No further code changes are required.**

Two manual/provider proofs remain before serving live traffic — both require a live LINE account and a physical spreadsheet application.

---

## Gate Results

| Gate | Result | Detail |
|------|--------|--------|
| `npm test` | **PASSED** | 44 files / 212 tests |
| `npm run lint` | **PASSED** | Zero warnings |
| `npx tsc --noEmit` | **PASSED** | Strict mode, zero errors |
| `npm run build` | **PASSED** | Next.js production build clean |
| `npm run test:e2e` | **PASSED** | 2 Playwright tests (admin CSV + shipment print) |
| `npm audit --json` | **PASSED** | 0 vulnerabilities |
| `npm run staging:smoke` | **PASSED** | Run ID `20260328072334` — see §4 |

---

## Code Findings — Resolution Summary

### P1: UUID Validation Normalized Across All Admin Routes

**Finding:** 9 admin routes accepted arbitrary strings for ID parameters. Malformed input bypassed validation and reached the Prisma/PostgreSQL layer, producing opaque `500` errors instead of a proper `400`.

**Routes fixed:**

| Route | Parameter(s) Fixed |
|-------|--------------------|
| `app/api/orders/[id]/route.ts` | `id` (path param) |
| `app/api/export-csv/route.ts` | `roundId` (query param) |
| `app/api/confirm-order/route.ts` | `orderId` |
| `app/api/quick-confirm/route.ts` | `orderId` |
| `app/api/batch-confirm/route.ts` | `orderIds[]` (array) |
| `app/api/confirm-shipment/route.ts` | `orderId` / `orderIds[]` |
| `app/api/notify-arrival/route.ts` | `productId`, `roundId` |
| `app/api/rounds/route.ts` | `id` (PUT) |
| `app/api/suppliers/route.ts` | `id` (PUT, DELETE) |

**How fixed:** All routes now use `uuidStringSchema("fieldName")` from `lib/validation.ts` — a shared Zod v4 schema that trims input, enforces RFC 4122 UUID format with version/variant bit validation, and returns a field-scoped error message on failure. The DB layer is never reached on malformed input.

**Test coverage:** Each fixed route has a dedicated `it("returns 400 for malformed id")` test case that asserts `400` and confirms the DB mock was never called. Two new test files were created (`orders/[id]/route.test.ts`, `rounds/route.test.ts`). Eight existing test files were updated.

**Test count delta:** 193 → 211 tests (+18), 42 → 44 test files (+2).

---

### P1: `submit-order` Local UUID Regex Removed

**Finding:** `submit-order/route.ts` defined a local `UUID_RE = /^[0-9a-f]{8}-.../i` regex and used three separate hand-rolled `superRefine` blocks to validate `round_id`, `submission_key`, and `product_id`. This diverged from the shared validation helper and produced inconsistent error messages.

**Fix:** The local `UUID_RE` constant was deleted. All three `superRefine` blocks were replaced with `uuidStringSchema("field")` one-liners, matching every other validated route in the codebase.

**Risk delta:** None. The regex was functionally equivalent; this is a maintenance and consistency fix. The shared helper is now the single implementation of UUID validation across the entire API surface.

---

### P2: `brace-expansion` Dependency Advisory Resolved

**Finding:** `npm audit` reported 1 moderate advisory — `brace-expansion < 1.1.13` via `eslint → minimatch` and `brace-expansion < 5.0.5` via `eslint-config-next → typescript-estree → minimatch`.

**Fix:** Pinned via targeted `overrides` in `package.json`:

```json
"overrides": {
  "brace-expansion": "1.1.13",
  "eslint": { "brace-expansion": "1.1.13" },
  "eslint-config-next": { "brace-expansion": "5.0.5" }
}
```

`npm audit` now reports **0 vulnerabilities**.

**Note:** These are tactical pins, not permanent solutions. Track against upstream `eslint` and `eslint-config-next` releases. The prior `picomatch` override (added 2026-03-26) follows the same pattern.

---

### P2: `fireAndForget` Fallback Path Made Lazy

**Finding:** The `catch` branch in `lib/notifications/fire-and-forget.ts` called `runTask()` immediately and passed the already-running promise to `waitUntil`. This violated the deferred-execution contract of the primary `after()` path — the task started synchronously on the request thread instead of being scheduled post-response.

**Fix:**

```typescript
// Before (eager):
const promise = runTask();
runtime.waitUntil?.(promise);

// After (lazy):
runtime.waitUntil?.(Promise.resolve().then(() => runTask()));
```

The task now starts only when the runtime's microtask scheduler picks it up, matching the semantics of the primary `after()` path. The test for this branch was updated to assert `task` is NOT called before `await capturedPromise`, then IS called after.

---

### P3: `ADMIN_EMAILS` Parse Cached

**Finding:** `isAllowedAdminEmail()` in `lib/auth/supabase-admin.ts` split, trimmed, and lowercased `process.env.ADMIN_EMAILS` on every call — every admin session validation re-parsed the same string.

**Fix:** Module-level `Set<string>` cache, populated lazily on first call:

```typescript
let cachedAllowedEmails: Set<string> | null = null;

function isAllowedAdminEmail(email: string) {
  if (!cachedAllowedEmails) {
    cachedAllowedEmails = new Set(
      (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    );
  }
  return cachedAllowedEmails.has(email.toLowerCase());
}
```

---

### P3 Deferred: `products/route.ts` Local UUID Regex

**Observation (CTO, 2026-03-28):** `products/route.ts` lines 19–20 still contain a local `UUID_RE` used in `nullableSupplierIdSchema`. The `supplier_id` field IS validated for UUID format when non-null — the behavior is correct — but the implementation is stylistically inconsistent with the rest of the codebase.

**Status:** Deferred. Not a blocker. Will be cleaned up when this file is next touched.

---

## Staging Smoke Run

**Run ID:** `20260328072334`
**Date/Time:** 2026-03-28 07:23–07:24 UTC
**Target:** `https://tendys-checkout-git-staging-letstanleycook911-4248s-projects.vercel.app/`
**Branch:** `staging`
**Status:** `passed`

### End-to-End Flow Coverage

| Step | Result |
|------|--------|
| POST `/api/suppliers` — create supplier | ✅ `2bd63f86-...` |
| POST `/api/rounds` — create open round | ✅ `e4b9fef1-...` |
| POST `/api/products` — create product | ✅ `5d3ddca4-...` |
| POST `/api/submit-order` — delivery order (宅配) | ✅ `ORD-20260328-001` |
| POST `/api/submit-order` — pickup order (面交) | ✅ `ORD-20260328-002` |
| POST `/api/lookup` — identity lookup | ✅ 2 orders returned |
| POST `/api/report-payment` | ✅ `ORD-20260328-001` |
| POST `/api/confirm-order` | ✅ `ORD-20260328-001` |
| POST `/api/notify-arrival` | ✅ queued for `5d3ddca4-...` |
| POST `/api/confirm-shipment` | ✅ `ORD-20260328-001` → `shipped` |
| POST `/api/cancel-order` | ✅ `ORD-20260328-002` → `cancelled` |

### Notification Log (from artifact)

| Type | Channel | Status |
|------|---------|--------|
| `payment_confirmed` | email | `success` |
| `payment_confirmed` | line | `skipped` (no LINE binding on smoke account — expected) |
| `product_arrival` | email | `success` |
| `product_arrival` | line | `skipped` (expected) |
| `shipment` | email | `success` |
| `shipment` | line | `skipped` (expected) |

LINE notifications skipped correctly — the smoke account has no LINE binding. Email channels succeeded. No error entries.

### CSV Export (from artifact)

Two rows produced — one per order. Columns include: order number, nickname, purchaser name, recipient name, phone, address, pickup method, line items, subtotals, shipping fee, total, status, payment fields, timestamps, cancel reason, note. BOM header present (`﻿`) for Excel compatibility. Chinese characters intact.

Sample row (delivery order, shipped):
```
ORD-20260328-001, smoke-20260328072334, 煙霧測試, 煙霧測試, 0912-000-678,
台北市信義區煙霧測試路 1 號, 宅配, Smoke Product 20260328072334x1, 120, 60, 180,
已出貨, 180, 12345, 2026/3/28 上午7:23:55, 2026/3/28 上午7:23:58, 2026/3/28 上午7:24:04
```

---

## Artifact Bundle

**Location:** `artifacts/staging-20260328072334/`
**Manifest siteUrl:** `https://tendys-checkout-git-staging-letstanleycook911-4248s-projects.vercel.app/` ✅ (matches `STAGING_BASE_URL`, not production)

| File | Description |
|------|-------------|
| `manifest.json` | Run metadata, siteUrl, artifact list |
| `lookup-results.png` | Public lookup page showing both smoke orders |
| `order-detail.png` | Signed order detail for `ORD-20260328-001` |
| `orders-export.csv` | Admin CSV export for the smoke round |
| `notification-logs.json` | Full notification log (6 entries) |
| `shipment-print-popup.png` | Shipment print popup screenshot |
| `shipment-print-popup.html` | Shipment print popup HTML source |

---

## Known Tactical Patches

These are not blockers but should be tracked before production:

1. **`picomatch` and `brace-expansion` overrides** — both are temporary pins via `package.json` overrides. Permanent resolution requires upstream `tailwindcss` / `vitest` / `eslint` major version bumps.

2. **Bearer-token fallback in `verifyAdminSession`** (`supabase-admin.ts:131–135`) — the dual-path (signed cookie + Bearer token fallback) is intentional. The Bearer path is used by staging tooling and the initial session-establishment flow. This should be explicitly documented in `CLAUDE.md` before production launch.

---

## Outstanding Items Before Production Launch

These require human action and cannot be automated:

### 1. LINE Integration Proof
- Bind a real LINE account to a test order using the `order_number + purchaser_name + phone_last3` webhook flow
- Screenshot of the delivered LINE push notification (payment confirmed, shipment, or arrival type)
- Confirms: LINE Channel Access Token is valid on the production deployment, webhook signature verification is working, and push delivery is functional end-to-end

### 2. CSV Encoding Verification
- Open `artifacts/staging-20260328072334/orders-export.csv` in Excel (Windows) or Numbers (Mac)
- Confirm: BOM is recognized (no `ï»¿` prefix visible), Chinese column headers render correctly, all columns align, date formats are readable
- This cannot be verified programmatically — spreadsheet app rendering must be observed directly

### 3. Remaining Runbook Screenshots
Per `docs/staging-smoke-runbook.md`, the following browser/provider screenshots are still required:
- Admin dashboard, orders list, shipments list with smoke data visible
- Public storefront with the smoke round open
- Public order detail page (already partially covered by `order-detail.png`)
- Any additional provider confirmation screenshots specified in the runbook

---

## Round 2 Remediation (2026-03-28)

Following the first CTO review, a second round identified one remaining P1 and one P3.

### P1 — cancel-order admin orderId missing UUID validation

`cancel-order/route.ts` used `optionalTrimmedStringSchema()` for `orderId`. A malformed string passed directly to `cancelOrder()` and hit the Prisma layer as a `500` — the exact class of bug the remediation was supposed to eliminate. Changed to `optionalUuidStringSchema("orderId")`. Malformed admin `orderId` now returns `400` before any DB call. Test fixture updated to valid UUID; malformed-UUID test case added.

### P3 — products/route.ts local UUID_RE removed

`nullableSupplierIdSchema` used a local `UUID_RE` regex. Replaced with `z.string().uuid().safeParse()` inline. `optionalUuidStringSchema` was not used directly because the schema must distinguish `null` (clear supplier_id) from `undefined` (no change) — semantics that `optionalUuidStringSchema` collapses to `undefined`. Behavior is identical; local regex is gone.

### Documentation

`CLAUDE.md` now has an Operational Notes section documenting: (1) the `verifyAdminSession` Bearer-token fallback is intentional dual-path used by staging tooling, and (2) `ADMIN_EMAILS` cache requires a Vercel redeploy to pick up changes.

---

## Commit Log (this review cycle)

| Commit | Summary |
|--------|---------|
| `702e866` | fix: P1 UUID validation on cancel-order admin path; P3 remove UUID_RE from products |
| `ab31c77` | docs: add comprehensive CTO production readiness report |
| `29f7d5b` | feat: pass staging smoke + capture artifacts; fix hydration race in artifacts |
| `889d8b2` | CTO remediation pass: normalize UUID validation, clean audit record |
| `0c85c57` | Harden staging validation and fix preview smoke tooling |

---

## Conclusion

The codebase is production-ready. UUID validation is now uniform across the full admin route set — including the cancel-order admin path that was missed in round 1. The shared `uuidStringSchema` / `optionalUuidStringSchema` helpers are the single implementation. The dependency audit is clean. The staging smoke run passed end-to-end against the correct deployment target with a complete artifact bundle. All four required env vars are confirmed set on Vercel.

Final production launch is gated only on the three manual/provider proof items listed above.
