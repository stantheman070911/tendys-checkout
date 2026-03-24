# roadmap.md

> **READ THIS FILE AT THE START OF EVERY SESSION.**
> This file is the single source of truth for what is done, what is in progress, and what is next.
> After reading this file, read `CLAUDE.md` and `whatwearebuilding.md` for full context.
>
> **Current public access model:** Public lookup uses `recipient_name + phone_last3`. Public order detail, payment reporting, cancellation, and LINE binding use `order_number + recipient_name + phone_last3`. Older completed-phase notes may still mention `access_code` as historical context.

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
  app/order/[orderNumber]/page.tsx  → placeholder (async params for Next.js 16)
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
  - `createUser(data)`
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
  - `findOrderByNumberAndAccessCode(orderNumber, accessCode)` — for public lookup/order access
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
  - Validate: `order_number`, `access_code`, amount, last5 (len 5)
  - Resolve order by `order_number + access_code`, check status = `pending_payment`
  - Call `reportPayment()`
- [x] **3.3** `app/api/cancel-order/route.ts` — POST
  - Two modes: user cancel (`order_number + access_code`, pending_payment only) and admin cancel (auth required, any status, optional cancel_reason)
  - User: resolve by `order_number + access_code`, check status = `pending_payment` → cancel + restore stock
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

> **Goal:** Replace broadcast notifications with 1-on-1 push. Users link orders to their LINE account by pasting the order number + access code into the LINE Official Account.

### Tasks

- [x] **3.5.1** Add `line_user_id` (TEXT, nullable) to Order model in `prisma/schema.prisma`
- [x] **3.5.2** Write `prisma/migration_002_line_push.sql` — `ALTER TABLE orders ADD COLUMN line_user_id TEXT`
- [x] **3.5.3** Create `lib/line/push.ts` — LINE API module (raw fetch, never-throw):
  - `sendLinePush(lineUserId, message)` — single user push
  - `sendLineMulticast(lineUserIds, message)` — batch up to 500, auto-chunks
  - `sendLineReply(replyToken, message)` — reply to webhook event (free)
  - `sendLineMessage(lineUserId, text, replyToken?)` — tries reply first, falls back to push
- [x] **3.5.4** Create `lib/line/webhook.ts` — HMAC-SHA256 signature verification
- [x] **3.5.5** Create `lib/line/validate-order-code.ts` — validates `order_number + access_code`, links `line_user_id` to order (idempotent, per-order)
- [x] **3.5.6** Create `lib/line/message-handler.ts` — handles incoming LINE messages:
  - Order number + access code pattern → validate + link → reply confirmation
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
- [x] Order linking is idempotent (re-sending same order number + access code = no-op)
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
  - Checkout form with: nickname input (no public auto-fill), recipient fields, pickup select (Radix sentinel workaround), ShippingFeeNote, order summary
  - Submit: generates submission_key once per session, disables button, calls API, redirects to `/order/[order_number]?code=...`
  - Round closed → 已截單 + all controls disabled
- [x] **4.3** `app/order/[orderNumber]/page.tsx` — Order Confirmation + Payment Report:
  - Server component (force-dynamic), fetches order via `findOrderByNumberAndAccessCode()`
  - `pending_payment`: bank details + `PaymentReportForm` + `CancelOrderButton` + share CTA + **「繼續選購」link**
  - `pending_confirm`: waiting status + payment info summary + share CTA
  - `confirmed`: confirmed state + "等待出貨"
  - `shipped`: shipped state with shipped_at timestamp
  - `cancelled`: cancelled state + cancel_reason (if any)
  - Shows and preserves the order access code; public summary masks phone instead of exposing full phone
  - Payment report: two-step flow with amount vs order total comparison before submit
  - Cancel: Dialog confirmation → API → router.refresh()
- [x] **4.4** `app/lookup/page.tsx` — Order Lookup:
  - Search by order number + access code via `/api/lookup`
  - Result with OrderStatusBadge, items summary, total (shipping shown separately)
  - **Result clickable → links to `/order/[order_number]?code=...` detail page**
  - Empty/initial states handled; no public history listing

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
- [x] Public lookup requires order number + access code
- [x] Lookup result links to `/order/[order_number]?code=...` detail page
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

### Post-Phase 5 Security Hardening & UI Polish Pass (2026-03-22 Session 2)

