// Sends order status notifications to individual LINE users.
// Called by your admin panel or backend when order status changes.

import { getOrderById, updateOrderStatus } from "../db/order";

// Assumes LINE Push API client exists at lib/line/client.ts (same pattern as project-guochenwei)
import { lineClient } from "./client";

// ─────────────────────────────────────────────────────────────────────────────
// Notification templates
// ─────────────────────────────────────────────────────────────────────────────

const NOTIFICATION_MESSAGES = {
  SHIPPED: (name: string, trackingNumber?: string) => {
    const base = `${name} 你好！\n\n你的訂單已出貨 🚚`;
    return trackingNumber
      ? `${base}\n\n追蹤號碼：${trackingNumber}`
      : base;
  },

  DELIVERED: (name: string) =>
    `${name} 你好！\n\n你的包裹已送達 📦✅\n感謝你的購買，歡迎下次再來！`,
};

// ─────────────────────────────────────────────────────────────────────────────
// Notify functions
// ─────────────────────────────────────────────────────────────────────────────

export type NotifyShippedInput = {
  orderId: string;
  trackingNumber?: string;
};

/**
 * Notify the buyer that their order has shipped.
 * Updates order status to SHIPPED.
 * Returns false if the order has no linked LINE user (user never pasted the code).
 */
export async function notifyShipped(input: NotifyShippedInput): Promise<boolean> {
  const order = await getOrderById(input.orderId);

  if (!order) {
    console.error(`[notifyShipped] Order ${input.orderId} not found`);
    return false;
  }

  if (!order.line_user_id) {
    console.warn(`[notifyShipped] Order ${input.orderId} has no linked LINE user — skipping push`);
    return false;
  }

  const message = NOTIFICATION_MESSAGES.SHIPPED(order.name, input.trackingNumber);

  try {
    await lineClient.pushMessage({
      to: order.line_user_id,
      messages: [{ type: "text", text: message }],
    });

    await updateOrderStatus(input.orderId, "SHIPPED");
    return true;
  } catch (err) {
    console.error(`[notifyShipped] Failed to push LINE message for order ${input.orderId}:`, err);
    return false;
  }
}

/**
 * Notify the buyer that their order has been delivered.
 * Updates order status to DELIVERED.
 */
export async function notifyDelivered(orderId: string): Promise<boolean> {
  const order = await getOrderById(orderId);

  if (!order) {
    console.error(`[notifyDelivered] Order ${orderId} not found`);
    return false;
  }

  if (!order.line_user_id) {
    console.warn(`[notifyDelivered] Order ${orderId} has no linked LINE user — skipping push`);
    return false;
  }

  const message = NOTIFICATION_MESSAGES.DELIVERED(order.name);

  try {
    await lineClient.pushMessage({
      to: order.line_user_id,
      messages: [{ type: "text", text: message }],
    });

    await updateOrderStatus(orderId, "DELIVERED");
    return true;
  } catch (err) {
    console.error(`[notifyDelivered] Failed to push LINE message for order ${orderId}:`, err);
    return false;
  }
}
