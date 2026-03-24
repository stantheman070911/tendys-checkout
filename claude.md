# CLAUDE.md

Read this entire file before writing or modifying any code. After reading this file, read `whatwearebuilding.md` for product spec, then read `roadmap.md` to find your current task.then read `prdandmock.tsx` to get the database schema and mock data. Do not start coding until you've read all three files.

**Actual versions (as installed):** Next.js 16.1.7, React 19.2.4, TypeScript 5.9, Tailwind CSS 3.4, Prisma 6.19, ESLint 9 (flat config).

Core Principles (Non-Negotiable)

Efficiency: Minimize steps, time, and cognitive load

Effectiveness: Flows must reliably achieve intended outcomes

Quality: No ambiguous states; edge cases explicitly handled

Simplicity: Eliminate unnecessary complexity

Constraint: Simple ≠ Easy (do not remove necessary system logic)

---

## Project

Group-buy ordering system for fresh produce (生鮮團購訂購系統). Organizers share a link in LINE groups → users browse products, see crowdfunding-style progress bars, place orders, report bank transfers → admin confirms payments, manages shipments, coordinates with suppliers, and sends notifications.

| Key | Value |
|-----|-------|
| Framework | Next.js 16.1 (App Router, Turbopack), TypeScript strict |
| DB | PostgreSQL via Supabase, Prisma ORM |
| Styling | Tailwind CSS + shadcn/ui |
| Email | Resend |
| Notifications | LINE Messaging API (1-on-1 push/multicast via webhook linking) |
| Auth | Supabase Auth (admin only, email/password) |
| Deploy | Vercel |

### Core Flow

1. Admin creates a round (開團), sets deadline + shipping fee, adds products with prices/stock/goal quantities.
2. Admin shares Vercel URL in LINE group.
3. User opens link → browses products (progress bars show goal status) → adds to cart (stock-limited, CartBar hints shipping fee) → enters nickname (display/organizer reference only; no public auto-fill) → fills recipient info + pickup option → sees shipping fee if 宅配 → submits order (idempotent via `submission_key`).
4. System shows bank account details + share CTA if any product is under goal.
5. User transfers money, reports payment (amount + last 5 digits — with confirmation step before submit) from the order page protected by `order_number + recipient_name + phone_last3`.
6. Admin reviews in dashboard → confirms single or batch → system sends LINE + Resend email (logged to `notification_logs`). Status: `confirmed`.
7. Admin coordinates with suppliers → products arrive at 理貨中心 → admin sends arrival notification to relevant customers.
8. Admin goes to 待出貨 page (grouped by pickup method) → marks orders as shipped (single or batch) → system sends shipment notification via LINE + Email. Status: `shipped`.
9. User checks status via `/lookup` (by `recipient_name + phone_last3`) → can click into order detail and re-validate with `order_number + recipient_name + phone_last3`.
10. **LINE linking**: User pastes `order_number + recipient_name + phone_last3` (for example `ORD-20260318-001 王小美 678`) into LINE Official Account → webhook validates all three fields → links `line_user_id` to order → subsequent notifications sent as 1-on-1 push (not broadcast).
11. **POS mode**: Admin can create orders on behalf of customers, do instant cash confirmation, and handle face-to-face pickup.
12. **Admin cancel**: Admin can cancel orders from any status (with reason + cancellation notification).

---

## Directory Layout

