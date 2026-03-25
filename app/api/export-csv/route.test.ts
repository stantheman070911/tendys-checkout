import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supabase-admin", () => ({
  verifyAdminSession: authMock,
  getSupabaseAdmin: vi.fn(),
}));

const ordersMock = vi.hoisted(() => ({
  listByRound: vi.fn(),
}));
vi.mock("@/lib/db/orders", () => ordersMock);

import { GET } from "./route";

function makeRequest(roundId?: string) {
  const params = roundId ? `?roundId=${roundId}` : "";
  const url = new URL(`http://localhost/api/export-csv${params}`);
  return {
    nextUrl: url,
  } as unknown as import("next/server").NextRequest;
}

const fakeOrders = [
  {
    order_number: "ORD-20260324-001",
    total_amount: 560,
    shipping_fee: 60,
    status: "confirmed",
    pickup_location: "",
    payment_amount: 560,
    payment_last5: "12345",
    payment_reported_at: "2026-03-24T10:00:00Z",
    confirmed_at: "2026-03-24T11:00:00Z",
    shipped_at: null,
    cancel_reason: null,
    note: "備註測試",
    created_at: "2026-03-24T09:00:00Z",
    user: {
      nickname: "王小明",
      purchaser_name: "王大明",
      recipient_name: "王小明",
      phone: "0900-000-001",
      address: "台北市信義區",
    },
    order_items: [
      { product_name: "台農57號黃金地瓜", quantity: 2, subtotal: 300 },
      { product_name: "放牧土雞蛋", quantity: 1, subtotal: 250 },
    ],
  },
];

// ── Tests ──────────────────────────────────────────────────────

describe("GET /api/export-csv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(true);
  });

  it("CSV starts with UTF-8 BOM", async () => {
    ordersMock.listByRound.mockResolvedValue(fakeOrders);

    const res = await GET(makeRequest("r1"));
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // UTF-8 BOM: EF BB BF
    expect(bytes[0]).toBe(0xef);
    expect(bytes[1]).toBe(0xbb);
    expect(bytes[2]).toBe(0xbf);
  });

  it("CSV header includes shipping fee column", async () => {
    ordersMock.listByRound.mockResolvedValue(fakeOrders);

    const res = await GET(makeRequest("r1"));
    const text = await res.text();
    const headerLine = text.split("\r\n")[0];
    expect(headerLine).toContain("運費");
  });

  it("preserves Chinese content", async () => {
    ordersMock.listByRound.mockResolvedValue(fakeOrders);

    const res = await GET(makeRequest("r1"));
    const text = await res.text();
    expect(text).toContain("王小明");
    expect(text).toContain("王大明");
    expect(text).toContain("台農57號黃金地瓜");
    expect(text).toContain("備註測試");
  });

  it("returns 401 when not admin", async () => {
    authMock.mockResolvedValue(false);

    const res = await GET(makeRequest("r1"));
    expect(res.status).toBe(401);
  });
});
