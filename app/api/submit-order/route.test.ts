import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supabase-admin", () => ({
  verifyAdminSession: authMock,
}));

const ordersMock = vi.hoisted(() => ({
  createCheckoutOrder: vi.fn(),
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
    purchaser_name: "Buyer Name",
    recipient_name: "Test Name",
    phone: "0900-000-001",
    pickup_location: "",
    address: "台北市信義區測試路 1 號",
    items: [{ product_id: VALID_PRODUCT_ID_1, quantity: 2 }],
    save_profile: false,
    ...overrides,
  };
}

describe("POST /api/submit-order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(false);
  });

  it("returns 201 on valid order", async () => {
    ordersMock.createCheckoutOrder.mockResolvedValue({
      kind: "success",
      order: {
        id: "o1",
        order_number: "ORD-20260324-001",
      },
      deduplicated: false,
    });

    const res = await POST(makeRequest(validBody()));

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.order.id).toBe("o1");
    expect(ordersMock.createCheckoutOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        round_id: VALID_ROUND_ID,
        submission_key: VALID_UUID,
        is_admin: false,
      }),
    );
  });

  it("returns 200 on submission_key dedup", async () => {
    ordersMock.createCheckoutOrder.mockResolvedValue({
      kind: "success",
      order: {
        id: "o1",
        order_number: "ORD-20260324-001",
      },
      deduplicated: true,
    });

    const res = await POST(makeRequest(validBody()));

    expect(res.status).toBe(200);
  });

  it("returns 400 on checkout validation error", async () => {
    ordersMock.createCheckoutOrder.mockResolvedValue({
      kind: "validation_error",
      error: "Insufficient stock for product",
    });

    const res = await POST(makeRequest(validBody()));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/stock/i);
  });

  it("returns 409 when a saved profile phone mismatch blocks saving", async () => {
    ordersMock.createCheckoutOrder.mockResolvedValue({
      kind: "saved_profile_phone_mismatch",
    });

    const res = await POST(makeRequest(validBody()));

    expect(res.status).toBe(409);
  });

  it("returns 503 when access_code schema drift is detected", async () => {
    ordersMock.createCheckoutOrder.mockResolvedValue({
      kind: "schema_drift_access_code",
      error: "migration missing",
    });

    const res = await POST(makeRequest(validBody()));

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toMatch(/migration/i);
  });

  it("passes admin context through for POS orders", async () => {
    authMock.mockResolvedValue(true);
    ordersMock.createCheckoutOrder.mockResolvedValue({
      kind: "success",
      order: {
        id: "o2",
        order_number: "ORD-20260324-002",
      },
      deduplicated: false,
    });

    const res = await POST(
      makeRequest(
        validBody({ pickup_location: "面交點 A", address: undefined }),
      ),
    );

    expect(res.status).toBe(201);
    expect(ordersMock.createCheckoutOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        is_admin: true,
        pickup_location: "面交點 A",
        save_profile: false,
      }),
    );
  });

  it("returns 400 for invalid submission_key", async () => {
    const res = await POST(
      makeRequest(validBody({ submission_key: "not-a-uuid" })),
    );

    expect(res.status).toBe(400);
    expect(ordersMock.createCheckoutOrder).not.toHaveBeenCalled();
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
    expect(ordersMock.createCheckoutOrder).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-string pickup_location", async () => {
    const res = await POST(
      makeRequest(validBody({ pickup_location: 123 })),
    );

    expect(res.status).toBe(400);
    expect(ordersMock.createCheckoutOrder).not.toHaveBeenCalled();
  });

  it("returns 400 for delivery without address", async () => {
    const res = await POST(
      makeRequest(validBody({ pickup_location: "", address: undefined })),
    );

    expect(res.status).toBe(400);
    expect(ordersMock.createCheckoutOrder).not.toHaveBeenCalled();
  });
});