- [x] **Admin Security**: Replaced URL `?token=` parameter with secure `fetch` headers and `verifyAdminSession` for CSV Exports.
- [x] **Server Enforcement**: Removed client-side trust for logic; the server strictly recalculates totals inside a transaction and enforces deadlines.
- [x] **Notification Analytics**: Migrated Prisma schema to include `round_id` and `product_id` in `NotificationLog`. Redesigned dashboard admin summary to accurately group by type and include "Skipped" statuses.
- [x] **UI UX Polish**: Added a dedicated LINE-linking guide block to the order completion page. Added `🎉` to progress bars at 100%. Storefront supports explicit `?round=` queries. Deadline banner is urgent only `< 1h`.
- [x] **Admin Polish**: Restricted bulk confirm checkboxes to `pending_confirm`. Fixed Active toggle labels. Added print wrappers for Product Demand Sheets and individual Packing Slips. Normalized batch API formats.

### Phase 1–5 Audit Closeout & Phase 6 Readiness (2026-03-22 Session 3)

- [x] **Audit artifact**: Added `phase-1-5-audit.md` with a phase-by-phase validation record and discrepancy log.
- [x] **Schema/type/source-of-truth alignment**: Reconciled `prisma/schema.prisma`, `prisma/migration.sql`, `types/index.ts`, and added `prisma/migration_003_notification_log_context.sql` for `notification_logs.round_id`, `notification_logs.product_id`, and `status = 'skipped'`.
- [x] **LINE flow fix**: Order detail now instructs users to paste `order_number + access_code`; LINE parsing accepts raw or prefixed order text but only binds when a valid access code is present; pending-payment share CTA restored.
- [x] **Admin routing hardening**: Replaced hardcoded `/admin/...` navigational paths with shared `ADMIN_BASE` helpers so obfuscation remains correct.
- [x] **Batch idempotency**: `batchConfirm()` / `batchConfirmShipment()` now use transition guards and only notify from rows mutated in the current call.
- [x] **Dashboard completion gap**: Product-demand detail now includes order number and supports per-product packing-list printing. Product lookups are cached instead of repeatedly scanning arrays.
- [x] **Admin shell auth hardening**: Added `/api/admin/session` so the shell verifies allowlisted access before loading admin UI; server-side data routes still enforce `verifyAdminSession()`.
- [x] **Phase 6 extension points**: Added shared admin helpers for path generation, notification summaries, and order search/grouping.
- [x] **Focused tests**: Added Vitest unit coverage for notification summary mapping, LINE extraction, admin path generation, and batch idempotency.

**Phase 1–5 status after audit:** COMPLETE for merge. The codebase is now the accepted baseline for Phase 6 work, and future sessions should continue from here without re-auditing earlier phases.

**Merge-validated points:**
- [x] Migration is structurally safe for existing rows.
- [x] Batch confirm/shipment is transition-guarded and notification-safe.
- [x] Admin auth remains enforced server-side on admin data routes.
- [x] Admin routing no longer depends on hardcoded `/admin/...` paths.

**Explicit caveats carried forward:**
- [x] **Historical analytics gap**: Older `product_arrival` logs without `order_id` / `round_id` / `product_id` cannot be back-attributed. Round-level analytics remain incomplete for that historical slice.
- [x] **LINE ambiguity handling**: Multiple order numbers in one message resolve to the first match. Ambiguity rejection is not implemented yet.
- [x] **Test depth**: confirm → notify coverage is still unit-level; there is no integration-level regression test yet.
- [x] **Dependency debt**: Existing `npm audit` issues are deferred to a separate dependency pass.

### Post-Remediation Pass 2 (2026-03-23 Session 4)

- [x] **P0 — Transaction rollback fix**: `createWithItems()` `return { error }` inside `$transaction` committed instead of rolling back — stock leak regression. Fixed with `OrderValidationError` thrown inside transaction + two-phase validation (validate all products before any stock mutation).
- [x] **P1 — Atomic single-open-round**: `rounds.create()` close + insert wrapped in `$transaction`. Added `migration_004_single_open_round.sql` (partial unique index). `update()` catches `P2002` concurrent conflicts.
- [x] **P2 — Customer count semantics**: `customersNotified` now counts unique customers (`user_id` / `order.id` fallback), not delivery endpoints. `getCustomersForArrivalNotification()` returns `customerCount` alongside `lineUserIds` and `emails`.
- [x] **Spec drift**: `whatwearebuilding.md` multi-open-round storefront switching replaced with single-open-round DB-enforced rule.
- [x] **Tests**: 23 tests pass (was 19). Extended rounds.test.ts (6 tests) and arrival-dedup.test.ts (6 tests).

