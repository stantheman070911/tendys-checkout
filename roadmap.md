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
  - `NotificationType` union: `'payment_confirmed' | 'shipment' | 'product_arrival'`
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
- [ ] Advisory lock uses `pg_advisory_xact_lock`
- [ ] RLS: anon `orders` UPDATE constrains both `using` AND `with check`
- [ ] RLS: `notification_logs` AND `suppliers` have NO anon access
- [ ] No redundant indexes on UNIQUE columns
- [ ] `product_progress` view excludes cancelled orders, includes `supplier_id`
- [ ] `orders_by_product` view joins users, excludes cancelled
- [ ] `orders.status` CHECK includes all 5 values
- [ ] `notification_logs.type` CHECK includes all 3 values
- [ ] `notification_logs.order_id` is nullable
- [ ] `rounds.shipping_fee` column exists
- [ ] `orders.shipping_fee` and `orders.shipped_at` columns exist
- [ ] `products.supplier_id` FK exists with SET NULL on delete
- [ ] `handle_updated_at` triggers on BOTH `users` AND `suppliers`

**Done when:** Prisma generates clean. Migration SQL reviewed. Types and constants compile.

---

## Phase 2: Library Layer (`lib/`)

> **Goal:** All pure TypeScript business logic. No API routes, no React.

### Tasks

- [ ] **2.1** `lib/db/prisma.ts` — globalThis singleton PrismaClient
- [ ] **2.2** `lib/db/users.ts`:
  - `findByNickname(nickname)`
  - `upsertByNickname(nickname, data)`
- [ ] **2.3** `lib/db/products.ts`:
  - `listActiveByRound(roundId)` — with progress data + supplier name
  - `decrementStock(productId, qty)` — atomic SQL
  - `restoreStock(productId, qty)` — for cancellation
- [ ] **2.4** `lib/db/rounds.ts`:
  - `getOpenRound()` — latest `is_open = true`
  - `findById(id)`
  - `create(data)` — includes `shipping_fee`
  - `close(id)`, `updateDeadline(id, deadline)`, `updateShippingFee(id, fee)`
- [ ] **2.5** `lib/db/suppliers.ts`:
  - `list()` — all suppliers with product count
  - `findById(id)` — with associated products
  - `create(data)`, `update(id, data)`, `delete(id)`
- [ ] **2.6** `lib/db/orders.ts`:
  - `createWithItems(data, items, submissionKey)` — transaction: validate stock → decrement → calc shipping fee (if 宅配 and round has fee) → insert order + items. Returns order or error.
  - `findBySubmissionKey(key)`
  - `reportPayment(orderId, amount, last5)`
  - `confirmOrder(orderId)` — status → confirmed, writes confirmed_at
  - `batchConfirm(orderIds)`
  - `confirmShipment(orderId)` — status → shipped, writes shipped_at
  - `batchConfirmShipment(orderIds)`
  - `cancelOrder(orderId)` — status → cancelled + restore stock (transaction)
  - `findByNicknameOrOrderNumber(query)` — for lookup
  - `listByRound(roundId, statusFilter?)`
  - `listConfirmedByRound(roundId)` — for 待出貨 page
  - `getOrderWithItems(orderId)`
  - `getOrdersByProduct(productId, roundId)` — all customers who ordered this product
- [ ] **2.7** `lib/db/notification-logs.ts`:
  - `logNotification(orderId, channel, type, status, errorMessage?)` — orderId nullable for arrival notifications
  - `getLogsByOrder(orderId)`
  - `getLogsByRound(roundId)` — for dashboard notification summary
- [ ] **2.8** `lib/notifications/line-notify.ts`:
  - `sendLineNotify(message)` — never throws, returns `{ success, error? }`
- [ ] **2.9** `lib/notifications/email.ts`:
  - `sendOrderConfirmationEmail(to, order, items)` — type: payment_confirmed
  - `sendShipmentEmail(to, order, items)` — type: shipment
  - `sendProductArrivalEmail(to, productName)` — type: product_arrival
  - All never-throw, return `{ success, error? }`
  - Plain HTML templates (Chinese)
- [ ] **2.10** `lib/notifications/send.ts`:
  - `sendPaymentConfirmedNotifications(order, items)` — both channels + log
  - `sendShipmentNotifications(order, items)` — both channels + log
  - `sendProductArrivalNotifications(productName, customers)` — loop: send to each customer via both channels + log each
- [ ] **2.11** `lib/auth/supabase-admin.ts`:
  - Supabase client with service role key
  - Supabase client with anon key
  - `verifyAdminSession(request)`
