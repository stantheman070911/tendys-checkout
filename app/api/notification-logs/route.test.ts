import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supabase-admin", () => ({
  verifyAdminSession: authMock,
}));

const logsMock = vi.hoisted(() => ({
  getLogsByRound: vi.fn(),
}));
vi.mock("@/lib/db/notification-logs", () => logsMock);

import { GET } from "./route";

const VALID_ROUND_ID = "11111111-1111-4111-8111-111111111111";

function makeRequest(query = "") {
  const suffix = query ? `?${query}` : "";
  return {
    nextUrl: new URL(`http://localhost/api/notification-logs${suffix}`),
  } as unknown as import("next/server").NextRequest;
}

describe("GET /api/notification-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(true);
  });

  it("returns logs for a valid round UUID", async () => {
    logsMock.getLogsByRound.mockResolvedValue([{ id: "log-1" }]);

    const res = await GET(makeRequest(`roundId=${VALID_ROUND_ID}`));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(logsMock.getLogsByRound).toHaveBeenCalledWith(VALID_ROUND_ID);
    expect(data.logs).toEqual([{ id: "log-1" }]);
  });

  it("returns 400 for an invalid roundId UUID", async () => {
    const res = await GET(makeRequest("roundId=not-a-uuid"));

    expect(res.status).toBe(400);
    expect(logsMock.getLogsByRound).not.toHaveBeenCalled();
  });
});
