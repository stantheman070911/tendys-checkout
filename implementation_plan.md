# Performance Fix Implementation Plan

Merged findings from two independent audits into a phased, prioritized fix plan. The plan is ordered from quickest wins to deeper architectural changes, grouped into 6 phases.

## User Review Required

> [!IMPORTANT]
> **Phase 5 (Server Components) is HIGH difficulty** and touches every admin page. It's the largest change and may benefit from being done in a separate session.

> [!WARNING]
> **Phase 2 changes notification behavior**: Mutations will return before notifications finish. Notification failures will no longer block the admin UI, but will still be logged. The admin will see notification results on the next dashboard refresh rather than inline in the mutation response.

---

## Phase 1 — Quick Wins (No Architectural Changes)

### Storefront Caching

#### [MODIFY] [page.tsx](file:///Users/stanleylu/workspace/tendycheckout/app/page.tsx)

Replace `export const dynamic = "force-dynamic"` with `export const revalidate = 30` to enable ISR. Storefront data (round + products) changes infrequently; 30s staleness is acceptable.

### Font Optimization

#### [MODIFY] [layout.tsx](file:///Users/stanleylu/workspace/tendycheckout/app/layout.tsx)

Replace the 7 `@fontsource` CSS imports with `next/font/google`. Use only needed weights (400, 600, 700 for sans; 400, 700 for serif) with `display: 'swap'`. This gives automatic subsetting, preloading, and self-hosting.

### Database Indexes

#### [NEW] [prisma/migrations/migration_008_perf_indexes.sql](file:///Users/stanleylu/workspace/tendycheckout/prisma/migrations/migration_008_perf_indexes.sql)

```sql
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_users_purchaser_name ON public.users(lower(purchaser_name));
```

`order_items.product_id` is used in `product_progress` view joins and product/customer lookups. `users.purchaser_name` is used in public order lookup queries.

#### [MODIFY] [schema.prisma](file:///Users/stanleylu/workspace/tendycheckout/prisma/schema.prisma)

Add `@@index([product_id])` on `order_items` model declaration to keep Prisma schema in sync.

### Public API Cache Headers

#### [MODIFY] [app/api/rounds/route.ts](file:///Users/stanleylu/workspace/tendycheckout/app/api/rounds/route.ts)
#### [MODIFY] [app/api/products/route.ts](file:///Users/stanleylu/workspace/tendycheckout/app/api/products/route.ts)

Add `Cache-Control: public, s-maxage=30, stale-while-revalidate=60` header to public GET responses.

---

## Phase 2 — Fire-and-Forget Notifications

All mutation routes currently `await` the full notification delivery (LINE push + email send + DB log writes) before responding. This adds 200–1000ms per mutation.

**Approach**: Create a `fireAndForget()` helper that calls the notification function without awaiting it. Catch and log errors, but don't block the response. The notification result is no longer returned in the mutation response body.

#### [NEW] [lib/notifications/fire-and-forget.ts](file:///Users/stanleylu/workspace/tendycheckout/lib/notifications/fire-and-forget.ts)

Small helper that takes an async function and runs it detached from the response lifecycle. Uses `waitUntil()` if available in the Vercel runtime, otherwise runs untracked.

#### [MODIFY] [app/api/confirm-order/route.ts](file:///Users/stanleylu/workspace/tendycheckout/app/api/confirm-order/route.ts)

Change `const notifications = await sendPaymentConfirmedNotifications(...)` to `fireAndForget(() => sendPaymentConfirmedNotifications(...))`. Return `{ order }` without waiting.

#### [MODIFY] [app/api/quick-confirm/route.ts](file:///Users/stanleylu/workspace/tendycheckout/app/api/quick-confirm/route.ts)

Same pattern.

#### [MODIFY] [app/api/cancel-order/route.ts](file:///Users/stanleylu/workspace/tendycheckout/app/api/cancel-order/route.ts)

Same pattern for the admin cancel path.

#### [MODIFY] [app/api/confirm-shipment/route.ts](file:///Users/stanleylu/workspace/tendycheckout/app/api/confirm-shipment/route.ts)

For both single and batch modes: commit DB state, return response, fire notifications in background. Batch mode will no longer await `Promise.allSettled(shippedOrders.map(...))` before responding.

#### [MODIFY] [app/api/notify-arrival/route.ts](file:///Users/stanleylu/workspace/tendycheckout/app/api/notify-arrival/route.ts)

This is a deliberate "send notification" action, so we'll keep it awaited since the admin explicitly wants confirmation. No change here.

---

## Phase 3 — Admin Auth & Bootstrap Optimization

