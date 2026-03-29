import {
  sendOrderCancelledEmail,
  sendOrderConfirmationEmail,
  sendProductArrivalEmail,
  sendShipmentEmail,
} from "@/lib/notifications/email";
import { sendLinePush, type NotifyResult } from "@/lib/line/push";
import { formatCurrency, formatOrderItems } from "@/lib/utils";
import type { ClaimedNotificationJob } from "@/lib/db/notification-jobs";
import type { NotificationChannel, NotificationType } from "@/types";

interface OrderNotificationPayload {
  orderNumber: string;
  totalAmount: number;
  shippingFee: number | null;
  cancelReason?: string | null;
  items: Array<{
    product_name: string;
    quantity: number;
    subtotal: number;
  }>;
}

interface ProductArrivalPayload {
  productName: string;
}

function isOrderPayload(
  payload: unknown,
): payload is OrderNotificationPayload {
  return (
    !!payload &&
    typeof payload === "object" &&
    "orderNumber" in payload &&
    "items" in payload
  );
}

function isProductArrivalPayload(
  payload: unknown,
): payload is ProductArrivalPayload {
  return (
    !!payload &&
    typeof payload === "object" &&
    "productName" in payload
  );
}

function buildLineMessage(
  type: NotificationType,
  payload: unknown,
) {
  if (type === "product_arrival" && isProductArrivalPayload(payload)) {
    return `\n【${payload.productName}】已到達理貨中心，我們會盡快安排出貨！`;
  }

  if (!isOrderPayload(payload)) {
    throw new Error("Invalid order notification payload");
  }

  switch (type) {
    case "payment_confirmed":
      return `\n訂單 ${payload.orderNumber} 付款已確認\n${formatOrderItems(payload.items)}\n金額: ${formatCurrency(payload.totalAmount)}`;
    case "shipment":
      return `\n訂單 ${payload.orderNumber} 已出貨\n${formatOrderItems(payload.items)}`;
    case "order_cancelled": {
      const reasonText = payload.cancelReason ? `\n原因: ${payload.cancelReason}` : "";
      return `\n訂單 ${payload.orderNumber} 已取消${reasonText}\n${formatOrderItems(payload.items)}`;
    }
    default:
      throw new Error(`Unsupported LINE notification type: ${type}`);
  }
}

async function deliverEmail(
  type: NotificationType,
  recipient: string,
  payload: unknown,
): Promise<NotifyResult> {
  if (type === "product_arrival" && isProductArrivalPayload(payload)) {
    return sendProductArrivalEmail(recipient, payload.productName);
  }

  if (!isOrderPayload(payload)) {
    throw new Error("Invalid order notification payload");
  }

  switch (type) {
    case "payment_confirmed":
      return sendOrderConfirmationEmail(recipient, {
        order_number: payload.orderNumber,
        total_amount: payload.totalAmount,
        shipping_fee: payload.shippingFee,
      }, payload.items);
    case "shipment":
      return sendShipmentEmail(recipient, {
        order_number: payload.orderNumber,
      }, payload.items);
    case "order_cancelled":
      return sendOrderCancelledEmail(
        recipient,
        {
          order_number: payload.orderNumber,
          total_amount: payload.totalAmount,
          shipping_fee: payload.shippingFee,
        },
        payload.items,
        payload.cancelReason,
      );
    default:
      throw new Error(`Unsupported email notification type: ${type}`);
  }
}

export async function deliverNotificationJob(
  job: ClaimedNotificationJob,
): Promise<NotifyResult> {
  const payload = job.payload as unknown;

  if (job.channel === "line") {
    return sendLinePush(job.recipient, buildLineMessage(job.type, payload));
  }

  if (job.channel === "email") {
    return deliverEmail(job.type, job.recipient, payload);
  }

  throw new Error(`Unsupported notification channel: ${job.channel}`);
}
