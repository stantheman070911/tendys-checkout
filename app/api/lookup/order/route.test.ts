import { beforeEach, describe, expect, it, vi } from "vitest";

const ordersMock = vi.hoisted(() => ({
  findPublicOrderByOrderNumberAndIdentity: vi.fn(),
}));
vi.mock("@/lib/db/orders", () => ordersMock);

const productsMock = vi.hoisted(() => ({
  listActiveByRound: vi.fn(),
}));
vi.mock("@/lib/db/products", () => productsMock);

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/lookup/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/lookup/order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    productsMock.listActiveByRound.mockResolvedValue([]);
  });

  it("returns 200 with a matching public order", async () => {
    ordersMock.findPublicOrderByOrderNumberAndIdentity.mockResolvedValue({
      id: "o1",
      order_number: "ORD-001",
      round_id: "round-1",
      total_amount: 500,
      shipping_fee: null,
      status: "confirmed",
      payment_amount: null,
      payment_last5: null,
      payment_reported_at: null,
      confirmed_at: null,
      shipped_at: null,
      note: null,
      pickup_location: null,
      cancel_reason: null,
      line_user_id: null,
      created_at: "2026-03-24T00:00:00Z",
      user: {
        recipient_name: "王小美",
        phone: "0912-345-678",
        address: "台北市信義區測試路 1 號",
      },
      order_items: [
        {
          id: "oi1",
          product_id: "p1",
          product_name: "地瓜",
          unit_price: 100,
          quantity: 2,
          subtotal: 200,
        },
      ],
    });

    const res = await POST(
      makeRequest({
        order_number: "ORD-001",
        recipient_name: "王小美",
        phone_last3: "678",
      }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.order.order_number).toBe("ORD-001");
    expect(data.order.user.masked_phone).toContain("***");
    expect(data.order.user.phone).toBe("0912-345-678");
    expect(data.order.user.address).toBe("台北市信義區測試路 1 號");
  });

  it("returns 404 when the order cannot be resolved", async () => {
    ordersMock.findPublicOrderByOrderNumberAndIdentity.mockResolvedValue(null);

    const res = await POST(
      makeRequest({
        order_number: "ORD-404",
        recipient_name: "王小美",
        phone_last3: "678",
      }),
    );

    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid phone_last3", async () => {
    const res = await POST(
      makeRequest({
        order_number: "ORD-001",
        recipient_name: "王小美",
        phone_last3: "67",
      }),
    );

    expect(res.status).toBe(400);
  });
});
