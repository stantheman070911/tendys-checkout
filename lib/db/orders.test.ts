import { beforeEach, describe, expect, it, vi } from "vitest";

const { txMock, prismaMock } = vi.hoisted(() => {
  const txMock = {
    order: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $executeRaw: vi.fn(),
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

const outboxMock = vi.hoisted(() => ({
  enqueuePaymentConfirmedNotificationsTx: vi.fn(),
  enqueueShipmentNotificationsTx: vi.fn(),
  enqueueOrderCancelledNotificationsTx: vi.fn(),
}));
vi.mock("@/lib/notifications/outbox", () => outboxMock);

import { batchConfirm, batchConfirmShipment } from "./orders";
import { cancelOrder } from "./orders";

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
    expect(outboxMock.enqueuePaymentConfirmedNotificationsTx).toHaveBeenCalledTimes(1);
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
    expect(outboxMock.enqueueShipmentNotificationsTx).toHaveBeenCalledTimes(1);
  });

  it("cancelOrder restores stock in product-id order to avoid deadlocks", async () => {
    txMock.order.findUnique.mockResolvedValue({
      id: "order-1",
      status: "pending_payment",
      cancel_reason: null,
      order_items: [
        { product_id: "product-b", quantity: 1 },
        { product_id: "product-a", quantity: 2 },
        { product_id: null, quantity: 99 },
      ],
      user: null,
    });
    txMock.order.update.mockResolvedValue({ id: "order-1" });
    txMock.$executeRaw.mockResolvedValue(1);

    const result = await cancelOrder("order-1", true, "客戶要求");

    expect(result).toMatchObject({
      changed: true,
      order: {
        id: "order-1",
        status: "cancelled",
        cancel_reason: "客戶要求",
      },
    });
    expect(txMock.$executeRaw).toHaveBeenCalledTimes(2);
    expect(txMock.$executeRaw.mock.calls[0]?.[2]).toBe("product-a");
    expect(txMock.$executeRaw.mock.calls[1]?.[2]).toBe("product-b");
    expect(outboxMock.enqueueOrderCancelledNotificationsTx).toHaveBeenCalledTimes(1);
  });
});
