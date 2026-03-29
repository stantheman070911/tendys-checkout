import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { NotificationChannel, NotificationType } from "@/types";

export interface LogNotificationPayload {
  orderId?: string | null;
  roundId?: string | null;
  productId?: string | null;
  channel: NotificationChannel;
  type: NotificationType;
  status: "success" | "skipped" | "failed";
  errorMessage?: string | null;
}

async function createNotificationLog(
  client: Prisma.TransactionClient | typeof prisma,
  payload: LogNotificationPayload,
) {
  return client.notificationLog.create({
    data: {
      order_id: payload.orderId ?? null,
      round_id: payload.roundId ?? null,
      product_id: payload.productId ?? null,
      channel: payload.channel,
      type: payload.type,
      status: payload.status,
      error_message: payload.errorMessage ?? null,
    },
  });
}

export async function logNotification(payload: LogNotificationPayload) {
  return createNotificationLog(prisma, payload);
}

export async function logNotificationTx(
  tx: Prisma.TransactionClient,
  payload: LogNotificationPayload,
) {
  return createNotificationLog(tx, payload);
}

export async function getLogsByOrder(orderId: string) {
  return prisma.notificationLog.findMany({
    where: { order_id: orderId },
    orderBy: { created_at: "desc" },
  });
}

export async function getLogsByRound(roundId: string) {
  return prisma.notificationLog.findMany({
    where: {
      OR: [{ round_id: roundId }, { order: { round_id: roundId } }],
    },
    orderBy: { created_at: "desc" },
  });
}

export async function getNotificationSummaryByRound(roundId: string) {
  return prisma.notificationLog.groupBy({
    by: ["type", "channel", "status"],
    where: {
      OR: [{ round_id: roundId }, { order: { round_id: roundId } }],
    },
    _count: { _all: true },
  });
}
