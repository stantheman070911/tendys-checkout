import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supabase-admin", () => ({
  verifyAdminSession: authMock,
}));

const dbMock = vi.hoisted(() => ({
  getOpenRound: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  listRecent: vi.fn(),
  findById: vi.fn(),
}));
vi.mock("@/lib/db/rounds", () => dbMock);

import { PUT } from "./route";

const VALID_ROUND_ID = "11111111-1111-4111-8111-000000000020";

function makePutRequest(body: unknown) {
  return new Request("http://localhost/api/rounds", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

// ── Tests ──────────────────────────────────────────────────────

describe("PUT /api/rounds — UUID validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(true);
  });

  it("returns 400 for malformed id", async () => {
    const res = await PUT(makePutRequest({ id: "not-a-uuid", is_open: false }));
    expect(res.status).toBe(400);
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("returns 400 when id is missing", async () => {
    const res = await PUT(makePutRequest({ is_open: false }));
    expect(res.status).toBe(400);
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("updates round when id is a valid UUID", async () => {
    dbMock.update.mockResolvedValue({ id: VALID_ROUND_ID, is_open: false });

    const res = await PUT(makePutRequest({ id: VALID_ROUND_ID, is_open: false }));
    expect(res.status).toBe(200);
    expect(dbMock.update).toHaveBeenCalledWith(VALID_ROUND_ID, { is_open: false });
  });
});
