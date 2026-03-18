// Validates an order code submitted by a LINE user.
// On success: marks code used, links LINE user ID to the order, flips status to LINKED.

import { getCodeByValue } from "../db/order";
import { prisma } from "../db/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ValidationError = "NOT_FOUND" | "USED" | "EXPIRED" | "ALREADY_LINKED";

export interface ValidationSuccess {
  valid: true;
  orderId: string;
  orderName: string; // buyer name, useful for confirmation message
}

export interface ValidationFailure {
  valid: false;
  error: ValidationError;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

// ─────────────────────────────────────────────────────────────────────────────
// Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate an order code submitted by a LINE user.
 *
 * On success:
 *   - Marks the code as used.
 *   - Links lineUserId to the order record.
 *   - Sets order status to LINKED.
 *   - Returns { valid: true, orderId, orderName }.
 *
 * On failure:
 *   - Returns { valid: false, error } — never throws.
 */
export async function validateOrderCode(
  code: string,
  lineUserId: string
): Promise<ValidationResult> {
  const record = await getCodeByValue(code.toUpperCase().trim());

  if (!record) {
    return { valid: false, error: "NOT_FOUND" };
  }

  if (record.used) {
    return { valid: false, error: "USED" };
  }

  if (record.expires_at < new Date()) {
    return { valid: false, error: "EXPIRED" };
  }

  // Guard: order already linked to a different LINE user
  if (record.order.line_user_id && record.order.line_user_id !== lineUserId) {
    return { valid: false, error: "ALREADY_LINKED" };
  }

  // Transaction: re-check inside TX to prevent race conditions, then commit
  const txResult = await prisma.$transaction(async (tx) => {
    const freshCode = await tx.orderCode.findUnique({
      where: { id: record.id },
    });

    if (!freshCode || freshCode.used) {
      return { valid: false, error: "USED" as const };
    }

    // Mark code used
    await tx.orderCode.update({
      where: { id: record.id },
      data: { used: true },
    });

    // Link LINE user ID and activate order
    await tx.order.update({
      where: { id: record.order_id },
      data: { line_user_id: lineUserId, status: "LINKED" },
    });

    return { valid: true as const };
  });

  if (!txResult.valid) {
    return { valid: false, error: txResult.error };
  }

  return { valid: true, orderId: record.order_id, orderName: record.order.name };
}
