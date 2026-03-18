# CLAUDE.md

Read this entire file before writing or modifying any code. After reading this file, read `whatwearebuilding.md` for product spec, then read `roadmap.md` to find your current task.then read `prdandmock.tsx` to get the database schema and mock data. Do not start coding until you've read all three files.

**Actual versions (as installed):** Next.js 16.1.7, React 19.2.4, TypeScript 5.9, Tailwind CSS 3.4, Prisma 6.19, ESLint 9 (flat config).

---

## Project

Group-buy ordering system for fresh produce (生鮮團購訂購系統). Organizers share a link in LINE groups → users browse products, see crowdfunding-style progress bars, place orders, report bank transfers → admin confirms payments, manages shipments, coordinates with suppliers, and sends notifications.

| Key | Value |
|-----|-------|
| Framework | Next.js 16.1 (App Router, Turbopack), TypeScript strict |
| DB | PostgreSQL via Supabase, Prisma ORM |
| Styling | Tailwind CSS + shadcn/ui |
| Email | Resend |
| Notifications | LINE Notify Webhook |
| Auth | Supabase Auth (admin only, email/password) |
| Deploy | Vercel |

### Core Flow

1. Admin creates a round (開團), sets deadline + shipping fee, adds products with prices/stock/goal quantities.
2. Admin shares Vercel URL in LINE group.
3. User opens link → browses products (progress bars show goal status) → adds to cart (stock-limited, CartBar hints shipping fee) → enters nickname (auto-fills returning user data) → fills recipient info + pickup option → sees shipping fee if 宅配 → submits order (idempotent via `submission_key`).
4. System shows bank account details + share CTA if any product is under goal.
5. User transfers money, reports payment (amount + last 5 digits — with confirmation step before submit).
6. Admin reviews in dashboard → confirms single or batch → system sends LINE Notify + Resend email (logged to `notification_logs`). Status: `confirmed`.
7. Admin coordinates with suppliers → products arrive at 理貨中心 → admin sends arrival notification to relevant customers.
8. Admin goes to 待出貨 page (grouped by pickup method) → marks orders as shipped (single or batch) → system sends shipment notification via LINE Notify + Email. Status: `shipped`.
9. User checks status via `/lookup` (by nickname or order number) → can click into order detail.
10. **POS mode**: Admin can create orders on behalf of customers, do instant cash confirmation, and handle face-to-face pickup.
11. **Admin cancel**: Admin can cancel orders from any status (with reason + cancellation notification).

---

## Directory Layout

```
app/                          → Next.js pages and API routes only
  page.tsx                    # User storefront (products + cart + checkout)
  order/[id]/page.tsx         # Order confirmation + payment report + cancel + share
  lookup/page.tsx             # Order lookup + history
  admin/
    page.tsx                  # Admin login
    dashboard/page.tsx        # Stats + item aggregation + notification log
    orders/page.tsx           # Order list, filter, single/batch confirm, CSV export
    shipments/page.tsx        # 待出貨 management, single/batch ship confirm
    products/page.tsx         # Product CRUD, goal_qty, image_url, stock, supplier link
    rounds/page.tsx           # Round management (open/close, deadline, shipping fee)
    suppliers/page.tsx        # Supplier CRUD + product-arrival notifications
  api/
    submit-order/route.ts     # Create order (submission_key dedup, stock check, shipping fee calc)
    report-payment/route.ts   # User reports payment (pending_payment → pending_confirm)
    cancel-order/route.ts     # User cancels (pending_payment only) OR Admin cancels (any status, with reason)
    confirm-order/route.ts    # Admin confirms single order + notifications
    batch-confirm/route.ts    # Admin batch confirm
    confirm-shipment/route.ts # Admin marks order(s) as shipped + notifications
    quick-confirm/route.ts    # Admin POS: skip pending_confirm, go straight to confirmed (cash payment)
    notify-arrival/route.ts   # Admin sends product-arrival notification to relevant customers
    export-csv/route.ts       # CSV export of orders
    rounds/route.ts           # Round CRUD (includes shipping_fee)
    products/route.ts         # Product CRUD (includes supplier_id)
    suppliers/route.ts        # Supplier CRUD
    orders-by-product/route.ts # Group orders by product → customer list
lib/                          → Pure TypeScript business logic (NO React/Next imports)
  db/
    prisma.ts                 # globalThis singleton PrismaClient
    users.ts                  # Upsert by nickname, lookup
    orders.ts                 # Create (with submission_key), update status, query, group by product
    products.ts               # CRUD, stock decrement, progress aggregation
    rounds.ts                 # CRUD, open/close, shipping fee
    suppliers.ts              # CRUD, list with product counts
    notification-logs.ts      # Insert log entry, query by order
  notifications/
    line-notify.ts            # POST to LINE Notify webhook, never-throw
    email.ts                  # Resend client + templates (order confirm, shipment, arrival)
    send.ts                   # Orchestrator: send both channels, log results
  auth/
    supabase-admin.ts         # Supabase Auth helpers (admin login/session check)
  utils.ts                    # Order number helpers, date formatting, share URL builder
components/
  ui/                         # shadcn/ui generated components
  ProductCard.tsx
  ProgressBar.tsx
  SharePanel.tsx
  DeadlineBanner.tsx
  OrderStatusBadge.tsx
  CartBar.tsx
  OrderLookup.tsx
  ShippingFeeNote.tsx         # "宅配到以上地址運費 $XXX" display
types/
  index.ts                    # Shared TS interfaces
constants/
  index.ts                    # Status enums, pickup options, bank info keys
prisma/
  schema.prisma               # 7 models: Round, Product, User, Order, OrderItem, NotificationLog, Supplier
  seed.ts                     # Dev seed data
```

