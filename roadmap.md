# roadmap.md

> **READ THIS FILE AT THE START OF EVERY SESSION.**
> This file is the single source of truth for what is done, what is in progress, and what is next.
> After reading this file, read `CLAUDE.md` and `whatwearebuilding.md` for full context.

---

## How to Use This File

1. **Find the current phase** — scan for the first `[ ]` or `[~]` checkbox. That's where you are.
2. **Read that phase's section** — understand what needs to be built and the acceptance criteria.
3. **Build only that phase** — do not skip ahead. Do not "prepare" for future phases.
4. **After completing a task** — change its `[ ]` to `[x]` and commit this file with the code.
5. **At each checkpoint** — run ALL verification commands. Do not proceed if any fail.
6. **If you see `[~]`** — that task was started but not finished. Pick up where it left off.

### Status Legend

- `[x]` — Done, verified, committed
- `[~]` — In progress (started in a previous session, not yet complete)
- `[ ]` — Not started

---

## Phase 0: Project Scaffolding

> **Goal:** Empty Next.js project that builds, with all config and directory structure in place.
> No business logic. Just the skeleton.

### Tasks

- [x] **0.1** Initialize Next.js 16.1 project with TypeScript strict, App Router, Tailwind CSS 3, React 19
- [x] **0.2** Install dependencies: `prisma`, `@prisma/client`, `@supabase/supabase-js`, `resend`, shadcn/ui base
- [x] **0.3** Run `npx shadcn@latest init` + add components
- [x] **0.4** Create directory structure (all placeholder pages + lib skeleton):
  ```
  lib/db/          → prisma.ts (globalThis singleton, no models yet)
  lib/notifications/
  lib/auth/
  lib/utils.ts
  types/index.ts
  constants/index.ts
  app/page.tsx                      → "Coming soon" placeholder
  app/order/[id]/page.tsx           → placeholder (async params for Next.js 16)
  app/lookup/page.tsx               → placeholder
  app/admin/page.tsx                → placeholder
  app/admin/dashboard/page.tsx      → placeholder
  app/admin/orders/page.tsx         → placeholder
  app/admin/shipments/page.tsx      → placeholder
  app/admin/products/page.tsx       → placeholder
  app/admin/rounds/page.tsx         → placeholder
  app/admin/suppliers/page.tsx      → placeholder
  ```
- [x] **0.5** Create `.env.local.example` with all env vars from CLAUDE.md (no real values)
- [x] **0.6** Configure `next.config.ts` — minimal (native TS config in Next.js 16)
- [x] **0.7** Add shadcn/ui components: `button`, `input`, `select`, `badge`, `card`, `table`, `dialog`, `tabs`, `checkbox`, `toast`, `label`, `toaster`

### Checkpoint 0

```bash
npx tsc --noEmit     # must pass
npm run lint         # must pass
npm run build        # must pass — all pages render without error
```

**Done when:** Project builds clean. Every page renders a placeholder. No business logic.

**Status: COMPLETE** — All tasks done. `tsc`, `lint`, `build` all pass. Committed and pushed to `main`.

---

## Phase 1: Database Layer

> **Goal:** Prisma schema, Supabase migration SQL, all DB infrastructure.
> After this phase, all tables/triggers/RLS/views exist in Supabase.

### Tasks

- [x] **1.1** Write `prisma/schema.prisma` — 7 models matching `whatwearebuilding.md`:
  - Round (with `shipping_fee`), Supplier, Product (with `supplier_id`), User, Order (with `shipping_fee`, `shipped_at`, 5 statuses), OrderItem, NotificationLog (with `type`, nullable `order_id`)
  - All relations, constraints, indexes, defaults
- [x] **1.2** Run `npx prisma generate` — confirm no errors
- [x] **1.3** Write `prisma/migration.sql` — full Supabase migration:
  - 7 `CREATE TABLE` statements
  - Indexes (NOT on columns with `@unique`)
  - `generate_order_number()` trigger with `pg_advisory_xact_lock`
  - `handle_updated_at()` triggers for `users` and `suppliers`
  - All RLS policies (reference CLAUDE.md RLS table — `suppliers` is admin-only)
  - `product_progress` view (includes `supplier_id`)
  - `orders_by_product` view
