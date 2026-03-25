import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicOrderAccessCookieName } from "@/lib/public-order-access";

const ordersMock = vi.hoisted(() => ({
  findPublicOrderByOrderNumberAndIdentity: vi.fn(),
}));
vi.mock("@/lib/db/orders", () => ordersMock);

import { POST } from "./route";

function makeRequest(body: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(body)) {
    formData.set(key, value);
  }

  return new Request("http://localhost/api/public-order/access", {
    method: "POST",
    body: formData,
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/public-order/access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_SESSION_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  });

  it("uses 303 and sets an access cookie on success", async () => {
    ordersMock.findPublicOrderByOrderNumberAndIdentity.mockResolvedValue({
      id: "o1",
      order_number: "ORD-001",
    });

    const res = await POST(
      makeRequest({
        order_number: "ord-001",
        purchaser_name: "王小美",
        phone_last3: "678",
      }),
    );

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost:3000/order/ORD-001");
    expect(res.headers.get("set-cookie")).toContain(
      `${getPublicOrderAccessCookieName("ORD-001")}=`,
    );
    expect(res.headers.get("set-cookie")).toContain("Path=/order/ORD-001");
  });

  it("uses 303 for validation redirects", async () => {
    const res = await POST(
      makeRequest({
        order_number: "ORD-001",
        purchaser_name: "王小美",
        phone_last3: "67",
      }),
    );

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/order/ORD-001?error=invalid",
    );
  });

  it("uses 303 for not found redirects", async () => {
    ordersMock.findPublicOrderByOrderNumberAndIdentity.mockResolvedValue(null);

    const res = await POST(
      makeRequest({
        order_number: "ORD-404",
        purchaser_name: "王小美",
        phone_last3: "678",
      }),
    );

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/order/ORD-404?error=not_found",
    );
  });
});
