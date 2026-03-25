import { describe, expect, it } from "vitest";
import { updateAdminQueryString } from "@/lib/admin/query-string";

describe("updateAdminQueryString", () => {
  it("adds and removes query params predictably", () => {
    const current = new URLSearchParams("page=2&q=王小美");

    expect(
      updateAdminQueryString(current, {
        q: null,
        status: "pending_confirm",
      }),
    ).toBe("?page=2&status=pending_confirm");
  });

  it("returns an empty string when all params are removed", () => {
    const current = new URLSearchParams("page=1");

    expect(
      updateAdminQueryString(current, {
        page: null,
      }),
    ).toBe("");
  });
});
