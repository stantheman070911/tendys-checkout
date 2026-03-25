import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supabase-admin", () => ({
  verifyAdminSession: authMock,
}));

const ordersMock = vi.hoisted(() => ({
  quickConfirm: vi.fn(),
}));
vi.mock("@/lib/db/orders", () => ordersMock);

const notifyMock = vi.hoisted(() => ({
  sendPaymentConfirmedNotifications: vi.fn(),
}));
vi.mock("@/lib/notifications/send", () => notifyMock);
vi.mock("@/lib/notifications/fire-and-forget", () => ({
  fireAndForget: (task: () => Promise<unknown>) => {
    void task();
  },
}));

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/quick-confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

const fakeOrder = {
  id: "o1",
  status: "confirmed",
  order_items: [{ id: "oi1", product_name: "地瓜", quantity: 1 }],
};

// ── Tests ──────────────────────────────────────────────────────

describe("POST /api/quick-confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(true);
  });

  it("confirms pending_payment → 200 + notification", async () => {
    ordersMock.quickConfirm.mockResolvedValue(fakeOrder);
    notifyMock.sendPaymentConfirmedNotifications.mockResolvedValue({});

    const res = await POST(makeRequest({ orderId: "o1", paymentAmount: 500 }));
    expect(res.status).toBe(200);
    expect(notifyMock.sendPaymentConfirmedNotifications).toHaveBeenCalledWith(
      fakeOrder,
      fakeOrder.order_items,
    );
  });

  it("returns 404 when order not found or wrong status", async () => {
    ordersMock.quickConfirm.mockResolvedValue(null);

    const res = await POST(makeRequest({ orderId: "o1", paymentAmount: 500 }));
    expect(res.status).toBe(404);
  });

  it("returns 401 when not admin", async () => {
    authMock.mockResolvedValue(false);

    const res = await POST(makeRequest({ orderId: "o1", paymentAmount: 500 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid paymentAmount", async () => {
    const cases = [0, -1, 1.5, undefined];
    for (const paymentAmount of cases) {
      const res = await POST(makeRequest({ orderId: "o1", paymentAmount }));
      expect(res.status).toBe(400);
    }
  });
});
