import { prisma } from "@/lib/db/prisma";

export async function logNotification(
  orderId: string | null,
  channel: string,
  type: string,
  status: string,
  errorMessage?: string | null
) {
  return prisma.notificationLog.create({
    data: {
      order_id: orderId,
      channel,
      type,
      status,
      error_message: errorMessage ?? null,
    },
  });
}

export async function getLogsByOrder(orderId: string) {
  return prisma.notificationLog.findMany({
    where: { order_id: orderId },
    orderBy: { created_at: "desc" },
  });
}

export async function getLogsByRound(roundId: string) {
  return prisma.notificationLog.findMany({
    where: { order: { round_id: roundId } },
    orderBy: { created_at: "desc" },
  });
}