- [x] **1.4** Write `types/index.ts` — TypeScript interfaces:
  - `Round`, `Supplier`, `Product`, `User`, `Order`, `OrderItem`, `NotificationLog`
  - `CartItem`, `OrderSubmitRequest`, `PaymentReportRequest`
  - `OrderStatus` union: `'pending_payment' | 'pending_confirm' | 'confirmed' | 'shipped' | 'cancelled'`
  - `NotificationType` union: `'payment_confirmed' | 'shipment' | 'product_arrival' | 'order_cancelled'`
  - `ProductProgress`, `OrderByProduct`
- [x] **1.5** Write `constants/index.ts`:
  - `ORDER_STATUS` enum object (5 statuses now)
  - `STATUS_LABELS` (Chinese: 待付款/待確認/已確認/已出貨/已取消)
  - `STATUS_COLORS` (Tailwind classes for each)
  - `NOTIFICATION_TYPES` enum
  - `PICKUP_OPTIONS` array
  - Bank info env var keys

### Checkpoint 1

```bash
npx prisma generate           # must succeed
npx tsc --noEmit              # must pass
npm run build                 # must pass
```

**Manual check — review `migration.sql` line by line:**
- [x] Advisory lock uses `pg_advisory_xact_lock`
- [x] RLS: anon `orders` UPDATE constrains both `using` AND `with check`
- [x] RLS: `notification_logs` AND `suppliers` have NO anon access
- [x] No redundant indexes on UNIQUE columns
- [x] `product_progress` view excludes cancelled orders, includes `supplier_id` (fixed: added FILTER clause)
- [x] `orders_by_product` view joins users, excludes cancelled
- [x] `orders.status` CHECK includes all 5 values
- [x] `notification_logs.type` CHECK includes all 4 values
- [x] `notification_logs.order_id` is nullable
- [x] `rounds.shipping_fee` column exists
- [x] `orders.shipping_fee` and `orders.shipped_at` columns exist
- [x] `products.supplier_id` FK exists with SET NULL on delete
- [x] `handle_updated_at` triggers on BOTH `users` AND `suppliers`

**Done when:** Prisma generates clean. Migration SQL reviewed. Types and constants compile.

---

## Phase 2: Library Layer (`lib/`)

> **Goal:** All pure TypeScript business logic. No API routes, no React.

### Tasks

- [x] **2.1** `lib/db/prisma.ts` — globalThis singleton PrismaClient
- [x] **2.2** `lib/db/users.ts`:
  - `findByNickname(nickname)`
  - `upsertByNickname(nickname, data)`
- [x] **2.3** `lib/db/products.ts`:
  - `listActiveByRound(roundId)` — with progress data + supplier name
  - `decrementStock(productId, qty)` — atomic SQL
  - `restoreStock(productId, qty)` — for cancellation
- [x] **2.4** `lib/db/rounds.ts`:
  - `getOpenRound()` — latest `is_open = true`
  - `findById(id)`
  - `create(data)` — includes `shipping_fee`
  - `close(id)`, `updateDeadline(id, deadline)`, `updateShippingFee(id, fee)`
- [x] **2.5** `lib/db/suppliers.ts`:
  - `list()` — all suppliers with product count
  - `findById(id)` — with associated products
  - `create(data)`, `update(id, data)`, `delete(id)`
- [x] **2.6** `lib/db/orders.ts`:
  - `createWithItems(data, items, submissionKey)` — transaction: validate stock → decrement → calc shipping fee (if 宅配 and round has fee) → insert order + items. Returns order or error.
  - `findBySubmissionKey(key)`
  - `reportPayment(orderId, amount, last5)`
  - `confirmOrder(orderId)` — status → confirmed, writes confirmed_at
  - `batchConfirm(orderIds)`
  - `confirmShipment(orderId)` — status → shipped, writes shipped_at
  - `batchConfirmShipment(orderIds)`
  - `cancelOrder(orderId, isAdmin?, cancelReason?)` — user: only pending_payment; admin: any status with reason. Restore stock (except shipped). Transaction.
  - `quickConfirm(orderId, paymentAmount)` — POS shortcut: pending_payment → confirmed, auto-fill payment fields + confirmed_at
  - `findByNicknameOrOrderNumber(query)` — for lookup
  - `listByRound(roundId, statusFilter?)`
  - `listConfirmedByRound(roundId)` — for 待出貨 page
  - `getOrderWithItems(orderId)`
  - `getOrdersByProduct(productId, roundId)` — all customers who ordered this product
