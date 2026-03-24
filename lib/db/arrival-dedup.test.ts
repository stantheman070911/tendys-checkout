import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  orderItem: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

import { getCustomersForArrivalNotification } from "./orders";

describe("getCustomersForArrivalNotification dedup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("collects all unique line_user_ids across orders from the same user", async () => {
    // Same user, two orders: first has no LINE link, second does
    prismaMock.orderItem.findMany.mockResolvedValue([
      {
        order: {
          id: "order-1",
          user_id: "user-1",
          line_user_id: null,
          user: { email: "user1@test.com" },
        },
      },
      {
        order: {
          id: "order-2",
          user_id: "user-1",
          line_user_id: "LINE-user-1",
          user: { email: "user1@test.com" },
        },
      },
    ]);

    const result = await getCustomersForArrivalNotification(
      "prod-1",
      "round-1",
    );

    expect(result.lineUserIds).toEqual(["LINE-user-1"]);
    expect(result.emails).toEqual(["user1@test.com"]);
    // Same user_id → 1 customer, not 2
    expect(result.customerCount).toBe(1);
  });

  it("dedupes LINE user IDs across different users", async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([
      {
        order: {
          id: "order-1",
          user_id: "user-1",
          line_user_id: "LINE-A",
          user: { email: "a@test.com" },
        },
      },
      {
        order: {
          id: "order-2",
          user_id: "user-2",
          line_user_id: "LINE-A", // same LINE account somehow
          user: { email: "b@test.com" },
        },
      },
      {
        order: {
          id: "order-3",
          user_id: "user-3",
          line_user_id: "LINE-B",
          user: { email: "a@test.com" }, // same email as user-1
        },
      },
    ]);

    const result = await getCustomersForArrivalNotification(
      "prod-1",
      "round-1",
    );

    expect(result.lineUserIds).toHaveLength(2);
    expect(result.lineUserIds).toContain("LINE-A");
    expect(result.lineUserIds).toContain("LINE-B");
    expect(result.emails).toHaveLength(2);
    expect(result.emails).toContain("a@test.com");
    expect(result.emails).toContain("b@test.com");
    // 3 distinct user_ids → 3 customers (even though shared endpoints)
    expect(result.customerCount).toBe(3);
  });

  it("returns zero customerCount and empty arrays when no orders match", async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([]);

    const result = await getCustomersForArrivalNotification(
      "prod-1",
      "round-1",
    );

    expect(result.customerCount).toBe(0);
    expect(result.lineUserIds).toEqual([]);
    expect(result.emails).toEqual([]);
  });

  it("handles orders with no LINE link and no email", async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([
      {
        order: {
          id: "order-1",
          user_id: "user-1",
          line_user_id: null,
          user: { email: null },
        },
      },
    ]);

    const result = await getCustomersForArrivalNotification(
      "prod-1",
      "round-1",
    );

    expect(result.customerCount).toBe(1);
    expect(result.lineUserIds).toEqual([]);
    expect(result.emails).toEqual([]);
  });

  it("one customer with both LINE and email counts as 1 customer", async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([
      {
        order: {
          id: "order-1",
          user_id: "user-1",
          line_user_id: "LINE-user-1",
          user: { email: "user1@test.com" },
        },
      },
    ]);

    const result = await getCustomersForArrivalNotification(
      "prod-1",
      "round-1",
    );

    // 1 customer, even though 2 delivery endpoints
    expect(result.customerCount).toBe(1);
    expect(result.lineUserIds).toEqual(["LINE-user-1"]);
    expect(result.emails).toEqual(["user1@test.com"]);
  });

  it("falls back to order.id when user_id is null (guest orders)", async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([
      {
        order: {
          id: "order-1",
          user_id: null,
          line_user_id: "LINE-A",
          user: null,
        },
      },
      {
        order: {
          id: "order-2",
          user_id: null,
          line_user_id: "LINE-B",
          user: null,
        },
      },
    ]);

    const result = await getCustomersForArrivalNotification(
      "prod-1",
      "round-1",
    );

    // Two distinct orders with no user_id → 2 customers (by order.id)
    expect(result.customerCount).toBe(2);
    expect(result.lineUserIds).toHaveLength(2);
  });
});
