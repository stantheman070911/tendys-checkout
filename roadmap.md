# roadmap.md

> **READ THIS FILE AT THE START OF EVERY SESSION.**
> Single source of truth for what is done and what is next.
> After reading, read `claude.md` and `whatwearebuilding.md` for full context.

---

## How to Use This File

1. **Find current phase** — first `[ ]` or `[~]` checkbox.
2. **Read that section** — understand what needs to be built.
3. **Build only that phase** — do not skip ahead.
4. **Update checkboxes** as you go. Commit this file with code changes.
5. **Run checkpoint verification** before moving to next phase.

`[x]` Done | `[~]` In progress | `[ ]` Not started

---

## Phase Summary

| Phase | Status | Description |
|-------|--------|-------------|
| 0 | COMPLETE | Project scaffolding (Next.js, Tailwind, shadcn/ui, directory structure) |
| 1 | COMPLETE | Database layer (Prisma schema, migration SQL, RLS, triggers, views, types) |
| 2 | COMPLETE | Library layer (pure TS business logic in `lib/`) |
| 3 | COMPLETE | API routes (19 routes, validation, auth, error handling) |
| 3.5 | COMPLETE | LINE push migration (webhook, order linking, 1-on-1 push) |
| 4 | COMPLETE | User pages (storefront, order detail, lookup, mobile-first) |
| 5 | COMPLETE | Admin core (login, dashboard, orders, products, rounds, POS) |
| 6 | COMPLETE | Shipments & suppliers (待出貨, 供應商管理, ShipmentCard, SupplierForm) |
| 7 | ACTIVE | Integration testing + polish |

---

## Phase 7: Integration Testing + Polish

> **Goal:** End-to-end flow works. Edge cases handled. Ready for first real group-buy round.

### Tasks

- [ ] **7.1** Full flow smoke test (manual, against real Supabase):
  - Create supplier → round (with shipping fee + pickup point A/B labels) → products (linked to supplier, with goals)
  - Place test orders: 宅配 (verify shipping added), 面交 (verify no shipping)
  - Verify progress bars update
  - Report payments via `order_number + purchaser_name + phone_last3` → admin confirm → verify notifications
  - Bind LINE with `order_number + purchaser_name + phone_last3` → verify push routing
  - Admin 通知到貨 → verify customers notified
  - Admin confirm shipment (single + batch) → verify notifications
  - Cancel order → verify stock restored
  - Lookup by `purchaser_name + phone_last3` → verify access works, no cross-order leaks, and unlocked detail shows expected address/phone
  - Export CSV → verify shipping fee column + Chinese encoding
  - Close round → verify 已截單
- [x] **7.2** Edge case tests (99 tests / 21 files)
- [x] **7.3** Mobile polish (ShippingFeeNote contrast, SharePanel clipboard handling)
- [x] **7.4** Error + loading states (lookup errors, CSV loading, product toggle, POS validation, clipboard fallback)
- [x] **7.5** Final cleanup (Prettier, no console.log/debugger, .gitignore, checkpoint order)
- [x] **7.6** Seed data rewrite (deterministic, 2 suppliers, 1 round, 5 products, 3 users)
- [x] **7.7** Public + admin luxury redesign
  - Added unified editorial-natural visual system in `app/globals.css`
  - Restyled public storefront, checkout, lookup, order detail, share flow
  - Restyled admin shell, dashboard, orders, shipments, products, rounds, suppliers, POS, dialogs
  - Kept all business logic and route contracts unchanged
- [x] **7.8** Typography + readability follow-up
  - Loaded `Noto Sans TC` + `Noto Serif TC` in `app/layout.tsx`
  - Added local package dependencies: `@fontsource/noto-sans-tc`, `@fontsource/noto-serif-tc`
  - Raised CartBar secondary text contrast for accessibility
- [x] **7.9** Submit-order hardening
  - Moved public/admin nickname resolution and user persistence into one transactional checkout helper in `lib/db/orders.ts`
  - Preserved `submission_key` dedup while preventing failed order creation from leaving partial user rows behind
  - Added explicit `/api/submit-order` handling for stale `orders.access_code` schema drift, returning `503` with migration guidance instead of opaque `500`
  - Added focused route + DB tests for dedup, saved-profile phone mismatches, concurrent nickname reuse, and schema-drift detection
