import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    command: "npx next dev --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ADMIN_EMAILS: "admin@example.com",
      ADMIN_SESSION_SECRET: "playwright-admin-session-secret",
      NEXT_PUBLIC_BANK_ACCOUNT: "000-000000000000",
      NEXT_PUBLIC_BANK_HOLDER: "測試帳戶",
      NEXT_PUBLIC_BANK_NAME: "測試銀行",
      PLAYWRIGHT_ADMIN_FIXTURE: "1",
      PUBLIC_ORDER_ACCESS_SECRET: "playwright-public-order-secret",
    },
  },
});
