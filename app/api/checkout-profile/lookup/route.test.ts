import { beforeEach, describe, expect, it, vi } from "vitest";

const usersMock = vi.hoisted(() => ({
  findSavedCheckoutProfileByNickname: vi.fn(),
  phoneMatchesStoredProfile: vi.fn(),
}));
vi.mock("@/lib/db/users", () => usersMock);

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => rateLimitMock);

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/checkout-profile/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/checkout-profile/lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitMock.getClientIp.mockReturnValue("127.0.0.1");
    rateLimitMock.checkRateLimit.mockReturnValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("returns matched profile when nickname and phone both match", async () => {
    usersMock.findSavedCheckoutProfileByNickname.mockResolvedValue({
      nickname: "小美",
      purchaser_name: "王小美",
      recipient_name: "王媽媽",
      phone: "0912345678",
      address: "台北市",
      email: "x@example.com",
    });
    usersMock.phoneMatchesStoredProfile.mockReturnValue(true);

    const res = await POST(makeRequest({ nickname: "小美", phone: "0912345678" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      status: "matched",
      profile: {
        nickname: "小美",
        purchaser_name: "王小美",
        recipient_name: "王媽媽",
        phone: "0912345678",
        address: "台北市",
        email: "x@example.com",
      },
    });
  });

  it("returns not_found when nickname has no saved profile", async () => {
    usersMock.findSavedCheckoutProfileByNickname.mockResolvedValue(null);

    const res = await POST(makeRequest({ nickname: "小美", phone: "0912345678" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ status: "not_found" });
  });

  it("returns phone_mismatch without leaking profile data", async () => {
    usersMock.findSavedCheckoutProfileByNickname.mockResolvedValue({
      nickname: "小美",
      purchaser_name: "王小美",
      recipient_name: "王媽媽",
      phone: "0912345678",
      address: "台北市",
      email: "x@example.com",
    });
    usersMock.phoneMatchesStoredProfile.mockReturnValue(false);

    const res = await POST(makeRequest({ nickname: "小美", phone: "0900000000" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ status: "phone_mismatch" });
  });

  it("returns 400 for missing nickname", async () => {
    const res = await POST(makeRequest({ phone: "0912345678" }));
    expect(res.status).toBe(400);
  });
});