```
app/                          → Next.js pages and API routes only
  page.tsx                    # User storefront (products + cart + checkout)
  order/[orderNumber]/page.tsx # Public order detail gate + client fetch by order number + recipient_name + phone_last3
  lookup/page.tsx             # Order lookup by recipient_name + phone_last3
  gtfo/page.tsx               # Troll page for /admin snoopers ("get the fuck out")
  admin/                      # ⚠️ NOT accessible via /admin (redirects to /gtfo)
                              # Real URL: /bitchassnigga (via next.config.ts rewrites)
    layout.tsx                # Admin shell: nav tabs, auth guard, POS button, logout
    page.tsx                  # Admin login
    dashboard/page.tsx        # Stats + item aggregation + notification log
    orders/page.tsx           # Order list, filter, single/batch confirm, CSV export
    orders/[id]/print/page.tsx # Order packing slip print view (@media print)
    shipments/page.tsx        # 待出貨 management, single/batch ship confirm
    products/page.tsx         # Product CRUD, goal_qty, image_url, stock, supplier link
    rounds/page.tsx           # Round management (open/close, deadline, shipping fee)
    suppliers/page.tsx        # Supplier CRUD + product-arrival notifications
  api/
    admin/session/route.ts    # Admin shell auth probe (server-verified allowlist check)
    submit-order/route.ts     # Create order (submission_key dedup, stock check, shipping fee calc)
    report-payment/route.ts   # User reports payment via order number + recipient_name + phone_last3 (pending_payment → pending_confirm)
    cancel-order/route.ts     # User cancels via order number + recipient_name + phone_last3 (pending_payment only) OR Admin cancels (any status, with reason)
    confirm-order/route.ts    # Admin confirms single order + notifications
    batch-confirm/route.ts    # Admin batch confirm
    confirm-shipment/route.ts # Admin marks order(s) as shipped + notifications
    quick-confirm/route.ts    # Admin POS: skip pending_confirm, go straight to confirmed (cash payment)
    notify-arrival/route.ts   # Admin sends product-arrival notification to relevant customers
    export-csv/route.ts       # CSV export of orders
    rounds/route.ts           # Round CRUD (includes shipping_fee)
    products/route.ts         # Product CRUD (includes supplier_id)
    suppliers/route.ts        # Supplier CRUD
    orders/route.ts           # Admin: list orders by round (with optional status filter)
    orders-by-product/route.ts # Group orders by product → customer list
    notification-logs/route.ts # Admin: notification audit log
    users/lookup/route.ts     # Admin-only nickname auto-fill (GET ?nickname=)
    lookup/route.ts           # Order search by recipient_name + phone_last3
    lookup/order/route.ts     # Public order detail fetch by order number + recipient_name + phone_last3
    line/webhook/route.ts     # LINE webhook: signature verify → message handler → order linking with recipient_name + phone_last3
lib/                          → Pure TypeScript business logic (NO React/Next imports)
  db/
    prisma.ts                 # globalThis singleton PrismaClient
    users.ts                  # Nickname lookup/create/admin upsert helpers
    orders.ts                 # Create (with submission_key), update status, query, group by product
    products.ts               # CRUD, stock decrement, progress aggregation
    rounds.ts                 # CRUD, open/close, shipping fee
    suppliers.ts              # CRUD, list with product counts
    notification-logs.ts      # Insert log entry, query by order
  rate-limit.ts               # Lightweight per-process rate limiting for public abuse paths
  line/
    push.ts                   # LINE push/multicast/reply API (raw fetch, never-throw)
    webhook.ts                # HMAC-SHA256 signature verification for LINE webhooks
    extract-order-number.ts   # Extracts ORD-YYYYMMDD-NNN from raw or prefixed LINE messages
    validate-order-code.ts    # Validates order number + recipient_name + phone_last3, links line_user_id to order
    message-handler.ts        # Handles incoming LINE text messages (order linking + status check)
  notifications/
    email.ts                  # Resend client + templates (order confirm, shipment, arrival)
    send.ts                   # Orchestrator: send LINE push + email, log results
  auth/
    supabase-admin.ts         # Supabase Auth helpers (admin login/session check)
    supabase-browser.ts       # Supabase browser client singleton (admin UI)
  admin/
    paths.ts                  # Shared admin path builder (real base path, no hardcoded /admin links)
    notification-summary.ts   # Notification log grouping helpers for dashboard/admin feedback
    order-search.ts           # Shared admin order search + shipment grouping helpers
  utils.ts                    # cn(), formatting, share URL builders, submission/public identity helpers, calcOrderTotal
components/
  ui/                         # shadcn/ui generated components
  StorefrontClient.tsx        # Main storefront client component (cart, checkout, form)
  ProductCard.tsx
  ProgressBar.tsx
  SharePanel.tsx
  DeadlineBanner.tsx
  OrderStatusBadge.tsx
  CartBar.tsx
  PaymentReportForm.tsx       # Two-step payment report (amount + last5 → confirm → submit)
  CancelOrderButton.tsx       # Cancel order with Dialog confirmation
  ShippingFeeNote.tsx         # "宅配到以上地址運費 $XXX" display
  admin/
    OrderCard.tsx             # Admin order card (expandable, per-status actions)
    POSForm.tsx               # POS inline order creation form
    ProductAggregationTable.tsx # Dashboard product demand + customer drill-down + 通知到貨
    ProductForm.tsx           # Product create/edit dialog
hooks/
  use-toast.ts                # shadcn/ui toast hook
  use-admin-session.ts        # Admin Supabase session + allowlist check
  use-admin-fetch.ts          # Authenticated admin fetch wrapper
types/
  index.ts                    # Shared TS interfaces
constants/
  index.ts                    # Status enums, pickup options, bank info keys
prisma/
  schema.prisma               # 7 models: Round, Product, User, Order, OrderItem, NotificationLog, Supplier
  migration.sql               # Initial migration (all tables, triggers, RLS, views)
  migration_002_line_push.sql # Add line_user_id column to orders
  migration_003_notification_log_context.sql # Add notification_logs round/product context + skipped status
  migration_004_single_open_round.sql # Partial unique index: at most one open round
  migration_006_public_access_security.sql # Harden RLS on users/orders/order_items
  seed.ts                     # Dev seed data
```

