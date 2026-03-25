import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supabase-admin", () => ({
  verifyAdminSession: authMock,
}));

const ordersMock = vi.hoisted(() => ({
  listPageByRound: vi.fn(),
}));
vi.mock("@/lib/db/orders", () => ordersMock);

import { GET } from "./route";

function makeRequest(query = "") {
  const suffix = query ? `?${query}` : "";
  return {
    nextUrl: new URL(`http://localhost/api/orders${suffix}`),
  } as unknown as import("next/server").NextRequest;
}

describe("GET /api/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(true);
  });

  it("returns thin admin list rows with pagination metadata", async () => {
    ordersMock.listPageByRound.mockResolvedValue({
      items: [
        {
          id: "o1",
          order_number: "ORD-001",
          round_id: "r1",
          total_amount: 560,
          shipping_fee: 60,
          status: "pending_confirm",
          payment_amount: 560,
          payment_last5: "12345",
          payment_reported_at: "2026-03-24T10:00:00.000Z",
          confirmed_at: null,
          shipped_at: null,
          pickup_location: null,
          created_at: "2026-03-24T09:00:00.000Z",
          items_preview: "地瓜 ×2",
          user: {
            nickname: "王小明",
            purchaser_name: "王大明",
            recipient_name: "王小明",
            phone: "0900-000-001",
          },
        },
      ],
      total: 1,
      page: 2,
      pageSize: 25,
      hasMore: false,
    });

    const res = await GET(
      makeRequest("roundId=r1&status=pending_confirm&page=2&pageSize=25&q=王"),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(ordersMock.listPageByRound).toHaveBeenCalledWith({
      roundId: "r1",
      status: "pending_confirm",
      search: "王",
      productId: undefined,
      page: 2,
      pageSize: 25,
    });
    expect(data.items).toEqual([
      expect.objectContaining({
        id: "o1",
        items_preview: "地瓜 ×2",
        user: expect.objectContaining({ nickname: "王小明" }),
      }),
    ]);
    expect(data.items[0].order_items).toBeUndefined();
    expect(data.orders).toEqual(data.items);
    expect(data.total).toBe(1);
    expect(data.page).toBe(2);
    expect(data.pageSize).toBe(25);
    expect(data.hasMore).toBe(false);
  });

  it("returns 401 when the admin session is invalid", async () => {
    authMock.mockResolvedValue(false);

    const res = await GET(makeRequest("roundId=r1"));

    expect(res.status).toBe(401);
  });
});
