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
- Admin auth is now a two-step model: Supabase still handles login, but `/api/admin/session` validates the access token once and establishes a signed `tendy_admin_session` cookie. Admin pages and routes now trust that cookie instead of re-checking Supabase on every request.
- Admin session signing and public order-access signing now require separate secrets in production: `ADMIN_SESSION_SECRET` and `PUBLIC_ORDER_ACCESS_SECRET`. They no longer fall back to `SUPABASE_SERVICE_ROLE_KEY`.
- Public abuse protection is now store-backed in production through Upstash Redis. Production deploys must provide `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and optionally `RATE_LIMIT_PREFIX`.
- Admin pages now render server-first through `components/admin/AdminShell.tsx` and `lib/admin/server.ts`; the old client-only auth/round bootstrap waterfall was removed.
- Admin dashboard/orders/shipments were reworked around backend aggregation and paginated list loaders instead of downloading full round datasets into the browser.
- Admin efficiency follow-up landed after review:
  - admin list routes now return explicit thin row view-models, while order/shipment detail expands lazily from `/api/orders/[id]`
  - dashboard summary data now comes from `lib/admin/dashboard.ts` instead of rebuilding counts/product demand/notification summaries in the browser
  - CSV export now uses `HEAD` preflight + a persistent hidden iframe transport, and `/api/export-csv` marks both success and error responses as `Cache-Control: private, no-store`
  - batch shipment printing now goes through `/api/orders/print-batch`, which is `roundId`-scoped, deduped, capped at 50, and restricted to `confirmed` shipment rows
  - after skeptical review, authoritative `router.refresh()` was restored for order/shipment mutation flows so totals and pagination metadata cannot drift
- Public order access is now token/cookie based instead of `sessionStorage` based:
  - `/api/submit-order` returns a signed detail URL for the created order
  - `/api/lookup` returns signed detail URLs for each matched result
  - `/api/public-order/access` validates the token or posted identity, sets an order-scoped httpOnly cookie, and redirects to clean `/order/[orderNumber]`
  - `app/order/[orderNumber]/page.tsx` now renders server-first when that cookie is present
- Public product progress now distinguishes **goal** from **sellout** for finite-stock items:
  - shared helper: `lib/progress-bar.ts`
  - finite-stock bars use stock ceiling as the track and render `成團目標` as a marker instead of filling to 100% at goal hit
  - storefront `剩餘` badge in `components/ProductCard.tsx` was enlarged and given stronger contrast for urgency
  - admin products/suppliers pages were updated to use the same stock-cap bar logic
- `Round` now owns configurable `pickup_option_a` + `pickup_option_b`. Shared helper: `lib/pickup-options.ts`. Storefront checkout, admin POS, rounds admin UI, and submit-order validation all read from the round, not a hard-coded constant.
- Live databases need manual SQL `prisma/migration_008_round_pickup_options.sql` before deploying the round-configurable pickup feature.
- Public order detail now includes:
  - one-click copy of the LINE binding string
  - a direct button to the official LINE OA
  - saved contact phone + shipping address after successful public verification
- Public lookup no longer forces a second verification step before opening a matched order:
  - shared helper: `lib/public-order-access.ts`
  - `/api/lookup` now returns signed detail URLs for each matched order
  - direct `/order/[orderNumber]` visits still fall back to manual `purchaser_name + phone_last3` verification
  - lookup CTA copy now includes Chinese (`view detail / 查詢細節`) for lower-English users
- Public checkout and public identity now use a stored-profile model instead of nickname-conflict rejection:
  - public checkout shows distinct `暱稱 / 訂購人 / 收貨人` fields plus an opt-in `儲存資料，下次結帳自動帶入` checkbox
  - auto-fill only runs when both `暱稱 + 完整電話` are present, via `/api/checkout-profile/lookup`
  - "完整電話" is now enforced as `normalizePhoneDigits(phone).length >= 10` on both client and server, so partial input does not trigger lookup, does not reveal saved nicknames, and does not consume lookup rate limit
  - saved checkout data now lives in `saved_checkout_profiles`, while `users` became per-order contact snapshots with `purchaser_name` + `recipient_name`
  - public lookup, single-order unlock, payment report, cancel, and LINE binding now verify with `purchaser_name + phone_last3`
  - admin orders / shipments / supplier drill-down / CSV / print now surface all three names: `暱稱 / 訂購人 / 收貨人`
- Public checkout hero summary was simplified for lower-friction ordering:
  - storefront delivery copy now says `宅配到以下地址`
  - homepage summary pills now show live round shipping info (`本團運費 {n}元` or `本團運費待設定`), a separate `面交取貨免運` pill, and round-normalized pickup labels
- Storefront card polish follow-up:
  - product aggregate copy now reads as group demand (`已有 x被預訂，共有 y`)
  - storefront progress-bar labels use `庫存` / `已被預訂` wording while admin bars keep the previous copy
  - stock-limit state pill now says `已達庫存`
  - product image overlay text is vertically centered in the image panel
  - the round-status badge in `components/DeadlineBanner.tsx` now keeps `開放中` on one line
- Verified after redesign + subsequent checkout/order-detail follow-up:
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm run build`
  - focused `npx vitest run ...` coverage for submit-order, round pickup config, public lookup/order detail flows, stock-cap progress math, and public-order access token handling