---

## Database Schema (7 models)

```
Round          → id, name, is_open, deadline, shipping_fee, created_at
Supplier       → id, name, contact_name, phone, email, note, created_at, updated_at
Product        → id, round_id(FK), supplier_id(FK), name, price, unit, is_active, stock, goal_qty, image_url, created_at
User           → id, nickname(UNIQUE), recipient_name, phone, address, email, created_at, updated_at
Order          → id, order_number(UNIQUE), user_id(FK), round_id(FK), total_amount, shipping_fee, status, payment_amount, payment_last5, payment_reported_at, confirmed_at, shipped_at, note, pickup_location, cancel_reason, submission_key(UNIQUE), line_user_id, created_at
OrderItem      → id, order_id(FK), product_id(FK), product_name, unit_price, quantity, subtotal
NotificationLog → id, order_id(FK|null), round_id(FK|null), product_id(FK|null), channel('line'|'email'), type('payment_confirmed'|'shipment'|'product_arrival'|'order_cancelled'), status('success'|'failed'|'skipped'), error_message, created_at
```

### Key Additions from v1

- **`rounds.shipping_fee`**: Integer, nullable. When set, 宅配 orders add this to total. 面交/取貨 orders do not.
- **`suppliers` table**: Linked to products via `products.supplier_id`. Used for 供應商管理 page and product-arrival notifications.
- **`orders.shipping_fee`**: Snapshot of the round's shipping fee at order time (so changing the round fee later doesn't affect existing orders). Null if pickup.
- **`orders.shipped_at`**: Timestamp written when admin confirms shipment.
- **`orders.cancel_reason`**: Text, nullable. Written when admin cancels an order (optional reason).
- **`notification_logs.type`**: Four values: `payment_confirmed`, `shipment`, `product_arrival`, `order_cancelled`.
- **Public nickname safety**: The public storefront no longer auto-fills saved user data. Existing nicknames may only be reused publicly when the submitted details match the saved profile exactly; admin POS can still update saved details under auth.
- **`orders.line_user_id`**: Text, nullable. Set when user pastes order number + recipient name + phone last 3 digits into LINE OA via webhook. Used for 1-on-1 push notifications. Per-order (not per-user) — each order must be linked individually.
- **`notification_logs` Context**: The `order_id` is nullable. Added `round_id` and `product_id` for accurate notification analytics, and a `skipped` status for tracking gracefully skipped notifications (e.g., missing `line_user_id`).

### Order Status Flow

```
pending_payment ──user reports payment──→ pending_confirm ──admin confirms──→ confirmed ──admin ships──→ shipped
       │                                                                                                  ↓
       ↓                                                                                          LINE + Email
   cancelled (user: only from pending_payment)                                                    (出貨通知)
   cancelled (admin: from ANY status, with cancel_reason + cancellation notification)

Admin POS shortcut: pending_payment → confirmed (skip pending_confirm for cash payments via quick-confirm)
```

