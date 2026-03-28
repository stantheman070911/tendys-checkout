import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supabase-admin", () => ({
  verifyAdminSession: authMock,
}));

const ordersMock = vi.hoisted(() => ({
  getOrderWithItems: vi.fn(),
}));
vi.mock("@/lib/db/orders", () => ordersMock);

import { GET } from "./route";

const VALID_ORDER_ID = "11111111-1111-4111-8111-000000000001";

function makeRequest(id: string) {
  return {
    request: new Request(`http://localhost/api/orders/${id}`) as unknown as import("next/server").NextRequest,
    params: Promise.resolve({ id }),
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe("GET /api/orders/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(true);
  });

  it("returns 200 with order when found", async () => {
    const fakeOrder = { id: VALID_ORDER_ID, order_number: "ORD-001", order_items: [] };
    ordersMock.getOrderWithItems.mockResolvedValue(fakeOrder);

    const { request, params } = makeRequest(VALID_ORDER_ID);
    const res = await GET(request, { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.order.id).toBe(VALID_ORDER_ID);
  });

  it("returns 404 when order not found", async () => {
    ordersMock.getOrderWithItems.mockResolvedValue(null);

    const { request, params } = makeRequest(VALID_ORDER_ID);
    const res = await GET(request, { params });
    expect(res.status).toBe(404);
  });

  it("returns 401 when not admin", async () => {
    authMock.mockResolvedValue(false);

    const { request, params } = makeRequest(VALID_ORDER_ID);
    const res = await GET(request, { params });
    expect(res.status).toBe(401);
  });

  it("returns 400 for malformed id", async () => {
    const { request, params } = makeRequest("not-a-uuid");
    const res = await GET(request, { params });
    expect(res.status).toBe(400);
    expect(ordersMock.getOrderWithItems).not.toHaveBeenCalled();
  });
});
