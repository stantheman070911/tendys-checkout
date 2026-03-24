import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────

const ordersMock = vi.hoisted(() => ({
  findOrderByNumberAndAccessCode: vi.fn(),
}));
vi.mock("@/lib/db/orders", () => ordersMock);

import { GET } from "./route";

function makeRequest(orderNumber?: string, accessCode?: string) {
  const params = new URLSearchParams();
  if (orderNumber !== undefined) params.set("orderNumber", orderNumber);
  if (accessCode !== undefined) params.set("accessCode", accessCode);
  const suffix = params.toString();
  const url = new URL(
    `http://localhost/api/lookup${suffix ? `?${suffix}` : ""}`,
  );
  return {
    headers: new Headers(),
    nextUrl: url,
  } as unknown as import("next/server").NextRequest;
}

// ── Tests ──────────────────────────────────────────────────────

describe("GET /api/lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with a matching order", async () => {
    ordersMock.findOrderByNumberAndAccessCode.mockResolvedValue({
      id: "o1",
      order_number: "ORD-001",
      access_code: "ABCD1234EFGH",
      status: "confirmed",
      total_amount: 500,
      shipping_fee: null,
      created_at: "2026-03-24T00:00:00Z",
      order_items: [
        { id: "oi1", product_name: "地瓜", quantity: 2, subtotal: 200 },
      ],
    });

    const res = await GET(makeRequest("ORD-001", "ABCD1234EFGH"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.order.order_number).toBe("ORD-001");
    expect(data.order.access_code).toBeUndefined();
  });

  it("returns 404 when no match", async () => {
    ordersMock.findOrderByNumberAndAccessCode.mockResolvedValue(null);

    const res = await GET(makeRequest("ORD-404", "ABCD1234EFGH"));
    expect(res.status).toBe(404);
  });

  it("returns 400 for missing orderNumber", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid accessCode", async () => {
    const res = await GET(makeRequest("ORD-001", "bad"));
    expect(res.status).toBe(400);
  });
});
