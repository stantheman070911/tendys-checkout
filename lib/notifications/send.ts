import {
  sendLinePush,
  sendLineMulticast,
  type NotifyResult,
} from "@/lib/line/push";
import {
  sendOrderConfirmationEmail,
  sendShipmentEmail,
  sendProductArrivalEmail,
  sendOrderCancelledEmail,
} from "@/lib/notifications/email";
import { mapWithConcurrency } from "@/lib/async";
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
  round_id?: string | null;
  line_user_id?: string | null;
  user?: { email?: string | null } | null;
}

interface ItemForNotify {
  product_name: string;
  quantity: number;
  subtotal: number;
}

interface ArrivalRecipients {
  lineUserIds: string[];
  emails: string[];
}

// ─── Payment Confirmed ──────────────────────────────────────

export async function sendPaymentConfirmedNotifications(
  order: OrderForNotify,
  items: ItemForNotify[],
): Promise<{ line: NotifyResult; email: NotifyResult | null }> {
  // LINE — push to the specific user (skip if no line_user_id)
  const lineMsg = `\n訂單 ${order.order_number} 付款已確認\n${formatOrderItems(items)}\n金額: ${formatCurrency(order.total_amount)}`;
  let lineResult: NotifyResult;
  let status: "success" | "skipped" | "failed" = "failed";
  if (order.line_user_id) {
    lineResult = await sendLinePush(order.line_user_id, lineMsg);
    status = lineResult.success ? "success" : "failed";
  } else {
    lineResult = { success: false, error: "No LINE user linked" };
    status = "skipped";
  }
  await logNotification({
    orderId: order.id,
    roundId: order.round_id,
    channel: "line",
    type: "payment_confirmed",
    status,
    errorMessage: status === "skipped" ? null : lineResult.error,
  });

  // Email
  let emailResult: NotifyResult | null = null;
  const email = order.user?.email;
  if (email) {
    emailResult = await sendOrderConfirmationEmail(email, order, items);
    await logNotification({
      orderId: order.id,
      roundId: order.round_id,
      channel: "email",
      type: "payment_confirmed",
      status: emailResult.success ? "success" : "failed",
      errorMessage: emailResult.error,
    });
  }

  return { line: lineResult, email: emailResult };
}

// ─── Shipment ────────────────────────────────────────────────

export async function sendShipmentNotifications(
  order: OrderForNotify,
  items: ItemForNotify[],
): Promise<{ line: NotifyResult; email: NotifyResult | null }> {
  // LINE — push to the specific user
  const lineMsg = `\n訂單 ${order.order_number} 已出貨\n${formatOrderItems(items)}`;
  let lineResult: NotifyResult;
  let status: "success" | "skipped" | "failed" = "failed";
  if (order.line_user_id) {
    lineResult = await sendLinePush(order.line_user_id, lineMsg);
    status = lineResult.success ? "success" : "failed";
  } else {
    lineResult = { success: false, error: "No LINE user linked" };
    status = "skipped";
  }
  await logNotification({
    orderId: order.id,
    roundId: order.round_id,
    channel: "line",
    type: "shipment",
    status,
    errorMessage: status === "skipped" ? null : lineResult.error,
  });

  // Email
  let emailResult: NotifyResult | null = null;
  const email = order.user?.email;
  if (email) {
    emailResult = await sendShipmentEmail(email, order, items);
    await logNotification({
      orderId: order.id,
      roundId: order.round_id,
      channel: "email",
      type: "shipment",
      status: emailResult.success ? "success" : "failed",
      errorMessage: emailResult.error,
    });
  }

  return { line: lineResult, email: emailResult };
}

// ─── Order Cancelled ─────────────────────────────────────────

export async function sendOrderCancelledNotifications(
  order: OrderForNotify,
  items: ItemForNotify[],
  cancelReason?: string | null,
): Promise<{ line: NotifyResult; email: NotifyResult | null }> {
  // LINE — push to the specific user
  const reasonText = cancelReason ? `\n原因: ${cancelReason}` : "";
  const lineMsg = `\n訂單 ${order.order_number} 已取消${reasonText}\n${formatOrderItems(items)}`;
  let lineResult: NotifyResult;
  let status: "success" | "skipped" | "failed" = "failed";
  if (order.line_user_id) {
    lineResult = await sendLinePush(order.line_user_id, lineMsg);
    status = lineResult.success ? "success" : "failed";
  } else {
    lineResult = { success: false, error: "No LINE user linked" };
    status = "skipped";
  }
  await logNotification({
    orderId: order.id,
    roundId: order.round_id,
    channel: "line",
    type: "order_cancelled",
    status,
    errorMessage: status === "skipped" ? null : lineResult.error,
  });

  // Email
  let emailResult: NotifyResult | null = null;
  const email = order.user?.email;
  if (email) {
    emailResult = await sendOrderCancelledEmail(
      email,
      order,
      items,
      cancelReason,
    );
    await logNotification({
      orderId: order.id,
      roundId: order.round_id,
      channel: "email",
      type: "order_cancelled",
      status: emailResult.success ? "success" : "failed",
      errorMessage: emailResult.error,
    });
  }

  return { line: lineResult, email: emailResult };
}

// ─── Product Arrival ─────────────────────────────────────────

export async function sendProductArrivalNotifications(
  productId: string,
  productName: string,
  roundId: string,
  recipients: ArrivalRecipients,
): Promise<{
  line: NotifyResult;
  emailResults: Array<{ email: string; result: NotifyResult }>;
}> {
  // LINE — multicast to all unique linked LINE accounts
  const lineMsg = `\n【${productName}】已到達理貨中心，我們會盡快安排出貨！`;

  let lineResult: NotifyResult;
  let lineStatus: "success" | "skipped" | "failed" = "failed";
  if (recipients.lineUserIds.length > 0) {
    lineResult = await sendLineMulticast(recipients.lineUserIds, lineMsg);
    lineStatus = lineResult.success ? "success" : "failed";
  } else {
    lineResult = {
      success: false,
      error: "No customers have linked LINE accounts",
    };
    lineStatus = "skipped";
  }
  await logNotification({
    roundId,
    productId,
    channel: "line",
    type: "product_arrival",
    status: lineStatus,
    errorMessage: lineStatus === "skipped" ? null : lineResult.error,
  });

  // Per-email — send in bounded batches, never stop on single failure
  const emailResults = await mapWithConcurrency(
    recipients.emails,
    10,
    async (email) => {
      const result =
        (await sendProductArrivalEmail(email, productName).catch((error) => ({
          success: false,
          error: error instanceof Error ? error.message : "Email send failed",
        }))) satisfies NotifyResult;
      await logNotification({
        roundId,
        productId,
        channel: "email",
        type: "product_arrival",
        status: result.success ? "success" : "failed",
        errorMessage: result.error,
      });
      return { email, result };
    },
  );

  return { line: lineResult, emailResults };
}
