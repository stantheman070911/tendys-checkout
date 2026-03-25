# CLAUDE.md

Read this file before writing or modifying any code. Then read `whatwearebuilding.md` for product spec, then `roadmap.md` for your current task. Do not start coding until you've read all three.

**Versions:** Next.js 16.1.7, React 19.2.4, TypeScript 5.9, Tailwind CSS 3.4, Prisma 6.12, ESLint 9 (flat config).

**Principles:** Efficiency, effectiveness, quality (no ambiguous states), simplicity. Simple ≠ easy — do not remove necessary system logic.

---

## Latest Handoff

- Public + admin UI were refactored into one editorial-natural luxury design system.
- Global brand layer lives in `app/globals.css`: warm ivory paper, olive-charcoal ink, muted forest primary, bronze accents, premium rounded surfaces, and shared `lux-*` utility classes.
- Intended typography is now explicitly loaded in `app/layout.tsx` via vendored local package assets:
  - `@fontsource/noto-sans-tc`
  - `@fontsource/noto-serif-tc`
- Cart-bar secondary copy contrast was raised in `components/CartBar.tsx` to avoid marginal readability on weaker screens.
- The redesign was visual only. Business logic and public/admin flows were intentionally preserved.
- `/api/submit-order` now uses an atomic checkout path in `lib/db/orders.ts`: nickname resolution + user persistence + order creation happen in one transaction, and stale `orders.access_code` schema drift is surfaced as `503` instead of opaque `500`.
- `components/PublicOrderPage.tsx` no longer flashes the manual verification form immediately after checkout redirect; it waits for the stored access auto-unlock attempt to finish first.
- Public product progress now distinguishes **goal** from **sellout** for finite-stock items:
  - shared helper: `lib/progress-bar.ts`
  - finite-stock bars use stock ceiling as the track and render `成團目標` as a marker instead of filling to 100% at goal hit
  - storefront `餘量` badge in `components/ProductCard.tsx` was enlarged and given stronger contrast for urgency
  - admin products/suppliers pages were updated to use the same stock-cap bar logic
- `Round` now owns configurable `pickup_option_a` + `pickup_option_b`. Shared helper: `lib/pickup-options.ts`. Storefront checkout, admin POS, rounds admin UI, and submit-order validation all read from the round, not a hard-coded constant.
- Live databases need manual SQL `prisma/migration_008_round_pickup_options.sql` before deploying the round-configurable pickup feature.
- Public order detail now includes:
  - one-click copy of the LINE binding string
  - a direct button to the official LINE OA
  - saved contact phone + shipping address after successful public verification
- Public lookup no longer forces a second verification step before opening a matched order:
  - shared helper: `lib/public-order-access.ts`
  - a verified `/lookup` search now caches session access for every matched order in that browser session
  - direct `/order/[orderNumber]` visits still fall back to manual `recipient_name + phone_last3` verification
  - lookup CTA copy now includes Chinese (`view detail / 查詢細節`) for lower-English users
