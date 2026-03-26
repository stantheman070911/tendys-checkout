import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supabase-admin", () => ({
  verifyAdminSession: authMock,
}));

const productsMock = vi.hoisted(() => ({
  listActiveByRound: vi.fn(),
  listAllByRound: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/db/products", () => productsMock);

import { GET, PUT } from "./route";

const VALID_ROUND_ID = "11111111-1111-4111-8111-111111111111";
const VALID_PRODUCT_ID = "22222222-2222-4222-8222-222222222222";

function makeGetRequest(query = "") {
  const suffix = query ? `?${query}` : "";
  return {
    nextUrl: new URL(`http://localhost/api/products${suffix}`),
  } as unknown as import("next/server").NextRequest;
}

function makePutRequest(body: unknown) {
  return new Request("http://localhost/api/products", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("products route validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(true);
  });

  it("returns 400 for an invalid GET roundId UUID", async () => {
    const res = await GET(makeGetRequest("roundId=not-a-uuid"));

    expect(res.status).toBe(400);
    expect(productsMock.listActiveByRound).not.toHaveBeenCalled();
    expect(productsMock.listAllByRound).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid PUT id UUID", async () => {
    const res = await PUT(
      makePutRequest({
        id: "not-a-uuid",
        name: "Updated Product",
      }),
    );

    expect(res.status).toBe(400);
    expect(productsMock.update).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid PUT round_id UUID", async () => {
    const res = await PUT(
      makePutRequest({
        id: VALID_PRODUCT_ID,
        round_id: "not-a-uuid",
      }),
    );

    expect(res.status).toBe(400);
    expect(productsMock.update).not.toHaveBeenCalled();
  });

  it("accepts a valid GET roundId UUID", async () => {
    productsMock.listActiveByRound.mockResolvedValue([]);

    const res = await GET(makeGetRequest(`roundId=${VALID_ROUND_ID}`));

    expect(res.status).toBe(200);
    expect(productsMock.listActiveByRound).toHaveBeenCalledWith(VALID_ROUND_ID);
  });
});
