import { beforeEach, describe, expect, it } from "vitest";
import {
  buildPublicOrderAccessPath,
  createPublicOrderAccessToken,
  getPublicOrderAccessCookieName,
  normalizePublicOrderAccessIdentity,
  verifyPublicOrderAccessToken,
} from "@/lib/public-order-access";

describe("public order access tokens", () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = "test-secret";
  });

  it("normalizes purchaser identity", () => {
    expect(
      normalizePublicOrderAccessIdentity({
        purchaser_name: " 王小美 ",
        phone_last3: "6-7-8",
      }),
    ).toEqual({
      purchaser_name: "王小美",
      phone_last3: "678",
    });
  });

  it("creates and verifies a signed token", () => {
    const token = createPublicOrderAccessToken({
      orderNumber: "ord-001",
      purchaserName: "王小美",
      phoneLast3: "678",
    });

    expect(verifyPublicOrderAccessToken(token)).toEqual(
      expect.objectContaining({
        order_number: "ORD-001",
        purchaser_name: "王小美",
        phone_last3: "678",
      }),
    );
  });

  it("builds cookie-safe helpers", () => {
    const token = createPublicOrderAccessToken({
      orderNumber: "ORD-001",
      purchaserName: "王小美",
      phoneLast3: "678",
    });

    expect(buildPublicOrderAccessPath(token)).toContain(
      "/api/public-order/access?token=",
    );
    expect(getPublicOrderAccessCookieName("ORD-001")).toMatch(
      /^tendy_order_access_/,
    );
  });

  it("rejects invalid tokens", () => {
    expect(verifyPublicOrderAccessToken("bad-token")).toBeNull();
  });
});
