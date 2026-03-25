import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supabase-admin", () => ({
  verifyAdminSession: authMock,
}));

const ordersMock = vi.hoisted(() => ({
  getConfirmedShipmentPrintOrdersByIds: vi.fn(),
}));
vi.mock("@/lib/db/orders", () => ordersMock);

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/orders/print-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/orders/print-batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(true);
  });

  it("returns all requested orders in the requested order", async () => {
    ordersMock.getConfirmedShipmentPrintOrdersByIds.mockResolvedValue([
      { id: "o2", order_number: "ORD-002", order_items: [], user: null },
      { id: "o1", order_number: "ORD-001", order_items: [], user: null },
    ]);

    const res = await POST(
      makeRequest({ roundId: "r1", orderIds: ["o2", "o1", "o2"] }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(ordersMock.getConfirmedShipmentPrintOrdersByIds).toHaveBeenCalledWith(
      "r1",
      ["o2", "o1"],
    );
    expect(data.orders.map((order: { id: string }) => order.id)).toEqual([
      "o2",
      "o1",
    ]);
  });

  it("returns 404 when any requested order is missing", async () => {
    ordersMock.getConfirmedShipmentPrintOrdersByIds.mockResolvedValue([
      { id: "o1", order_number: "ORD-001", order_items: [], user: null },
    ]);

    const res = await POST(makeRequest({ roundId: "r1", orderIds: ["o1", "o2"] }));
    expect(res.status).toBe(404);
  });

  it("returns 401 when not admin", async () => {
    authMock.mockResolvedValue(false);

    const res = await POST(makeRequest({ roundId: "r1", orderIds: ["o1"] }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when roundId is missing", async () => {
    const res = await POST(makeRequest({ orderIds: ["o1"] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the request exceeds the print cap", async () => {
    const orderIds = Array.from({ length: 51 }, (_, index) => `o-${index}`);

    const res = await POST(makeRequest({ roundId: "r1", orderIds }));

    expect(res.status).toBe(400);
    expect(
      ordersMock.getConfirmedShipmentPrintOrdersByIds,
    ).not.toHaveBeenCalled();
  });
});
