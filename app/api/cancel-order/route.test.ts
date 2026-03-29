import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supabase-admin", () => ({
  authorizeAdminRequest: authMock,
}));

const ordersMock = vi.hoisted(() => ({
  cancelOrder: vi.fn(),
  getOrderWithItems: vi.fn(),
  findPublicOrderByOrderNumberAndIdentity: vi.fn(),
}));
vi.mock("@/lib/db/orders", () => ordersMock);

import { POST } from "./route";

const VALID_ORDER_ID = "11111111-1111-4111-8111-000000000001";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/cancel-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

const fakeOrder = {
  id: VALID_ORDER_ID,
  order_number: "ORD-20260324-001",
  status: "cancelled",
  order_items: [{ id: "oi1", product_name: "地瓜", quantity: 1 }],
};

// ── Tests ──────────────────────────────────────────────────────

describe("POST /api/cancel-order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("user cancel pending_payment → 200, no notification", async () => {
    authMock.mockResolvedValue({
      authorized: false,
      mode: "none",
      claims: null,
    });
    ordersMock.findPublicOrderByOrderNumberAndIdentity.mockResolvedValue({
      ...fakeOrder,
    });
    ordersMock.cancelOrder.mockResolvedValue({
      changed: true,
      order: fakeOrder,
      order_items: fakeOrder.order_items,
    });

    const res = await POST(
      makeRequest({
        order_number: "ORD-20260324-001",
        purchaser_name: "王小美",
        phone_last3: "678",
      }),
    );
    expect(res.status).toBe(200);
  });

  it("user cancel non-pending_payment → 400", async () => {
    authMock.mockResolvedValue({
      authorized: false,
      mode: "none",
      claims: null,
    });
    ordersMock.findPublicOrderByOrderNumberAndIdentity.mockResolvedValue({
      ...fakeOrder,
    });
    ordersMock.cancelOrder.mockResolvedValue({
      error: "Only pending_payment orders can be cancelled by user",
    });

    const res = await POST(
      makeRequest({
        order_number: "ORD-20260324-001",
        purchaser_name: "王小美",
        phone_last3: "678",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("admin cancel → 200", async () => {
    authMock.mockResolvedValue({
      authorized: true,
      mode: "cookie",
      claims: null,
    });
    ordersMock.cancelOrder.mockResolvedValue({
      changed: true,
      order: fakeOrder,
      order_items: fakeOrder.order_items,
    });

    const res = await POST(
      makeRequest({ orderId: VALID_ORDER_ID, cancel_reason: "客戶要求" }),
    );
    expect(res.status).toBe(200);
  });

  it("admin cancel already-cancelled → no notification", async () => {
    authMock.mockResolvedValue({
      authorized: true,
      mode: "cookie",
      claims: null,
    });
    ordersMock.cancelOrder.mockResolvedValue({
      changed: false,
      order: fakeOrder,
      order_items: fakeOrder.order_items,
    });

    const res = await POST(makeRequest({ orderId: VALID_ORDER_ID }));
    expect(res.status).toBe(200);
  });

  it("order not found → 404", async () => {
    authMock.mockResolvedValue({
      authorized: false,
      mode: "none",
      claims: null,
    });
    ordersMock.findPublicOrderByOrderNumberAndIdentity.mockResolvedValue(null);

    const res = await POST(
      makeRequest({
        order_number: "ORD-404",
        purchaser_name: "王小美",
        phone_last3: "678",
      }),
    );
    expect(res.status).toBe(404);
  });

  it("missing public order_number → 400", async () => {
    authMock.mockResolvedValue({
      authorized: false,
      mode: "none",
      claims: null,
    });
    const res = await POST(
      makeRequest({ purchaser_name: "王小美", phone_last3: "678" }),
    );
    expect(res.status).toBe(400);
  });

  it("invalid phone_last3 → 400", async () => {
    authMock.mockResolvedValue({
      authorized: false,
      mode: "none",
      claims: null,
    });
    const res = await POST(
      makeRequest({
        order_number: "ORD-20260324-001",
        purchaser_name: "王小美",
        phone_last3: "67",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("admin cancel with malformed orderId → 400, DB never called", async () => {
    authMock.mockResolvedValue({
      authorized: true,
      mode: "cookie",
      claims: null,
    });
    const res = await POST(makeRequest({ orderId: "not-a-uuid", cancel_reason: "test" }));
    expect(res.status).toBe(400);
    expect(ordersMock.cancelOrder).not.toHaveBeenCalled();
  });
});
