import {
  summarizeNotificationCounts,
  type NotificationTypeSummary,
} from "@/lib/admin/notification-summary";
import {
  getNotificationSummaryByRound,
} from "@/lib/db/notification-logs";
import { listFailedNotificationJobsByRound } from "@/lib/db/notification-jobs";
import {
  getRoundOrderStatusCounts,
  getRoundProductDemand,
  getRoundRevenueTotal,
} from "@/lib/db/orders";
import { listDashboardByRound } from "@/lib/db/products";
import type {
  AdminDashboardProductRow,
  AdminNotificationFailureRow,
  NotificationChannel,
  NotificationLogStatus,
  NotificationType,
  OrderStatus,
} from "@/types";

export interface AdminDashboardSummary {
  counts: Partial<Record<OrderStatus, number>>;
  totalOrders: number;
  activeOrders: number;
  totalRevenue: number;
  productRows: AdminDashboardProductRow[];
  notificationSummary: NotificationTypeSummary[];
  failedNotificationJobs: AdminNotificationFailureRow[];
}

export async function getAdminDashboardSummary(
  roundId: string,
): Promise<AdminDashboardSummary> {
  const [
    statusCounts,
    totalRevenue,
    products,
    productDemand,
    notificationCounts,
    failedNotificationJobs,
  ] =
    await Promise.all([
      getRoundOrderStatusCounts(roundId),
      getRoundRevenueTotal(roundId),
      listDashboardByRound(roundId),
      getRoundProductDemand(roundId),
      getNotificationSummaryByRound(roundId),
      listFailedNotificationJobsByRound(roundId),
    ]);

  const counts = Object.fromEntries(
    statusCounts.map((entry: { status: string; _count: { _all: number } }) => [
      entry.status,
      entry._count._all,
    ]),
  ) as Partial<Record<OrderStatus, number>>;
  const totalOrders = statusCounts.reduce(
    (sum: number, entry: { _count: { _all: number } }) =>
      sum + entry._count._all,
    0,
  );
  const activeOrders = totalOrders - (counts.cancelled ?? 0);

  const demandByProductId = new Map<
    string,
    {
      name: string;
      qty: number;
      revenue: number;
    }
  >();

  for (const demand of productDemand) {
    if (!demand.product_id) {
      continue;
    }

    demandByProductId.set(demand.product_id, {
      name: demand.product_name,
      qty: demand._sum.quantity ?? 0,
      revenue: demand._sum.subtotal ?? 0,
    });
  }

  const productRows: AdminDashboardProductRow[] = products.map((product: {
    id: string;
    name: string;
    unit: string;
    supplier?: { name: string | null } | null;
  }) => {
    const demand = demandByProductId.get(product.id);
    demandByProductId.delete(product.id);

    return {
      productId: product.id,
      name: product.name,
      supplierName: product.supplier?.name ?? null,
      unit: product.unit,
      qty: demand?.qty ?? 0,
      revenue: demand?.revenue ?? 0,
    };
  });

  for (const [productId, demand] of demandByProductId) {
    productRows.push({
      productId,
      name: demand.name,
      supplierName: null,
      unit: "份",
      qty: demand.qty,
      revenue: demand.revenue,
    });
  }

  const notificationSummary = summarizeNotificationCounts(
    notificationCounts.map((entry: {
      type: string;
      channel: string;
      status: string;
      _count: { _all: number };
    }) => ({
      type: entry.type as NotificationType,
      channel: entry.channel as NotificationChannel,
      status: entry.status as NotificationLogStatus,
      count: entry._count._all,
    })),
  );

  return {
    counts,
    totalOrders,
    activeOrders,
    totalRevenue,
    productRows,
    notificationSummary,
    failedNotificationJobs: failedNotificationJobs.map((job: {
      id: string;
      recipient: string;
      channel: string;
      type: string;
      last_error: string | null;
      attempt_count: number;
      created_at: Date;
    }) => ({
      id: job.id,
      recipient: job.recipient,
      channel: job.channel as NotificationChannel,
      type: job.type as NotificationType,
      last_error: job.last_error,
      attempt_count: job.attempt_count,
      created_at: job.created_at.toISOString(),
    })),
  };
}