Five statuses: `pending_payment`, `pending_confirm`, `confirmed`, `shipped`, `cancelled`

Four notification types: `payment_confirmed`, `shipment`, `product_arrival`, `order_cancelled`

Cancel stock restore: yes for pending_payment/pending_confirm/confirmed; no for shipped.

### Terminology (canonical — use consistently)

| Term | Meaning |
|------|---------|
| 宅配 | Home delivery, adds shipping_fee |
| 面交 | In-person pickup at designated location, no shipping fee |
| 確認寄出 | Mark 宅配 order as shipped |
| 確認取貨 | Mark 面交 order as picked up (same status: `shipped`) |
| 代客下單 | Admin creates order on behalf of customer (POS) |
| 快速收款 | POS cash payment → quick-confirm (pending_payment → confirmed) |
| 綁定訂單 | User pastes order number + recipient_name + phone_last3 in LINE OA → webhook links `line_user_id` to that order |

### Key DB Behaviors

- **Order number generation**: Trigger-based `ORD-YYYYMMDD-NNN` with `pg_advisory_xact_lock`.
- **`submission_key`**: UUID UNIQUE. Client generates before submit; duplicate inserts fail harmlessly.
- **`product_progress` view**: Aggregates `order_items` by product (excluding cancelled orders).
- **Auto `updated_at`**: Trigger on `users` and `suppliers` tables.
- **Shipping fee calculation**: `submit-order` route checks `pickup_location`: if null/empty (宅配), adds `round.shipping_fee` to total and snapshots it in `orders.shipping_fee`.
- **Public lookup / mutations**: `/api/lookup` requires `recipient_name + phone_last3`, while `/api/lookup/order`, `/api/report-payment`, `/api/cancel-order`, and LINE binding require `order_number + recipient_name + phone_last3`. Internal UUIDs stay private on public routes.
- **LINE order linking**: User pastes `ORD-YYYYMMDD-NNN 王小美 678` in LINE OA → webhook verifies all three fields and writes `line_user_id` on that order. Per-order (not per-user). Idempotent — re-pasting the same order by the same user is a no-op. One order = one LINE account.
- **LINE message extraction**: The webhook parser accepts exactly one order number, one 3-digit suffix, and a non-empty recipient name; ambiguous messages fail closed.
- **Single-open-round invariant**: At most one round can have `is_open = true`, enforced by a partial unique index (`idx_rounds_single_open`). `create()` atomically closes existing open rounds in a transaction. `update()` does a friendly precheck and catches `P2002` from concurrent conflicts.
- **Order creation two-phase validation**: `createWithItems()` validates all products (existence, round ownership, `is_active`) before any stock mutation. All errors throw `OrderValidationError` inside the `$transaction` to trigger rollback, caught outside and converted to `{ error }` for the API contract.
- **Arrival notification customer counting**: `getCustomersForArrivalNotification()` returns `customerCount` (unique `user_id`, falling back to `order.id` for guests) alongside `lineUserIds` and `emails`. The `customersNotified` field in notify-arrival response reflects unique customers, not delivery endpoints.

### RLS Policies (critical — get these right)

| Table | Anon (unauthenticated) | Authenticated (admin) |
|-------|------------------------|-----------------------|
| `rounds` | SELECT | ALL |
| `suppliers` | — | ALL |
| `products` | SELECT | ALL |
| `users` | — | ALL |
| `orders` | — | ALL |
| `order_items` | — | ALL |
| `notification_logs` | — | SELECT, INSERT |

Public storefront/order operations go through server-side API routes and Prisma, not direct anon table access.

---

## Critical Rules

### Boundaries (violating these causes real bugs)