- [x] **2.7** `lib/db/notification-logs.ts`:
  - `logNotification(orderId, channel, type, status, errorMessage?)` — orderId nullable for arrival notifications
  - `getLogsByOrder(orderId)`
  - `getLogsByRound(roundId)` — for dashboard notification summary
- [x] **2.8** ~~`lib/notifications/line-notify.ts`~~ → **Replaced by `lib/line/push.ts`** in Phase 3.5:
  - Old: `sendLineNotify(message)` — broadcast to all followers (deprecated, file deleted)
  - New: `sendLinePush`, `sendLineMulticast`, `sendLineReply`, `sendLineMessage` — 1-on-1 push via raw fetch, never-throw
- [x] **2.9** `lib/notifications/email.ts`:
  - `sendOrderConfirmationEmail(to, order, items)` — type: payment_confirmed
  - `sendShipmentEmail(to, order, items)` — type: shipment
  - `sendProductArrivalEmail(to, productName)` — type: product_arrival
  - `sendOrderCancelledEmail(to, order, items, cancelReason?)` — type: order_cancelled
  - All never-throw, return `{ success, error? }`
  - Plain HTML templates (Chinese)
- [x] **2.10** `lib/notifications/send.ts`:
  - `sendPaymentConfirmedNotifications(order, items)` — both channels + log
  - `sendShipmentNotifications(order, items)` — both channels + log
  - `sendProductArrivalNotifications(productName, customers)` — loop: send to each customer via both channels + log each
- [x] **2.11** `lib/auth/supabase-admin.ts`:
  - Supabase client with service role key
  - Supabase client with anon key
  - `verifyAdminSession(request)`
- [x] **2.12** `lib/utils.ts`:
  - `formatCurrency(amount)` → `$420`
  - `formatOrderItems(items)` → "有機地瓜x3、放山雞蛋x2"
  - `buildShareUrl(roundId)`
  - `buildLineShareUrl(url, text)`
  - `generateSubmissionKey()` → `crypto.randomUUID()`
  - `calcOrderTotal(items, shippingFee?)` — sum subtotals + optional shipping

### Checkpoint 2

```bash
npx tsc --noEmit     # must pass
npm run lint         # must pass
npm run build        # must pass
```

**Verify:**
- [x] `lib/` has ZERO imports from `react`, `next`, `next/server`
- [x] Only `lib/db/prisma.ts` contains `new PrismaClient()`
- [x] All notification functions are never-throw
- [x] `createWithItems` handles shipping fee: adds to total if 宅配, snapshots on order
- [x] `confirmShipment` writes `shipped_at`
- [x] `sendProductArrivalNotifications` loops over customers, doesn't stop on single failure
- [x] 4 email templates exist (payment_confirmed, shipment, product_arrival, order_cancelled)

**Status: COMPLETE** — All tasks done. `tsc`, `lint`, `build` all pass. All verification checks passed.

---

## Phase 3: API Routes

> **Goal:** All API routes. Backend fully functional and testable with curl.

### Tasks

- [x] **3.1** `app/api/submit-order/route.ts` — POST
  - Validate body: cart items, nickname, recipient info, pickup, submission_key
  - Check round is open
  - Call `createWithItems()` (handles stock + dedup + shipping fee)
  - Return order data or error
- [x] **3.2** `app/api/report-payment/route.ts` — POST
  - Validate: orderId, amount, last5 (len 5)
  - Check status = `pending_payment`
  - Call `reportPayment()`
- [x] **3.3** `app/api/cancel-order/route.ts` — POST
  - Two modes: user cancel (no auth, pending_payment only) and admin cancel (auth required, any status, optional cancel_reason)
  - User: check status = `pending_payment` → cancel + restore stock
  - Admin: any status → cancel + restore stock (except shipped) + send cancellation notification
- [x] **3.4** `app/api/confirm-order/route.ts` — POST (admin)
  - Verify admin → confirm → send payment_confirmed notifications → return results
- [x] **3.5** `app/api/batch-confirm/route.ts` — POST (admin)
  - Verify admin → batch confirm → send notifications for each
