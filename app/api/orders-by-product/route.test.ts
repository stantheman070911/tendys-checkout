import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supabase-admin", () => ({
  verifyAdminSession: authMock,
}));

const ordersMock = vi.hoisted(() => ({
  getOrdersByProduct: vi.fn(),
}));
vi.mock("@/lib/db/orders", () => ordersMock);

import { GET } from "./route";

const VALID_PRODUCT_ID = "22222222-2222-4222-8222-222222222222";
const VALID_ROUND_ID = "11111111-1111-4111-8111-111111111111";

function makeRequest(query = "") {
  const suffix = query ? `?${query}` : "";
  return {
    nextUrl: new URL(`http://localhost/api/orders-by-product${suffix}`),
  } as unknown as import("next/server").NextRequest;
}

describe("GET /api/orders-by-product", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(true);
  });

  it("returns customers for a valid UUID query", async () => {
    ordersMock.getOrdersByProduct.mockResolvedValue([
      { order_number: "ORD-001", product_id: VALID_PRODUCT_ID },
    ]);

    const res = await GET(
      makeRequest(`productId=${VALID_PRODUCT_ID}&roundId=${VALID_ROUND_ID}`),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(ordersMock.getOrdersByProduct).toHaveBeenCalledWith(
      VALID_PRODUCT_ID,
      VALID_ROUND_ID,
    );
    expect(data.customers).toHaveLength(1);
  });

  it("returns 400 for an invalid productId UUID", async () => {
    const res = await GET(
      makeRequest(`productId=not-a-uuid&roundId=${VALID_ROUND_ID}`),
    );

    expect(res.status).toBe(400);
    expect(ordersMock.getOrdersByProduct).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid roundId UUID", async () => {
    const res = await GET(
      makeRequest(`productId=${VALID_PRODUCT_ID}&roundId=not-a-uuid`),
    );

    expect(res.status).toBe(400);
    expect(ordersMock.getOrdersByProduct).not.toHaveBeenCalled();
  });
});
