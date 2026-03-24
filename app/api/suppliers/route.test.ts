import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supabase-admin", () => ({
  verifyAdminSession: authMock,
}));

const dbMock = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteSupplier: vi.fn(),
}));
vi.mock("@/lib/db/suppliers", () => dbMock);

import { PUT, POST } from "./route";

function makeRequest(body: unknown, method = "PUT") {
  return new Request("http://localhost/api/suppliers", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

// ── Tests ──────────────────────────────────────────────────────

describe("PUT /api/suppliers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(true);
  });

  it("clears optional fields when null is sent", async () => {
    dbMock.update.mockResolvedValue({
      id: "s1",
      name: "Acme",
      contact_name: null,
      phone: null,
      email: null,
      note: null,
    });

    const res = await PUT(
      makeRequest({
        id: "s1",
        contact_name: null,
        phone: null,
        email: null,
        note: null,
      })
    );

    expect(res.status).toBe(200);
    expect(dbMock.update).toHaveBeenCalledWith("s1", {
      contact_name: null,
      phone: null,
      email: null,
      note: null,
    });
  });

  it("rejects whitespace-only name with 400", async () => {
    const res = await PUT(makeRequest({ id: "s1", name: "   " }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/name/i);
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("rejects empty string name with 400", async () => {
    const res = await PUT(makeRequest({ id: "s1", name: "" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/name/i);
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/suppliers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(true);
  });

  it("rejects whitespace-only name with 400", async () => {
    const res = await POST(makeRequest({ name: "   " }, "POST"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/name/i);
    expect(dbMock.create).not.toHaveBeenCalled();
  });
});