1. **`lib/` is pure TS.** Zero React or Next.js imports. Ever.
2. **One PrismaClient.** Only `lib/db/prisma.ts` instantiates it (stored on `globalThis`). Never `new PrismaClient()` elsewhere.
3. **No `any`** without a `// any: <justification>` comment.
4. **No secrets in code.** Use `.env.local`. Bank account info uses `NEXT_PUBLIC_BANK_*` env vars.
5. **Stock checks are server-side.** Cart UI prevents over-adding, but `submit-order` must re-validate atomically. Client checks are UX only.
6. **`submission_key` is generated client-side** (once per checkout session). The API deduplicates on the server against the unique constraint.
7. **Shipping fee is snapshotted on order creation.** The order stores `shipping_fee` at creation time. Never recalculate from the round after the fact.
8. **Product arrival notifications target customers by product**, not by order. Query: all users who ordered product X in non-cancelled orders for the current round.
9. **Public order access requires `recipient_name + phone_last3` and, for single-order actions, `order_number + recipient_name + phone_last3`.** Do not expose internal UUIDs on public routes.

### API Routes

- Type with `NextRequest` / `NextResponse`.
- Return `{ error: string }` + correct HTTP status on failure.
- Validate request bodies before touching the DB.
- `submit-order` must: check round open → validate stock → calc shipping → decrement stock → insert order + items in transaction. Public callers must not overwrite an existing nickname profile with different saved details.
- `confirm-order` and `batch-confirm`: update status → send notifications → log results. Notification failure does NOT rollback confirmation.
- `confirm-shipment`: update status to `shipped` + write `shipped_at` → send shipment notifications → log results.
- `notify-arrival`: takes `productId` + `roundId` → find all customers with that product in non-cancelled orders → send "已到達理貨中心" notification to each → log results.
- `report-payment`: public path requires `order_number + recipient_name + phone_last3 + payment_amount + payment_last5`.
- `cancel-order`: Two modes — user (only `pending_payment`, requires `order_number + recipient_name + phone_last3`) and admin (any status, requires auth, optional `cancel_reason`). Restores stock except for `shipped`. Sends cancellation notification (admin cancel only).
- `quick-confirm`: Admin POS shortcut — takes `orderId`, skips `pending_confirm`, sets status to `confirmed` + writes `confirmed_at` + auto-fills payment fields. For cash/in-person payments.
- `lookup`: public path requires `recipient_name + phone_last3`; single-order public detail fetch uses `order_number + recipient_name + phone_last3`. Public routes must never return internal order IDs.
- `users/lookup`: admin-only helper for POS autofill. Never expose it to anonymous callers again.
- `line/webhook`: LINE webhook receiver. Verifies `x-line-signature` (HMAC-SHA256), dispatches text messages to `handleMessage()`. Always returns 200. Handles: order number + recipient name + phone last 3 → validate + link `line_user_id`; existing user → show status; unknown text → show instructions.

### Git

- Branch naming: `claude/<description>-<sessionId>`.
- Never push to `main`/`master` without explicit permission.
- Imperative commit messages: `Add storefront page`, `Fix stock race in submit-order`.
- Stage specific files, not `git add -A`.

### Code Style

- Prettier for formatting. ESLint 9 flat config (`eslint.config.mjs`) with `eslint-config-next`.
- Tests: Vitest, colocated as `*.test.ts` or in `__tests__/`.
- Only change what was requested. No speculative helpers, no drive-by docstrings.

---

## Stack Pitfalls

| # | Pitfall | Why it matters |
|---|---------|---------------|
| 1 | **Prisma hot-reload leak** | `new PrismaClient()` on every hot reload exhausts DB connections. Use `globalThis` singleton. |
| 2 | **Prisma `generate` after schema changes** | Always run `npx prisma generate` after editing `schema.prisma`. |
| 3 | **Supabase pooled vs direct URL** | `DATABASE_URL` = pooled (port 6543, runtime). `DIRECT_URL` = direct (port 5432, migrations). |
| 4 | **Vercel limits** | Hobby tier: 10s function timeout, 4.5MB body. CSV exports must stream or paginate. |
| 5 | **shadcn/ui components are editable copies** | Don't regenerate without warning — local changes get overwritten. |
| 6 | **Stock decrement must be atomic** | `UPDATE products SET stock = stock - $qty WHERE stock >= $qty` in transaction. Never read-then-write. |
| 7 | **Order number trigger needs advisory lock** | `pg_advisory_xact_lock` prevents duplicate sequence numbers. |
| 8 | **LINE Messaging API push (not broadcast)** | Uses push (`/push`), multicast (`/multicast`), and reply (`/reply`) — NOT broadcast. Requires `line_user_id` linked via webhook. Raw `fetch`, no SDK. |
| 9 | **RLS + Prisma** | Browser Supabase is for admin auth only. Storefront and API mutations run server-side via Prisma; RLS is the containment layer for direct client access, not the primary app authorization model. |
| 10 | **`submission_key` must be UUID** | Use `crypto.randomUUID()`. Strings/timestamps will collide. |
| 11 | **Shipping fee snapshot** | Store `shipping_fee` on the order at creation time. If admin changes round fee later, existing orders are unaffected. |