- Verified after redesign + subsequent checkout/order-detail follow-up:
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm run build`
  - focused `npx vitest run ...` coverage for submit-order, round pickup config, public lookup/order detail flows, stock-cap progress math, and public-order access session handling

### Primary Redesign Files

- Public shell + storefront: `app/page.tsx`, `components/StorefrontClient.tsx`, `components/ProductCard.tsx`, `components/CartBar.tsx`, `components/SharePanel.tsx`
- Public order flows: `app/lookup/page.tsx`, `components/PublicOrderPage.tsx`, `components/PaymentReportForm.tsx`, `components/CancelOrderButton.tsx`
- Admin shell + key screens: `app/admin/layout.tsx`, `app/admin/page.tsx`, `app/admin/dashboard/page.tsx`, `app/admin/orders/page.tsx`, `app/admin/shipments/page.tsx`, `app/admin/products/page.tsx`, `app/admin/rounds/page.tsx`, `app/admin/suppliers/page.tsx`
- Shared admin cards/forms: `components/admin/OrderCard.tsx`, `ShipmentCard.tsx`, `POSForm.tsx`, `ProductAggregationTable.tsx`, `ProductForm.tsx`, `SupplierForm.tsx`
- Shared primitives: `components/ui/button.tsx`, `input.tsx`, `dialog.tsx`, `select.tsx`

### Design Intent

- Mood: warm, natural, premium-market, editorial. Avoid flashy-tech or nightclub-dark aesthetics.
- Public and admin must feel like the same product family.
- If extending the UI, prefer existing `lux-*` classes before inventing new one-off Tailwind styling.
- Preserve the stronger hierarchy introduced in the redesign:
  - serif display headlines
  - restrained bronze meta labels
  - floating dark tray for cart/batch actions
  - image-first product presentation
  - premium receipt-like order detail

---

## Project

Group-buy ordering system for fresh produce (生鮮團購訂購系統). Organizers share a link in LINE groups → users browse, order, report bank transfers → admin confirms payments, ships, coordinates with suppliers, sends notifications.

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

1. Admin creates round (開團) with deadline + shipping fee + pickup labels + products.
2. Shares URL in LINE group.
3. User browses → adds to cart → enters nickname + recipient info + pickup option → submits (idempotent via `submission_key`).
4. System shows bank details + share CTA if any product under goal.
5. User transfers money, reports payment (`order_number + recipient_name + phone_last3`).
6. Admin confirms (single/batch) → LINE + email notification. Status: `confirmed`.
7. Products arrive → admin sends arrival notification to relevant customers.
8. Admin marks shipped (待出貨, grouped by pickup method) → shipment notification. Status: `shipped`.
9. User checks status via `/lookup` (`recipient_name + phone_last3`) and can open any matched order detail in that browser session without re-entering the same fields.
10. **LINE linking**: User pastes `ORD-YYYYMMDD-NNN 王小美 678` → webhook validates + links `line_user_id`.
11. **POS**: Admin creates orders on behalf of customers, instant cash confirmation.
12. **Admin cancel**: From any status, with reason + cancellation notification.

---

## Directory Layout

```
app/
  page.tsx                      # Storefront
  order/[orderNumber]/page.tsx  # Public order detail (auto-unlocks from checkout or verified lookup session; direct access still gated by order_number + recipient_name + phone_last3)
  lookup/page.tsx               # Order lookup (recipient_name + phone_last3)
  gtfo/page.tsx                 # Troll page for /admin snoopers
  admin/                        # ⚠️ NOT /admin (redirects to /gtfo). Real URL: /bitchassnigga (next.config.ts rewrites)
    layout.tsx                  # Auth guard, nav tabs, POS button
    page.tsx                    # Login
    dashboard/page.tsx          # Stats + aggregation + notification log
    orders/page.tsx             # Order list, filter, confirm, CSV
    orders/[id]/print/page.tsx  # Packing slip (@media print)
    shipments/page.tsx          # 待出貨 management
    products/page.tsx           # Product CRUD
    rounds/page.tsx             # Round management
    suppliers/page.tsx          # Supplier CRUD
  api/
    admin/session/route.ts      # Auth probe (allowlist check)
    submit-order/route.ts       # Create order (dedup, stock check, shipping calc)
    report-payment/route.ts     # pending_payment → pending_confirm
    cancel-order/route.ts       # User cancel (pending_payment only) OR admin cancel (any status)
    confirm-order/route.ts      # Admin confirm single
    batch-confirm/route.ts      # Admin confirm batch
    confirm-shipment/route.ts   # Admin ship (single/batch)
    quick-confirm/route.ts      # POS: pending_payment → confirmed (cash)
    notify-arrival/route.ts     # Product arrival → notify customers
    export-csv/route.ts
    rounds/route.ts
    products/route.ts
    suppliers/route.ts
    orders/route.ts             # List by round (optional status filter)
    orders/[id]/route.ts        # Single order detail
    orders-by-product/route.ts  # Group by product → customer list
    notification-logs/route.ts
    users/lookup/route.ts       # Admin-only POS autofill
    lookup/route.ts             # Public: recipient_name + phone_last3
    lookup/order/route.ts       # Public: order_number + recipient_name + phone_last3
    line/webhook/route.ts       # LINE webhook (signature verify → order linking)
lib/                            # Pure TypeScript — NO React/Next imports
  db/prisma.ts                  # globalThis singleton PrismaClient
  db/users.ts, orders.ts, products.ts, rounds.ts, suppliers.ts, notification-logs.ts
  rate-limit.ts
  pickup-options.ts             # Round pickup option defaults + validation
  line/push.ts, webhook.ts, extract-order-number.ts, extract-order-binding.ts
  line/validate-order-code.ts, message-handler.ts
  notifications/email.ts, send.ts
  auth/supabase-admin.ts, supabase-browser.ts
  admin/paths.ts, notification-summary.ts, order-search.ts, shipment-status.ts
  utils.ts                      # cn(), formatting, share URLs, calcOrderTotal
