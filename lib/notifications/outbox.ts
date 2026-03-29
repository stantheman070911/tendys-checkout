import { Prisma } from "@prisma/client";
import {
  createNotificationJobs,
  createNotificationJobsTx,
  type CreateNotificationJobInput,
} from "@/lib/db/notification-jobs";
import { logNotification, logNotificationTx } from "@/lib/db/notification-logs";
import type { NotificationType } from "@/types";

type TxClient = Prisma.TransactionClient;

interface NotificationOrder {
  id: string;
  round_id: string | null;
  order_number: string;
  total_amount: number;
  shipping_fee: number | null;
  confirmed_at?: Date | null;
  shipped_at?: Date | null;
  cancel_reason?: string | null;
  line_user_id?: string | null;
  user?: { email?: string | null } | null;
  order_items: Array<{
    product_name: string;
    quantity: number;
    subtotal: number;
  }>;
}

function buildOrderPayload(order: NotificationOrder) {
  return {
    orderNumber: order.order_number,
    totalAmount: order.total_amount,
    shippingFee: order.shipping_fee,
    cancelReason: order.cancel_reason ?? null,
    items: order.order_items.map((item) => ({
      product_name: item.product_name,
      quantity: item.quantity,
      subtotal: item.subtotal,
    })),
  } satisfies Prisma.InputJsonObject;
}

function normalizeRecipientEmail(email: string) {
  return email.trim().toLowerCase();
}

async function logMissingLineRecipientTx(
  tx: TxClient,
  order: NotificationOrder,
  type: NotificationType,
) {
  await logNotificationTx(tx, {
    orderId: order.id,
    roundId: order.round_id,
    channel: "line",
    type,
    status: "skipped",
  });
}

function buildOrderJobs(
  order: NotificationOrder,
  type: NotificationType,
  uniqueAt: string,
) {
  const payload = buildOrderPayload(order);
  const jobs: CreateNotificationJobInput[] = [];

  if (order.line_user_id) {
    jobs.push({
      orderId: order.id,
      roundId: order.round_id,
      recipient: order.line_user_id,
      channel: "line",
      type,
      payload,
      dedupeKey: `${type}:line:${order.id}:${uniqueAt}:${order.line_user_id}`,
    });
  }

  const email = order.user?.email ? normalizeRecipientEmail(order.user.email) : null;
  if (email) {
    jobs.push({
      orderId: order.id,
      roundId: order.round_id,
      recipient: email,
      channel: "email",
      type,
      payload,
      dedupeKey: `${type}:email:${order.id}:${uniqueAt}:${email}`,
    });
  }

  return jobs;
}

export async function enqueuePaymentConfirmedNotificationsTx(
  tx: TxClient,
  order: NotificationOrder,
) {
  const confirmedAt = order.confirmed_at?.toISOString();
  if (!confirmedAt) {
    throw new Error("Confirmed order is missing confirmed_at");
  }

  if (!order.line_user_id) {
    await logMissingLineRecipientTx(tx, order, "payment_confirmed");
  }

  return createNotificationJobsTx(
    tx,
    buildOrderJobs(order, "payment_confirmed", confirmedAt),
  );
}

export async function enqueueShipmentNotificationsTx(
  tx: TxClient,
  order: NotificationOrder,
) {
  const shippedAt = order.shipped_at?.toISOString();
  if (!shippedAt) {
    throw new Error("Shipped order is missing shipped_at");
  }

  if (!order.line_user_id) {
    await logMissingLineRecipientTx(tx, order, "shipment");
  }

  return createNotificationJobsTx(tx, buildOrderJobs(order, "shipment", shippedAt));
}

export async function enqueueOrderCancelledNotificationsTx(
  tx: TxClient,
  order: NotificationOrder,
) {
  const cancelReason = order.cancel_reason ?? "";

  if (!order.line_user_id) {
    await logMissingLineRecipientTx(tx, order, "order_cancelled");
  }

  return createNotificationJobsTx(
    tx,
    buildOrderJobs(order, "order_cancelled", cancelReason),
  );
}

export async function enqueueProductArrivalNotifications(input: {
  productId: string;
  productName: string;
  roundId: string;
  lineUserIds: string[];
  emails: string[];
}) {
  const payload = {
    productName: input.productName,
  } satisfies Prisma.InputJsonObject;

  if (input.lineUserIds.length === 0) {
    await logNotification({
      roundId: input.roundId,
      productId: input.productId,
      channel: "line",
      type: "product_arrival",
      status: "skipped",
    });
  }

  const jobs: CreateNotificationJobInput[] = [
    ...input.lineUserIds.map((lineUserId) => ({
      roundId: input.roundId,
      productId: input.productId,
      recipient: lineUserId,
      channel: "line" as const,
      type: "product_arrival" as const,
      payload,
      dedupeKey: `product_arrival:line:${input.roundId}:${input.productId}:${lineUserId}`,
    })),
    ...input.emails.map((email) => {
      const normalized = normalizeRecipientEmail(email);
      return {
        roundId: input.roundId,
        productId: input.productId,
        recipient: normalized,
        channel: "email" as const,
        type: "product_arrival" as const,
        payload,
        dedupeKey: `product_arrival:email:${input.roundId}:${input.productId}:${normalized}`,
      };
    }),
  ];

  return createNotificationJobs(jobs);
}
