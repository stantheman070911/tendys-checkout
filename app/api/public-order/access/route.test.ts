import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPublicOrderAccessToken,
  getPublicOrderAccessCookieName,
} from "@/lib/public-order-access";

const ordersMock = vi.hoisted(() => ({
  findPublicOrderByOrderNumberAndIdentity: vi.fn(),
}));
vi.mock("@/lib/db/orders", () => ordersMock);

import { GET, POST } from "./route";

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

function makeGetRequest(search = "") {
  const url = `http://localhost/api/public-order/access${
    search ? `?${search}` : ""
  }`;

  return {
    url,
    nextUrl: {
      href: url,
      pathname: "/api/public-order/access",
      search: search ? `?${search}` : "",
      searchParams: new URL(url).searchParams,
      clone: () => new URL(url),
    },
    headers: new Headers(),
  } as unknown as import("next/server").NextRequest;
}

describe("/api/public-order/access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PUBLIC_ORDER_ACCESS_SECRET = "test-public-order-secret";
    process.env.NEXT_PUBLIC_SITE_URL = "https://wrong.example.com";
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
    expect(res.headers.get("location")).toBe("http://localhost/order/ORD-001");
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
      "http://localhost/order/ORD-001?error=invalid",
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
      "http://localhost/order/ORD-404?error=not_found",
    );
  });

  it("accepts signed GET access links and redirects to the clean order path", async () => {
    const token = createPublicOrderAccessToken({
      orderNumber: "ORD-001",
      purchaserName: "王小美",
      phoneLast3: "678",
    });

    const res = await GET(
      makeGetRequest(`token=${encodeURIComponent(token)}&order=ORD-001`),
    );

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost/order/ORD-001");
    expect(res.headers.get("set-cookie")).toContain(
      `${getPublicOrderAccessCookieName("ORD-001")}=`,
    );
  });

  it("rejects invalid signed GET access links", async () => {
    const res = await GET(makeGetRequest("token=bad-token&order=ORD-001"));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "http://localhost/order/ORD-001?error=invalid",
    );
  });
});
