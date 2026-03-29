import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supabase-admin", () => ({
  verifyAdminSession: authMock,
}));

const jobsMock = vi.hoisted(() => ({
  requeueNotificationJobs: vi.fn(),
}));
vi.mock("@/lib/db/notification-jobs", () => jobsMock);

import { POST } from "./route";

const JOB_ID = "11111111-1111-4111-8111-000000000001";
const ROUND_ID = "11111111-1111-4111-8111-000000000002";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/notification-jobs/retry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/notification-jobs/retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(true);
  });

  it("requeues explicit job ids", async () => {
    jobsMock.requeueNotificationJobs.mockResolvedValue({ count: 1 });

    const res = await POST(makeRequest({ jobIds: [JOB_ID] }));

    expect(res.status).toBe(200);
    expect(jobsMock.requeueNotificationJobs).toHaveBeenCalledWith({
      jobIds: [JOB_ID],
      roundId: undefined,
    });
  });

  it("requeues all failed jobs for a round", async () => {
    jobsMock.requeueNotificationJobs.mockResolvedValue({ count: 4 });

    const res = await POST(makeRequest({ roundId: ROUND_ID }));

    expect(res.status).toBe(200);
    expect(jobsMock.requeueNotificationJobs).toHaveBeenCalledWith({
      jobIds: undefined,
      roundId: ROUND_ID,
    });
  });

  it("returns 401 when not admin", async () => {
    authMock.mockResolvedValue(false);

    const res = await POST(makeRequest({ roundId: ROUND_ID }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when neither jobIds nor roundId is provided", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect(jobsMock.requeueNotificationJobs).not.toHaveBeenCalled();
  });
});