- [x] **3.6** `app/api/confirm-shipment/route.ts` — POST (admin)
  - Verify admin
  - Accept single `orderId` or array `orderIds` (handles both single + batch)
  - For each: update to `shipped` → send shipment notifications → log
  - Return results array
- [x] **3.7** `app/api/notify-arrival/route.ts` — POST (admin)
  - Verify admin
  - Validate: `productId`, `roundId`
  - Call `getOrdersByProduct()` to find all relevant customers
  - Call `sendProductArrivalNotifications()` with product name + customer list
  - Return: count notified, successes, failures
- [x] **3.8** `app/api/quick-confirm/route.ts` — POST (admin)
  - POS shortcut: takes `orderId` + `paymentAmount`
  - Verify admin → set status to `confirmed`, auto-fill payment fields, write `confirmed_at`
  - Send payment_confirmed notifications
  - Use case: admin collects cash in person, skips pending_confirm step
- [x] **3.9** `app/api/export-csv/route.ts` — GET (admin)
  - CSV with shipping fee column added
- [x] **3.10** `app/api/rounds/route.ts` — CRUD (admin)
  - POST (create) includes `shipping_fee`
  - PUT (update) can change `shipping_fee`
- [x] **3.11** `app/api/products/route.ts` — CRUD (admin)
  - Includes `supplier_id` in create/update
- [x] **3.12** `app/api/suppliers/route.ts` — CRUD (admin)
  - GET: list all with product count
  - POST: create, PUT: update, DELETE: delete (only if no linked products)
- [x] **3.13** `app/api/orders-by-product/route.ts` — GET (admin)
  - Query params: `productId`, `roundId`
  - Returns customer list: nickname, name, phone, quantity, order number

### Checkpoint 3

```bash
npx tsc --noEmit     # must pass
npm run lint         # must pass
npm run build        # must pass
```

**Verify:**
- [x] Every route validates input before DB
- [x] Every route returns `{ error }` + HTTP status on failure
- [x] Admin routes check `verifyAdminSession()` — return 401 if not admin
- [x] `submit-order` calculates shipping fee correctly (宅配 vs 面交)
- [x] `confirm-shipment` handles both single and batch
- [x] `notify-arrival` finds customers by product, not by order
- [x] `confirm-order`/`confirm-shipment` don't rollback on notification failure
- [x] Supplier DELETE is blocked if products reference it
- [x] `cancel-order` handles both user mode (pending_payment only) and admin mode (any status + reason + notification)
- [x] `quick-confirm` skips pending_confirm for POS cash payments

**Done when:** All 13 routes compile and build passes. Backend feature-complete.

**Status: COMPLETE** — All 13 routes done. `tsc`, `lint`, `build` all pass. LINE Notify migrated to LINE Messaging API. Committed and pushed to `main`.

---

## Phase 3.5: LINE Push Notification Migration

> **Goal:** Replace broadcast notifications with 1-on-1 push. Users link orders to their LINE account by pasting the order number into the LINE Official Account.

### Tasks

- [x] **3.5.1** Add `line_user_id` (TEXT, nullable) to Order model in `prisma/schema.prisma`
- [x] **3.5.2** Write `prisma/migration_002_line_push.sql` — `ALTER TABLE orders ADD COLUMN line_user_id TEXT`
- [x] **3.5.3** Create `lib/line/push.ts` — LINE API module (raw fetch, never-throw):
  - `sendLinePush(lineUserId, message)` — single user push
  - `sendLineMulticast(lineUserIds, message)` — batch up to 500, auto-chunks
  - `sendLineReply(replyToken, message)` — reply to webhook event (free)
  - `sendLineMessage(lineUserId, text, replyToken?)` — tries reply first, falls back to push
- [x] **3.5.4** Create `lib/line/webhook.ts` — HMAC-SHA256 signature verification
- [x] **3.5.5** Create `lib/line/validate-order-code.ts` — validates order number format (`ORD-YYYYMMDD-NNN`), links `line_user_id` to order (idempotent, per-order)
- [x] **3.5.6** Create `lib/line/message-handler.ts` — handles incoming LINE messages:
  - Order number pattern → validate + link → reply confirmation
  - Existing linked user → show order status
  - Unknown text → show instructions