### Post-Remediation Pass 3 (2026-03-23 Session 5)

- [x] **P1 — POST /api/rounds concurrent conflict exposed as 500**: `create()` in `lib/db/rounds.ts` did not catch `P2002` from the partial unique index, so concurrent `POST /api/rounds` requests fell through to the generic 500 catch. Fixed: `create()` now catches `P2002` and returns `{ error }` (same pattern as `update()`). `POST` route maps `{ error }` to `400`.
- [x] **Doc drift**: `phase-6-readiness-audit.md` test counts corrected (verification snapshot: 24 tests; issue 1 fix: 7 focused tests; files-modified table: 7 tests).
- [x] **Tests**: 24 tests pass (was 23). Added `create()` P2002 catch test in `rounds.test.ts` (now 7 tests).

### Phase 6 Implementation (2026-03-24 Session 6)

- [x] **Shipments page** (`app/admin/shipments/page.tsx`): Full implementation — fetch open round + confirmed orders, group by pickup method via `groupOrdersByPickup()`, search via `matchesOrderSearch()`, collapsible sections, single-confirm via `ShipmentCard` component, batch confirm with sticky bottom bar, "列印全部" print view, product filter from query param, persistent notification results panel.
- [x] **ShipmentCard component** (`components/admin/ShipmentCard.tsx`): Per-order card with checkbox, recipient info, items table, single confirm button ("確認寄出" / "確認取貨"), `onConfirmed` callback feeding page-level results panel.
- [x] **Suppliers page** (`app/admin/suppliers/page.tsx`): Full implementation — supplier list with expand/collapse, CRUD via `SupplierForm` dialog, delete-with-confirmation (blocked if products linked), per-supplier product list with progress bars, per-product customer drill-down via `orders-by-product` API, per-product "通知到貨" with LINE/email result feedback.
- [x] **SupplierForm component** (`components/admin/SupplierForm.tsx`): Dialog-based create/edit form (name, contact_name, phone, email, note).
- [x] **ProductAggregationTable enhancements**: Added per-product "列印理貨清單" print action and "通知到貨" button (same pattern as suppliers page).
- [x] **Dashboard cross-links**: Verified — 商品需求彙總 "前往出貨" links to shipments with product filter, pending shipment count links to shipments page, product-expand-customer-list pattern shared.

### Phase 6 Audit Fixes (2026-03-24 Session 7)

- [x] **P1 — Single-confirm results lost**: `ShipmentCard` now calls `onConfirmed({ orderNumber, line, email })` so single confirms populate the persistent results panel (previously only batch confirms did).
- [x] **P1 — Skipped-as-failed misreport**: Replaced boolean notification status with tri-state `"success" | "failed" | "skipped"`. LINE skip (`"No LINE user linked"`) now renders as `—` instead of `✗`. Email skip (`null`) likewise.
- [x] **P2 — Shared helper extraction**: Extracted `mapNotifyStatus()` and `renderNotifyIcon()` into `lib/admin/shipment-status.ts`. Both `shipments/page.tsx` and `ShipmentCard.tsx` import from the shared helper — no inline duplicates.
- [x] **P2 — Verification order fix**: Updated CLAUDE.md to document `npm run build` before `npx tsc --noEmit` (Next.js generates `.next/types/validator.ts` during build).
- [x] **Tests**: Added `lib/admin/shipment-status.test.ts` with 11 focused tests covering all tri-state mapping paths (success, failed, skipped for both channels, missing fields, undefined payload, failed-vs-skipped differentiation, icon rendering). Added `app/api/suppliers/route.test.ts` with 4 focused tests (null-clearing, blank-name rejection). Total: 39 tests across 9 files.

**Explicit caveats carried forward:**
- Phase 6 admin flows rely on manual verification + helper-level unit coverage, not component/integration tests.
- Historical analytics gap and LINE ambiguity handling remain deferred from Phase 1–5.

### CTO Security Hardening (2026-03-24 Session 8)

