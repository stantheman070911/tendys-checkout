import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supabase-admin", () => ({
  verifyAdminSession: authMock,
}));

const productsMock = vi.hoisted(() => ({
  findById: vi.fn(),
}));
vi.mock("@/lib/db/products", () => productsMock);

const ordersMock = vi.hoisted(() => ({
  getCustomersForArrivalNotification: vi.fn(),
}));
vi.mock("@/lib/db/orders", () => ordersMock);

const notifyMock = vi.hoisted(() => ({
  sendProductArrivalNotifications: vi.fn(),
}));
vi.mock("@/lib/notifications/send", () => notifyMock);
vi.mock("@/lib/notifications/fire-and-forget", () => ({
  fireAndForget: (task: () => Promise<unknown>) => {
    void task();
  },
}));

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
    authMock.mockResolvedValue(true);
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
    expect(notifyMock.sendProductArrivalNotifications).not.toHaveBeenCalled();
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
    notifyMock.sendProductArrivalNotifications.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ productId: PRODUCT_ID, roundId: ROUND_ID }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.customersNotified).toBe(2);
    expect(data.queued).toBe(true);
    expect(notifyMock.sendProductArrivalNotifications).toHaveBeenCalledWith(
      PRODUCT_ID,
      "地瓜",
      ROUND_ID,
      recipients,
    );
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
    expect(notifyMock.sendProductArrivalNotifications).not.toHaveBeenCalled();
  });

  it("returns 401 when not admin", async () => {
    authMock.mockResolvedValue(false);

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
