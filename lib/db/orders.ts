import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

// ─── Order Creation ──────────────────────────────────────────

interface CreateOrderData {
  round_id: string;
  user_id: string;
  pickup_location: string;
  note?: string;
}

interface CreateOrderItem {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export async function createWithItems(
  data: CreateOrderData,
  items: CreateOrderItem[],
  submissionKey: string
) {
  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Dedup check
      const existing = await tx.order.findUnique({
        where: { submission_key: submissionKey },
        include: { order_items: true },
      });
      if (existing) return { order: existing, deduplicated: true };

      // 2. Validate round is open + get shipping fee
      const round = await tx.round.findUnique({
        where: { id: data.round_id },
      });
      if (!round || !round.is_open) {
        return { error: "Round is not open" };
      }

      // 3. Atomic stock decrement for each item
      for (const item of items) {
        const updated = await tx.$executeRaw`
          UPDATE products
          SET stock = CASE WHEN stock IS NOT NULL THEN stock - ${item.quantity} ELSE stock END
          WHERE id = ${item.product_id}::uuid AND (stock IS NULL OR stock >= ${item.quantity})
        `;
        if (updated === 0) {
          throw new Error(`Insufficient stock for ${item.product_name}`);
        }
      }

      // 4. Calculate shipping fee (宅配 = empty pickup_location)
      const isDelivery = !data.pickup_location;
      const shippingFee =
        isDelivery && round.shipping_fee ? round.shipping_fee : null;

      // 5. Calculate total
      const itemsTotal = items.reduce((sum, i) => sum + i.subtotal, 0);
      const totalAmount = itemsTotal + (shippingFee ?? 0);

      // 6. Create order + items
      const order = await tx.order.create({
        data: {
          user_id: data.user_id,
          round_id: data.round_id,
          total_amount: totalAmount,
          shipping_fee: shippingFee,
          pickup_location: data.pickup_location || null,
          note: data.note || null,
          submission_key: submissionKey,
          order_items: {
            create: items.map((i) => ({
              product_id: i.product_id,
              product_name: i.product_name,
              unit_price: i.unit_price,
              quantity: i.quantity,
              subtotal: i.subtotal,
            })),
          },
        },
        include: { order_items: true },
      });

      return { order, deduplicated: false };
    });
  } catch (err) {
    // Safety net: submission_key unique violation (concurrent request)
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const existing = await findBySubmissionKey(submissionKey);
      if (existing) return { order: existing, deduplicated: true };
    }
    // Stock error — return as error message
    if (err instanceof Error && err.message.startsWith("Insufficient stock")) {
      return { error: err.message };
    }
    throw err;
  }
}

// ─── Query ───────────────────────────────────────────────────

export async function findBySubmissionKey(key: string) {
  return prisma.order.findUnique({
    where: { submission_key: key },
    include: { order_items: true },
  });
}

export async function getOrderWithItems(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { order_items: true, user: true, round: true },
  });
}

export async function findByNicknameOrOrderNumber(query: string) {
  return prisma.order.findMany({
    where: {
      OR: [{ order_number: query }, { user: { nickname: query } }],
    },
    include: { order_items: true, user: true },
    orderBy: { created_at: "desc" },
  });
}

export async function listByRound(roundId: string, statusFilter?: string) {
  return prisma.order.findMany({
    where: {
      round_id: roundId,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: { order_items: true, user: true },
    orderBy: { created_at: "desc" },
  });
}

export async function listConfirmedByRound(roundId: string) {
  return listByRound(roundId, "confirmed");
}

export async function getOrdersByProduct(productId: string, roundId: string) {
  const items = await prisma.orderItem.findMany({
    where: {
      product_id: productId,
      order: { round_id: roundId, status: { not: "cancelled" } },
    },
    include: {
      order: { include: { user: true } },
    },
  });

  return items.map((item) => ({
    product_id: item.product_id,
    product_name: item.product_name,
    nickname: item.order.user?.nickname ?? "",
    recipient_name: item.order.user?.recipient_name ?? null,
    phone: item.order.user?.phone ?? null,
    quantity: item.quantity,
    subtotal: item.subtotal,
    order_number: item.order.order_number,
    status: item.order.status,
    pickup_location: item.order.pickup_location,
    round_id: item.order.round_id,
  }));
}

// ─── Status Mutations ────────────────────────────────────────

export async function reportPayment(
  orderId: string,
  amount: number,
  last5: string
) {
  try {
    return await prisma.order.update({
      where: { id: orderId, status: "pending_payment" },
      data: {
        status: "pending_confirm",
        payment_amount: amount,
        payment_last5: last5,
        payment_reported_at: new Date(),
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return null;
    }
    throw err;
  }
}

export async function confirmOrder(orderId: string) {
  return prisma.order.update({
    where: { id: orderId },
    data: { status: "confirmed", confirmed_at: new Date() },
    include: { order_items: true, user: true },
  });
}

export async function batchConfirm(orderIds: string[]) {
  await prisma.order.updateMany({
    where: { id: { in: orderIds }, status: "pending_confirm" },
    data: { status: "confirmed", confirmed_at: new Date() },
  });
  return prisma.order.findMany({
    where: { id: { in: orderIds }, status: "confirmed" },
    include: { order_items: true, user: true },
  });
}

export async function confirmShipment(orderId: string) {
  return prisma.order.update({
    where: { id: orderId },
    data: { status: "shipped", shipped_at: new Date() },
    include: { order_items: true, user: true },
  });
}

export async function batchConfirmShipment(orderIds: string[]) {
  await prisma.order.updateMany({
    where: { id: { in: orderIds }, status: "confirmed" },
    data: { status: "shipped", shipped_at: new Date() },
  });
  return prisma.order.findMany({
    where: { id: { in: orderIds }, status: "shipped" },
    include: { order_items: true, user: true },
  });
}

export async function cancelOrder(
  orderId: string,
  isAdmin?: boolean,
  cancelReason?: string
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { order_items: true, user: true },
    });
    if (!order) return null;
    if (order.status === "cancelled") return order;

    // User can only cancel pending_payment; admin can cancel any status
    if (!isAdmin && order.status !== "pending_payment") {
      return { error: "User can only cancel pending_payment orders" };
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "cancelled",
        cancel_reason: cancelReason || null,
      },
    });

    // Restore stock for each item (skip for shipped orders — product already sent)
    if (order.status !== "shipped") {
      for (const item of order.order_items) {
        if (item.product_id) {
          await tx.$executeRaw`
            UPDATE products
            SET stock = CASE WHEN stock IS NOT NULL THEN stock + ${item.quantity} ELSE stock END
            WHERE id = ${item.product_id}::uuid
          `;
        }
      }
    }

    return { ...order, status: "cancelled" as const, cancel_reason: cancelReason || null };
  });
}

// ─── Quick Confirm (POS Cash Payment) ────────────────────────

export async function quickConfirm(orderId: string, paymentAmount: number) {
  try {
    return await prisma.order.update({
      where: { id: orderId, status: "pending_payment" },
      data: {
        status: "confirmed",
        payment_amount: paymentAmount,
        payment_last5: "CASH",
        payment_reported_at: new Date(),
        confirmed_at: new Date(),
      },
      include: { order_items: true, user: true },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return null;
    }
    throw err;
  }
}