- [ ] **2.12** `lib/utils.ts`:
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
- [ ] `lib/` has ZERO imports from `react`, `next`, `next/server`
- [ ] Only `lib/db/prisma.ts` contains `new PrismaClient()`
- [ ] All notification functions are never-throw
- [ ] `createWithItems` handles shipping fee: adds to total if 宅配, snapshots on order
- [ ] `confirmShipment` writes `shipped_at`
- [ ] `sendProductArrivalNotifications` loops over customers, doesn't stop on single failure
- [ ] 3 email templates exist (payment_confirmed, shipment, product_arrival)

**Done when:** All lib files compile. No React imports. Business logic complete.

---

## Phase 3: API Routes

> **Goal:** All API routes. Backend fully functional and testable with curl.

### Tasks

- [ ] **3.1** `app/api/submit-order/route.ts` — POST
  - Validate body: cart items, nickname, recipient info, pickup, submission_key
  - Check round is open
  - Call `createWithItems()` (handles stock + dedup + shipping fee)
  - Return order data or error
- [ ] **3.2** `app/api/report-payment/route.ts` — POST
  - Validate: orderId, amount, last5 (len 5)
  - Check status = `pending_payment`
  - Call `reportPayment()`
- [ ] **3.3** `app/api/cancel-order/route.ts` — POST
  - Check status = `pending_payment`
  - Call `cancelOrder()` (restores stock)
- [ ] **3.4** `app/api/confirm-order/route.ts` — POST (admin)
  - Verify admin → confirm → send payment_confirmed notifications → return results
- [ ] **3.5** `app/api/batch-confirm/route.ts` — POST (admin)
  - Verify admin → batch confirm → send notifications for each
- [ ] **3.6** `app/api/confirm-shipment/route.ts` — POST (admin)
  - Verify admin
  - Accept single `orderId` or array `orderIds` (handles both single + batch)
  - For each: update to `shipped` → send shipment notifications → log
  - Return results array
- [ ] **3.7** `app/api/notify-arrival/route.ts` — POST (admin)
  - Verify admin
  - Validate: `productId`, `roundId`
  - Call `getOrdersByProduct()` to find all relevant customers
  - Call `sendProductArrivalNotifications()` with product name + customer list
  - Return: count notified, successes, failures
- [ ] **3.8** `app/api/export-csv/route.ts` — GET (admin)
  - CSV with shipping fee column added
- [ ] **3.9** `app/api/rounds/route.ts` — CRUD (admin)
  - POST (create) includes `shipping_fee`
  - PUT (update) can change `shipping_fee`
- [ ] **3.10** `app/api/products/route.ts` — CRUD (admin)
  - Includes `supplier_id` in create/update
- [ ] **3.11** `app/api/suppliers/route.ts` — CRUD (admin)
  - GET: list all with product count
  - POST: create, PUT: update, DELETE: delete (only if no linked products)
- [ ] **3.12** `app/api/orders-by-product/route.ts` — GET (admin)
  - Query params: `productId`, `roundId`
  - Returns customer list: nickname, name, phone, quantity, order number

### Checkpoint 3

```bash
npx tsc --noEmit     # must pass
npm run lint         # must pass
npm run build        # must pass
```

**Verify:**
- [ ] Every route validates input before DB
- [ ] Every route returns `{ error }` + HTTP status on failure
- [ ] Admin routes check `verifyAdminSession()` — return 401 if not admin
- [ ] `submit-order` calculates shipping fee correctly (宅配 vs 面交)
- [ ] `confirm-shipment` handles both single and batch
- [ ] `notify-arrival` finds customers by product, not by order
- [ ] `confirm-order`/`confirm-shipment` don't rollback on notification failure
- [ ] Supplier DELETE is blocked if products reference it

**Done when:** All 12 routes compile and build passes. Backend feature-complete.

---

## Phase 4: User-Facing Pages

> **Goal:** All 3 user pages functional. Full flow: browse → cart → checkout → pay → report → lookup.

### Tasks

- [ ] **4.1** Shared components:
  - `ProgressBar.tsx` — orange/green, percentage
  - `SharePanel.tsx` — copy link + LINE share
  - `DeadlineBanner.tsx` — countdown + 已截單
  - `OrderStatusBadge.tsx` — 5 statuses now (add 已出貨)
  - `CartBar.tsx` — sticky bottom (count + total + checkout)
  - `ProductCard.tsx` — +/- with stock limit + progress bar
  - `ShippingFeeNote.tsx` — "宅配到以上地址，運費 $XXX"
