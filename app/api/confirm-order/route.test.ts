import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supabase-admin", () => ({
  authorizeAdminRequest: authMock,
}));

const ordersMock = vi.hoisted(() => ({
  confirmOrder: vi.fn(),
}));
vi.mock("@/lib/db/orders", () => ordersMock);

import { POST } from "./route";

const VALID_ORDER_ID = "11111111-1111-4111-8111-000000000001";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/confirm-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

const fakeOrder = {
  id: VALID_ORDER_ID,
  order_number: "ORD-20260324-001",
  status: "confirmed",
  order_items: [{ id: "oi1", product_name: "地瓜", quantity: 1 }],
};

// ── Tests ──────────────────────────────────────────────────────

describe("POST /api/confirm-order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      authorized: true,
      mode: "cookie",
      claims: null,
    });
  });

  it("returns 200 on success", async () => {
    ordersMock.confirmOrder.mockResolvedValue(fakeOrder);

    const res = await POST(makeRequest({ orderId: VALID_ORDER_ID }));
    expect(res.status).toBe(200);
  });

  it("returns 404 when order not found or wrong status", async () => {
    ordersMock.confirmOrder.mockResolvedValue(null);

    const res = await POST(makeRequest({ orderId: VALID_ORDER_ID }));
    expect(res.status).toBe(404);
  });

  it("returns 401 when not admin", async () => {
    authMock.mockResolvedValue({
      authorized: false,
      mode: "none",
      claims: null,
    });

    const res = await POST(makeRequest({ orderId: VALID_ORDER_ID }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing orderId", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed orderId", async () => {
    const res = await POST(makeRequest({ orderId: "not-a-uuid" }));
    expect(res.status).toBe(400);
    expect(ordersMock.confirmOrder).not.toHaveBeenCalled();
  });
});