---

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (client-side, RLS-gated) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role (server-side, bypasses RLS) |
| `ADMIN_EMAILS` | Yes | Comma-separated email allowlist for admin access |
| `DATABASE_URL` | Yes | Supabase pooled connection (Prisma runtime) |
| `DIRECT_URL` | Yes | Supabase direct connection (Prisma migrations) |
| `RESEND_API_KEY` | Yes | Email sending |
| `RESEND_FROM_EMAIL` | Yes | Sender address |
| `LINE_CHANNEL_ACCESS_TOKEN` | Yes | LINE Messaging API channel access token |
| `LINE_CHANNEL_SECRET` | Yes | LINE Messaging API channel secret |
| `NEXT_PUBLIC_BANK_NAME` | Yes | Bank name shown to users |
| `NEXT_PUBLIC_BANK_ACCOUNT` | Yes | Bank account number |
| `NEXT_PUBLIC_BANK_HOLDER` | Yes | Account holder name |
| `NEXT_PUBLIC_SITE_URL` | Yes | Base URL for share links |

---

## Audit Closeout (2026-03-22)

Phase 1–5 is now considered complete for merge after the audit/remediation pass documented in `phase-1-5-audit.md`. Phase 6 should start from the existing codebase, not by re-auditing earlier phases.

### What Was Fixed

- **Schema alignment:** `prisma/schema.prisma`, `prisma/migration.sql`, `prisma/migration_003_notification_log_context.sql`, and `types/index.ts` now agree on `notification_logs.round_id`, `notification_logs.product_id`, and `status = 'skipped'`.
- **LINE flow correctness:** Order detail copy now tells users to paste `order_number + recipient_name + phone_last3`; the webhook parser accepts raw or prefixed order text but only binds when exactly one order number, one 3-digit suffix, and a non-empty recipient name are present; the pending-payment share CTA was restored.
- **Admin routing:** Admin print/navigation paths now use shared helpers instead of hardcoded `/admin/...`, so obfuscation via `ADMIN_BASE` remains intact.
- **Idempotent batch ops:** Batch confirm/shipment now transition-guard on source state and send notifications only for rows actually changed in that call.
- **Dashboard gaps:** Product-demand expansion now shows order numbers, product demand uses cached product lookups, and admins have a per-product packing-list print action instead of page-only printing.

### Structural Changes

- Added `prisma/migration_003_notification_log_context.sql` for notification-log context columns and `skipped` status support.
- Added `/api/admin/session` so the admin shell verifies allowlisted access before loading protected UI.
- Added shared admin helpers under `lib/admin/` for real admin path generation, notification summaries, and reusable order search/grouping.
- Added `lib/line/extract-order-number.ts` so LINE parsing is reusable and testable.
- Added focused Vitest unit coverage for notification summaries, LINE extraction, batch idempotency, admin paths, and admin order search/grouping.

### Merge-Validated Guarantees

- Migration is structurally safe for existing rows: new notification-log context columns are nullable, and the status check was widened rather than tightened.
- Batch confirm/shipment is transition-guarded and notification-safe: side effects are triggered only from rows updated in the current call.
- Admin auth remains enforced server-side on admin data routes through `verifyAdminSession()`. `/api/admin/session` hardens the shell; it does not replace route enforcement.
- Admin routing no longer depends on hardcoded `/admin/...` links for navigational flows.

### Caveats And Deferred Work

