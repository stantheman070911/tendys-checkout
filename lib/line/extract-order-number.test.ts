import { describe, expect, it } from "vitest";
import { extractOrderNumber } from "./extract-order-number";

describe("extractOrderNumber", () => {
  it("returns a raw order number unchanged", () => {
    expect(extractOrderNumber("ORD-20260322-001")).toBe("ORD-20260322-001");
  });

  it("extracts an order number from prefixed text", () => {
    expect(extractOrderNumber("綁定 ORD-20260322-001")).toBe(
      "ORD-20260322-001",
    );
  });

  it("returns null when no order number exists", () => {
    expect(extractOrderNumber("hello there")).toBeNull();
  });
});