- [x] **3.5.7** Create `app/api/line/webhook/route.ts` — LINE webhook endpoint:
  - Verify `x-line-signature` header
  - Dispatch text message events to `handleMessage()`
  - Always return 200 OK (LINE requirement)
- [x] **3.5.8** Update `lib/notifications/send.ts` — replace broadcast with targeted push:
  - Payment/shipment/cancellation: `sendLinePush(order.line_user_id, msg)`, skip if no `line_user_id`
  - Product arrival: collect all customer `line_user_id`s, use `sendLineMulticast(ids, msg)`
  - Add `line_user_id` to `OrderForNotify` and `CustomerForArrival` interfaces
- [x] **3.5.9** Update `types/index.ts` — add `line_user_id: string | null` to Order interface
- [x] **3.5.10** Update `app/api/notify-arrival/route.ts` — pass `line_user_id` in customer data
- [x] **3.5.11** Delete `lib/notifications/line-notify.ts` (dead code, replaced by `lib/line/push.ts`)
- [x] **3.5.12** ~~Add `order-link-template/` to `tsconfig.json` exclude array~~ (removed: template directory deleted in cleanup)

### Checkpoint 3.5

```bash
npx tsc --noEmit     # must pass
npm run lint         # must pass
npm run build        # must pass
```

**Verify:**
- [x] `lib/line/push.ts` uses raw fetch (no `@line/bot-sdk`)
- [x] All push functions are never-throw
- [x] Webhook verifies HMAC-SHA256 signature
- [x] Order linking is idempotent (re-pasting same order = no-op)
- [x] One order = one LINE account (ALREADY_LINKED error for different user)
- [x] `send.ts` imports from `@/lib/line/push`, not `line-notify`
- [x] Product arrival uses multicast (not individual pushes)
- [x] Missing `line_user_id` → skip LINE push gracefully (email still sent)

**Status: COMPLETE** — All tasks done. `tsc`, `lint`, `build` all pass. Committed to `main` (`d9583fd`).

---

## Phase 4: User-Facing Pages

> **Goal:** All 3 user pages functional. Full flow: browse → cart → checkout → pay → report → lookup.

### Tasks

- [x] **4.1** Shared components:
  - `ProgressBar.tsx` — orange/green, percentage, 🎉 at 100%
  - `SharePanel.tsx` — copy link + LINE share
  - `DeadlineBanner.tsx` — live countdown + 已截單 (urgent < 1h highlight)
  - `OrderStatusBadge.tsx` — 5 statuses with STATUS_COLORS
  - `CartBar.tsx` — sticky bottom (count + total + checkout) + **shipping fee hint** ("商品 $420 + 宅配運費 $60") + safe-area padding
  - `ProductCard.tsx` — +/- with stock limit + progress bar + 已售完 state
  - `ShippingFeeNote.tsx` — "宅配到以上地址，運費 $XXX"
- [x] **4.2** `app/page.tsx` — Storefront:
  - Server component shell (force-dynamic) + `StorefrontClient` client component
  - Fetch open round (with shipping_fee) + products with progress via Prisma
  - Product grid (1 col mobile, 2 col tablet+) with ProductCard
  - DeadlineBanner, SharePanel, CartBar
  - Checkout form with: nickname auto-fill (via `/api/users/lookup`), recipient fields, pickup select (Radix sentinel workaround), ShippingFeeNote, order summary
  - Submit: generates submission_key once per session, disables button, calls API, redirects to `/order/[id]`
  - Round closed → 已截單 + all controls disabled
- [x] **4.3** `app/order/[id]/page.tsx` — Order Confirmation + Payment Report:
  - Server component (force-dynamic), fetches order via `getOrderWithItems()`
  - `pending_payment`: bank details + `PaymentReportForm` + `CancelOrderButton` + share CTA + **「繼續選購」link**
  - `pending_confirm`: waiting status + payment info summary + share CTA
  - `confirmed`: confirmed state + "等待出貨"
  - `shipped`: shipped state with shipped_at timestamp
  - `cancelled`: cancelled state + cancel_reason (if any)
  - Payment report: two-step flow with amount vs order total comparison before submit
  - Cancel: Dialog confirmation → API → router.refresh()
