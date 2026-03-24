import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────

const ordersMock = vi.hoisted(() => ({
  reportPayment: vi.fn(),
  findOrderByNumberAndAccessCode: vi.fn(),
}));
vi.mock("@/lib/db/orders", () => ordersMock);

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/report-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

// ── Tests ──────────────────────────────────────────────────────

describe("POST /api/report-payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 on valid payment report", async () => {
    const fakeOrder = { id: "o1", status: "pending_confirm" };
    ordersMock.findOrderByNumberAndAccessCode.mockResolvedValue({
      id: "o1",
    });
    ordersMock.reportPayment.mockResolvedValue(fakeOrder);

    const res = await POST(
      makeRequest({
        order_number: "ORD-001",
        access_code: "ABCD1234EFGH",
        payment_amount: 500,
        payment_last5: "12345",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.order.id).toBe("o1");
  });

  it("returns 404 when order not found or wrong status", async () => {
    ordersMock.findOrderByNumberAndAccessCode.mockResolvedValue(null);

    const res = await POST(
      makeRequest({
        order_number: "ORD-404",
        access_code: "ABCD1234EFGH",
        payment_amount: 500,
        payment_last5: "12345",
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid payment_last5", async () => {
    ordersMock.findOrderByNumberAndAccessCode.mockResolvedValue({
      id: "o1",
    });
    const invalidValues = ["1234", "abcde", "123456"];
    for (const payment_last5 of invalidValues) {
      const res = await POST(
        makeRequest({
          order_number: "ORD-001",
          access_code: "ABCD1234EFGH",
          payment_amount: 500,
          payment_last5,
        }),
      );
      expect(res.status).toBe(400);
    }
  });

  it("returns 400 for invalid payment_amount", async () => {
    ordersMock.findOrderByNumberAndAccessCode.mockResolvedValue({
      id: "o1",
    });
    const invalidValues = [0, -1, 1.5];
    for (const payment_amount of invalidValues) {
      const res = await POST(
        makeRequest({
          order_number: "ORD-001",
          access_code: "ABCD1234EFGH",
          payment_amount,
          payment_last5: "12345",
        }),
      );
      expect(res.status).toBe(400);
    }
  });

  it("returns 400 for missing order_number", async () => {
    const res = await POST(
      makeRequest({
        access_code: "ABCD1234EFGH",
        payment_amount: 500,
        payment_last5: "12345",
      }),
    );
    expect(res.status).toBe(400);
  });
});