- **Historical analytics gap:** Older `product_arrival` logs without `order_id` / `round_id` / `product_id` cannot be back-attributed. Round-level analytics are incomplete for that historical slice.
- **LINE ambiguity handling:** Multiple order numbers in one LINE message currently resolve to the first match. Ambiguity rejection is not implemented yet.
- **Test depth:** Confirm → notify behavior is covered at the unit level only. There is still no integration test covering the full route-to-notification path.
- **Dependencies:** Existing `npm audit` findings are deferred to a dedicated dependency upgrade pass.

### Deferred Backlog

- Decide whether historical arrival analytics should remain explicitly partial or gain a forward-only reporting annotation strategy.
- Reject or disambiguate LINE messages containing multiple order numbers instead of using first-match-wins.
- Add an integration-level confirm → notify regression test.
- Run a separate dependency remediation pass for current `npm audit` issues.

## Audit Closeout — Pass 2 (2026-03-23)

Post-remediation review caught three regressions and one spec drift from the first audit pass. All fixed in this pass.

### What Was Fixed

- **P0 — Transaction rollback regression**: `return { error }` inside `$transaction` commits instead of rolling back. Stock decremented for earlier items was lost when a later item failed validation. Fixed by throwing `OrderValidationError` inside the transaction (triggers rollback), caught outside and converted to `{ error }`. Also split processing into validate-all-first, then decrement.
- **P1 — Non-atomic single-open-round**: `create()` ran close + insert as separate calls; failed insert left no open round. Fixed by wrapping in `prisma.$transaction`. Added `migration_004_single_open_round.sql` with partial unique index. `update()` now catches `P2002` for concurrent conflicts.
- **P2 — Customer count semantics**: `customersNotified` counted delivery endpoints (LINE IDs + emails union), not customers. One customer with both channels counted as 2. Fixed by tracking unique `user_id` (fallback `order.id`) and returning `customerCount`.
- **Spec drift**: `whatwearebuilding.md` line 469 documented multi-open-round storefront switching, conflicting with the accepted single-open-round model. Updated to reflect DB-enforced single-open-round.

### Verification

- `npx tsc --noEmit` — pass
- `npm run lint` — pass
- `npm run build` — pass (30 routes, 0 errors)
- `npx vitest run` — 23 tests pass (7 test files)

## Audit Closeout — Pass 3 (2026-03-23)

Post-remediation re-audit found one remaining concurrency gap and stale doc counts. Fixed in this pass.

### What Was Fixed

- **P1 — POST /api/rounds concurrent conflict as 500**: `create()` did not catch `P2002` from the partial unique index. Concurrent `POST /api/rounds` requests fell through to the generic catch → 500. Fixed: `create()` now wraps the transaction in `try/catch`, catches `P2002`, and returns `{ error }` (same pattern as `update()`). Route maps `{ error }` to `400`.
- **Doc drift**: `phase-6-readiness-audit.md` had stale test counts (4/6 instead of 7 for rounds tests, 23 instead of 24 total). Corrected.

### Verification

- `npx tsc --noEmit` — pass
- `npm run lint` — pass
- `npm run build` — pass (30 routes, 0 errors)
- `npx vitest run` — 24 tests pass (7 test files)

## Security Hardening (2026-03-24)

Audit-driven hardening closed the public trust-boundary gaps identified in the CTO security review.

### What Was Changed

- Locked RLS on `users`, `orders`, and `order_items` to authenticated/admin access only. Anonymous direct reads/writes to those tables are no longer allowed.
- Removed public nickname-based lookup/autofill/history. Public lookup now uses `recipient_name + phone_last3`, and single-order public actions use `order_number + recipient_name + phone_last3`.
- Made `/api/users/lookup` admin-only for POS autofill.
- Added lightweight rate limiting on `submit-order`, `lookup`, `report-payment`, and `cancel-order`.
- Updated LINE binding so users must send order number + recipient name + phone last 3; binding failure copy no longer acts as a strong existence oracle.
- Prevented public nickname collisions from overwriting an existing saved profile with different phone/address/email details.

### Verified Public Access Results

- Anonymous direct Supabase access to `users`, `orders`, and `order_items` is blocked by RLS (`SELECT` returns no rows; `INSERT`/`UPDATE` are rejected or blocked).
- Authenticated/admin access remains available for those tables.
- Public read access for `rounds` and `products` remains intact.
- The old permissive anon policies on `users`, `orders`, and `order_items` are gone.

