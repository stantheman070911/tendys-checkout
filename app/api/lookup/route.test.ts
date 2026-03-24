import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────

const ordersMock = vi.hoisted(() => ({
  findOrdersByRecipientNameAndPhoneLast3: vi.fn(),
}));
vi.mock("@/lib/db/orders", () => ordersMock);

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

// ── Tests ──────────────────────────────────────────────────────

describe("POST /api/lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with a matching order", async () => {
    ordersMock.findOrdersByRecipientNameAndPhoneLast3.mockResolvedValue([
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
      },
    ]);

    const res = await POST(
      makeRequest({ recipient_name: "王小美", phone_last3: "678" }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.orders[0].order_number).toBe("ORD-001");
    expect(data.orders[0].detail_url).toBeUndefined();
  });

  it("returns 404 when no match", async () => {
    ordersMock.findOrdersByRecipientNameAndPhoneLast3.mockResolvedValue([]);

    const res = await POST(
      makeRequest({ recipient_name: "王小美", phone_last3: "678" }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for missing recipient_name", async () => {
    const res = await POST(makeRequest({ phone_last3: "678" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid phone_last3", async () => {
    const res = await POST(
      makeRequest({ recipient_name: "王小美", phone_last3: "12" }),
    );
    expect(res.status).toBe(400);
  });
});
