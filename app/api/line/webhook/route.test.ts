import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const handleMessageMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/line/message-handler", () => ({
  handleMessage: handleMessageMock,
}));

vi.mock("@/lib/notifications/fire-and-forget", () => ({
  fireAndForget: (task: () => Promise<unknown>) => {
    void task();
  },
}));

import { POST } from "./route";

function sign(body: string) {
  return createHmac("SHA256", "route-secret").update(body).digest("base64");
}

describe("POST /api/line/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LINE_CHANNEL_SECRET = "route-secret";
  });

  it("rejects tampered payloads without calling the handler", async () => {
    const res = await POST(
      new Request("http://localhost/api/line/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-line-signature": "bad-signature",
        },
        body: JSON.stringify({
          events: [
            {
              type: "message",
              replyToken: "reply-token",
              source: { userId: "line-user-1" },
              message: { type: "text", text: "hello" },
            },
          ],
        }),
      }) as unknown as import("next/server").NextRequest,
    );

    expect(res.status).toBe(200);
    expect(handleMessageMock).not.toHaveBeenCalled();
  });

  it("accepts a valid signature and dispatches text message events", async () => {
    const body = JSON.stringify({
      events: [
        {
          type: "message",
          replyToken: "reply-token",
          source: { userId: "line-user-1" },
          message: { type: "text", text: "hello" },
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

    expect(res.status).toBe(200);
    expect(handleMessageMock).toHaveBeenCalledWith(
      "line-user-1",
      "hello",
      "reply-token",
    );
  });

  it("returns 200 on malformed payloads", async () => {
    const res = await POST(
      new Request("http://localhost/api/line/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-line-signature": sign("{bad-json"),
        },
        body: "{bad-json",
      }) as unknown as import("next/server").NextRequest,
    );

    expect(res.status).toBe(200);
  });
});
