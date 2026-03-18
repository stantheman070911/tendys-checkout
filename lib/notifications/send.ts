import { sendLineNotify, type NotifyResult } from "@/lib/notifications/line-notify";
import {
  sendOrderConfirmationEmail,
  sendShipmentEmail,
  sendProductArrivalEmail,
  sendOrderCancelledEmail,
} from "@/lib/notifications/email";
import { logNotification } from "@/lib/db/notification-logs";
import { formatCurrency, formatOrderItems } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────

interface OrderForNotify {
  id: string;
  order_number: string;
  total_amount: number;
  shipping_fee?: number | null;
  user?: { email?: string | null } | null;
}

interface ItemForNotify {
  product_name: string;
  quantity: number;
  subtotal: number;
}

interface CustomerForArrival {
  email?: string | null;
  orderId?: string | null;
}

// ─── Payment Confirmed ──────────────────────────────────────

export async function sendPaymentConfirmedNotifications(
  order: OrderForNotify,
  items: ItemForNotify[]
): Promise<{ line: NotifyResult; email: NotifyResult | null }> {
  // LINE
  const lineMsg = `\n訂單 ${order.order_number} 付款已確認\n${formatOrderItems(items)}\n金額: ${formatCurrency(order.total_amount)}`;
  const lineResult = await sendLineNotify(lineMsg);
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
  // LINE
  const lineMsg = `\n訂單 ${order.order_number} 已出貨\n${formatOrderItems(items)}`;
  const lineResult = await sendLineNotify(lineMsg);
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
  // LINE
  const reasonText = cancelReason ? `\n原因: ${cancelReason}` : "";
  const lineMsg = `\n訂單 ${order.order_number} 已取消${reasonText}\n${formatOrderItems(items)}`;
  const lineResult = await sendLineNotify(lineMsg);
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
  // One LINE message to the group
  const lineMsg = `\n【${productName}】已到達理貨中心，我們會盡快安排出貨！`;
  const lineResult = await sendLineNotify(lineMsg);
  await logNotification(
    null,
    "line",
    "product_arrival",
    lineResult.success ? "success" : "failed",
    lineResult.error
  );

  // Per-customer email — never stop on single failure
  const emailResults: Array<{ email: string; result: NotifyResult }> = [];
  for (const customer of customers) {
    if (!customer.email) continue;
    const result = await sendProductArrivalEmail(customer.email, productName);
    await logNotification(
      customer.orderId ?? null,
      "email",
      "product_arrival",
      result.success ? "success" : "failed",
      result.error
    );
    emailResults.push({ email: customer.email, result });
  }

  return { line: lineResult, emailResults };
}
