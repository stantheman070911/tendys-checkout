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

  it("returns 200 with matching orders", async () => {
    const fakeOrders = [{ id: "o1", order_number: "ORD-001" }];
    ordersMock.findByNicknameOrOrderNumber.mockResolvedValue(fakeOrders);

    const res = await GET(makeRequest("TestUser"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.orders).toEqual(fakeOrders);
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
