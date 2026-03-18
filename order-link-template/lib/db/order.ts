// Database queries for Order and OrderCode models.
// Assumes a Prisma singleton at lib/db/prisma.ts (same pattern as project-guochenwei).

import { prisma } from "./prisma";
import type { Order, OrderCode, OrderStatus } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Order queries
// ─────────────────────────────────────────────────────────────────────────────

export type OrderItem = {
  name: string;
  qty: number;
  price: number;
};

export type CreateOrderInput = {
  name: string;
  phone?: string;
  items: OrderItem[];
  note?: string;
};

/** Create a new order. Status defaults to PENDING in the schema. */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  return prisma.order.create({
    data: {
      name: input.name,
      phone: input.phone ?? null,
      items: input.items,
      note: input.note ?? null,
    },
  });
}

export async function getOrderById(
  id: string
): Promise<(Order & { code: OrderCode | null }) | null> {
  return prisma.order.findUnique({
    where: { id },
    include: { code: true },
  });
}

/** Set line_user_id and flip status to LINKED. Called after successful code validation. */
export async function linkLineIdToOrder(
  orderId: string,
  lineUserId: string
): Promise<Order> {
  return prisma.order.update({
    where: { id: orderId },
    data: { line_user_id: lineUserId, status: "LINKED" },
  });
}

/** Update order status (e.g. SHIPPED, DELIVERED). */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<Order> {
  return prisma.order.update({
    where: { id: orderId },
    data: { status },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// OrderCode queries
// ─────────────────────────────────────────────────────────────────────────────

export type CreateCodeInput = {
  code: string;
  orderId: string;
  expiresAt: Date;
};

export async function createCode(input: CreateCodeInput): Promise<OrderCode> {
  return prisma.orderCode.create({
    data: {
      code: input.code,
      order_id: input.orderId,
      expires_at: input.expiresAt,
    },
  });
}

/** Look up a code and include its parent order. */
export async function getCodeByValue(
  code: string
): Promise<(OrderCode & { order: Order }) | null> {
  return prisma.orderCode.findUnique({
    where: { code },
    include: { order: true },
  });
}

/** Mark a code as used. Called inside a transaction in validate-order-code.ts. */
export async function markCodeUsed(codeId: string): Promise<void> {
  await prisma.orderCode.update({
    where: { id: codeId },
    data: { used: true },
  });
}