---

## Database Schema (7 models)

```
Round          → id, name, is_open, deadline, shipping_fee, created_at
Supplier       → id, name, contact_name, phone, email, note, created_at, updated_at
Product        → id, round_id(FK), supplier_id(FK), name, price, unit, is_active, stock, goal_qty, image_url, created_at
User           → id, nickname(UNIQUE), recipient_name, phone, address, email, created_at, updated_at
Order          → id, order_number(UNIQUE), user_id(FK), round_id(FK), total_amount, shipping_fee, status, payment_amount, payment_last5, payment_reported_at, confirmed_at, shipped_at, note, pickup_location, cancel_reason, submission_key(UNIQUE), created_at
OrderItem      → id, order_id(FK), product_id(FK), product_name, unit_price, quantity, subtotal
NotificationLog → id, order_id(FK|null), channel('line'|'email'), type('payment_confirmed'|'shipment'|'product_arrival'|'order_cancelled'), status('success'|'failed'), error_message, created_at
```

### Key Additions from v1

- **`rounds.shipping_fee`**: Integer, nullable. When set, 宅配 orders add this to total. 面交/取貨 orders do not.
- **`suppliers` table**: Linked to products via `products.supplier_id`. Used for 供應商管理 page and product-arrival notifications.
- **`orders.shipping_fee`**: Snapshot of the round's shipping fee at order time (so changing the round fee later doesn't affect existing orders). Null if pickup.
- **`orders.shipped_at`**: Timestamp written when admin confirms shipment.
- **`orders.cancel_reason`**: Text, nullable. Written when admin cancels an order (optional reason).
- **`notification_logs.type`**: Four values: `payment_confirmed`, `shipment`, `product_arrival`, `order_cancelled`.
- **`notification_logs.order_id`**: Now nullable — product arrival notifications aren't tied to a single order.

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

### Key DB Behaviors

- **Order number generation**: Trigger-based `ORD-YYYYMMDD-NNN` with `pg_advisory_xact_lock`.
- **`submission_key`**: UUID UNIQUE. Client generates before submit; duplicate inserts fail harmlessly.
- **`product_progress` view**: Aggregates `order_items` by product (excluding cancelled orders).
- **Auto `updated_at`**: Trigger on `users` and `suppliers` tables.
- **Shipping fee calculation**: `submit-order` route checks `pickup_location`: if null/empty (宅配), adds `round.shipping_fee` to total and snapshots it in `orders.shipping_fee`.

### RLS Policies (critical — get these right)

