import { prisma } from "../db/prisma";

// ─── Types ───────────────────────────────────────────────────

export type ValidationError = "NOT_FOUND" | "ALREADY_LINKED";

export interface ValidationSuccess {
  valid: true;
  orderId: string;
  orderNumber: string;
}

export interface ValidationFailure {
  valid: false;
  error: ValidationError;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

// ─── Function ────────────────────────────────────────────────

/**
 * Validate an order number submitted by a LINE user.
 *
 * On success:
 *   - Links lineUserId to the order record (order.line_user_id).
 *   - Returns { valid: true, orderId, orderNumber }.
 *
 * On failure:
 *   - Returns { valid: false, error } — never throws.
 */
export async function validateOrderNumber(
  orderNumber: string,
  lineUserId: string
): Promise<ValidationResult> {
  const order = await prisma.order.findUnique({
    where: { order_number: orderNumber },
  });

  if (!order) {
    return { valid: false, error: "NOT_FOUND" };
  }

  // Already linked to a different LINE user
  if (order.line_user_id && order.line_user_id !== lineUserId) {
    return { valid: false, error: "ALREADY_LINKED" };
  }

  // Already linked to this same user — success (idempotent)
  if (order.line_user_id === lineUserId) {
    return { valid: true, orderId: order.id, orderNumber: order.order_number };
  }

  // Link LINE user ID to the order
  await prisma.order.update({
    where: { id: order.id },
    data: { line_user_id: lineUserId },
  });

  return { valid: true, orderId: order.id, orderNumber: order.order_number };
}
