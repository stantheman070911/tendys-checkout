import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supabase-admin", () => ({
  verifyAdminSession: authMock,
}));

const usersMock = vi.hoisted(() => ({
  createUser: vi.fn(),
  findByNickname: vi.fn(),
  upsertByNickname: vi.fn(),
}));
vi.mock("@/lib/db/users", () => usersMock);

const ordersMock = vi.hoisted(() => ({
  createWithItems: vi.fn(),
}));
vi.mock("@/lib/db/orders", () => ordersMock);

import { POST } from "./route";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_ROUND_ID = "11111111-1111-4111-8111-111111111111";
const VALID_PRODUCT_ID_1 = "22222222-2222-4222-8222-222222222222";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/submit-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    submission_key: VALID_UUID,
    round_id: VALID_ROUND_ID,
    nickname: "TestUser",
    recipient_name: "Test Name",
    phone: "0900-000-001",
    pickup_location: "",
    address: "台北市信義區測試路 1 號",
    items: [{ product_id: VALID_PRODUCT_ID_1, quantity: 2 }],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe("POST /api/submit-order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(false);
    usersMock.findByNickname.mockResolvedValue(null);
    usersMock.createUser.mockResolvedValue({ id: "user-1" });
  });

  it("returns 201 on valid order", async () => {
    const fakeOrder = {
      id: "o1",
      order_number: "ORD-20260324-001",
    };
    ordersMock.createWithItems.mockResolvedValue({ order: fakeOrder });

    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.order.id).toBe("o1");
  });

  it("returns 200 on submission_key dedup", async () => {
    const fakeOrder = { id: "o1", order_number: "ORD-20260324-001" };
    ordersMock.createWithItems.mockResolvedValue({
      order: fakeOrder,
      deduplicated: true,
    });

    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(200);
  });

  it("returns 400 when stock exhausted", async () => {
    ordersMock.createWithItems.mockResolvedValue({
      error: "Insufficient stock for product",
    });

    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/stock/i);
  });

  it("returns 400 when round is closed", async () => {
    ordersMock.createWithItems.mockResolvedValue({
      error: "Round is not open",
    });

    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid submission_key", async () => {
    const res = await POST(
      makeRequest(validBody({ submission_key: "not-a-uuid" })),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/submission_key/);
  });

  it("returns 400 for missing required fields", async () => {
    const res = await POST(makeRequest({ submission_key: VALID_UUID }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for duplicate product IDs", async () => {
    const res = await POST(
      makeRequest(
        validBody({
          items: [
            { product_id: VALID_PRODUCT_ID_1, quantity: 1 },
            { product_id: VALID_PRODUCT_ID_1, quantity: 2 },
          ],
        }),
      ),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/[Dd]uplicate/);
  });

  it("returns 400 for negative quantity", async () => {
    const res = await POST(
      makeRequest(
        validBody({ items: [{ product_id: VALID_PRODUCT_ID_1, quantity: -1 }] }),
      ),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/quantity/);
  });

  it("returns 400 for invalid round_id", async () => {
    const res = await POST(makeRequest(validBody({ round_id: "round-1" })));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/round_id/i);
  });

  it("returns 400 for invalid product_id", async () => {
    const res = await POST(
      makeRequest(validBody({ items: [{ product_id: "p1", quantity: 1 }] })),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/product_id/i);
  });

  it("returns 400 for delivery without address", async () => {
    const res = await POST(
      makeRequest(validBody({ pickup_location: "", address: undefined })),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/address/);
  });

  it("returns 201 for valid 面交 order without address", async () => {
    const fakeOrder = {
      id: "o2",
      order_number: "ORD-20260324-002",
    };
    ordersMock.createWithItems.mockResolvedValue({ order: fakeOrder });

    const res = await POST(
      makeRequest(
        validBody({ pickup_location: "面交點 A", address: undefined }),
      ),
    );
    expect(res.status).toBe(201);
  });

  it("returns 409 when a public nickname exists with different saved details", async () => {
    usersMock.findByNickname.mockResolvedValue({
      id: "user-1",
      nickname: "TestUser",
      recipient_name: "Other Name",
      phone: "0912345678",
      address: "台北市",
      email: "old@example.com",
    });

    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(409);
  });

  it("allows admin POS to overwrite an existing nickname profile", async () => {
    authMock.mockResolvedValue(true);
    usersMock.findByNickname.mockResolvedValue({
      id: "user-1",
      nickname: "TestUser",
    });
    usersMock.upsertByNickname.mockResolvedValue({ id: "user-1" });
    ordersMock.createWithItems.mockResolvedValue({
      order: {
        id: "o3",
        order_number: "ORD-20260324-003",
      },
    });

    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(201);
    expect(usersMock.upsertByNickname).toHaveBeenCalled();
  });

  it("reuses a concurrently created public nickname when details match", async () => {
    usersMock.createUser.mockRejectedValueOnce({ code: "P2002" });
    usersMock.findByNickname
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "user-1",
        nickname: "TestUser",
        recipient_name: "Test Name",
        phone: "0900-000-001",
        address: "台北市信義區測試路 1 號",
        email: null,
      });
    ordersMock.createWithItems.mockResolvedValue({
      order: {
        id: "o4",
        order_number: "ORD-20260324-004",
      },
    });

    const res = await POST(makeRequest(validBody({ email: undefined })));
    expect(res.status).toBe(201);
    expect(ordersMock.createWithItems).toHaveBeenCalled();
  });
});
