# Full Stack Performance Audit Report

## Status
- Implemented on 2026-03-25.
- The codebase now uses signed cookie-backed admin sessions, server-first admin page loading, paginated admin order/shipment data, normalized indexed public lookup fields, signed public order detail links, batch-streamed CSV export, bounded background notification dispatch, deterministic checkout stock locking, and optimized product-card images.

## Executive Summary
The perceived slowness across the Tendy Market application is primarily driven by client-side data over-fetching and missing pagination. The admin dashboard and order management pages download the entire unpaginated history of a group-buy round—including all associated user and order item records—just to calculate simple statistics and render lists. Furthermore, public order lookups rely on heavy, unindexable SQL regex operations that force full-table scans. Additionally, uncached Next.js dynamic rendering on the storefront and fake streaming limits in CSV exports severely impact high-traffic user flows.

## Audit Scope and Flows Reviewed
1. **Public User Storefront Render:** [app/page.tsx](file:///Users/stanleylu/workspace/tendycheckout/app/page.tsx) -> [lib/db/products.ts](file:///Users/stanleylu/workspace/tendycheckout/lib/db/products.ts) (focus on `product_progress` view caching).
2. **Order Checkout path:** [/api/submit-order/route.ts](file:///Users/stanleylu/workspace/tendycheckout/app/api/submit-order/route.ts) -> Database locking, sequential stock updates, and transaction boundaries.
3. **Public Order Lookup:** [lib/db/orders.ts](file:///Users/stanleylu/workspace/tendycheckout/lib/db/orders.ts) -> Database query patterns for public access verification.
4. **Admin Dashboard Flow:** [app/admin/dashboard/page.tsx](file:///Users/stanleylu/workspace/tendycheckout/app/admin/dashboard/page.tsx) -> Initial load, data aggregation, and rendering.
5. **Admin Order Management:** [app/admin/orders/page.tsx](file:///Users/stanleylu/workspace/tendycheckout/app/admin/orders/page.tsx) -> Filtering, batch selection, and post-mutation revalidation.
6. **Batch Notifications:** `/api/batch-confirm/route.ts` -> Asynchronous webhook/email dispatch patterns.
7. **Admin CSV Export:** `api/export-csv` streaming logic vs memory limits.

---

## Confirmed Bottlenecks

### 1. Massive Client-Side Data Over-Fetching (Admin Dashboard)
- **Summary**: The Admin Dashboard computes total revenue and status counts in the browser by fetching every single order, user, and order item for the active round.
- **Root Cause**: Lack of backend aggregation.
- **Exact Code Location**: [app/admin/dashboard/page.tsx](file:///Users/stanleylu/workspace/tendycheckout/app/admin/dashboard/page.tsx) (`fetchData` fetches `/api/orders?roundId=...`) -> computes `totalRevenue = nonCancelled.reduce(...)`.
- **Affected Flow**: Admin Dashboard initial load.
- **Evidence**: The component downloads the complete `OrderWithItems[]` array, flattens `allItems`, and runs standard `.filter().length` and `.reduce()` operations in the frontend.
- **Impact**: High. O(N) network payload size and client memory usage. As a round grows to hundreds of orders, TTFB (Time to First Byte) will degrade, and the UI will freeze during JSON parsing and React rendering.
- **Recommended Fix**: Create a dedicated `/api/dashboard/stats` endpoint that uses Prisma's `aggregate` and `groupBy` functions to calculate revenue and counts natively in PostgreSQL.
- **Estimated Difficulty**: Medium
- **Estimated Impact**: High
- **Priority**: P0

### 2. Full-Table Scan on Public Order Lookup
- **Summary**: The public lookup feature uses raw SQL with `lower()`, `COALESCE()`, and `REGEXP_REPLACE()` functions on the fly, making it impossible for the database to use indexes.
- **Root Cause**: Unindexable search patterns.
- **Exact Code Location**: [lib/db/orders.ts](file:///Users/stanleylu/workspace/tendycheckout/lib/db/orders.ts) -> [findPublicOrderIdsByIdentity()](file:///Users/stanleylu/workspace/tendycheckout/lib/db/orders.ts#196-211).
- **Affected Flow**: Public Order Lookup.
- **Evidence**: `WHERE lower(COALESCE(u.purchaser_name, '')) = ... AND RIGHT(REGEXP_REPLACE(...), 3) = ...`
- **Impact**: High. This forces a sequential scan of the `users` table on every public lookup or order view. In high-traffic scenarios (e.g., after an arrival notification), this will spike CPU utilization on the Supabase database and slow down the entire system.
- **Recommended Fix**: Add a `phone_last3` and `normalized_purchaser_name` column to the User model, compute them at creation time, and index them (`@@index([normalized_purchaser_name, phone_last3])`).
- **Estimated Difficulty**: Medium
- **Estimated Impact**: High
- **Priority**: P0

### 3. Client-Side Rendering Gridlock (No Pagination)
- **Summary**: The admin orders page renders every order in the round simultaneously without pagination or virtualization.
- **Root Cause**: Missing pagination limits.
- **Exact Code Location**: [app/admin/orders/page.tsx](file:///Users/stanleylu/workspace/tendycheckout/app/admin/orders/page.tsx) -> `{filtered.map((o) => <OrderCard ... />)}`.
- **Affected Flow**: Admin Orders list interaction and filtering.
- **Evidence**: The component fetches all orders and maps over `filtered`. There is no `LIMIT`/`OFFSET` in the API call, and no virtual list (e.g., `tanstack/react-virtual`) in the DOM.
- **Impact**: High. Rendering hundreds of complex `OrderCard` DOM nodes will lock the browser's main thread, causing severe interaction latency when typing in the search bar or changing filter tabs.
- **Recommended Fix**: Implement server-side pagination with limit/offset parameters, or apply a virtualized list component on the frontend if bulk searching is strictly required.
- **Estimated Difficulty**: Medium
- **Estimated Impact**: High
- **Priority**: P1

### 4. Destructive Post-Mutation Revalidation Polling
- **Summary**: Changing an order's status triggers a "silent" fetch that re-downloads the entire unpaginated order database 2 seconds later.
- **Root Cause**: Naive state synchronization pattern.
- **Exact Code Location**: [app/admin/orders/page.tsx](file:///Users/stanleylu/workspace/tendycheckout/app/admin/orders/page.tsx) -> `scheduleRevalidate` -> `fetchData({ silent: true })`.
- **Affected Flow**: Admin confirming orders, marking shipments, or acting in POS.
- **Evidence**: The `handleOrderMutated` function successfully applies an optimistic update, but then calls `scheduleRevalidate()`, which triggers a full `adminFetch('/api/orders')` array reload via `setTimeout`.
- **Impact**: Medium. If an admin clicks "Confirm" 5 times in a row, the app queues multiple multi-megabyte JSON downloads in the background, causing network waterfalls and garbage collection stutters.
- **Recommended Fix**: Trust the optimistic update and remove the 2-second background refetch. Rely on explicit user refreshes or target only the specific mutated order if a refetch is mandatory.
- **Estimated Difficulty**: Low
- **Estimated Impact**: Medium
- **Priority**: P1

### 5. Unbounded Concurrent Notification Dispatches
- **Summary**: Batch confirming orders fires off email and LINE API calls for all selected orders concurrently, risking rate limits and memory spikes.
- **Root Cause**: Unchunked Promise.allSettled execution.
- **Exact Code Location**: [app/api/batch-confirm/route.ts](file:///Users/stanleylu/workspace/tendycheckout/app/api/batch-confirm/route.ts) -> `Promise.allSettled(confirmedOrders.map(...))`.
- **Affected Flow**: Admin batch confirmation.
- **Evidence**: `fireAndForget` passes a massive array of concurrent promises to `globalThis.waitUntil`. If an admin bulk-confirms 300 orders, it fires 300 concurrent requests to external APIs.
- **Impact**: Medium. Will likely result in 429 Too Many Requests from Resend or LINE, or cause the Vercel serverless function to hit its memory/execution time ceiling.
- **Recommended Fix**: Implement chunking using a utility like `p-map` with a concurrency limit (e.g., 10-20), or offload notifications to a true background queue (like Inngest or Upstash QStash).
- **Estimated Difficulty**: Low
- **Estimated Impact**: Medium
- **Priority**: P2

### 6. Fake Streaming in CSV Export Causes OOM
- **Summary**: The CSV export route reads all orders into memory before streaming, risking serverless timeouts.
- **Root Cause**: [/api/export-csv/route.ts](file:///Users/stanleylu/workspace/tendycheckout/app/api/export-csv/route.ts) awaits [listByRound(roundId)](file:///Users/stanleylu/workspace/tendycheckout/lib/db/products.ts#26-59) fully before starting the `ReadableStream`.
- **Exact Code Location**: [app/api/export-csv/route.ts](file:///Users/stanleylu/workspace/tendycheckout/app/api/export-csv/route.ts) line 22
- **Affected Flow**: Admin CSV download.
- **Evidence**: `const orders = await listByRound(roundId.trim());` is synchronously awaited before streaming begins.
- **Impact**: High. Will hit Vercel's 50MB function memory limit or 10s timeout for large rounds.
- **Recommended Fix**: Inside the `ReadableStream` start controller, fetch orders in chunks (e.g., using `take`, `skip`) and enqueue rows iteratively.
- **Estimated Difficulty**: Medium
- **Estimated Impact**: High
- **Priority**: P2

### 7. Uncached Dynamic Storefront Rendering & Heavy `product_progress` View
- **Summary**: The public storefront drops caching entirely and runs a massive O(N) aggregate database view on every load.
- **Root Cause**: [app/page.tsx](file:///Users/stanleylu/workspace/tendycheckout/app/page.tsx) reads `searchParams`, opting the page into dynamic rendering. This runs [getOpenRound()](file:///Users/stanleylu/workspace/tendycheckout/lib/db/rounds.ts#4-10) and [listActiveByRound()](file:///Users/stanleylu/workspace/tendycheckout/lib/db/products.ts#60-62), which joins the unbounded `product_progress` view.
- **Exact Code Location**: [app/page.tsx](file:///Users/stanleylu/workspace/tendycheckout/app/page.tsx), [prisma/migration.sql](file:///Users/stanleylu/workspace/tendycheckout/prisma/migration.sql)
- **Affected Flow**: Public storefront load.
- **Evidence**: `searchParams` forces server rendering dynamically on every visit. The underlying view aggregates `order_items` across the *entire system history*.
- **Impact**: Medium to High on load spikes.
- **Recommended Fix**: Wrap storefront DB fetchers in `unstable_cache`. Denormalize `current_qty` onto the [Product](file:///Users/stanleylu/workspace/tendycheckout/app/admin/products/page.tsx#13-200) table via transactional updates.
- **Estimated Difficulty**: High
- **Estimated Impact**: High
- **Priority**: P2

---

## Possible But Unconfirmed Issues

### 1. Session Auth Latency
- **Why it is suspicious**: Every secure API route calls `verifyAdminSession(request)`.
- **Missing Evidence**: The code for [lib/auth/supabase-admin.ts](file:///Users/stanleylu/workspace/tendycheckout/lib/auth/supabase-admin.ts) is not provided. If `supabase.auth.getSession()` makes a network call to the Supabase Auth server on every request instead of locally verifying the JWT signature, it adds 50-150ms of latency to every admin API call.
- **How to verify it**: Check [lib/auth/supabase-admin.ts](file:///Users/stanleylu/workspace/tendycheckout/lib/auth/supabase-admin.ts) to see if it relies on network validation or local JWT decoding.

### 2. Sequential Row Locking & Deadlock Risks
- **Why it is suspicious**: In [lib/db/orders.ts](file:///Users/stanleylu/workspace/tendycheckout/lib/db/orders.ts) ([createOrderInTx](file:///Users/stanleylu/workspace/tendycheckout/lib/db/orders.ts#301-388)), the code iterates over items and executes `tx.$executeRaw UPDATE products SET stock...` sequentially.
- **Missing Evidence**: Requires database profiling. Updating rows sequentially isn't inherently bad, but if concurrent checkouts access the same products in different orders (e.g., User A buys Apple then Banana; User B buys Banana then Apple), PostgreSQL can deadlock.
- **How to verify it**: Review database logs for deadlocks. Consider sorting items by `product_id` alphanumerically before running the update loop to guarantee deterministic lock acquisition.

---

## Top 5 Bottlenecks Ranked by Impact
1. Full-Table Scan in Public Lookups (DB CPU spike risk).
2. Admin Dashboard Client-Side Aggregation (Network & Memory choke).
3. No Pagination on Admin Orders Page (Browser Main Thread lock).
4. Full-Payload Polling After Mutations (Redundant network waterfalls).
5. Unbounded Concurrent Notifications (Third-party Rate limit risks).

---

## Quick Wins (Can be implemented immediately)

- **Remove Revalidation Polling**: Delete the `scheduleRevalidate` logic in [app/admin/orders/page.tsx](file:///Users/stanleylu/workspace/tendycheckout/app/admin/orders/page.tsx). You already have optimistic UI updates working via `applyBatchStatusTransition`; trust them.
- **Chunk Notifications**: Wrap the notification dispatch in `batch-confirm` in a simple chunking loop (e.g., process 10 at a time) to protect against API rate limits.
- **Sort Items Before Checkout Update**: In [lib/db/orders.ts](file:///Users/stanleylu/workspace/tendycheckout/lib/db/orders.ts), sort items by `product_id` before the `for` loop to eliminate transaction deadlock risks.

---

## Deeper Fixes (Requiring Architectural Change)

- **Backend Aggregation API**: Rewrite `/api/dashboard/stats` to use `prisma.order.aggregate({ _sum: { total_amount: true } })` and `prisma.order.groupBy` rather than sending the raw data objects to the client.
- **Pre-Computed Indexed Columns**: Alter the User schema to include `phone_digits_last3` and `purchaser_name_lower`. Update the submit-order flow to populate these fields. Add standard indexes to them. Rewrite the [findPublicOrderIdsByIdentity](file:///Users/stanleylu/workspace/tendycheckout/lib/db/orders.ts#196-211) raw SQL to query against these exact columns instead of using runtime regex/lower functions.
- **Server-Side Pagination**: Add `skip` and `take` to `/api/orders`, and implement standard cursor or offset pagination on the frontend.
- **True Streaming for CSV Exports**: Fetch data incrementally inside the `ReadableStream` instead of querying the Database fully upfront on [app/api/export-csv/route.ts](file:///Users/stanleylu/workspace/tendycheckout/app/api/export-csv/route.ts).
- **Denormalize Progress Tracking**: Migrate `product_progress` from an aggregate View into a discrete column on the `products` table that uses database transactional updates to unblock storefront caching.
