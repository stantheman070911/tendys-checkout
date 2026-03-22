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
  quantity: number;
}

// Thrown inside $transaction to trigger rollback while carrying a user-facing message
class OrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderValidationError";
  }
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

      // 2. Validate round is open + check deadline + get shipping fee
      const round = await tx.round.findUnique({
        where: { id: data.round_id },
      });
      if (!round || !round.is_open) {
        throw new OrderValidationError("Round is not open");
      }
      if (round.deadline && new Date() > new Date(round.deadline)) {
        throw new OrderValidationError("This round has closed");
      }

      // 2.5 Load canonical products for authoritative pricing/validation
      const canonicalProducts = await tx.product.findMany({
        where: { id: { in: items.map((i) => i.product_id) } },
      });
      const productMap = new Map(canonicalProducts.map((p) => [p.id, p]));

      // 3a. Validate ALL products before any stock mutation
      for (const item of items) {
        const product = productMap.get(item.product_id);
        if (!product) {
          throw new OrderValidationError(`Product not found: ${item.product_id}`);
        }
        if (product.round_id !== data.round_id) {
          throw new OrderValidationError(`Product ${product.name} does not belong to this round`);
        }
        if (!product.is_active) {
          throw new OrderValidationError(`Product ${product.name} is no longer available`);
        }
      }

      // 3b. Atomic stock decrements + resolve line items
      const resolvedItems = [];
      let itemsTotal = 0;

      for (const item of items) {
        const product = productMap.get(item.product_id)!;

        const updated = await tx.$executeRaw`
          UPDATE products
          SET stock = CASE WHEN stock IS NOT NULL THEN stock - ${item.quantity} ELSE stock END
          WHERE id = ${item.product_id}::uuid AND (stock IS NULL OR stock >= ${item.quantity})
        `;
        if (updated === 0) {
          throw new OrderValidationError(`Insufficient stock for ${product.name}`);
        }

        const subtotal = product.price * item.quantity;
        itemsTotal += subtotal;
        resolvedItems.push({
          product_id: product.id,
          product_name: product.name,
          unit_price: product.price,
          quantity: item.quantity,
          subtotal,
        });
      }

      // 4. Calculate shipping fee (宅配 = empty pickup_location)
      const isDelivery = !data.pickup_location;
      const shippingFee =
        isDelivery && round.shipping_fee ? round.shipping_fee : null;

      // 5. Calculate total
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
            create: resolvedItems,
          },
        },
        include: { order_items: true },
      });

      return { order, deduplicated: false };
    });
  } catch (err) {
    // Validation errors → { error } return (transaction already rolled back)
    if (err instanceof OrderValidationError) {
      return { error: err.message };
    }
    // Safety net: submission_key unique violation (concurrent request)
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const existing = await findBySubmissionKey(submissionKey);
      if (existing) return { order: existing, deduplicated: true };
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

export async function getCustomersForArrivalNotification(
  productId: string,
  roundId: string
): Promise<{
  customerCount: number;
  lineUserIds: string[];
  emails: string[];
}> {
  const items = await prisma.orderItem.findMany({
    where: {
      product_id: productId,
      order: { round_id: roundId, status: { not: "cancelled" } },
    },
    include: {
      order: { include: { user: true } },
    },
  });

  // Dedupe delivery endpoints by value (per-order LINE linking means different
  // orders from the same user may have different link states)
  const lineUserIdSet = new Set<string>();
  const emailSet = new Set<string>();
  // Count unique customers by user_id (fall back to order.id for guest orders)
  const customerIdSet = new Set<string>();

  for (const item of items) {
    customerIdSet.add(item.order.user_id ?? item.order.id);

    const lineUserId = item.order.line_user_id;
    if (lineUserId) lineUserIdSet.add(lineUserId);

    const email = item.order.user?.email;
    if (email) emailSet.add(email.toLowerCase());
  }

  return {
    customerCount: customerIdSet.size,
    lineUserIds: Array.from(lineUserIdSet),
    emails: Array.from(emailSet),
  };
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
  try {
    return await prisma.order.update({
      where: { id: orderId, status: "pending_confirm" },
      data: { status: "confirmed", confirmed_at: new Date() },
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

export async function batchConfirm(orderIds: string[]) {
  return prisma.$transaction(async (tx) => {
    const pendingOrders = await tx.order.findMany({
      where: { id: { in: orderIds }, status: "pending_confirm" },
      select: { id: true },
    });

    const pendingIds = pendingOrders.map((order) => order.id);
    if (pendingIds.length === 0) {
      return [];
    }

    await tx.order.updateMany({
      where: { id: { in: pendingIds }, status: "pending_confirm" },
      data: { status: "confirmed", confirmed_at: new Date() },
    });

    return tx.order.findMany({
      where: { id: { in: pendingIds }, status: "confirmed" },
      include: { order_items: true, user: true },
    });
  });
}

export async function confirmShipment(orderId: string) {
  try {
    return await prisma.order.update({
      where: { id: orderId, status: "confirmed" },
      data: { status: "shipped", shipped_at: new Date() },
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

export async function batchConfirmShipment(orderIds: string[]) {
  return prisma.$transaction(async (tx) => {
    const confirmedOrders = await tx.order.findMany({
      where: { id: { in: orderIds }, status: "confirmed" },
      select: { id: true },
    });

    const confirmedIds = confirmedOrders.map((order) => order.id);
    if (confirmedIds.length === 0) {
      return [];
    }

    await tx.order.updateMany({
      where: { id: { in: confirmedIds }, status: "confirmed" },
      data: { status: "shipped", shipped_at: new Date() },
    });

    return tx.order.findMany({
      where: { id: { in: confirmedIds }, status: "shipped" },
      include: { order_items: true, user: true },
    });
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
    if (order.status === "cancelled") {
      return { order, changed: false as const };
    }

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

    const cancelled = { ...order, status: "cancelled" as const, cancel_reason: cancelReason || null };
    return { order: cancelled, changed: true as const };
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
