import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supabase-admin", () => ({
  authorizeAdminRequest: authMock,
}));

const productsMock = vi.hoisted(() => ({
  findById: vi.fn(),
}));
vi.mock("@/lib/db/products", () => productsMock);

const ordersMock = vi.hoisted(() => ({
  getCustomersForArrivalNotification: vi.fn(),
}));
vi.mock("@/lib/db/orders", () => ordersMock);

const outboxMock = vi.hoisted(() => ({
  enqueueProductArrivalNotifications: vi.fn(),
}));
vi.mock("@/lib/notifications/outbox", () => outboxMock);

import { POST } from "./route";

const PRODUCT_ID = "11111111-1111-4111-8111-000000000010";
const ROUND_ID = "11111111-1111-4111-8111-000000000020";
const OTHER_ROUND_ID = "11111111-1111-4111-8111-000000000021";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/notify-arrival", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

// ── Tests ──────────────────────────────────────────────────────

describe("POST /api/notify-arrival", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      authorized: true,
      mode: "cookie",
      claims: null,
    });
  });

  it("returns 200 with 0 customers and no notification call", async () => {
    productsMock.findById.mockResolvedValue({
      id: PRODUCT_ID,
      name: "地瓜",
      round_id: ROUND_ID,
    });
    ordersMock.getCustomersForArrivalNotification.mockResolvedValue({
      customerCount: 0,
      lineUserIds: [],
      emails: [],
    });

    const res = await POST(makeRequest({ productId: PRODUCT_ID, roundId: ROUND_ID }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.customersNotified).toBe(0);
    expect(data.queued).toBe(false);
    expect(outboxMock.enqueueProductArrivalNotifications).not.toHaveBeenCalled();
  });

  it("returns 404 when product not found", async () => {
    productsMock.findById.mockResolvedValue(null);

    const res = await POST(makeRequest({ productId: PRODUCT_ID, roundId: ROUND_ID }));
    expect(res.status).toBe(404);
  });

  it("sends notifications on valid arrival", async () => {
    const recipients = {
      customerCount: 2,
      lineUserIds: ["line1"],
      emails: ["a@b.com"],
    };
    productsMock.findById.mockResolvedValue({
      id: PRODUCT_ID,
      name: "地瓜",
      round_id: ROUND_ID,
    });
    ordersMock.getCustomersForArrivalNotification.mockResolvedValue(recipients);
    outboxMock.enqueueProductArrivalNotifications.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ productId: PRODUCT_ID, roundId: ROUND_ID }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.customersNotified).toBe(2);
    expect(data.queued).toBe(true);
    expect(outboxMock.enqueueProductArrivalNotifications).toHaveBeenCalledWith({
      productId: PRODUCT_ID,
      productName: "地瓜",
      roundId: ROUND_ID,
      lineUserIds: recipients.lineUserIds,
      emails: recipients.emails,
    });
  });

  it("returns 400 when product and round do not match", async () => {
    productsMock.findById.mockResolvedValue({
      id: PRODUCT_ID,
      name: "地瓜",
      round_id: OTHER_ROUND_ID,
    });

    const res = await POST(makeRequest({ productId: PRODUCT_ID, roundId: ROUND_ID }));
    expect(res.status).toBe(400);
    expect(ordersMock.getCustomersForArrivalNotification).not.toHaveBeenCalled();
    expect(outboxMock.enqueueProductArrivalNotifications).not.toHaveBeenCalled();
  });

  it("returns 401 when not admin", async () => {
    authMock.mockResolvedValue({
      authorized: false,
      mode: "none",
      claims: null,
    });

    const res = await POST(makeRequest({ productId: PRODUCT_ID, roundId: ROUND_ID }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for malformed productId", async () => {
    const res = await POST(makeRequest({ productId: "not-a-uuid", roundId: ROUND_ID }));
    expect(res.status).toBe(400);
    expect(productsMock.findById).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed roundId", async () => {
    const res = await POST(makeRequest({ productId: PRODUCT_ID, roundId: "not-a-uuid" }));
    expect(res.status).toBe(400);
    expect(productsMock.findById).not.toHaveBeenCalled();
  });
});
