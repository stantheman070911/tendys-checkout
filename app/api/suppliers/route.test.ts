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

import { PUT, POST, DELETE } from "./route";

const VALID_SUPPLIER_ID = "11111111-1111-4111-8111-000000000030";

function makeRequest(body: unknown, method = "PUT") {
  return new Request("http://localhost/api/suppliers", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

function makeDeleteRequest(id?: string) {
  const params = id ? `?id=${id}` : "";
  const url = new URL(`http://localhost/api/suppliers${params}`);
  return {
    nextUrl: url,
  } as unknown as import("next/server").NextRequest;
}

// ── Tests ──────────────────────────────────────────────────────

describe("PUT /api/suppliers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(true);
  });

  it("clears optional fields when null is sent", async () => {
    dbMock.update.mockResolvedValue({
      id: VALID_SUPPLIER_ID,
      name: "Acme",
      contact_name: null,
      phone: null,
      email: null,
      note: null,
    });

    const res = await PUT(
      makeRequest({
        id: VALID_SUPPLIER_ID,
        contact_name: null,
        phone: null,
        email: null,
        note: null,
      }),
    );

    expect(res.status).toBe(200);
    expect(dbMock.update).toHaveBeenCalledWith(VALID_SUPPLIER_ID, {
      contact_name: null,
      phone: null,
      email: null,
      note: null,
    });
  });

  it("rejects whitespace-only name with 400", async () => {
    const res = await PUT(makeRequest({ id: VALID_SUPPLIER_ID, name: "   " }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/name/i);
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("rejects empty string name with 400", async () => {
    const res = await PUT(makeRequest({ id: VALID_SUPPLIER_ID, name: "" }));
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

describe("DELETE /api/suppliers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(true);
  });

  it("returns 400 when supplier has linked products", async () => {
    dbMock.deleteSupplier.mockResolvedValue({
      error: "Cannot delete supplier with linked products",
    });

    const res = await DELETE(makeDeleteRequest(VALID_SUPPLIER_ID));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/product/i);
  });

  it("returns 200 when supplier has no products", async () => {
    dbMock.deleteSupplier.mockResolvedValue({ success: true });

    const res = await DELETE(makeDeleteRequest(VALID_SUPPLIER_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 400 when id is missing", async () => {
    const res = await DELETE(makeDeleteRequest());
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed id", async () => {
    const res = await DELETE(makeDeleteRequest("not-a-uuid"));
    expect(res.status).toBe(400);
    expect(dbMock.deleteSupplier).not.toHaveBeenCalled();
  });
});

describe("PUT /api/suppliers — malformed id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(true);
  });

  it("returns 400 for malformed id", async () => {
    const res = await PUT(makeRequest({ id: "not-a-uuid", name: "Test" }));
    expect(res.status).toBe(400);
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});
