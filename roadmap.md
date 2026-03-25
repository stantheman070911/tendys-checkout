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
  - Replaced the post-checkout verification-form flash with a loading state while stored order access is being auto-consumed
  - This later evolved into the current `purchaser_name + phone_last3` public auth rule; the core UX goal stayed the same in `components/PublicOrderPage.tsx`
- [x] **7.11** Configurable pickup points per round
  - Added `pickup_option_a` + `pickup_option_b` to `Round` in Prisma, shared types, seed data, and Supabase SQL
  - Added manual migration file `prisma/migration_008_round_pickup_options.sql` for live databases
  - Updated admin round management to edit pickup labels, and updated storefront checkout + admin POS to read the active round’s labels instead of a hard-coded constant
  - Updated order creation validation so `pickup_location` must match the round’s configured pickup labels
- [x] **7.12** Public order detail polish
  - Added one-click LINE binding copy and a direct official LINE OA button on the public order detail page
  - Extended `/api/lookup/order` to return saved contact phone + shipping address after successful public verification, and surfaced both on the unlocked order detail view
- [x] **7.13** Stock-cap progress bar clarification
  - Added shared progress-bar math helper in `lib/progress-bar.ts`
  - Finite-stock products now use stock ceiling as the bar length and render `成團目標` as a marker instead of filling the whole bar at goal hit
  - Raised storefront `餘量` badge size/contrast for urgency and updated admin products/suppliers to share the same stock-cap logic
- [x] **7.14** Lookup single-verification flow
  - Added shared public-order session helper in `lib/public-order-access.ts`
  - A verified `/lookup` search now caches access for all matched orders in the current browser session, so opening a result no longer asks for the same identity twice
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

### Checkpoint 7 (Final)

```bash
npm run build        # must pass
npx tsc --noEmit     # must pass (requires prior build)
npm run lint         # must pass
npx vitest run       # must pass
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
- [ ] **Dependency remediation** — `npm audit` issues in dedicated pass
- [ ] **Visual QA pass** — Device-by-device screenshot / browser review for the new luxury theme on low-end mobile and Safari

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
