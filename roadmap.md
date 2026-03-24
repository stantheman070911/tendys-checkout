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
  - Create supplier → round (with shipping fee) → products (linked to supplier, with goals)
  - Place test orders: 宅配 (verify shipping added), 面交 (verify no shipping)
  - Verify progress bars update
  - Report payments via `order_number + recipient_name + phone_last3` → admin confirm → verify notifications
  - Bind LINE with `order_number + recipient_name + phone_last3` → verify push routing
  - Admin 通知到貨 → verify customers notified
  - Admin confirm shipment (single + batch) → verify notifications
  - Cancel order → verify stock restored
  - Lookup by `recipient_name + phone_last3` → verify access works, no cross-order leaks
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
  - Added focused route + DB tests for dedup, nickname conflicts, concurrent nickname reuse, and schema-drift detection

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
