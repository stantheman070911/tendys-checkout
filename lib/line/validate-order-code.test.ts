import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  order: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../db/prisma", () => ({
  prisma: prismaMock,
}));

import { validateOrderNumber } from "./validate-order-code";

describe("validateOrderNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("links a valid order", async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: "o1",
      order_number: "ORD-001",
      status: "confirmed",
      line_user_id: null,
      user: { phone: "0912-345-678" },
    });

    const result = await validateOrderNumber(
      "ORD-001",
      "王小美",
      "678",
      "line-user-1",
    );

    expect(result).toEqual({
      valid: true,
      orderId: "o1",
      orderNumber: "ORD-001",
      status: "confirmed",
      alreadyLinked: false,
    });
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { line_user_id: "line-user-1" },
    });
  });

  it("is idempotent when the same LINE user is already linked", async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: "o1",
      order_number: "ORD-001",
      status: "shipped",
      line_user_id: "line-user-1",
      user: { phone: "0912-345-678" },
    });

    const result = await validateOrderNumber(
      "ORD-001",
      "王小美",
      "678",
      "line-user-1",
    );

    expect(result).toEqual({
      valid: true,
      orderId: "o1",
      orderNumber: "ORD-001",
      status: "shipped",
      alreadyLinked: true,
    });
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it("rejects a different LINE user for an already-linked order", async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: "o1",
      order_number: "ORD-001",
      status: "confirmed",
      line_user_id: "line-user-2",
      user: { phone: "0912-345-678" },
    });

    const result = await validateOrderNumber(
      "ORD-001",
      "王小美",
      "678",
      "line-user-1",
    );

    expect(result).toEqual({
      valid: false,
      error: "ALREADY_LINKED",
    });
  });

  it("rejects when the order cannot be resolved", async () => {
    prismaMock.order.findFirst.mockResolvedValue(null);

    const result = await validateOrderNumber(
      "ORD-404",
      "王小美",
      "678",
      "line-user-1",
    );

    expect(result).toEqual({
      valid: false,
      error: "INVALID_ORDER_ACCESS",
    });
  });

  it("rejects when the phone last 3 does not match", async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: "o1",
      order_number: "ORD-001",
      status: "confirmed",
      line_user_id: null,
      user: { phone: "0912-345-999" },
    });

    const result = await validateOrderNumber(
      "ORD-001",
      "王小美",
      "678",
      "line-user-1",
    );

    expect(result).toEqual({
      valid: false,
      error: "INVALID_ORDER_ACCESS",
    });
  });
});