- [x] **P0 — Direct anon Supabase access closed**: Added `prisma/migration_006_public_access_security.sql` to backfill `orders.access_code`, make it `NOT NULL`/`UNIQUE`/length-checked, and remove permissive anon RLS policies from `users`, `orders`, and `order_items`.
- [x] **P0 — Public order access rebuilt around access codes**: Public `/api/lookup`, `/order/[orderNumber]`, `/api/report-payment`, and `/api/cancel-order` now require `order_number + access_code`. Internal order UUIDs are no longer exposed on public lookup responses.
- [x] **P0 — Public PII autofill removed**: Storefront nickname auto-fill was removed. `/api/users/lookup` is now admin-only for POS use.
- [x] **P0 — Nickname collision takeover blocked**: Public submit-order now rejects reuse of an existing nickname when submitted recipient/phone/address/email do not match the saved profile. Admin POS keeps authenticated overwrite behavior.
- [x] **P1 — Abuse cost raised**: Added lightweight rate limiting for `submit-order`, `lookup`, `report-payment`, and `cancel-order`.
- [x] **P1 — LINE bind ownership proof added**: LINE order linking now requires both order number and access code; failure messages were generalized to reduce enumeration value.
- [x] **Live verification**: Migration 006 was verified against Supabase. Anonymous direct reads/writes to `users`, `orders`, and `order_items` are blocked. Public reads on `rounds` and `products` still work.
- [x] **Verification**: `npx vitest run` (99 tests / 21 files), `npm run lint`, `npm run build`, and `npx tsc --noEmit` all pass.

### Post-Deploy Follow-Up (2026-03-24 Session 9)

- [x] **Route naming cleanup**: Renamed the public order page segment from `app/order/[id]/page.tsx` to `app/order/[orderNumber]/page.tsx` so the filesystem route matches the real parameter semantics.
- [x] **Build-only Prisma payload fix**: `findOrderByNumberAndAccessCode()` in `lib/db/orders.ts` now uses explicit Prisma `OrderGetPayload` include types for `order_items`, `user`, and `round`, fixing a production-only TypeScript build failure where `/api/lookup` saw the base `Order` shape instead of the included relations.
- [x] **Docs synced**: Updated `claude.md` and the Phase 4 route references so future sessions use `[orderNumber]` terminology consistently.
- [x] **Verification**: `npm run build`, `npx tsc --noEmit`, `npm run lint`, and `npx vitest run` all pass after the follow-up fix.

---

## Phase 6: Admin Pages — Shipments & Suppliers

> **Goal:** 待出貨 page + 供應商管理 page. Full operational workflow complete.

### Tasks

- [x] **6.1** `app/admin/shipments/page.tsx` — 待出貨管理:
  - List all `confirmed` orders (not yet shipped)
  - **Group by pickup method**: 宅配 section, 面交點A section, 面交點B section (collapsible)
  - Each shows: order number, recipient, phone, address/pickup, items, total
  - Search/filter by nickname, phone, or order number
  - Single confirm button per order: 宅配 → "確認寄出", 面交 → "確認取貨" (both set status to `shipped`)
  - Checkbox multi-select + "批次確認寄出" button
  - On confirm: calls `confirm-shipment` API → status → shipped → notifications sent
  - Success feedback: show notification results (LINE ✓/✗, Email ✓/✗)
  - **「列印全部」button** → print all pending shipment packing slips (@media print)
- [x] **6.2** `app/admin/suppliers/page.tsx` — 供應商管理:
  - Supplier list: name, contact, phone, email, product count
  - Create / edit / delete (delete blocked if has products)
  - Click supplier → shows their linked products with progress + order quantities
  - **Per-product customer detail**: click product name → expand customer list (nickname, name, phone, qty, order number)
  - **「通知到貨」button per product**: sends arrival notification to all customers who ordered that product
  - Notification result feedback: "已通知 N 位客戶 (LINE: X成功, Email: Y成功)"
- [x] **6.3** Wire up dashboard ↔ supplier/shipment cross-links:
  - Dashboard 商品需求彙總 "通知到貨" uses same API as supplier page
  - Dashboard pending shipment count links to `/admin/shipments`
  - Supplier page and dashboard share the product-expand-customer-list pattern

### Checkpoint 6

```bash
npm run build            # must pass (also generates .next/types for tsc)
npx tsc --noEmit        # must pass (requires prior build)
npm run lint             # must pass
npx vitest run           # must pass
```