| Table | Anon (unauthenticated) | Authenticated (admin) |
|-------|------------------------|-----------------------|
| `rounds` | SELECT | ALL |
| `suppliers` | — | ALL |
| `products` | SELECT | ALL |
| `users` | SELECT, INSERT, UPDATE | ALL |
| `orders` | SELECT, INSERT | ALL |
| `orders` (update) | Only `pending_payment` → `pending_confirm` with payment fields filled | ALL |
| `order_items` | SELECT, INSERT | ALL |
| `notification_logs` | — | SELECT, INSERT |

---

## Critical Rules

### Boundaries (violating these causes real bugs)

1. **`lib/` is pure TS.** Zero React or Next.js imports. Ever.
2. **One PrismaClient.** Only `lib/db/prisma.ts` instantiates it (stored on `globalThis`). Never `new PrismaClient()` elsewhere.
3. **No `any`** without a `// any: <justification>` comment.
4. **No secrets in code.** Use `.env.local`. Bank account info uses `NEXT_PUBLIC_BANK_*` env vars.
5. **Stock checks are server-side.** Cart UI prevents over-adding, but `submit-order` must re-validate atomically. Client checks are UX only.
6. **`submission_key` is generated client-side** (once per checkout session). The API does `INSERT ... ON CONFLICT (submission_key) DO NOTHING`.
7. **Shipping fee is snapshotted on order creation.** The order stores `shipping_fee` at creation time. Never recalculate from the round after the fact.
8. **Product arrival notifications target customers by product**, not by order. Query: all users who ordered product X in non-cancelled orders for the current round.

### API Routes

- Type with `NextRequest` / `NextResponse`.
- Return `{ error: string }` + correct HTTP status on failure.
- Validate request bodies before touching the DB.
- `submit-order` must: check round open → validate stock → calc shipping → decrement stock → insert order + items in transaction.
- `confirm-order` and `batch-confirm`: update status → send notifications → log results. Notification failure does NOT rollback confirmation.
- `confirm-shipment`: update status to `shipped` + write `shipped_at` → send shipment notifications → log results.
- `notify-arrival`: takes `productId` + `roundId` → find all customers with that product in non-cancelled orders → send "已到達理貨中心" notification to each → log results.
- `cancel-order`: Two modes — user (only `pending_payment`, no auth) and admin (any status, requires auth, optional `cancel_reason`). Restores stock except for `shipped`. Sends cancellation notification (admin cancel only).
- `quick-confirm`: Admin POS shortcut — takes `orderId`, skips `pending_confirm`, sets status to `confirmed` + writes `confirmed_at` + auto-fills payment fields. For cash/in-person payments.

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
| 8 | **LINE Notify is a simple POST** | `POST https://notify-api.line.me/api/notify` with Bearer token and form-encoded message. Not the Messaging API. |
| 9 | **RLS + Prisma** | Anon operations use Supabase anon key client. Admin operations use service role key. Don't mix. |
| 10 | **`submission_key` must be UUID** | Use `crypto.randomUUID()`. Strings/timestamps will collide. |
| 11 | **Shipping fee snapshot** | Store `shipping_fee` on the order at creation time. If admin changes round fee later, existing orders are unaffected. |

---

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (client-side, RLS-gated) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role (server-side, bypasses RLS) |
| `DATABASE_URL` | Yes | Supabase pooled connection (Prisma runtime) |
| `DIRECT_URL` | Yes | Supabase direct connection (Prisma migrations) |
| `RESEND_API_KEY` | Yes | Email sending |
| `RESEND_FROM_EMAIL` | Yes | Sender address |
| `LINE_NOTIFY_TOKEN` | Yes | LINE Notify access token |
| `NEXT_PUBLIC_BANK_NAME` | Yes | Bank name shown to users |
| `NEXT_PUBLIC_BANK_ACCOUNT` | Yes | Bank account number |
| `NEXT_PUBLIC_BANK_HOLDER` | Yes | Account holder name |
| `NEXT_PUBLIC_SITE_URL` | Yes | Base URL for share links |

---

## Verification (run before presenting work)

```bash
npx tsc --noEmit        # types
npm run lint             # eslint
npm run build            # full build
npx vitest run           # tests (if relevant tests exist)
```

All must pass. If any fails due to your code, fix it before continuing.

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

_(none yet)_