import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────

const ordersMock = vi.hoisted(() => ({
  findByNicknameOrOrderNumber: vi.fn(),
}));
vi.mock("@/lib/db/orders", () => ordersMock);

import { GET } from "./route";

function makeRequest(q?: string) {
  const params = q !== undefined ? `?q=${encodeURIComponent(q)}` : "";
  const url = new URL(`http://localhost/api/lookup${params}`);
  return {
    nextUrl: url,
  } as unknown as import("next/server").NextRequest;
}

// ── Tests ──────────────────────────────────────────────────────

describe("GET /api/lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with matching orders (PII stripped)", async () => {
    const fakeOrders = [
      {
        id: "o1",
        order_number: "ORD-001",
        status: "confirmed",
        total_amount: 500,
        shipping_fee: null,
        created_at: "2026-03-24T00:00:00Z",
        order_items: [
          { id: "oi1", product_name: "地瓜", quantity: 2, subtotal: 200 },
        ],
        user: {
          nickname: "TestUser",
          recipient_name: "王小明",
          phone: "0912345678",
          address: "台北市",
          email: "test@test.com",
        },
      },
    ];
    ordersMock.findByNicknameOrOrderNumber.mockResolvedValue(fakeOrders);

    const res = await GET(makeRequest("TestUser"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.orders).toHaveLength(1);
    expect(data.orders[0].order_number).toBe("ORD-001");
    expect(data.orders[0].user).toEqual({ nickname: "TestUser" });
    // PII must NOT be in response
    expect(data.orders[0].user.phone).toBeUndefined();
    expect(data.orders[0].user.address).toBeUndefined();
    expect(data.orders[0].user.email).toBeUndefined();
    expect(data.orders[0].user.recipient_name).toBeUndefined();
  });

  it("returns 200 with empty array when no match", async () => {
    ordersMock.findByNicknameOrOrderNumber.mockResolvedValue([]);

    const res = await GET(makeRequest("nonexistent"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.orders).toEqual([]);
  });

  it("returns 400 for missing q param", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
  });

  it("returns 400 for whitespace-only q", async () => {
    const res = await GET(makeRequest("   "));
    expect(res.status).toBe(400);
  });
});