**Verify:**
- [x] 待出貨 page only shows `confirmed` orders (not pending_payment, not already shipped)
- [x] 待出貨 page groups orders by pickup method (宅配 / 面交點A / 面交點B)
- [x] Single + batch shipment confirm works
- [x] Shipment confirmation sends both LINE + Email notifications
- [x] shipped_at timestamp is written
- [x] Supplier CRUD works (create, edit, delete-if-no-products)
- [x] Customer list per product shows correct data
- [x] 通知到貨 sends to all relevant customers, not just one
- [x] Notification results displayed to admin after sending
- [x] Supplier page usable on tablet

**Done when:** Admin can manage full lifecycle: confirm payment → notify arrival → confirm shipment → all with notifications.

**Status: COMPLETE** — All 3 tasks done. `build`, `tsc` (post-build), `lint`, `vitest` all pass (39 tests, 9 files). Committed as `fa47e7f` and pushed to `main`.

---

## Phase 7: Integration Testing + Polish

> **Goal:** End-to-end flow works. Edge cases handled. Ready for first real group-buy round.

### Tasks

- [ ] **7.1** Full flow smoke test (manual, against real Supabase):
  - Create supplier → create round (with shipping fee) → add products (linked to supplier, with goals)
  - Place test orders: one 宅配 (verify shipping added), one 面交 (verify no shipping), confirm each receives an `order_number`
  - Verify progress bars update
  - Report payments via `order_number + recipient_name + phone_last3` → admin confirm → verify LINE + Email sent (type: payment_confirmed)
  - Bind LINE with `order_number + recipient_name + phone_last3` → verify push notifications route to the linked LINE account
  - Admin clicks 通知到貨 for a product → verify relevant customers notified (type: product_arrival)
  - Admin confirms shipment (single + batch) → verify LINE + Email (type: shipment)
  - Cancel an order → verify stock restored
  - Lookup by `recipient_name + phone_last3`, then open detail by `order_number + recipient_name + phone_last3` → verify order detail access works and no cross-order history leaks
  - Export CSV → verify shipping fee column + Chinese encoding
  - Close round → verify 已截單
- [x] **7.2** Edge cases (92 tests / 19 files):
  - Route-level tests for submit-order, cancel-order, confirm-order, quick-confirm, report-payment, notify-arrival, batch-confirm, confirm-shipment, export-csv, lookup
  - Extended suppliers DELETE coverage
  - Covers: stock exhaustion, round closed, submission_key dedup, invalid fields, duplicate products, negative quantity, delivery without address, user vs admin cancel modes, batch partial success, CSV BOM/header/Chinese, zero-customer arrival
- [x] **7.3** Mobile polish:
  - ShippingFeeNote contrast improved (text-muted-foreground → text-gray-600)
  - SharePanel clipboard error handling added
- [x] **7.4** Error + loading states:
  - Lookup page: error toasts on fetch failure
  - CSV export: loading state + disabled button during export
  - Product toggle: per-product disabled state during toggle
  - POS form: client-side delivery address validation for 宅配
  - SharePanel: clipboard .catch() with failure toast
- [x] **7.5** Final cleanup:
  - Prettier all source files
  - No `console.log` / `debugger` / commented-out code
  - `.env.local` in `.gitignore`
  - Checkpoint order fixed (build before tsc)
- [x] **7.6** Rewrite `prisma/seed.ts`:
  - Deterministic + rerunnable (cleans named fixtures only)
  - 2 suppliers, 1 round (shipping_fee: 60), 5 products, 3 test users
  - No ad-hoc console.log

### Checkpoint 7 (Final)

```bash
npm run build        # must pass (generates .next/types for tsc)
npx tsc --noEmit     # must pass (requires prior build)
npm run lint         # must pass
npx vitest run       # must pass
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

## Deferred Backlog

> These items are known and intentionally deferred. Do not re-audit completed phases before Phase 6 unless one of these backlog items becomes the active task.

- [ ] **Historical analytics gap** — Older `product_arrival` logs without `order_id` / `round_id` / `product_id` cannot be back-attributed. Decide whether to leave reporting explicitly partial or add a forward-only reporting annotation strategy.
- [ ] **LINE ambiguity handling** — Reject or explicitly disambiguate LINE messages containing multiple order numbers instead of using first-match-wins.
- [ ] **Integration coverage** — Add an integration-level confirm → notify regression test covering route execution and notification dispatch boundaries.
- [ ] **Dependency remediation** — Resolve existing `npm audit` issues in a dedicated dependency upgrade/security pass.

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
