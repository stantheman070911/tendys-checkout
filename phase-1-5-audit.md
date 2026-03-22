# Phase 1–5 Audit

Audit date: 2026-03-22

## Verification Snapshot

- `npx prisma generate` — pass
- `npx tsc --noEmit` — pass
- `npm run lint` — pass
- `npm run build` — pass
- Automated tests — not present before this audit pass

## Architecture Summary

- Next.js 16 App Router application with public storefront, order detail, and lookup flows.
- Admin UI is client-rendered, authenticated with Supabase session tokens, and backed by header-authenticated API routes.
- `lib/db` contains Prisma-backed business logic, `lib/notifications` coordinates LINE + email delivery, and `lib/line` handles webhook-driven order linking.

## Phase Status

| Phase | Status | Notes |
| --- | --- | --- |
| Phase 1 | Validated with drift | Runtime schema, bootstrap SQL, and shared TS types had diverged around notification log context and skipped status. |
| Phase 2 | Validated | Library surface exists and matches the roadmap closely; batch mutation idempotency was hardened during this pass. |
| Phase 3 / 3.5 | Validated with hardening | API surface exists, but batch confirm / shipment previously allowed duplicate notifications for mixed-status inputs. |
| Phase 4 | Not fully validated | Pending-payment share CTA was missing and the LINE-linking guide copied a value the webhook parser would not accept. |
| Phase 5 | Not fully validated | Admin print path was broken by route obfuscation, pending-payment orders still rendered batch checkboxes, and dashboard product drill-down lacked order numbers / packing-list print. |

## Discrepancies Closed In This Pass

- Aligned notification log schema contracts across Prisma schema, bootstrap SQL, incremental SQL, and shared TS interfaces.
- Documented `ADMIN_EMAILS` in the repo docs and `.env.local.example`.
- Fixed the order detail LINE-linking guide to present a raw order number and made the message parser accept embedded order numbers.
- Restored the pending-payment share CTA on the order detail page.
- Restricted batch selection UI to `pending_confirm` orders only.
- Replaced the broken hardcoded `/admin/...` print path with the obfuscated admin base path helper.
- Changed batch confirm / shipment logic so notifications are sent only for rows transitioned in the current request.
- Added order numbers and per-product packing-list printing to the dashboard product-demand drill-down.
- Replaced silent admin data-load failures with explicit error surfaces and added an allowlist-backed admin session check for the admin shell.

## Remaining Intentional Gaps

- Phase 6 shipments and suppliers pages remain placeholders by design.
- Public lookup by nickname or order number remains unchanged because it is explicit product scope, despite its privacy tradeoff.
