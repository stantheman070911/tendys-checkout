import { describe, expect, it, vi } from "vitest";
import { logError, logInfo } from "@/lib/logger";

describe("logger", () => {
  it("emits structured JSON info logs", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    logInfo({
      event: "request_received",
      requestId: "req-123",
      route: "/api/test",
      authMode: "cookie",
      orderId: "order-1",
    });

    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
    expect(payload).toMatchObject({
      level: "info",
      event: "request_received",
      requestId: "req-123",
      route: "/api/test",
      authMode: "cookie",
      orderId: "order-1",
    });
  });

  it("serializes error objects in error logs", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logError({
      event: "request_failed",
      error: new Error("boom"),
    });

    const payload = JSON.parse(String(errorSpy.mock.calls[0]?.[0]));
    expect(payload.level).toBe("error");
    expect(payload.error).toMatchObject({
      name: "Error",
      message: "boom",
    });
  });
});
