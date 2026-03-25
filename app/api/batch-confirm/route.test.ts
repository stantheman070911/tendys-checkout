import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supabase-admin", () => ({
  verifyAdminSession: authMock,
}));

const ordersMock = vi.hoisted(() => ({
  batchConfirm: vi.fn(),
}));
vi.mock("@/lib/db/orders", () => ordersMock);

const notifyMock = vi.hoisted(() => ({
  sendPaymentConfirmedNotifications: vi.fn(),
}));
vi.mock("@/lib/notifications/send", () => notifyMock);
vi.mock("@/lib/notifications/fire-and-forget", () => ({
  fireAndForget: (task: () => Promise<unknown>) => {
    void task();
  },
}));

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/batch-confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

// ── Tests ──────────────────────────────────────────────────────

describe("POST /api/batch-confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(true);
    notifyMock.sendPaymentConfirmedNotifications.mockResolvedValue({});
  });

  it("partial success: some confirmed, some skipped", async () => {
    ordersMock.batchConfirm.mockResolvedValue([
      { id: "o1", order_number: "ORD-001", order_items: [] },
    ]);

    const res = await POST(makeRequest({ orderIds: ["o1", "o2"] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.confirmed).toBe(1);
    expect(data.skipped).toEqual(["o2"]);
  });

  it("all skipped → 200 with confirmed: 0", async () => {
    ordersMock.batchConfirm.mockResolvedValue([]);

    const res = await POST(makeRequest({ orderIds: ["o1", "o2"] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.confirmed).toBe(0);
    expect(data.skipped).toEqual(["o1", "o2"]);
    expect(notifyMock.sendPaymentConfirmedNotifications).not.toHaveBeenCalled();
  });

  it("returns 401 when not admin", async () => {
    authMock.mockResolvedValue(false);

    const res = await POST(makeRequest({ orderIds: ["o1"] }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for empty orderIds", async () => {
    const res = await POST(makeRequest({ orderIds: [] }));
    expect(res.status).toBe(400);
  });
});