- Verified after the performance remediation follow-up:
  - `npm test` (35 files / 162 tests)
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run build`
  - focused route/helper coverage for export preflight/cache headers, bounded shipment batch print, dashboard summary mapping, shipment print document rendering, and order thin-row mapping

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
3. User browses → adds to cart → enters `暱稱 / 訂購人 / 收貨人` + contact info + pickup option → optionally saves profile for next time → submits (idempotent via `submission_key`).
4. If both `暱稱 + 完整電話` are entered, the system may auto-fill previously saved checkout data for that exact pair.
5. System shows bank details + share CTA if any product under goal.
6. User transfers money, reports payment (`order_number + purchaser_name + phone_last3`).
7. Admin confirms (single/batch) → LINE + email notification. Status: `confirmed`.
8. Products arrive → admin sends arrival notification to relevant customers.
9. Admin marks shipped (待出貨, grouped by pickup method) → shipment notification. Status: `shipped`.
10. User checks status via `/lookup` (`purchaser_name + phone_last3`) and can open any matched order detail in that browser session without re-entering the same fields.
11. **LINE linking**: User pastes `ORD-YYYYMMDD-NNN 王小美 678` → webhook validates against `purchaser_name + phone_last3` and links `line_user_id`.
12. **POS**: Admin creates orders on behalf of customers, instant cash confirmation, with nickname autofill preferring saved checkout profiles.
13. **Admin cancel**: From any status, with reason + cancellation notification.

---

## Directory Layout

```
app/
  page.tsx                      # Storefront
  order/[orderNumber]/page.tsx  # Public order detail (server-renders when the order-scoped access cookie exists; direct access still gated by order_number + purchaser_name + phone_last3)
  lookup/page.tsx               # Order lookup (purchaser_name + phone_last3)
  admin/                        # Canonical admin route
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
    admin/session/route.ts      # Validate Supabase token once, set/clear signed admin session cookie
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
    orders/print-batch/route.ts # Batch shipment print payload (round-scoped, confirmed-only, capped)
    orders-by-product/route.ts  # Group by product → customer list
    notification-logs/route.ts
    checkout-profile/lookup/route.ts # Public autofill: nickname + full phone
    users/lookup/route.ts       # Admin-only POS autofill
    lookup/route.ts             # Public: purchaser_name + phone_last3
    public-order/access/route.ts # Public: signed order access handoff / manual unlock form
    line/webhook/route.ts       # LINE webhook (signature verify → order linking)
lib/                            # Pure TypeScript — NO React/Next imports
  db/prisma.ts                  # globalThis singleton PrismaClient
  db/users.ts, orders.ts, products.ts, rounds.ts, suppliers.ts, notification-logs.ts
  perf.ts                       # Opt-in slow-query logging helpers
  rate-limit.ts
  pickup-options.ts             # Round pickup option defaults + validation
  line/push.ts, webhook.ts, extract-order-number.ts, extract-order-binding.ts
  line/validate-order-code.ts, message-handler.ts
  notifications/email.ts, send.ts
  auth/signed-token.ts, auth/supabase-admin.ts, supabase-browser.ts
  admin/server.ts               # Server-only admin session + chrome loaders
  admin/dashboard.ts, csv-export.ts, order-view.ts, shipment-print.ts
  admin/paths.ts, notification-summary.ts, order-search.ts, shipment-status.ts
  utils.ts                      # cn(), formatting, share URLs, calcOrderTotal
