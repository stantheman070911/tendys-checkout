import { describe, expect, it } from "vitest";
import { groupOrdersByPickup, matchesOrderSearch } from "./order-search";

describe("matchesOrderSearch", () => {
  const order = {
    order_number: "ORD-20260322-001",
    pickup_location: null,
    user: {
      nickname: "小美",
      phone: "0912-345-678",
      recipient_name: "王小美",
    },
  };

  it("matches nickname, phone, recipient, and order number", () => {
    expect(matchesOrderSearch(order, "小美")).toBe(true);
    expect(matchesOrderSearch(order, "0912")).toBe(true);
    expect(matchesOrderSearch(order, "王小美")).toBe(true);
    expect(matchesOrderSearch(order, "20260322")).toBe(true);
  });
});

describe("groupOrdersByPickup", () => {
  it("groups delivery orders under 宅配 and preserves pickup labels", () => {
    const groups = groupOrdersByPickup([
      { pickup_location: null, id: "1" },
      { pickup_location: "面交點 A", id: "2" },
      { pickup_location: "", id: "3" },
    ]);

    expect(groups).toEqual([
      {
        label: "宅配",
        orders: [
          { pickup_location: null, id: "1" },
          { pickup_location: "", id: "3" },
        ],
      },
      { label: "面交點 A", orders: [{ pickup_location: "面交點 A", id: "2" }] },
    ]);
  });
});
