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

const VALID_ROUND_ID = "11111111-1111-4111-8111-111111111111";
const VALID_ORDER_ID_1 = "22222222-2222-4222-8222-222222222222";
const VALID_ORDER_ID_2 = "33333333-3333-4333-8333-333333333333";

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
      {
        id: VALID_ORDER_ID_2,
        order_number: "ORD-002",
        order_items: [],
        user: null,
      },
      {
        id: VALID_ORDER_ID_1,
        order_number: "ORD-001",
        order_items: [],
        user: null,
      },
    ]);

    const res = await POST(
      makeRequest({
        roundId: VALID_ROUND_ID,
        orderIds: [VALID_ORDER_ID_2, VALID_ORDER_ID_1, VALID_ORDER_ID_2],
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(ordersMock.getConfirmedShipmentPrintOrdersByIds).toHaveBeenCalledWith(
      VALID_ROUND_ID,
      [VALID_ORDER_ID_2, VALID_ORDER_ID_1],
    );
    expect(data.orders.map((order: { id: string }) => order.id)).toEqual([
      VALID_ORDER_ID_2,
      VALID_ORDER_ID_1,
    ]);
  });

  it("returns 404 when any requested order is missing", async () => {
    ordersMock.getConfirmedShipmentPrintOrdersByIds.mockResolvedValue([
      {
        id: VALID_ORDER_ID_1,
        order_number: "ORD-001",
        order_items: [],
        user: null,
      },
    ]);

    const res = await POST(
      makeRequest({
        roundId: VALID_ROUND_ID,
        orderIds: [VALID_ORDER_ID_1, VALID_ORDER_ID_2],
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 when not admin", async () => {
    authMock.mockResolvedValue(false);

    const res = await POST(
      makeRequest({ roundId: VALID_ROUND_ID, orderIds: [VALID_ORDER_ID_1] }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when roundId is missing", async () => {
    const res = await POST(makeRequest({ orderIds: ["o1"] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the request exceeds the print cap", async () => {
    const orderIds = Array.from({ length: 51 }, (_, index) =>
      `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    );

    const res = await POST(
      makeRequest({ roundId: VALID_ROUND_ID, orderIds }),
    );

    expect(res.status).toBe(400);
    expect(
      ordersMock.getConfirmedShipmentPrintOrdersByIds,
    ).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid roundId UUID", async () => {
    const res = await POST(
      makeRequest({ roundId: "not-a-uuid", orderIds: [VALID_ORDER_ID_1] }),
    );

    expect(res.status).toBe(400);
    expect(ordersMock.getConfirmedShipmentPrintOrdersByIds).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid orderId UUID", async () => {
    const res = await POST(
      makeRequest({ roundId: VALID_ROUND_ID, orderIds: ["not-a-uuid"] }),
    );

    expect(res.status).toBe(400);
    expect(ordersMock.getConfirmedShipmentPrintOrdersByIds).not.toHaveBeenCalled();
  });
});
