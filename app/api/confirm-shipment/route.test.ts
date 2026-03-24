import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supabase-admin", () => ({
  verifyAdminSession: authMock,
}));

const ordersMock = vi.hoisted(() => ({
  confirmShipment: vi.fn(),
  batchConfirmShipment: vi.fn(),
}));
vi.mock("@/lib/db/orders", () => ordersMock);

const notifyMock = vi.hoisted(() => ({
  sendShipmentNotifications: vi.fn(),
}));
vi.mock("@/lib/notifications/send", () => notifyMock);

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/confirm-shipment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

const fakeOrder = {
  id: "o1",
  order_number: "ORD-001",
  status: "shipped",
  order_items: [{ id: "oi1", product_name: "地瓜", quantity: 1 }],
};

// ── Tests ──────────────────────────────────────────────────────

describe("POST /api/confirm-shipment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(true);
    notifyMock.sendShipmentNotifications.mockResolvedValue({});
  });

  it("single: valid → 200 + notification", async () => {
    ordersMock.confirmShipment.mockResolvedValue(fakeOrder);

    const res = await POST(makeRequest({ orderId: "o1" }));
    expect(res.status).toBe(200);
    expect(notifyMock.sendShipmentNotifications).toHaveBeenCalledWith(
      fakeOrder,
      fakeOrder.order_items,
    );
  });

  it("single: not found → 404", async () => {
    ordersMock.confirmShipment.mockResolvedValue(null);

    const res = await POST(makeRequest({ orderId: "nonexistent" }));
    expect(res.status).toBe(404);
  });

  it("batch: mixed → partial success with skipped", async () => {
    ordersMock.batchConfirmShipment.mockResolvedValue([fakeOrder]);

    const res = await POST(makeRequest({ orderIds: ["o1", "o2"] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.shipped).toBe(1);
    expect(data.skipped).toEqual(["o2"]);
  });

  it("batch: notification only for newly shipped", async () => {
    ordersMock.batchConfirmShipment.mockResolvedValue([fakeOrder]);

    await POST(makeRequest({ orderIds: ["o1", "o2"] }));
    // Only called once for the one that actually shipped
    expect(notifyMock.sendShipmentNotifications).toHaveBeenCalledTimes(1);
    expect(notifyMock.sendShipmentNotifications).toHaveBeenCalledWith(
      fakeOrder,
      fakeOrder.order_items,
    );
  });

  it("returns 401 when not admin", async () => {
    authMock.mockResolvedValue(false);

    const res = await POST(makeRequest({ orderId: "o1" }));
    expect(res.status).toBe(401);
  });
});
