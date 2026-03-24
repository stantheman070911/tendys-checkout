import { beforeEach, describe, expect, it, vi } from "vitest";

const { txMock, prismaMock } = vi.hoisted(() => {
  const txMock = {
    order: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  const prismaMock = {
    $transaction: vi.fn(async (callback: (tx: typeof txMock) => unknown) =>
      callback(txMock),
    ),
  };

  return { txMock, prismaMock };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

import { batchConfirm, batchConfirmShipment } from "./orders";

describe("batch order mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("batchConfirm only returns orders transitioned in this call", async () => {
    txMock.order.findMany
      .mockResolvedValueOnce([{ id: "pending-1" }])
      .mockResolvedValueOnce([
        {
          id: "pending-1",
          status: "confirmed",
          order_items: [],
          user: null,
        },
      ]);
    txMock.order.updateMany.mockResolvedValue({ count: 1 });

    const result = await batchConfirm(["already-confirmed", "pending-1"]);

    expect(txMock.order.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["pending-1"] }, status: "pending_confirm" },
      data: expect.objectContaining({ status: "confirmed" }),
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("pending-1");
  });

  it("batchConfirmShipment only returns orders transitioned in this call", async () => {
    txMock.order.findMany
      .mockResolvedValueOnce([{ id: "confirmed-1" }])
      .mockResolvedValueOnce([
        {
          id: "confirmed-1",
          status: "shipped",
          order_items: [],
          user: null,
        },
      ]);
    txMock.order.updateMany.mockResolvedValue({ count: 1 });

    const result = await batchConfirmShipment([
      "already-shipped",
      "confirmed-1",
    ]);

    expect(txMock.order.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["confirmed-1"] }, status: "confirmed" },
      data: expect.objectContaining({ status: "shipped" }),
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("confirmed-1");
  });
});