- [x] **7.10** Public order redirect polish
  - Replaced the post-checkout/client-side unlock handoff with signed public access links + order-scoped cookies
  - `/order/[orderNumber]` now renders server-first after checkout or lookup access, while direct visits still fall back to manual `purchaser_name + phone_last3` verification
- [x] **7.11** Configurable pickup points per round
  - Added `pickup_option_a` + `pickup_option_b` to `Round` in Prisma, shared types, seed data, and Supabase SQL
  - Added manual migration file `prisma/migration_008_round_pickup_options.sql` for live databases
  - Updated admin round management to edit pickup labels, and updated storefront checkout + admin POS to read the active round’s labels instead of a hard-coded constant
  - Updated order creation validation so `pickup_location` must match the round’s configured pickup labels
- [x] **7.12** Public order detail polish
  - Added one-click LINE binding copy and a direct official LINE OA button on the public order detail page
  - Unlocked order detail now renders saved contact phone + shipping address directly on the server after access verification
- [x] **7.13** Stock-cap progress bar clarification
  - Added shared progress-bar math helper in `lib/progress-bar.ts`
  - Finite-stock products now use stock ceiling as the bar length and render `成團目標` as a marker instead of filling the whole bar at goal hit
  - Raised storefront `餘量` badge size/contrast for urgency and updated admin products/suppliers to share the same stock-cap logic
- [x] **7.14** Lookup single-verification flow
  - Added signed public-order access helpers in `lib/public-order-access.ts`
  - `/api/lookup` now returns signed detail URLs so opening a matched result no longer requires a second identity round-trip
  - Direct `/order/[orderNumber]` visits still fall back to manual verification, and lookup CTA/copy was localized with Chinese support (`查詢細節`)
- [x] **7.15** Public checkout + storefront copy clarification
  - Storefront delivery wording now says `宅配到以下地址`
  - Homepage hero pills now show the live round shipping fee (`本團運費 {n}元` or `本團運費待設定`), a separate `面交取貨免運` pill, and normalized round pickup labels
- [x] **7.16** Storefront product-card wording + layout polish
  - Public product cards now describe aggregate demand as `已有 x被預訂，共有 y`, with unlimited-stock fallback `已被預訂 x`
  - Storefront progress-bar copy now uses `庫存` / `已被預訂`, and the stock-limit pill is shortened to `已達庫存`
  - Product image overlay text is vertically centered, and the round-status badge keeps `開放中` on one line
- [x] **7.17** Public saved-profile checkout + purchaser identity split
  - Added `users.purchaser_name`, removed global uniqueness from `users.nickname`, and introduced `saved_checkout_profiles` for reusable checkout autofill
  - Public checkout now shows `暱稱 / 訂購人 / 收貨人` with opt-in `儲存資料，下次結帳自動帶入`, and autofill only runs when `暱稱 + 完整電話` both exist
  - Public lookup, order unlock, payment report, cancel, and LINE binding now verify with `purchaser_name + phone_last3`
  - Admin orders / shipments / supplier drill-down / CSV / print now show all three names, and admin search now covers `暱稱 / 訂購人 / 收貨人 / 電話 / 訂單號`
- [x] **7.18** Saved-profile privacy + logical customer dedupe follow-up
  - Added a shared public checkout autofill threshold (`normalizePhoneDigits(phone).length >= 10`) and enforced it on both storefront client and `/api/checkout-profile/lookup`
  - Incomplete phone input now short-circuits before rate limiting or DB lookup, preventing saved-profile nickname disclosure while a user is still typing
  - Arrival notification customer counts now dedupe by logical purchaser identity (`purchaser_name + normalized phone`, with `recipient_name` fallback) instead of including nickname
  - Added focused route and DB tests for incomplete-phone autofill requests, cross-nickname same-customer dedupe, and legacy purchaser-name fallback