components/
  ui/                           # shadcn/ui (editable copies — don't regenerate)
  StorefrontClient.tsx, PublicOrderPage.tsx, ProductCard.tsx, ProgressBar.tsx
  CartBar.tsx, SharePanel.tsx, DeadlineBanner.tsx, OrderStatusBadge.tsx
  PaymentReportForm.tsx, CancelOrderButton.tsx, ShippingFeeNote.tsx
  admin/OrderCard.tsx, POSForm.tsx, ProductAggregationTable.tsx
  admin/ProductForm.tsx, SupplierForm.tsx, ShipmentCard.tsx
hooks/use-toast.ts, use-admin-session.ts, use-admin-fetch.ts
types/index.ts
constants/index.ts              # Status enums, bank info keys
prisma/
  schema.prisma                 # 7 models
  migration.sql                 # Initial (tables, triggers, RLS, views)
  migration_002–008             # Incremental (line_user_id, notif context, single-open-round, line index, RLS hardening, remove access_code, round pickup labels)
  seed.ts
```

---

## Database Schema (7 models)

```
Round          → id, name, is_open, deadline, shipping_fee, pickup_option_a, pickup_option_b, created_at
Supplier       → id, name, contact_name, phone, email, note, created_at, updated_at
Product        → id, round_id(FK), supplier_id(FK), name, price, unit, is_active, stock, goal_qty, image_url, created_at
User           → id, nickname(UNIQUE), recipient_name, phone, address, email, created_at, updated_at
Order          → id, order_number(UNIQUE), user_id(FK), round_id(FK), total_amount, shipping_fee, status, payment_amount, payment_last5, payment_reported_at, confirmed_at, shipped_at, note, pickup_location, cancel_reason, submission_key(UNIQUE), line_user_id, created_at
OrderItem      → id, order_id(FK), product_id(FK), product_name, unit_price, quantity, subtotal
NotificationLog → id, order_id(FK|null), round_id(FK|null), product_id(FK|null), channel, type, status, error_message, created_at
```

### Order Status Flow

```
pending_payment → pending_confirm → confirmed → shipped
       ↓                                           ↓
   cancelled (user: pending_payment only)    LINE + Email
   cancelled (admin: ANY status + cancel_reason)

POS shortcut: pending_payment → confirmed (quick-confirm, cash)
```

Statuses: `pending_payment`, `pending_confirm`, `confirmed`, `shipped`, `cancelled`
Notification types: `payment_confirmed`, `shipment`, `product_arrival`, `order_cancelled`
Cancel stock restore: yes except `shipped`.

### Terminology

| Term | Meaning |
|------|---------|
| 宅配 | Home delivery, adds shipping_fee |
| 面交 | In-person pickup, no shipping fee |
| 確認寄出/確認取貨 | Mark shipped (宅配/面交, same status: `shipped`) |
| 代客下單 | Admin POS order creation |
| 快速收款 | POS cash → quick-confirm |
| 綁定訂單 | LINE linking via order_number + recipient_name + phone_last3 |

### Key DB Behaviors

- **Order numbers**: Trigger-based `ORD-YYYYMMDD-NNN` with `pg_advisory_xact_lock`.
- **`submission_key`**: Client-generated UUID. Server deduplicates via unique constraint.
- **`product_progress` view**: Aggregates order_items by product (excluding cancelled).
- **Shipping fee**: `submit-order` snapshots `round.shipping_fee` on 宅配 orders. Never recalculate after creation.
- **Pickup options**: `pickup_option_a` / `pickup_option_b` live on `Round`. `pickup_location` must be empty string (宅配) or match that round’s configured labels.
- **Public access**: `/api/lookup` requires `recipient_name + phone_last3`. A successful lookup may cache per-order session access client-side, but server truth for single-order actions remains `order_number + recipient_name + phone_last3`. No internal UUIDs on public routes.
- **Public order detail payload**: After public verification succeeds, `/api/lookup/order` may return saved phone + address for that order’s user so the customer can verify delivery details.
- **LINE linking**: Per-order (not per-user). Webhook verifies all three fields. Idempotent. One order = one LINE account.
- **Single-open-round**: Partial unique index. `create()` atomically closes existing open rounds. `update()` catches `P2002`.
- **Order creation**: Two-phase — validate all products first, then decrement stock. `OrderValidationError` thrown inside `$transaction` triggers rollback.
- **Arrival notifications**: Target customers by product, count by unique customer identity (not delivery endpoints).

### RLS Policies

| Table | Anon | Authenticated (admin) |
|-------|------|-----------------------|
| `rounds`, `products` | SELECT | ALL |
| `suppliers`, `users`, `orders`, `order_items` | — | ALL |
| `notification_logs` | — | SELECT, INSERT |

Public operations go through server-side API routes + Prisma, not direct anon access.

---

## Critical Rules

### Boundaries (violating these causes real bugs)

1. **`lib/` is pure TS.** Zero React/Next.js imports.
2. **One PrismaClient.** Only `lib/db/prisma.ts` (globalThis singleton).
3. **No `any`** without `// any: <justification>`.
4. **No secrets in code.** `.env.local` only. Bank info uses `NEXT_PUBLIC_BANK_*`.
5. **Stock checks are server-side.** Client checks are UX only; `submit-order` re-validates atomically.
6. **`submission_key`** = `crypto.randomUUID()`, generated client-side once per checkout session.
7. **Shipping fee snapshot.** Stored on order at creation. Never recalculate from round.
8. **Arrival notifications target by product**, not order.
9. **Public routes use `recipient_name + phone_last3`** (+ `order_number` for single-order actions). No internal UUIDs.
10. **Pickup options are round-scoped.** Never validate or render pickup labels from a global constant.