### Verification

- `npx vitest run` — 99 tests pass (21 test files)
- `npm run lint` — pass
- `npm run build` — pass
- `npx tsc --noEmit` — pass

---

## Verification (run before presenting work)

```bash
npm run build            # full build (also generates .next/types needed by tsc)
npx tsc --noEmit        # types (requires prior build for Next.js generated route types)
npm run lint             # eslint
npx vitest run           # tests (if relevant tests exist)
```

All must pass. If any fails due to your code, fix it before continuing.

> **Note:** `npx tsc --noEmit` depends on `.next/types/validator.ts` generated by `npm run build`. On a fresh checkout or after `rm -rf .next`, run `npm run build` first.

## Self-Review (after every change, before commit)

1. **Does it do what was asked?** Re-read the request. Nothing extra.
2. **Security:** No secrets committed? Input validated? Stock checks server-side? RLS correct?
3. **Conventions:** `lib/` pure TS? Single PrismaClient? No `any` without comment?
4. **Diff audit:** `git diff` — any leftover `console.log`, `debugger`, commented-out code?
5. **Regression:** Did changes to shared `lib/` code break any importers?

---

## Code Cleanup (on-demand only)

1. **Dead code** — Remove unused imports, `console.log`/`debugger`. Commit: `cleanup: remove dead code in [scope]`
2. **Formatting** — Prettier, normalize imports, replace magic values. Commit: `cleanup: normalize formatting in [scope]`
3. **Light refactor** — Extract repeated logic (≥3), flatten deep nesting (>3 levels), split functions >80 lines. Commit: `cleanup: refactor [what] in [scope]`
4. **Verify** — Run all verification commands. All must pass.

Never clean up more than 10 files without user approval. Never redesign architecture.

---

## Error Log

**When to log:** After fixing any mistake caught by user, build failure, or runtime error. Log in same commit as fix.

**Format:**
```
### [YYYY-MM-DD] Title
**Mistake:** What went wrong.
**Fix:** What corrected it.
**Rule:** How to prevent it.
```

Keep max 15 entries. When full, drop oldest.

#### Entries

### [2026-03-24] Prisma include inference drift caused build-only route type failure
**Mistake:** `findOrderByNumberAndAccessCode()` relied on inferred Prisma return types. Local runtime behavior was correct, but the production build treated the result as a base `Order` without included relations, so `/api/lookup` failed on `order.order_items`.
**Fix:** Defined explicit Prisma include constants and `OrderGetPayload` types for order queries with relations, and returned those concrete payload shapes from `lib/db/orders.ts`.
**Rule:** For shared Prisma query helpers used across routes/pages, make relation-bearing payload types explicit instead of relying on cross-file inference during Next.js builds.

### [2026-03-23] return { error } inside $transaction commits instead of rolling back
**Mistake:** Converted `throw` to `return { error }` inside Prisma interactive transaction. Prisma commits on return, only rolls back on throw. Stock decremented for earlier items was permanently lost when a later item failed.
**Fix:** Introduced `OrderValidationError` thrown inside transaction (triggers rollback), caught outside and converted to `{ error }` return.
**Rule:** Never `return` from a Prisma `$transaction` callback to signal failure. Always `throw` to trigger rollback.

### [2026-03-23] Non-atomic close + create for single-open-round
**Mistake:** `rounds.create()` called `updateMany` then `create` as separate operations. If `create` failed, existing rounds were already closed — no open round left.
**Fix:** Wrapped both operations in `prisma.$transaction`. Added partial unique index for DB-level enforcement.
**Rule:** Multi-step invariant enforcement must be transactional. Add DB constraints as safety net.

### [2026-03-23] customersNotified counted endpoints, not customers
**Mistake:** Union of LINE user IDs and emails counted delivery endpoints. One customer with both LINE and email was counted as 2.
**Fix:** Added `customerCount` based on unique `user_id` (fallback `order.id` for guests).
**Rule:** When counting "customers notified", dedupe by customer identity, not by delivery channel.