- [x] **7.19** Admin mutation refresh follow-up
  - Replaced the remaining `onRefresh()`-driven admin order/shipment mutation flows with parent-owned optimistic state updates
  - Removed the old full-list background revalidation pattern in favor of paginated server refresh only when authoritative sync is still needed
  - Added shared admin order-state helpers and focused Vitest coverage for replacement, batch status transitions, skipped-id shipment removal, and pending badge math
  - Verified after follow-up review fixes with `npm run build`, `npx tsc --noEmit`, `npm run lint`, and `npx vitest run` (29 files / 145 tests)
- [x] **7.20** Full-stack performance remediation
  - Admin auth now establishes a signed app session cookie once via `/api/admin/session`, removing repeated Supabase validation from the hot path
  - Admin dashboard, orders, shipments, products, rounds, and suppliers now render server-first; initial round chrome and badge counts load on the server instead of a client hydration waterfall
  - Admin orders and shipments now use server-side pagination + URL state, and the dashboard uses backend aggregation helpers instead of downloading full round datasets into the browser
  - Public lookup/order access now uses normalized indexed identity columns plus signed access tokens/cookies; `/api/lookup/order` and the old `sessionStorage` unlock path were removed
  - Arrival notifications now dispatch in background with bounded concurrency, CSV export streams in batches, checkout stock updates acquire product locks in deterministic order, and storefront product cards use optimized `next/image`
  - Added `prisma/migration_011_public_lookup_indexes.sql` for live databases and opt-in query timing logs around the remaining `product_progress` / under-goal checks
- [x] **7.21** Performance follow-up hardening + CTO sign-off
  - Admin orders and shipments now consume explicit thin row view-models, while expanded detail loads lazily from `/api/orders/[id]`
  - Admin dashboard now uses one server summary contract for status counts, revenue, product demand rows, and aggregated notification status instead of rebuilding those views in the browser
  - CSV export now uses `HEAD` preflight + persistent hidden iframe download, and `/api/export-csv` marks both success and error responses with `Cache-Control: private, no-store`
  - Shipment batch printing now uses `/api/orders/print-batch`, scoped to `roundId`, restricted to `confirmed` shipment rows, deduped, and capped to 50 orders per request
  - After review, authoritative `router.refresh()` was restored for order/shipment mutation flows so totals and pagination metadata stay correct while the client chrome badge still updates immediately
  - Verified on the final sign-off tree with `npm test` (35 files / 162 tests), `npm run lint`, `npx tsc --noEmit`, and `npm run build`

### Checkpoint 7 (Final)

```bash
npm run build        # must pass
npx tsc --noEmit     # must pass (requires prior build)
npm run lint         # must pass
npx vitest run       # must pass
npm run test:e2e     # browser coverage for CSV preflight/download + shipment batch print
```

**Verify:**
- [ ] Full user flow end-to-end (including shipping fee)
- [ ] Full admin flow end-to-end (confirm → arrival notify → ship)
- [ ] Supplier management works
- [ ] All 4 notification types send correctly
- [ ] No console errors
- [ ] Mobile-friendly
- [ ] CSV correct
- [ ] Customer-by-product view accurate

**Done when:** System ready for first real group-buy round with real users.

---

## Deferred Backlog

- [ ] **Historical analytics gap** — Older `product_arrival` logs without context columns cannot be back-attributed
- [ ] **LINE ambiguity handling** — Reject or disambiguate messages with multiple order numbers (currently first-match-wins)
- [ ] **Integration coverage** — Route-to-notification integration test
- [ ] **Admin client-flow integration coverage** — Add browser/component coverage for CSV preflight/download and shipment batch print flows
- [ ] **Dependency remediation** — `npm audit` issues in dedicated pass
- [ ] **Visual QA pass** — Device-by-device screenshot / browser review for the new luxury theme on low-end mobile and Safari
- [ ] **True DB-side thin rows** — Replace per-order `order_items` list hydration with SQL/precomputed preview data for the admin list hot path

---

## Session Start Checklist

```
1. Read roadmap.md — find current phase
2. Read claude.md — rules, pitfalls, conventions
3. Read whatwearebuilding.md — product spec
4. Find first [ ] or [~] — start there
5. Work on ONLY that phase
6. Update checkboxes as you go
7. Run checkpoint verification before next phase
8. Commit roadmap.md with code changes
```