- [x] **4.4** `app/lookup/page.tsx` — Order Lookup:
  - Search by nickname or order number via `/api/lookup`
  - Results with OrderStatusBadge, items summary, total (shipping shown separately)
  - **Each result clickable → links to `/order/[id]` detail page**
  - Empty/initial states handled

### Checkpoint 4

```bash
npx tsc --noEmit     # must pass
npm run lint         # must pass
npm run build        # must pass
```

**Verify:**
- [x] Storefront fetches from real API (server component calls Prisma directly)
- [x] +/- respects stock limits (client-side UX check, server re-validates)
- [x] Progress bar shows current/goal with percentage
- [x] **Shipping fee shows ONLY when 宅配 is selected AND round has fee**
- [x] **Order summary total correctly adds shipping fee**
- [x] Submit button disables after click + stays disabled
- [x] submission_key generated once per session (on first checkout click)
- [x] Share panel only when product under goal
- [x] Lookup works with both nickname and order number
- [x] Lookup results link to `/order/[id]` detail page
- [x] Order detail page handles all 5 statuses (cancelled shows reason if present)
- [x] Payment report has confirmation step before submit
- [x] CartBar shows shipping fee hint
- [x] Order confirmation page has "繼續選購" link
- [x] All pages mobile-responsive (LINE browser): viewport meta, 44px touch targets, safe-area padding, 16px font (no iOS zoom), single-column mobile-first layout

**Done when:** User full flow works end-to-end with real API.

**Status: COMPLETE** — All tasks done. `tsc`, `lint`, `build` all pass. Mobile-first: viewport meta with viewportFit=cover, 44px min touch targets on all inputs/buttons, safe-area padding on CartBar, 16px base font to prevent iOS zoom, single-column mobile layout with responsive grid.

**Additional:** Admin route obfuscation applied — `/admin` redirects to `/gtfo` (troll page). Real admin accessed via `/bitchassnigga` (rewrites in `next.config.ts`). Mock UI/UX from `prdandmock.tsx` applied to all Phase 4 pages.

---

## Phase 5: Admin Pages — Core

> **Goal:** Login + dashboard + order management + product/round management.

### Tasks

- [x] **5.1** `app/admin/page.tsx` — Login:
  - Email/password → Supabase Auth → redirect to dashboard
- [x] **5.2** Admin auth guard + navigation:
  - Check session on all `/admin/*` (except login) → redirect if unauthenticated
  - **Fixed navigation bar** (sidebar or top nav) with all admin sections + current round name + logout button
- [x] **5.3** `app/admin/dashboard/page.tsx`:
  - Top cards: total orders, revenue, pending confirm, pending payment, **pending shipment (confirmed count)**
  - **Cards are clickable** — 待確認 → orders page filtered; 待出貨 → shipments page
  - 商品需求彙總: product name, total qty, unit, revenue, **supplier name**, **「通知到貨」button**, **click to expand customer list**, **「列印理貨清單」button**
  - 通知發送狀態: by notification type (payment_confirmed / shipment / product_arrival / order_cancelled)
- [x] **5.4** `app/admin/orders/page.tsx`:
  - **Search bar** (nickname / phone / order number) + Filter tabs: 全部 / 待付款 / 待確認 / 已確認 / **已出貨** / 已取消
  - **「+ 代客下單」button** → opens inline order form (POS mode)
  - Order cards + batch confirm for pending_confirm
  - Single order detail: info + payment match + confirm / **admin cancel (with reason)** / **quick confirm (POS cash)**
  - **Print packing slip** per order
  - CSV export (includes shipping fee column)
- [x] **5.5** `app/admin/products/page.tsx`:
  - Product list with progress bars + **supplier name**
  - Create/edit form includes **supplier dropdown** + goal_qty + image_url
  - Edit / 上下架 buttons
- [x] **5.6** `app/admin/rounds/page.tsx`:
  - Current round: name, deadline, status, **shipping fee display**
  - 截單 + 修改截止 + **修改運費**
  - 新開一團 form: name + deadline + **shipping fee input**

### Checkpoint 5a

```bash
npx tsc --noEmit     # must pass
npm run lint         # must pass
npm run build        # must pass
```

