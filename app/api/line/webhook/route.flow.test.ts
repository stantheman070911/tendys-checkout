import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  order: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

const pushMock = vi.hoisted(() => ({
  sendLineMessage: vi.fn(),
}));
vi.mock("@/lib/line/push", () => pushMock);

vi.mock("@/lib/notifications/fire-and-forget", () => ({
  fireAndForget: (task: () => Promise<unknown>) => {
    void task();
  },
}));

import { POST } from "./route";

function sign(body: string) {
  return createHmac("SHA256", "flow-secret").update(body).digest("base64");
}

describe("POST /api/line/webhook binding flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LINE_CHANNEL_SECRET = "flow-secret";
    prismaMock.order.findFirst.mockResolvedValue({
      id: "order-1",
      order_number: "ORD-20260329-001",
      status: "pending_confirm",
      line_user_id: null,
      user: {
        phone: "0912-000-678",
      },
    });
    prismaMock.order.update.mockResolvedValue({ id: "order-1" });
    pushMock.sendLineMessage.mockResolvedValue({ success: true });
  });

  it("links the order to the LINE user and sends a success reply", async () => {
    const body = JSON.stringify({
      events: [
        {
          type: "message",
          replyToken: "reply-token",
          source: { userId: "line-user-1" },
          message: {
            type: "text",
            text: "ORD-20260329-001 王小美 678",
          },
        },
      ],
    });

    const res = await POST(
      new Request("http://localhost/api/line/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-line-signature": sign(body),
        },
        body,
      }) as unknown as import("next/server").NextRequest,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(res.status).toBe(200);
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { line_user_id: "line-user-1" },
    });
    expect(pushMock.sendLineMessage).toHaveBeenCalledWith(
      "line-user-1",
      expect.stringContaining("ORD-20260329-001"),
      "reply-token",
    );
  });
});
