# Audit Result

Generated: 2026-03-26 (Asia/Taipei)

## Decision

No sign-off.

The code-side remediation is materially real: local gates are clean, the UUID/validation fixes are in place, the staging tooling now targets `STAGING_BASE_URL` explicitly, and the artifact workflow refuses cross-environment evidence. The remaining blocker is still operational proof, but it has narrowed: the preview deployment is now reachable with the supplied Vercel bypass secret, and the smoke run proceeds into the app before failing on preview-side configuration during `submit-order`.

## Current Verification

Verification below was rerun on 2026-03-26 from this workspace and is based on actual command output.

### Local Gates

- `npm test`
  Result: passed at `42` files / `193` tests.

- `npm run lint`
  Result: passed.
  Note: Playwright output now writes to `.playwright-artifacts/test-results`, so lint no longer depends on a tracked `test-results/.gitkeep`.

- `npx tsc --noEmit`
  Result: passed.

- `npm run build`
  Result: passed.

- `npm run test:e2e`
  Result: passed with `2` Playwright tests.

- `npm audit --json`
  Result: passed with `0` vulnerabilities.

### Staging Tooling Corrections

These operational defects are now fixed in code:

- `scripts/staging-smoke.mjs`
  Now targets `STAGING_BASE_URL` only, writes run-scoped `artifacts/staging-smoke-<runId>.log` and `artifacts/staging-smoke-<runId>.json`, and fails closed when Vercel Deployment Protection blocks the preview.

- `scripts/staging-artifacts.mjs`
  Now targets `STAGING_BASE_URL` only, requires `--run-id=<runId>` or `--summary-path=<path>`, requires a successful smoke summary, and refuses to run when the smoke `baseUrl` does not match the current `STAGING_BASE_URL`.

- `package.json` and `docs/staging-smoke-runbook.md`
  Now use `node --env-file=.env.local ...` through `npm run staging:smoke` and `npm run staging:artifacts`, so the documented commands are executable as written.

- `playwright.config.ts` and `.gitignore`
  Now isolate Playwright output under `.playwright-artifacts/`, removing the prior `test-results/.gitkeep` workflow defect.

## Real Preview Validation

### Preview Smoke Attempt

Status: still blocked, but now at app configuration rather than preview access

Execution:

- Base URL: `https://tendys-checkout-48npf1b5w-letstanleycook911-4248s-projects.vercel.app/`
- Command: `STAGING_VERCEL_BYPASS_SECRET=... npm run staging:smoke`
- Run ID: `20260326110505`
- Log artifact: `artifacts/staging-smoke-20260326110505.log`
- Summary artifact: `artifacts/staging-smoke-20260326110505.json`

Observed result:

- The preview bypass fix is real: the smoke successfully created a supplier, round, and product on the protected preview deployment.
- The next public step, `POST /api/submit-order`, returned `503 {\"error\":\"Ordering is temporarily unavailable\"}`.
- No staging artifact bundle was generated, because the smoke summary status is `failed`.

Recorded error:

`POST /api/submit-order failed (503): Ordering is temporarily unavailable`

### Follow-up Probes

Status: completed

Execution:

- Admin-side protected submit-order probe using the same preview round/product returned the same `503 Ordering is temporarily unavailable`.

What this means:

- The remaining blocker is not only the public rate-limit path.
- Inference from code: on the admin path, `app/api/submit-order/route.ts` skips public rate limiting but still calls `getPublicOrderAccessSecret()` before order creation. Because the preview admin probe still returned the same generic `503`, the preview deployment is very likely missing `PUBLIC_ORDER_ACCESS_SECRET`.
- Additional public-route configuration such as Upstash Redis still needs verification after `submit-order` succeeds, but the current concrete blocker is the public-order signing secret.

### Artifact Guardrail Check

Status: passed

Execution:

- Command: `npm run staging:artifacts -- --run-id=20260326110505`

Observed result:

- The artifact script refused to run because the smoke summary status is `failed`.
- This prevents the repo from generating fake "staging" evidence after a blocked preview run.

Recorded error:

`Smoke summary artifacts/staging-smoke-20260326110505.json has status failed. Run npm run staging:smoke successfully before capturing artifacts.`

## Invalid Historical Evidence

The earlier March 26 smoke/artifact capture against `https://tendys-checkout.vercel.app/` must not be treated as staging validation. That URL is production, not the preview deployment referenced by `STAGING_BASE_URL`. Any prior write-up that presented those production artifacts as staging proof has been superseded by this record.

## Remaining Blockers

### 1. Preview deployment configuration

Required next step:

1. Ensure the preview deployment has `PUBLIC_ORDER_ACCESS_SECRET` configured.
2. Keep using `STAGING_VERCEL_BYPASS_SECRET` or `VERCEL_AUTOMATION_BYPASS_SECRET` locally for the protected preview URL.
3. Re-run `npm run staging:smoke`.
4. Re-run `npm run staging:artifacts -- --run-id=<runId>`.

After `submit-order` succeeds, re-check the public rate-limited routes to confirm the preview also has the required Upstash Redis configuration.

### 2. Manual/provider proof after the preview smoke passes

Still required by `docs/staging-smoke-runbook.md`:

- real LINE binding with a human account
- delivered LINE push proof
- spreadsheet-app verification of the exported CSV
- the remaining browser/provider screenshots called out in the runbook

### 3. Dependency cleanup follow-up

Status: still open

I re-checked the current dependency landscape with `npm outdated`. The `picomatch` override is still acting as a tactical patch, because the direct dependency chains that resolve `anymatch` / `micromatch` / `readdirp` have not been eliminated on the current pinned major lines. Removing the override safely would require a broader dependency-upgrade pass, most notably around Tailwind and the watcher/test toolchain.

## Final Judgment

The repository is in better shape than the earlier sign-off attempt, and the tooling no longer fakes staging evidence. But the decisive operational proof is still absent: this workspace cannot reach the protected preview deployment without a bypass secret, and the required manual/provider artifacts have not been captured. CTO sign-off remains unjustified until that preview run is completed and the remaining proof is attached.
