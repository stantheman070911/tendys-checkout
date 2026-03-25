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
      id: "p1",
      name: "地瓜",
      round_id: "r1",
    });
    ordersMock.getCustomersForArrivalNotification.mockResolvedValue({
      customerCount: 0,
      lineUserIds: [],
      emails: [],
    });

    const res = await POST(makeRequest({ productId: "p1", roundId: "r1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.customersNotified).toBe(0);
    expect(data.queued).toBe(false);
    expect(notifyMock.sendProductArrivalNotifications).not.toHaveBeenCalled();
  });

  it("returns 404 when product not found", async () => {
    productsMock.findById.mockResolvedValue(null);

    const res = await POST(
      makeRequest({ productId: "nonexistent", roundId: "r1" }),
    );
    expect(res.status).toBe(404);
  });

  it("sends notifications on valid arrival", async () => {
    const recipients = {
      customerCount: 2,
      lineUserIds: ["line1"],
      emails: ["a@b.com"],
    };
    productsMock.findById.mockResolvedValue({
      id: "p1",
      name: "地瓜",
      round_id: "r1",
    });
    ordersMock.getCustomersForArrivalNotification.mockResolvedValue(recipients);
    notifyMock.sendProductArrivalNotifications.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ productId: "p1", roundId: "r1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.customersNotified).toBe(2);
    expect(data.queued).toBe(true);
    expect(notifyMock.sendProductArrivalNotifications).toHaveBeenCalledWith(
      "p1",
      "地瓜",
      "r1",
      recipients,
    );
  });

  it("returns 400 when product and round do not match", async () => {
    productsMock.findById.mockResolvedValue({
      id: "p1",
      name: "地瓜",
      round_id: "other-round",
    });

    const res = await POST(makeRequest({ productId: "p1", roundId: "r1" }));
    expect(res.status).toBe(400);
    expect(ordersMock.getCustomersForArrivalNotification).not.toHaveBeenCalled();
    expect(notifyMock.sendProductArrivalNotifications).not.toHaveBeenCalled();
  });

  it("returns 401 when not admin", async () => {
    authMock.mockResolvedValue(false);

    const res = await POST(makeRequest({ productId: "p1", roundId: "r1" }));
    expect(res.status).toBe(401);
  });
});