### Cache Token in [useAdminFetch](file:///Users/stanleylu/workspace/tendycheckout/hooks/use-admin-fetch.ts#6-57)

#### [MODIFY] [hooks/use-admin-fetch.ts](file:///Users/stanleylu/workspace/tendycheckout/hooks/use-admin-fetch.ts)

Cache the access token from `getSession()` in a ref. Reuse it for subsequent calls within the same session. Only re-fetch if the token is expired or missing.

### Shared Admin Round Context

#### [NEW] [contexts/AdminRoundContext.tsx](file:///Users/stanleylu/workspace/tendycheckout/contexts/AdminRoundContext.tsx)

React context that:
1. Fetches `/api/rounds?all=true` **once** in [AdminLayout](file:///Users/stanleylu/workspace/tendycheckout/app/admin/layout.tsx#31-172)
2. Resolves the open round and stores it in context
3. Fetches the pending order count in **parallel** with the round fetch
4. Exposes `round`, `pendingCount`, `refreshRound()` to all child pages

#### [MODIFY] [app/admin/layout.tsx](file:///Users/stanleylu/workspace/tendycheckout/app/admin/layout.tsx)

Wrap children in `<AdminRoundProvider>`. Remove the local `useEffect` that fetches rounds and pending counts. Read from context instead.

#### [MODIFY] [app/admin/dashboard/page.tsx](file:///Users/stanleylu/workspace/tendycheckout/app/admin/dashboard/page.tsx)

Remove the `adminFetch("/api/rounds?all=true")` call. Read `round` from `useAdminRound()` context. Immediately fire `Promise.all([orders, products, logs])` without waiting for round resolution.

#### [MODIFY] [app/admin/orders/page.tsx](file:///Users/stanleylu/workspace/tendycheckout/app/admin/orders/page.tsx)

Same: remove round fetch, read from context.

#### [MODIFY] [app/admin/products/page.tsx](file:///Users/stanleylu/workspace/tendycheckout/app/admin/products/page.tsx)

Same: remove round fetch, read from context.

#### [MODIFY] [app/admin/shipments/page.tsx](file:///Users/stanleylu/workspace/tendycheckout/app/admin/shipments/page.tsx)

Same: remove round fetch, read from context.

#### [MODIFY] [app/admin/suppliers/page.tsx](file:///Users/stanleylu/workspace/tendycheckout/app/admin/suppliers/page.tsx)

Same: remove round fetch, read from context. Also fix the sequential fetch pattern (suppliers → rounds → products) to parallel.

---

## Phase 4 — Database Query Optimizations

### Push Phone Filtering to SQL

#### [MODIFY] [lib/db/orders.ts](file:///Users/stanleylu/workspace/tendycheckout/lib/db/orders.ts)

In [findOrdersByPurchaserNameAndPhoneLast3()](file:///Users/stanleylu/workspace/tendycheckout/lib/db/orders.ts#466-489): Replace the current two-step (fetch-all-by-name, filter-in-JS) with a raw SQL query that does `RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 3) = $phoneLast3` at the database level.

### Remove Extra Product Query in Order Lookup

#### [MODIFY] [app/api/lookup/order/route.ts](file:///Users/stanleylu/workspace/tendycheckout/app/api/lookup/order/route.ts)

The [listActiveByRound()](file:///Users/stanleylu/workspace/tendycheckout/lib/db/products.ts#60-62) call on line 69 fetches all round products just to compute `any_under_goal`. Replace with a lightweight raw SQL count: `SELECT COUNT(*) FROM products LEFT JOIN product_progress ... WHERE current_qty < goal_qty AND round_id = $1`.

### Autofill Debounce Reduction

#### [MODIFY] [components/StorefrontClient.tsx](file:///Users/stanleylu/workspace/tendycheckout/components/StorefrontClient.tsx)

Reduce debounce from 450ms to 300ms.

---

## Phase 5 — Optimistic UI Updates (Skip Full Refetches)

Status: COMPLETE on 2026-03-25 after follow-up review fixes.

Implemented result:
- Added parent-owned optimistic mutation updates for admin orders and shipments
- Added `lib/admin/order-state.ts` helpers plus Vitest coverage for replacement, batch transitions, skipped-id shipment removal, and pending-count clamping
- Extended `AdminRoundContext` with local pending-count adjustment so the orders badge updates immediately
- Added 2-second debounced background revalidation on orders and shipments
- Follow-up fix: silent revalidation failures now preserve the last good UI and surface a non-blocking inline warning instead of replacing the page with the blocking error banner

After every admin mutation (confirm, cancel, ship), the current code calls `fetchData()` which re-fetches the entire dataset. Instead, patch the local state optimistically.

#### [MODIFY] [components/admin/OrderCard.tsx](file:///Users/stanleylu/workspace/tendycheckout/components/admin/OrderCard.tsx)

After [confirmPayment](file:///Users/stanleylu/workspace/tendycheckout/components/admin/OrderCard.tsx#74-76), [quickConfirm](file:///Users/stanleylu/workspace/tendycheckout/lib/db/orders.ts#765-788), [confirmShipment](file:///Users/stanleylu/workspace/tendycheckout/lib/db/orders.ts#671-688), and [handleCancel](file:///Users/stanleylu/workspace/tendycheckout/components/admin/OrderCard.tsx#91-116): instead of calling `onRefresh()` (which triggers a full re-fetch), call a new `onOptimisticUpdate(orderId, newStatus)` callback that patches the order in the parent's local state. Queue a background `fetchData()` with a debounce to sync eventually.

#### [MODIFY] [app/admin/orders/page.tsx](file:///Users/stanleylu/workspace/tendycheckout/app/admin/orders/page.tsx)

Add `handleOptimisticUpdate(orderId, newStatus)` that patches `orders` state in-place. Pass it to [OrderCard](file:///Users/stanleylu/workspace/tendycheckout/components/admin/OrderCard.tsx#30-394). Schedule a background refetch after 2s.

#### [MODIFY] [app/admin/shipments/page.tsx](file:///Users/stanleylu/workspace/tendycheckout/app/admin/shipments/page.tsx)

Same pattern for `ShipmentCard`.

---

## Phase 6 (Future / Out-of-Scope) — Noted for Later

These are deeper architectural changes identified in both audits but NOT included in this fix pass:

- **Server Components for admin** — Converting admin pages from client-fetch to server-rendered with Suspense. High difficulty, touches every admin page.
- **Local JWT Verification** — Replace `supabase.auth.getUser()` with local `jose.jwtVerify()`. Medium difficulty but requires careful security review.
- **Dashboard Stats Endpoint** — Dedicated SQL aggregation endpoint instead of fetching all orders. Medium difficulty.
- **Pagination** — Cursor-based pagination for orders and logs. Medium difficulty, includes frontend "load more" UI.
- **Background Job Queue** — Proper queue system for notifications instead of fire-and-forget.

---

## Verification Plan

### Automated Tests

Existing test suite (28 test files) covers all modified API routes. After changes, run:

```bash
cd /Users/stanleylu/workspace/tendycheckout && npx vitest run
```

Key tests that must still pass:
- [app/api/confirm-order/route.test.ts](file:///Users/stanleylu/workspace/tendycheckout/app/api/confirm-order/route.test.ts) — will need minor update since notification response shape changes (Phase 2)
- [app/api/confirm-shipment/route.test.ts](file:///Users/stanleylu/workspace/tendycheckout/app/api/confirm-shipment/route.test.ts) — same
- [app/api/quick-confirm/route.test.ts](file:///Users/stanleylu/workspace/tendycheckout/app/api/quick-confirm/route.test.ts) — same
- [app/api/cancel-order/route.test.ts](file:///Users/stanleylu/workspace/tendycheckout/app/api/cancel-order/route.test.ts) — same
- All other existing tests should pass without modification

### Build Verification

```bash
cd /Users/stanleylu/workspace/tendycheckout && npm run build
```

Must complete without errors. Specifically verifies:
- `next/font` imports are correct (Phase 1)
- ISR config is valid (Phase 1)
- No broken imports from the new context (Phase 3)

### Manual Verification

> [!NOTE]
> I'd appreciate your guidance on how to best test this manually — can you deploy to a staging environment, or do you run `npm run dev` locally against the production Supabase instance?

If local dev is available:

1. **Storefront** — `npm run dev`, open `/`. Verify page loads with fonts rendering correctly (no FOUT jank). Check Network tab for cache headers on API calls.
2. **Admin Dashboard** — Navigate to admin. Check Network tab: should see only 1 `/api/rounds` call (not 2). Verify pending count badge shows.
3. **Admin Actions** — Confirm an order, verify the response returns instantly (no waiting for LINE/email). Check that notifications still appear in the notification summary on next refresh.
4. **Autofill** — On storefront, enter nickname + phone, verify autofill triggers and feels snappier.

### Database Migration

The new indexes (Phase 1) should be applied manually to the Supabase database:

```sql
-- Run in Supabase SQL Editor
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_users_purchaser_name ON public.users(lower(purchaser_name));
```
