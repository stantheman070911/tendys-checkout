# Staging Smoke Runbook

This repo now has two verification layers:

1. `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `npm run test:e2e` for deterministic local coverage.
2. A staging smoke pass for the real cross-system path that unit and browser mocks cannot prove.

Do not mark the unchecked Phase 7 smoke items complete until this runbook has been executed against staging and artifacts have been captured.

## Required Env Vars

For the script:

- `STAGING_BASE_URL`
- `STAGING_ADMIN_BEARER_TOKEN`
- `STAGING_VERCEL_BYPASS_SECRET` or `VERCEL_AUTOMATION_BYPASS_SECRET` if the preview deployment is behind Vercel Deployment Protection
- Optional overrides: `STAGING_SMOKE_PURCHASER_NAME`, `STAGING_SMOKE_PHONE`, `STAGING_SMOKE_EMAIL`, `STAGING_SMOKE_ADDRESS`

For the deployed app:

- `ADMIN_SESSION_SECRET`
- `PUBLIC_ORDER_ACCESS_SECRET`
- `NOTIFICATION_WORKER_SECRET`
- `CRON_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `RATE_LIMIT_PREFIX`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `SENTRY_DSN`
- `OPS_ALERT_WEBHOOK_URL`

`CRON_SECRET` must be set on the Vercel project. Vercel Cron attaches `Authorization: Bearer <CRON_SECRET>` automatically when invoking `/api/internal/notification-worker`.

## Automated Pass

Run:

```bash
npm run staging:smoke
```

The script performs:

1. Run `npm run db:validate` against the target database configuration.
2. Exchange `STAGING_ADMIN_BEARER_TOKEN` for a real admin session cookie via `/api/admin/session`.
3. Create supplier.
4. Create round with shipping fee and pickup labels.
5. Create product linked to that round/supplier.
6. Submit one delivery order and one pickup order.
7. Lookup orders via `purchaser_name + phone_last3`.
8. Report payment for the delivery order.
9. Admin confirm the delivery order.
10. Queue an arrival notification.
11. Admin confirm shipment.
12. Cancel the pickup order.
13. Deactivate the test product and close the test round.

The script writes these run-scoped artifacts automatically:

- `artifacts/staging-smoke-<runId>.log`
- `artifacts/staging-smoke-<runId>.json`

Capture:

- Script stdout
- Returned IDs / order numbers (`artifacts/staging-smoke-<runId>.json`)
- Any non-200 responses

If the staging preview is protected by Vercel and the bypass secret is missing or invalid, the script now fails with a deployment-protection error instead of silently treating the auth page as a successful response.

## Artifact Capture

After the automated smoke log exists, run:

```bash
npm run staging:artifacts -- --run-id=<runId>
```

This captures the artifacts that can be generated automatically from the deployed app:

- `/lookup` result screenshot
- signed order-detail screenshot
- real CSV export file
- notification-log JSON for the smoke round
- shipment print HTML + screenshot using deployed `/api/orders/print-batch` data

These artifacts are written under `artifacts/staging-<runId>/`.

The artifact helper refuses to run unless:

- `STAGING_BASE_URL` matches the smoke summary `baseUrl`
- the smoke summary status is `passed`
- the operator passes an explicit `--run-id=<runId>` or `--summary-path=<path>`

This helper does not replace the remaining manual proof steps below. In particular, it does not complete real LINE binding with a human account, provider-dashboard verification, or spreadsheet-app visual verification of the CSV file.

## Manual Provider / Browser Checklist

Record timestamp, staging URL, commit SHA, and operator name.

- Verify admin login via Supabase and session-cookie creation.
- Verify the hidden admin path is `/backoffice` and `/admin` redirects to `/gtfo`.
- Open `/lookup`, search with the smoke purchaser identity, and confirm each result exposes a working signed detail link.
- Open the signed detail URL directly and confirm the browser lands on clean `/order/[orderNumber]`.
- Verify public order detail shows phone, address, and LINE binding UI correctly.
- Complete a LINE binding message using the smoke order number and verify webhook routing to the correct order.
- Confirm payment-confirmed notification arrives via Resend and LINE for the delivery order.
- Confirm arrival notification arrives via Resend and LINE for the purchased product.
- Confirm shipment notification arrives via Resend and LINE after shipment confirmation.
- Open admin orders and run CSV export; verify downloaded file encoding, headers, and shipping-fee columns in a spreadsheet app.
- Open admin shipments and run batch print; verify the popup document renders correct names, pickup/delivery sections, and item rows.
- Verify cancelling the pickup order restored stock and did not send shipment/payment notifications incorrectly.
- Close the round and confirm storefront checkout is blocked while lookup of existing orders still works.
- Check browser console for errors on storefront, lookup, orders admin, and shipments admin.

## Artifact Checklist

- Terminal log from `npm run staging:smoke`
- Smoke summary JSON from `artifacts/staging-smoke-<runId>.json`
- Screenshot or screen recording of `/lookup` result and signed-detail open
- Screenshot of CSV opened in spreadsheet software
- Screenshot/PDF of shipment print popup
- Email delivery proof or provider dashboard screenshot
- LINE push proof or provider dashboard screenshot

## Failure Handling

- If the automated script leaves a round open, manually close it in admin and note the round ID in the incident log.
- If a provider step fails but the app-side state change succeeded, capture the order number and provider request logs before retrying.
- If rate-limited routes return `503`, verify Upstash credentials and `RATE_LIMIT_PREFIX` on the staging deployment before rerunning.