components/
  ui/                           # shadcn/ui (editable copies — don't regenerate)
  StorefrontClient.tsx, PublicOrderPage.tsx, ProductCard.tsx, ProgressBar.tsx
  CartBar.tsx, SharePanel.tsx, DeadlineBanner.tsx, OrderStatusBadge.tsx
  PaymentReportForm.tsx, CancelOrderButton.tsx, ShippingFeeNote.tsx
  admin/AdminShell.tsx, AdminChromeState.tsx, OrderCard.tsx, POSForm.tsx, ProductAggregationTable.tsx
  admin/ProductForm.tsx, SupplierForm.tsx, ShipmentCard.tsx
hooks/use-toast.ts, use-admin-fetch.ts, use-admin-order-details.ts
types/index.ts
constants/index.ts              # Status enums, bank info keys
prisma/
  schema.prisma                 # 8 models
  migration.sql                 # Initial (tables, triggers, RLS, views)
  migration_002–011             # Incremental (line_user_id, notif context, single-open-round, line index, RLS hardening, remove access_code, round pickup labels, saved checkout profiles, public lookup indexes)
  seed.ts
```

---

## Database Schema (8 models)

```
Round               → id, name, is_open, deadline, shipping_fee, pickup_option_a, pickup_option_b, created_at
Supplier            → id, name, contact_name, phone, email, note, created_at, updated_at
Product             → id, round_id(FK), supplier_id(FK), name, price, unit, is_active, stock, goal_qty, image_url, created_at
User                → id, nickname(INDEX), purchaser_name, purchaser_name_lower, recipient_name, phone, phone_digits, phone_last3, address, email, created_at, updated_at
SavedCheckoutProfile → id, nickname(UNIQUE), purchaser_name, recipient_name, phone, address, email, created_at, updated_at
Order               → id, order_number(UNIQUE), user_id(FK), round_id(FK), total_amount, shipping_fee, status, payment_amount, payment_last5, payment_reported_at, confirmed_at, shipped_at, note, pickup_location, cancel_reason, submission_key(UNIQUE), line_user_id, created_at
OrderItem           → id, order_id(FK), product_id(FK), product_name, unit_price, quantity, subtotal
NotificationLog     → id, order_id(FK|null), round_id(FK|null), product_id(FK|null), channel, type, status, error_message, created_at
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
| 綁定訂單 | LINE linking via order_number + purchaser_name + phone_last3 |

### Key DB Behaviors

- **Order numbers**: Trigger-based `ORD-YYYYMMDD-NNN` with `pg_advisory_xact_lock`.
- **`submission_key`**: Client-generated UUID. Server deduplicates via unique constraint.
- **`product_progress` view**: Aggregates order_items by product (excluding cancelled).
- **Shipping fee**: `submit-order` snapshots `round.shipping_fee` on 宅配 orders. Never recalculate after creation.
- **Pickup options**: `pickup_option_a` / `pickup_option_b` live on `Round`. `pickup_location` must be empty string (宅配) or match that round’s configured labels.
- **Saved checkout profiles**: `saved_checkout_profiles` is the reusable autofill store keyed by `nickname`; `users` is now a per-order snapshot and is never reused across orders.
- **Admin auth**: Supabase verifies identity once at login; the app then uses a signed `tendy_admin_session` cookie for admin page loads and admin API calls.
- **Public access**: `/api/lookup` requires `purchaser_name + phone_last3` and returns signed order detail URLs. `/api/public-order/access` converts a valid token or manual identity submission into an order-scoped httpOnly cookie so `/order/[orderNumber]` can render server-first. No internal UUIDs on public routes.
- **Public lookup columns**: `users.purchaser_name_lower`, `users.phone_digits`, and `users.phone_last3` are computed/write-time normalized fields used by public identity lookups and should stay in sync with `purchaser_name` / `phone`.
- **LINE linking**: Per-order (not per-user). Webhook verifies all three fields. Idempotent. One order = one LINE account.
- **Single-open-round**: Partial unique index. `create()` atomically closes existing open rounds. `update()` catches `P2002`.
- **Order creation**: Two-phase — validate all products first, then decrement stock. Stock updates sort `product_id` first to reduce deadlock risk. `OrderValidationError` thrown inside `$transaction` triggers rollback.
- **Arrival notifications**: Target customers by product, count by logical purchaser identity (`purchaser_name + normalized phone`, with legacy `recipient_name` fallback), not by nickname or delivery endpoints.

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
9. **Public routes use `purchaser_name + phone_last3`** (+ `order_number` for single-order actions). No internal UUIDs.
10. **Pickup options are round-scoped.** Never validate or render pickup labels from a global constant.

