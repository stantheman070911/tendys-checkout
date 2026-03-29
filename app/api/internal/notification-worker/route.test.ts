import { beforeEach, describe, expect, it, vi } from "vitest";

const alertsMock = vi.hoisted(() => ({
  recordWorkerAuthorizationFailure: vi.fn(),
}));
vi.mock("@/lib/alerts", () => alertsMock);

const workerMock = vi.hoisted(() => ({
  runNotificationWorker: vi.fn(),
}));
vi.mock("@/lib/notifications/worker", () => workerMock);

import { POST } from "./route";

describe("POST /api/internal/notification-worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOTIFICATION_WORKER_SECRET = "worker-secret";
    delete process.env.CRON_SECRET;
  });

  it("returns 401 when the bearer token is missing or wrong", async () => {
    const res = await POST(
      new Request("http://localhost/api/internal/notification-worker", {
        method: "POST",
      }) as unknown as import("next/server").NextRequest,
    );

    expect(res.status).toBe(401);
    expect(alertsMock.recordWorkerAuthorizationFailure).toHaveBeenCalledTimes(1);
    expect(workerMock.runNotificationWorker).not.toHaveBeenCalled();
  });

  it("runs the worker when authorized", async () => {
    workerMock.runNotificationWorker.mockResolvedValue({
      claimed: 3,
      sent: 2,
      failed: 1,
    });

    const res = await POST(
      new Request("http://localhost/api/internal/notification-worker", {
        method: "POST",
        headers: {
          Authorization: "Bearer worker-secret",
        },
      }) as unknown as import("next/server").NextRequest,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      claimed: 3,
      sent: 2,
      failed: 1,
    });
  });

  it("accepts Vercel cron authorization when CRON_SECRET is configured", async () => {
    process.env.CRON_SECRET = "cron-secret";
    workerMock.runNotificationWorker.mockResolvedValue({
      claimed: 1,
      sent: 1,
      failed: 0,
    });

    const res = await POST(
      new Request("http://localhost/api/internal/notification-worker", {
        method: "POST",
        headers: {
          Authorization: "Bearer cron-secret",
        },
      }) as unknown as import("next/server").NextRequest,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      claimed: 1,
      sent: 1,
      failed: 0,
    });
  });
});
