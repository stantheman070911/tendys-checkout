import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supabase-admin", () => ({
  authorizeAdminRequest: authMock,
}));

const ordersMock = vi.hoisted(() => ({
  confirmShipment: vi.fn(),
  batchConfirmShipment: vi.fn(),
}));
vi.mock("@/lib/db/orders", () => ordersMock);

import { POST } from "./route";

const UUID1 = "11111111-1111-4111-8111-000000000001";
const UUID2 = "11111111-1111-4111-8111-000000000002";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/confirm-shipment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

const fakeOrder = {
  id: UUID1,
  order_number: "ORD-001",
  status: "shipped",
  order_items: [{ id: "oi1", product_name: "地瓜", quantity: 1 }],
};

// ── Tests ──────────────────────────────────────────────────────

describe("POST /api/confirm-shipment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      authorized: true,
      mode: "cookie",
      claims: null,
    });
  });

  it("single: valid → 200", async () => {
    ordersMock.confirmShipment.mockResolvedValue(fakeOrder);

    const res = await POST(makeRequest({ orderId: UUID1 }));
    expect(res.status).toBe(200);
  });

  it("single: not found → 404", async () => {
    ordersMock.confirmShipment.mockResolvedValue(null);

    const res = await POST(makeRequest({ orderId: UUID1 }));
    expect(res.status).toBe(404);
  });

  it("batch: mixed → partial success with skipped", async () => {
    ordersMock.batchConfirmShipment.mockResolvedValue([fakeOrder]);

    const res = await POST(makeRequest({ orderIds: [UUID1, UUID2] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.shipped).toBe(1);
    expect(data.skipped).toEqual([UUID2]);
  });

  it("batch: only returns newly shipped orders", async () => {
    ordersMock.batchConfirmShipment.mockResolvedValue([fakeOrder]);

    const res = await POST(makeRequest({ orderIds: [UUID1, UUID2] }));
    const data = await res.json();
    expect(data.shipped).toBe(1);
    expect(data.skipped).toEqual([UUID2]);
  });

  it("returns 401 when not admin", async () => {
    authMock.mockResolvedValue({
      authorized: false,
      mode: "none",
      claims: null,
    });

    const res = await POST(makeRequest({ orderId: UUID1 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for malformed orderId", async () => {
    const res = await POST(makeRequest({ orderId: "not-a-uuid" }));
    expect(res.status).toBe(400);
    expect(ordersMock.confirmShipment).not.toHaveBeenCalled();
  });

  it("returns 400 when orderIds contains a malformed UUID", async () => {
    const res = await POST(makeRequest({ orderIds: [UUID1, "not-a-uuid"] }));
    expect(res.status).toBe(400);
    expect(ordersMock.batchConfirmShipment).not.toHaveBeenCalled();
  });
});