**Verify:**
- [x] Login authenticates via real Supabase Auth
- [x] All admin pages redirect to login if unauthenticated
- [x] Dashboard numbers from real DB
- [x] Dashboard 商品需求彙總 shows supplier names
- [x] Dashboard 通知到貨 button calls `notify-arrival` API
- [x] Dashboard product expand shows customer list from `orders-by-product` API
- [x] Product form has supplier dropdown
- [x] Round form has shipping fee input
- [x] CSV includes shipping fee

**Done when:** Core admin pages functional with real data.

**Status: COMPLETE** — All 6 tasks done. `tsc`, `lint`, `build` all pass. Auth: browser Supabase client + useAdminSession hook + useAdminFetch hook. Layout: indigo sticky header with tab pills, auth guard, POS button, logout. Dashboard: 6 stat cards (clickable), product aggregation table with expand + 通知到貨, notification summary. Orders: search + filter + batch confirm + OrderCard with per-status actions + POS form + CSV export. Products: CRUD with supplier dropdown + progress bars + toggle active. Rounds: current round with inline fee/deadline edit + 截單 + new round form + history.

### Post-Phase 5 Bug Fixes & Optimizations (2026-03-22)

- [x] **Fix:** Cancel idempotency — duplicate cancel calls no longer re-send notifications (`cancelOrder()` returns `{ order, changed }`)
- [x] **Security:** LINE webhook signature verification now uses `timingSafeEqual` (timing-attack resistant)
- [x] **Perf:** Product arrival emails sent concurrently via `Promise.allSettled()` instead of sequential loop
- [x] **Prep:** Phase 6 type stubs added to `types/index.ts` (`ShipmentGroup`, `ShipmentConfirmResult`, `SupplierCardData`, `SupplierFormValues`)
- [x] **Prep:** Implementation spec comments added to shipments + suppliers placeholder pages

---

## Phase 6: Admin Pages — Shipments & Suppliers

> **Goal:** 待出貨 page + 供應商管理 page. Full operational workflow complete.

### Tasks

- [ ] **6.1** `app/admin/shipments/page.tsx` — 待出貨管理:
  - List all `confirmed` orders (not yet shipped)
  - **Group by pickup method**: 宅配 section, 面交點A section, 面交點B section (collapsible)
  - Each shows: order number, recipient, phone, address/pickup, items, total
  - Search/filter by nickname, phone, or order number
  - Single confirm button per order: 宅配 → "確認寄出", 面交 → "確認取貨" (both set status to `shipped`)
  - Checkbox multi-select + "批次確認寄出" button
  - On confirm: calls `confirm-shipment` API → status → shipped → notifications sent
  - Success feedback: show notification results (LINE ✓/✗, Email ✓/✗)
  - **「列印全部」button** → print all pending shipment packing slips (@media print)
- [ ] **6.2** `app/admin/suppliers/page.tsx` — 供應商管理:
  - Supplier list: name, contact, phone, email, product count
  - Create / edit / delete (delete blocked if has products)
  - Click supplier → shows their linked products with progress + order quantities
  - **Per-product customer detail**: click product name → expand customer list (nickname, name, phone, qty, order number)
  - **「通知到貨」button per product**: sends arrival notification to all customers who ordered that product
  - Notification result feedback: "已通知 N 位客戶 (LINE: X成功, Email: Y成功)"
- [ ] **6.3** Wire up dashboard ↔ supplier/shipment cross-links:
  - Dashboard 商品需求彙總 "通知到貨" uses same API as supplier page
  - Dashboard pending shipment count links to `/admin/shipments`
  - Supplier page and dashboard share the product-expand-customer-list pattern

### Checkpoint 5b

```bash
npx tsc --noEmit     # must pass
npm run lint         # must pass
npm run build        # must pass
```

**Verify:**
- [ ] 待出貨 page only shows `confirmed` orders (not pending_payment, not already shipped)
- [ ] 待出貨 page groups orders by pickup method (宅配 / 面交點A / 面交點B)
- [ ] Single + batch shipment confirm works
- [ ] Shipment confirmation sends both LINE + Email notifications
- [ ] shipped_at timestamp is written
- [ ] Supplier CRUD works (create, edit, delete-if-no-products)
- [ ] Customer list per product shows correct data
- [ ] 通知到貨 sends to all relevant customers, not just one
- [ ] Notification results displayed to admin after sending
- [ ] Supplier page usable on tablet

