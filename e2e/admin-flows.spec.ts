import { expect, test } from "@playwright/test";
import { ADMIN_BASE } from "../constants";
import { signToken } from "../lib/auth/signed-token";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_SESSION_SECRET = "playwright-admin-session-secret";

function createAdminSessionCookie() {
  return signToken(
    {
      email: ADMIN_EMAIL,
      sid: "playwright-admin-session",
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    },
    ADMIN_SESSION_SECRET,
  );
}

test.beforeEach(async ({ context, baseURL }) => {
  if (!baseURL) {
    throw new Error("baseURL is required for Playwright tests");
  }

  await context.addCookies([
    {
      name: "tendy_admin_session",
      value: createAdminSessionCookie(),
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
});

test("orders page performs CSV preflight before download", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) {
    throw new Error("baseURL is required for Playwright tests");
  }

  await page.route("**/api/export-csv?roundId=round-playwright", async (route) => {
    const request = route.request();
    if (request.method() === "HEAD") {
      await route.fulfill({
        status: 204,
        headers: {
          "Cache-Control": "private, no-store",
        },
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
      },
      body: "\uFEFF訂單編號\r\nORD-PLAYWRIGHT-001\r\n",
    });
  });

  const headRequest = page.waitForRequest(
    (request) =>
      request.method() === "HEAD" &&
      request.url() === `${baseURL}/api/export-csv?roundId=round-playwright`,
  );
  const downloadRequest = page.waitForRequest(
    (request) =>
      request.method() === "GET" &&
      request.url() === `${baseURL}/api/export-csv?roundId=round-playwright`,
  );

  await page.goto(`${ADMIN_BASE}/orders?roundId=round-playwright`);
  await page.getByRole("button", { name: "CSV" }).click();

  await headRequest;
  await downloadRequest;
  await expect(
    page.getByRole("button", { name: "已開始" }),
  ).toBeVisible();
});

test("shipments page requests batch print payload and opens a print window", async ({
  page,
}) => {
  let requestBody: unknown = null;

  await page.addInitScript(() => {
    (window as Window & { __lastPrintHtml?: string }).__lastPrintHtml = "";
    window.open = (() => {
      return {
        document: {
          write(html: string) {
            (
              window as Window & { __lastPrintHtml?: string }
            ).__lastPrintHtml = html;
          },
          close() {},
        },
      } as Window;
    }) as typeof window.open;
  });

  await page.route("**/api/orders/print-batch", async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        orders: [
          {
            id: "order-playwright-confirmed",
            order_number: "ORD-PLAYWRIGHT-PRINT",
            user_id: "user-1",
            round_id: "round-playwright",
            total_amount: 240,
            shipping_fee: null,
            status: "confirmed",
            payment_amount: 240,
            payment_last5: "67890",
            payment_reported_at: "2026-03-25T10:00:00.000Z",
            confirmed_at: "2026-03-25T10:30:00.000Z",
            shipped_at: null,
            note: null,
            pickup_location: "面交點 A",
            cancel_reason: null,
            submission_key: null,
            line_user_id: null,
            created_at: "2026-03-25T09:30:00.000Z",
            user: {
              id: "user-1",
              nickname: "面交客戶",
              purchaser_name: "陳大華",
              recipient_name: "陳大華",
              phone: "0922-000-111",
              address: null,
              email: null,
              created_at: "2026-03-25T09:30:00.000Z",
              updated_at: "2026-03-25T09:30:00.000Z",
            },
            order_items: [
              {
                id: "item-1",
                order_id: "order-playwright-confirmed",
                product_id: "product-playwright-1",
                product_name: "地瓜",
                unit_price: 120,
                quantity: 2,
                subtotal: 240,
              },
            ],
          },
        ],
      }),
    });
  });

  await page.goto(`${ADMIN_BASE}/shipments?roundId=round-playwright`);
  await page.getByRole("button", { name: "列印本頁" }).click();

  await expect
    .poll(() => requestBody)
    .toEqual({
      roundId: "round-playwright",
      orderIds: ["order-playwright-confirmed"],
    });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __lastPrintHtml?: string }).__lastPrintHtml ??
          "",
      ),
    )
    .toContain("ORD-PLAYWRIGHT-PRINT");
});
