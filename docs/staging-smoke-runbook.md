# Staging Smoke Runbook

This repo now has two verification layers:

1. `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `npm run test:e2e` for deterministic local coverage.
2. A staging smoke pass for the real cross-system path that unit and browser mocks cannot prove.

Do not mark the unchecked Phase 7 smoke items complete until this runbook has been executed against staging and artifacts have been captured.

## Required Env Vars

For the script:

- `STAGING_BASE_URL`
- `STAGING_ADMIN_BEARER_TOKEN`
- Optional overrides: `STAGING_SMOKE_PURCHASER_NAME`, `STAGING_SMOKE_PHONE`, `STAGING_SMOKE_EMAIL`, `STAGING_SMOKE_ADDRESS`

For the deployed app:

- `ADMIN_SESSION_SECRET`
- `PUBLIC_ORDER_ACCESS_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `RATE_LIMIT_PREFIX`

## Automated Pass

Run:

```bash
node scripts/staging-smoke.mjs
```

The script performs:

1. Create supplier.
2. Create round with shipping fee and pickup labels.
3. Create product linked to that round/supplier.
4. Submit one delivery order and one pickup order.
5. Lookup orders via `purchaser_name + phone_last3`.
6. Report payment for the delivery order.
7. Admin confirm the delivery order.
8. Queue an arrival notification.
9. Admin confirm shipment.
10. Cancel the pickup order.
11. Deactivate the test product and close the test round.

Capture:

- Script stdout
- Returned IDs / order numbers
- Any non-200 responses

## Manual Provider / Browser Checklist

Record timestamp, staging URL, commit SHA, and operator name.

- Verify admin login via Supabase and session-cookie creation.
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

- Terminal log from `scripts/staging-smoke.mjs`
- Screenshot or screen recording of `/lookup` result and signed-detail open
- Screenshot of CSV opened in spreadsheet software
- Screenshot/PDF of shipment print popup
- Email delivery proof or provider dashboard screenshot
- LINE push proof or provider dashboard screenshot

## Failure Handling

- If the automated script leaves a round open, manually close it in admin and note the round ID in the incident log.
- If a provider step fails but the app-side state change succeeded, capture the order number and provider request logs before retrying.
- If rate-limited routes return `503`, verify Upstash credentials and `RATE_LIMIT_PREFIX` on the staging deployment before rerunning.
