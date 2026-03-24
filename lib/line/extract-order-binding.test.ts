import { describe, expect, it } from "vitest";
import { extractOrderBinding } from "./extract-order-binding";

describe("extractOrderBinding", () => {
  it("extracts order number, recipient name, and phone last 3", () => {
    expect(extractOrderBinding("ORD-20260322-001 王小美 678")).toEqual({
      orderNumber: "ORD-20260322-001",
      recipientName: "王小美",
      phoneLast3: "678",
    });
  });

  it("allows prefixed text but keeps the remaining name payload intact", () => {
    expect(extractOrderBinding("綁定 ORD-20260322-001 王小美 678")).toEqual({
      orderNumber: "ORD-20260322-001",
      recipientName: "綁定 王小美",
      phoneLast3: "678",
    });
  });

  it("returns null when multiple order numbers are present", () => {
    expect(
      extractOrderBinding("ORD-20260322-001 ORD-20260322-002 王小美 678"),
    ).toBeNull();
  });

  it("returns null when multiple 3-digit groups are present", () => {
    expect(
      extractOrderBinding("ORD-20260322-001 王小美 678 123"),
    ).toBeNull();
  });

  it("returns null when recipient name is missing", () => {
    expect(extractOrderBinding("ORD-20260322-001 678")).toBeNull();
  });
});