### API Route Contracts

- Type with `NextRequest`/`NextResponse`. Return `{ error: string }` + correct HTTP status on failure.
- Validate request bodies before DB access.
- `submit-order`: round open → validate stock → calc shipping → decrement stock → insert (transaction). No overwriting existing nickname profiles with different details.
- `submit-order`: validate `pickup_location` against the round’s configured pickup labels, not a static options array.
- `confirm-order`/`batch-confirm`: update status → notify → log. Notification failure does NOT rollback.
- `confirm-shipment`: status → `shipped` + `shipped_at` → notify → log.
- `notify-arrival`: `productId + roundId` → customers with that product in non-cancelled orders → notify.
- `cancel-order`: User mode (pending_payment, public auth) or admin mode (any status, with reason + notification). Restore stock except shipped.
- `quick-confirm`: POS shortcut, `orderId` → confirmed + auto-fill payment fields.
- `users/lookup`: **Admin-only**. Never expose to anonymous callers.
- `lookup/order`: After successful public verification, returning the saved phone/address is acceptable; before verification, expose nothing.
- `line/webhook`: Always returns 200. HMAC verify → `handleMessage()`.

### Git

- Branch: `claude/<description>-<sessionId>`. Never push to main without permission.
- Imperative commits. Stage specific files, not `git add -A`.

### Code Style

- Prettier + ESLint 9 flat config. Tests: Vitest, colocated `*.test.ts`.
- Only change what was requested. No speculative helpers or drive-by docstrings.

---

## Stack Pitfalls

| # | Pitfall | Rule |
|---|---------|------|
| 1 | Prisma hot-reload leak | Use `globalThis` singleton, never `new PrismaClient()` elsewhere |
| 2 | Prisma generate | Run `npx prisma generate` after schema changes |
| 3 | Supabase URLs | `DATABASE_URL` = pooled (6543, runtime). `DIRECT_URL` = direct (5432, migrations) |
| 4 | Vercel limits | 10s timeout, 4.5MB body. CSV must stream/paginate |
| 5 | shadcn/ui copies | Don't regenerate — local changes get overwritten |
| 6 | Stock atomicity | `SET stock = stock - $qty WHERE stock >= $qty` in transaction |
| 7 | Order number trigger | `pg_advisory_xact_lock` prevents duplicates |
| 8 | LINE API | Push/multicast/reply only (not broadcast). Raw fetch, no SDK |
| 9 | RLS + Prisma | Browser Supabase = admin auth only. App logic runs server-side via Prisma |
| 10 | submission_key | Must be UUID (`crypto.randomUUID()`), not string/timestamp |
| 11 | Shipping fee | Snapshot on order creation. Round changes don't affect existing orders |
| 12 | Round pickup labels | After schema change, run `npx prisma generate` and apply `prisma/migration_008_round_pickup_options.sql` to live Supabase before deploy |

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side anon key (RLS-gated) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side service role (bypasses RLS) |
| `ADMIN_EMAILS` | Comma-separated admin email allowlist |
| `DATABASE_URL` | Supabase pooled connection (Prisma runtime) |
| `DIRECT_URL` | Supabase direct connection (migrations) |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Email sending |
| `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET` | LINE Messaging API |
| `NEXT_PUBLIC_BANK_NAME` / `NEXT_PUBLIC_BANK_ACCOUNT` / `NEXT_PUBLIC_BANK_HOLDER` | Bank info shown to users |
| `NEXT_PUBLIC_SITE_URL` | Base URL for share links |