- [ ] **4.2** `app/page.tsx` — Storefront:
  - Fetch open round (with shipping_fee) + products with progress
  - Product list with ProductCard
  - DeadlineBanner, SharePanel, CartBar
  - Checkout form:
    - Nickname with auto-fill
    - Recipient fields + pickup select
    - **When pickup = 宅配 and round has shipping_fee → show ShippingFeeNote**
    - Order summary with: items subtotal + shipping fee line (if applicable) + total
  - Submit: generates submission_key, disables button, calls API
  - Redirect to `/order/[id]`
  - Round closed → 已截單 + disable cart
- [ ] **4.3** `app/order/[id]/page.tsx` — Order Confirmation + Payment Report:
  - Fetch order by ID
  - `pending_payment`: bank details (amount includes shipping) + report form + cancel + share CTA
  - `pending_confirm`: waiting status + summary + share CTA
  - `confirmed`: confirmed state + "等待出貨"
  - `shipped`: shipped state with shipped_at timestamp
  - `cancelled`: cancelled state
  - Payment report form: amount + last5
  - Cancel: confirmation dialog → API → refresh
- [ ] **4.4** `app/lookup/page.tsx` — Order Lookup:
  - Search by nickname or order number
  - Results with 5-status badge, items, total (shipping shown separately)
  - `pending_payment` actions: report link + cancel

### Checkpoint 4

```bash
npx tsc --noEmit     # must pass
npm run lint         # must pass
npm run build        # must pass
```

**Verify:**
- [ ] Storefront fetches from real API
- [ ] +/- respects stock limits
- [ ] Progress bar updates optimistically
- [ ] **Shipping fee shows ONLY when 宅配 is selected AND round has fee**
- [ ] **Order summary total correctly adds shipping fee**
- [ ] Submit button disables after click + stays disabled
- [ ] submission_key generated once per session
- [ ] Share panel only when product under goal
- [ ] Lookup works with both nickname and order number
- [ ] Order detail page handles all 5 statuses
- [ ] All pages mobile-responsive (LINE browser)

**Done when:** User full flow works end-to-end with real API.

---

## Phase 5: Admin Pages — Core

> **Goal:** Login + dashboard + order management + product/round management.

### Tasks

- [ ] **5.1** `app/admin/page.tsx` — Login:
  - Email/password → Supabase Auth → redirect to dashboard
- [ ] **5.2** Admin auth guard:
  - Check session on all `/admin/*` (except login) → redirect if unauthenticated
- [ ] **5.3** `app/admin/dashboard/page.tsx`:
  - Top cards: total orders, revenue, pending confirm, pending payment, **pending shipment (confirmed count)**
  - 商品需求彙總: product name, total qty, unit, revenue, **supplier name**, **「通知到貨」button**, **click to expand customer list**
  - 通知發送狀態: by notification type (payment_confirmed / shipment / product_arrival)
- [ ] **5.4** `app/admin/orders/page.tsx`:
  - Filter tabs: 全部 / 待付款 / 待確認 / 已確認 / **已出貨** / 已取消
  - Order cards + batch confirm for pending_confirm
  - Single order detail: info + payment match + confirm / cancel
  - CSV export (includes shipping fee column)
- [ ] **5.5** `app/admin/products/page.tsx`:
  - Product list with progress bars + **supplier name**
  - Create/edit form includes **supplier dropdown** + goal_qty + image_url
  - Edit / 上下架 buttons
- [ ] **5.6** `app/admin/rounds/page.tsx`:
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
- [ ] Login authenticates via real Supabase Auth
- [ ] All admin pages redirect to login if unauthenticated
- [ ] Dashboard numbers from real DB
- [ ] Dashboard 商品需求彙總 shows supplier names
- [ ] Dashboard 通知到貨 button calls `notify-arrival` API
- [ ] Dashboard product expand shows customer list from `orders-by-product` API
- [ ] Product form has supplier dropdown
- [ ] Round form has shipping fee input
- [ ] CSV includes shipping fee

**Done when:** Core admin pages functional with real data.

---

## Phase 6: Admin Pages — Shipments & Suppliers

> **Goal:** 待出貨 page + 供應商管理 page. Full operational workflow complete.

### Tasks

- [ ] **6.1** `app/admin/shipments/page.tsx` — 待出貨管理:
  - List all `confirmed` orders (not yet shipped)
  - Each shows: order number, recipient, phone, address/pickup, items, total
  - Search/filter by nickname or order number
  - Single "確認寄出" button per order
  - Checkbox multi-select + "批次確認寄出" button
  - On confirm: calls `confirm-shipment` API → status → shipped → notifications sent
  - Success feedback: show notification results (LINE ✓/✗, Email ✓/✗)
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
  - Cancel `confirmed` (by admin) → should succeed + restore stock
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
- [ ] All 3 notification types send correctly
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