**Done when:** Admin can manage full lifecycle: confirm payment → notify arrival → confirm shipment → all with notifications.

---

## Phase 7: Integration Testing + Polish

> **Goal:** End-to-end flow works. Edge cases handled. Ready for first real group-buy round.

### Tasks

- [ ] **7.1** Full flow smoke test (manual, against real Supabase):
  - Create supplier → create round (with shipping fee) → add products (linked to supplier, with goals)
  - Place test orders: one 宅配 (verify shipping added), one 面交 (verify no shipping)
  - Verify progress bars update
  - Report payments → admin confirm → verify LINE + Email sent (type: payment_confirmed)
  - Admin clicks 通知到貨 for a product → verify relevant customers notified (type: product_arrival)
  - Admin confirms shipment (single + batch) → verify LINE + Email (type: shipment)
  - Cancel an order → verify stock restored
  - Lookup by nickname → verify history with all statuses
  - Export CSV → verify shipping fee column + Chinese encoding
  - Close round → verify 已截單
- [ ] **7.2** Edge cases:
  - Submit order stock = 0 → error
  - Submit order round closed → blocked
  - Double-click submit → same order (submission_key)
  - Payment report wrong format → validation error
  - Cancel `pending_confirm` → should fail
  - Cancel `confirmed` (by admin) → should succeed + restore stock + send cancellation notification
  - Cancel `shipped` (by admin) → should succeed + NO stock restore + send cancellation notification
  - Quick confirm (POS) on pending_payment → confirmed directly (skip pending_confirm)
  - Quick confirm on non-pending_payment → should fail
  - Admin create order on behalf of customer → order created as pending_payment
  - Batch confirm mix of valid/already-confirmed → partial success
  - Batch ship mix of confirmed/already-shipped → partial success
  - 通知到貨 when no one ordered that product → graceful "0 位客戶" message
  - Delete supplier with linked products → blocked with error message
  - **Shipping fee = null (round has no fee) + 宅配 → total has no shipping line**
  - **Change round shipping fee → existing orders unaffected**
  - Progress bar at 100% → 🎉
  - Product with no goal_qty → no bar
  - Product with stock = null → unlimited
- [ ] **7.3** Mobile polish:
  - All user pages in LINE in-app browser (iOS + Android)
  - Sticky CartBar doesn't overlap
  - Share panel copy + LINE share work on mobile
  - Touch targets ≥ 44px
  - **Shipping fee note readable on small screens**
- [ ] **7.4** Error + loading states:
  - Loading spinners on all buttons
  - Network error handling (toast or inline, not blank screen)
  - Empty states: no products, no orders, no suppliers, no pending shipments
- [ ] **7.5** Final cleanup:
  - Remove `console.log` / `debugger` / commented-out code
  - Prettier all files
  - No secrets in code
  - `.env.local` in `.gitignore`
- [ ] **7.6** Write `prisma/seed.ts`:
  - 2 suppliers, 1 round (with shipping_fee: 60), 5 products linked to suppliers, 2-3 test users
  - Matches prototype mock data feel

### Checkpoint 7 (Final)

```bash
npx tsc --noEmit     # must pass
npm run lint         # must pass
npm run build        # must pass
npx vitest run       # must pass (if tests exist)
```

**Verify:**
- [ ] Full user flow end-to-end (including shipping fee)
- [ ] Full admin flow end-to-end (confirm → arrival notify → ship)
- [ ] Supplier management works
- [ ] All 4 notification types send correctly (payment_confirmed, shipment, product_arrival, order_cancelled)
- [ ] No console errors
- [ ] Mobile-friendly
- [ ] CSV correct
- [ ] Customer-by-product view accurate

**Done when:** System ready for first real group-buy round with real users.

---

## Session Start Checklist

Copy-paste this at the start of every session:

```
1. Read roadmap.md (this file) — find current phase
2. Read CLAUDE.md — refresh on rules, pitfalls, conventions
3. Read whatwearebuilding.md — refresh on product spec
4. Find the first [ ] or [~] task — that's your starting point
5. Work on ONLY that phase
6. Update checkboxes as you go
7. Run checkpoint verification before moving to next phase
8. Commit roadmap.md with your code changes
```