import { describe, expect, it } from "vitest";
import { buildAdminPath } from "./paths";

describe("buildAdminPath", () => {
  it("returns the admin base for empty input", () => {
    expect(buildAdminPath()).toBe("/bitchassnigga");
  });

  it("normalizes relative paths", () => {
    expect(buildAdminPath("orders/123/print")).toBe(
      "/bitchassnigga/orders/123/print",
    );
  });

  it("preserves rooted paths", () => {
    expect(buildAdminPath("/dashboard")).toBe("/bitchassnigga/dashboard");
  });
});