---

## Verification (run before presenting work)

```bash
npm run build        # full build (generates .next/types needed by tsc)
npx tsc --noEmit     # types (requires prior build)
npm run lint         # eslint
npx vitest run       # tests
```

All must pass. Fix failures before continuing.

## Self-Review (after every change, before commit)

1. Does it do what was asked? Nothing extra.
2. Security: No secrets? Input validated? Stock server-side? RLS correct?
3. Conventions: `lib/` pure TS? Single PrismaClient? No untagged `any`?
4. Diff: No leftover `console.log`, `debugger`, commented-out code?
5. Regression: Shared `lib/` changes — did importers break?

## Code Cleanup (on-demand only)

1. Dead code → `cleanup: remove dead code in [scope]`
2. Formatting → `cleanup: normalize formatting in [scope]`
3. Light refactor (≥3 repeats, >3 nesting, >80 lines) → `cleanup: refactor [what] in [scope]`
4. Verify all commands pass. Never clean >10 files without approval.

---

## Error Log

**When to log:** After fixing mistakes caught by user, build, or runtime. Max 15 entries.

### [2026-03-24] submit-order partial user writes + stale access_code schema drift
**Mistake:** `/api/submit-order` created or updated `users` before the order transaction. If order creation failed, checkout left partial user state behind. A stale database still requiring `orders.access_code` also surfaced as a generic `500`.
**Fix:** Moved nickname resolution + user persistence into the same transaction as order creation in `lib/db/orders.ts`. `/api/submit-order` now maps known `P2011 access_code` drift to `503` and names `migration_007_remove_access_code.sql`.
**Rule:** Public/admin checkout user writes must be atomic with order creation. When Prisma exposes schema drift through typed errors/meta, return an explicit operator-facing failure instead of a generic `500`.

### [2026-03-24] Public order page flashed verification UI before auto-unlock
**Mistake:** Immediately after checkout redirect to `/order/[orderNumber]`, the page briefly rendered the manual verification form before consuming the just-saved sessionStorage access payload.
**Fix:** `components/PublicOrderPage.tsx` now holds the page in a loading state until the stored access attempt succeeds or fails.
**Rule:** If a page auto-consumes stored public access state, do not render fallback verification UI until that attempt has resolved.

### [2026-03-24] Prisma include inference drift
**Mistake:** Inferred Prisma return types worked at runtime but production build treated result as base `Order` without relations.
**Fix:** Explicit include constants + `OrderGetPayload` types in `lib/db/orders.ts`.
**Rule:** Make relation-bearing Prisma payload types explicit for shared query helpers.

### [2026-03-23] return { error } inside $transaction commits instead of rolling back
**Mistake:** Prisma commits on return, only rolls back on throw. Stock lost on partial validation failure.
**Fix:** `OrderValidationError` thrown inside transaction, caught outside → `{ error }`.
**Rule:** Never `return` from `$transaction` to signal failure. Always `throw`.

### [2026-03-23] Non-atomic single-open-round
**Mistake:** Separate close + create calls. Failed create left no open round.
**Fix:** `prisma.$transaction` + partial unique index.
**Rule:** Multi-step invariants must be transactional with DB constraints as safety net.

### [2026-03-23] Customer count counted endpoints, not customers
**Mistake:** LINE IDs + emails union double-counted customers with both channels.
**Fix:** Dedupe by `user_id` (fallback `order.id` for guests).
**Rule:** Count customers by identity, not delivery channel.
