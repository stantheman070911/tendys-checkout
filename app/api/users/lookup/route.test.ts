import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supabase-admin", () => ({
  verifyAdminSession: authMock,
}));

const usersMock = vi.hoisted(() => ({
  findByNickname: vi.fn(),
}));
vi.mock("@/lib/db/users", () => usersMock);

import { GET } from "./route";

function makeRequest(nickname?: string) {
  const params = nickname ? `?nickname=${encodeURIComponent(nickname)}` : "";
  const url = new URL(`http://localhost/api/users/lookup${params}`);
  return {
    headers: new Headers(),
    nextUrl: url,
  } as unknown as import("next/server").NextRequest;
}

describe("GET /api/users/lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for public callers", async () => {
    authMock.mockResolvedValue(false);

    const res = await GET(makeRequest("小明"));
    expect(res.status).toBe(401);
  });

  it("returns autofill fields for admins", async () => {
    authMock.mockResolvedValue(true);
    usersMock.findByNickname.mockResolvedValue({
      recipient_name: "王小明",
      phone: "0912345678",
      address: "台北市",
      email: "test@example.com",
    });

    const res = await GET(makeRequest("小明"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user).toEqual({
      recipient_name: "王小明",
      phone: "0912345678",
      address: "台北市",
      email: "test@example.com",
    });
  });
});
