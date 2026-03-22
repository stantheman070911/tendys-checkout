import { sendLinePush, sendLineMulticast, type NotifyResult } from "@/lib/line/push";
import {
  sendOrderConfirmationEmail,
  sendShipmentEmail,
  sendProductArrivalEmail,
  sendOrderCancelledEmail,
} from "@/lib/notifications/email";
import { logNotification } from "@/lib/db/notification-logs";
import { formatCurrency, formatOrderItems } from "@/lib/utils";

// Re-export NotifyResult for consumers
export type { NotifyResult } from "@/lib/line/push";

// ─── Types ───────────────────────────────────────────────────

interface OrderForNotify {
  id: string;
  order_number: string;
  total_amount: number;
  shipping_fee?: number | null;
  line_user_id?: string | null;
  user?: { email?: string | null } | null;
}

interface ItemForNotify {
  product_name: string;
  quantity: number;
  subtotal: number;
}

interface CustomerForArrival {
  email?: string | null;
  line_user_id?: string | null;
}

// ─── Payment Confirmed ──────────────────────────────────────

export async function sendPaymentConfirmedNotifications(
  order: OrderForNotify,
  items: ItemForNotify[]
): Promise<{ line: NotifyResult; email: NotifyResult | null }> {
  // LINE — push to the specific user (skip if no line_user_id)
  const lineMsg = `\n訂單 ${order.order_number} 付款已確認\n${formatOrderItems(items)}\n金額: ${formatCurrency(order.total_amount)}`;
  let lineResult: NotifyResult;
  if (order.line_user_id) {
    lineResult = await sendLinePush(order.line_user_id, lineMsg);
  } else {
    lineResult = { success: false, error: "No LINE user linked to this order" };
  }
  await logNotification(
    order.id,
    "line",
    "payment_confirmed",
    lineResult.success ? "success" : "failed",
    lineResult.error
  );

  // Email
  let emailResult: NotifyResult | null = null;
  const email = order.user?.email;
  if (email) {
    emailResult = await sendOrderConfirmationEmail(email, order, items);
    await logNotification(
      order.id,
      "email",
      "payment_confirmed",
      emailResult.success ? "success" : "failed",
      emailResult.error
    );
  }

  return { line: lineResult, email: emailResult };
}

// ─── Shipment ────────────────────────────────────────────────

export async function sendShipmentNotifications(
  order: OrderForNotify,
  items: ItemForNotify[]
): Promise<{ line: NotifyResult; email: NotifyResult | null }> {
  // LINE — push to the specific user
  const lineMsg = `\n訂單 ${order.order_number} 已出貨\n${formatOrderItems(items)}`;
  let lineResult: NotifyResult;
  if (order.line_user_id) {
    lineResult = await sendLinePush(order.line_user_id, lineMsg);
  } else {
    lineResult = { success: false, error: "No LINE user linked to this order" };
  }
  await logNotification(
    order.id,
    "line",
    "shipment",
    lineResult.success ? "success" : "failed",
    lineResult.error
  );

  // Email
  let emailResult: NotifyResult | null = null;
  const email = order.user?.email;
  if (email) {
    emailResult = await sendShipmentEmail(email, order, items);
    await logNotification(
      order.id,
      "email",
      "shipment",
      emailResult.success ? "success" : "failed",
      emailResult.error
    );
  }

  return { line: lineResult, email: emailResult };
}

// ─── Order Cancelled ─────────────────────────────────────────

export async function sendOrderCancelledNotifications(
  order: OrderForNotify,
  items: ItemForNotify[],
  cancelReason?: string | null
): Promise<{ line: NotifyResult; email: NotifyResult | null }> {
  // LINE — push to the specific user
  const reasonText = cancelReason ? `\n原因: ${cancelReason}` : "";
  const lineMsg = `\n訂單 ${order.order_number} 已取消${reasonText}\n${formatOrderItems(items)}`;
  let lineResult: NotifyResult;
  if (order.line_user_id) {
    lineResult = await sendLinePush(order.line_user_id, lineMsg);
  } else {
    lineResult = { success: false, error: "No LINE user linked to this order" };
  }
  await logNotification(
    order.id,
    "line",
    "order_cancelled",
    lineResult.success ? "success" : "failed",
    lineResult.error
  );

  // Email
  let emailResult: NotifyResult | null = null;
  const email = order.user?.email;
  if (email) {
    emailResult = await sendOrderCancelledEmail(
      email,
      order,
      items,
      cancelReason
    );
    await logNotification(
      order.id,
      "email",
      "order_cancelled",
      emailResult.success ? "success" : "failed",
      emailResult.error
    );
  }

  return { line: lineResult, email: emailResult };
}

// ─── Product Arrival ─────────────────────────────────────────

export async function sendProductArrivalNotifications(
  productName: string,
  customers: CustomerForArrival[]
): Promise<{
  line: NotifyResult;
  emailResults: Array<{ email: string; result: NotifyResult }>;
}> {
  // LINE — multicast to all customers with linked LINE accounts
  const lineMsg = `\n【${productName}】已到達理貨中心，我們會盡快安排出貨！`;
  const lineUserIds = customers
    .map((c) => c.line_user_id)
    .filter((id): id is string => !!id);

  let lineResult: NotifyResult;
  if (lineUserIds.length > 0) {
    lineResult = await sendLineMulticast(lineUserIds, lineMsg);
  } else {
    lineResult = { success: false, error: "No customers have linked LINE accounts" };
  }
  await logNotification(
    null,
    "line",
    "product_arrival",
    lineResult.success ? "success" : "failed",
    lineResult.error
  );

  // Per-customer email — send concurrently, never stop on single failure
  const customersWithEmail = customers.filter(
    (c): c is CustomerForArrival & { email: string } => !!c.email
  );
  const settled = await Promise.allSettled(
    customersWithEmail.map(async (customer) => {
      const result = await sendProductArrivalEmail(customer.email, productName);
      await logNotification(
        null,
        "email",
        "product_arrival",
        result.success ? "success" : "failed",
        result.error
      );
      return { email: customer.email, result };
    })
  );
  const emailResults: Array<{ email: string; result: NotifyResult }> = [];
  for (const entry of settled) {
    if (entry.status === "fulfilled") {
      emailResults.push(entry.value);
    }
    // Rejected promises are swallowed — already logged individually
  }

  return { line: lineResult, emailResults };
}
