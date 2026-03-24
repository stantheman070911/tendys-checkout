import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supabase-admin", () => ({
  verifyAdminSession: authMock,
}));

const ordersMock = vi.hoisted(() => ({
  cancelOrder: vi.fn(),
  getOrderWithItems: vi.fn(),
  findOrderByNumberAndAccessCode: vi.fn(),
}));
vi.mock("@/lib/db/orders", () => ordersMock);

const notifyMock = vi.hoisted(() => ({
  sendOrderCancelledNotifications: vi.fn(),
}));
vi.mock("@/lib/notifications/send", () => notifyMock);

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/cancel-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

const fakeOrder = {
  id: "o1",
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
    authMock.mockResolvedValue(false);
    ordersMock.findOrderByNumberAndAccessCode.mockResolvedValue({
      ...fakeOrder,
    });
    ordersMock.cancelOrder.mockResolvedValue({
      changed: true,
      order: fakeOrder,
      order_items: fakeOrder.order_items,
    });

    const res = await POST(
      makeRequest({ order_number: "ORD-20260324-001", access_code: "ABCD1234EFGH" }),
    );
    expect(res.status).toBe(200);
    expect(notifyMock.sendOrderCancelledNotifications).not.toHaveBeenCalled();
  });

  it("user cancel non-pending_payment → 400", async () => {
    authMock.mockResolvedValue(false);
    ordersMock.findOrderByNumberAndAccessCode.mockResolvedValue({
      ...fakeOrder,
    });
    ordersMock.cancelOrder.mockResolvedValue({
      error: "Only pending_payment orders can be cancelled by user",
    });

    const res = await POST(
      makeRequest({ order_number: "ORD-20260324-001", access_code: "ABCD1234EFGH" }),
    );
    expect(res.status).toBe(400);
  });

  it("admin cancel → 200 + sends notification", async () => {
    authMock.mockResolvedValue(true);
    ordersMock.cancelOrder.mockResolvedValue({
      changed: true,
      order: fakeOrder,
      order_items: fakeOrder.order_items,
    });
    notifyMock.sendOrderCancelledNotifications.mockResolvedValue({});

    const res = await POST(
      makeRequest({ orderId: "o1", cancel_reason: "客戶要求" }),
    );
    expect(res.status).toBe(200);
    expect(notifyMock.sendOrderCancelledNotifications).toHaveBeenCalledWith(
      fakeOrder,
      fakeOrder.order_items,
      "客戶要求",
    );
  });

  it("admin cancel already-cancelled → no notification", async () => {
    authMock.mockResolvedValue(true);
    ordersMock.cancelOrder.mockResolvedValue({
      changed: false,
      order: fakeOrder,
      order_items: fakeOrder.order_items,
    });

    const res = await POST(makeRequest({ orderId: "o1" }));
    expect(res.status).toBe(200);
    expect(notifyMock.sendOrderCancelledNotifications).not.toHaveBeenCalled();
  });

  it("order not found → 404", async () => {
    authMock.mockResolvedValue(false);
    ordersMock.findOrderByNumberAndAccessCode.mockResolvedValue(null);

    const res = await POST(
      makeRequest({ order_number: "ORD-404", access_code: "ABCD1234EFGH" }),
    );
    expect(res.status).toBe(404);
  });

  it("missing public order_number → 400", async () => {
    authMock.mockResolvedValue(false);
    const res = await POST(makeRequest({ access_code: "ABCD1234EFGH" }));
    expect(res.status).toBe(400);
  });
});