### API Route Contracts

- Type with `NextRequest`/`NextResponse`. Return `{ error: string }` + correct HTTP status on failure.
- Validate request bodies before DB access.
- `submit-order`: round open → validate stock → calc shipping → decrement stock → insert (transaction). Public checkout may optionally save/update a reusable checkout profile, but only when `nickname + full phone` match.
- `submit-order`: validate `pickup_location` against the round’s configured pickup labels, not a static options array.
- `confirm-order`/`batch-confirm`: update status → notify → log. Notification failure does NOT rollback.
- `confirm-shipment`: status → `shipped` + `shipped_at` → notify → log.
- `notify-arrival`: `productId + roundId` → customers with that product in non-cancelled orders → notify.
- `cancel-order`: User mode (pending_payment, public auth) or admin mode (any status, with reason + notification). Restore stock except shipped.
- `quick-confirm`: POS shortcut, `orderId` → confirmed + auto-fill payment fields.
- `users/lookup`: **Admin-only**. Never expose to anonymous callers.
- `public-order/access`: Accept signed detail-token GET handoff or manual unlock POST, then set an order-scoped access cookie and redirect to `/order/[orderNumber]`.
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
| `ADMIN_SESSION_SECRET` | Required in production; signs admin session cookies |
| `PUBLIC_ORDER_ACCESS_SECRET` | Required in production; signs public order access tokens/cookies |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Required in production; shared rate-limit backend |
| `RATE_LIMIT_PREFIX` | Optional Redis key prefix for rate-limit buckets |
| `DATABASE_URL` | Supabase pooled connection (Prisma runtime) |
| `DIRECT_URL` | Supabase direct connection (migrations) |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Email sending |
| `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET` | LINE Messaging API |
| `NEXT_PUBLIC_BANK_NAME` / `NEXT_PUBLIC_BANK_ACCOUNT` / `NEXT_PUBLIC_BANK_HOLDER` | Bank info shown to users |
| `NEXT_PUBLIC_SITE_URL` | Base URL for share links |

---

## Operational Notes

### Admin auth dual-path (verifyAdminSession)
`lib/auth/supabase-admin.ts:130–141` has a deliberate Bearer-token fallback alongside the primary signed-cookie path. The Bearer path is used by staging tooling (`scripts/staging-smoke.mjs`, `scripts/staging-artifacts.mjs`) and by the initial admin session-establishment flow where the cookie has not yet been set. Do not remove it without updating those scripts.

### ADMIN_EMAILS cache
`isAllowedAdminEmail()` in `lib/auth/supabase-admin.ts` parses `process.env.ADMIN_EMAILS` once on first call and caches the result in a module-level `Set`. On Vercel's serverless model, the cache is per-process (cleared on each cold start). **Adding or removing admin email addresses requires a Vercel redeploy** to guarantee all warm instances pick up the change.

---

## Verification (run before presenting work)

```bash
npm run build        # full build (generates .next/types needed by tsc)
npx tsc --noEmit     # types (requires prior build)
npm run lint         # eslint
npx vitest run       # tests
npm run test:e2e     # browser coverage for admin CSV + shipment print flows
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

### [2026-03-25] Admin/public performance remediation changed auth and unlock flows
**Mistake:** Admin routes re-validated Supabase on every request, admin pages booted from a client hydration/auth waterfall, and public order detail depended on a client-side `sessionStorage` unlock handoff.
**Fix:** Admin now establishes a signed app-session cookie once and loads pages server-first. Public order detail now uses signed detail URLs plus order-scoped httpOnly cookies, so checkout/lookup can open `/order/[orderNumber]` server-first without a client unlock round-trip.
**Rule:** Avoid client-only auth/bootstrap on hot paths. If the server can establish durable access context once, prefer cookie-backed server rendering over repeated client round-trips.

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
