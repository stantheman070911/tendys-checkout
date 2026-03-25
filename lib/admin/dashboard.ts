import {
  summarizeNotificationCounts,
  type NotificationTypeSummary,
} from "@/lib/admin/notification-summary";
import { getNotificationSummaryByRound } from "@/lib/db/notification-logs";
import {
  getRoundOrderStatusCounts,
  getRoundProductDemand,
  getRoundRevenueTotal,
} from "@/lib/db/orders";
import { listDashboardByRound } from "@/lib/db/products";
import type {
  AdminDashboardProductRow,
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
}

export async function getAdminDashboardSummary(
  roundId: string,
): Promise<AdminDashboardSummary> {
  const [statusCounts, totalRevenue, products, productDemand, notificationCounts] =
    await Promise.all([
      getRoundOrderStatusCounts(roundId),
      getRoundRevenueTotal(roundId),
      listDashboardByRound(roundId),
      getRoundProductDemand(roundId),
      getNotificationSummaryByRound(roundId),
    ]);

  const counts = Object.fromEntries(
    statusCounts.map((entry) => [entry.status, entry._count._all]),
  ) as Partial<Record<OrderStatus, number>>;
  const totalOrders = statusCounts.reduce(
    (sum, entry) => sum + entry._count._all,
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

  const productRows: AdminDashboardProductRow[] = products.map((product) => {
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
    notificationCounts.map((entry) => ({
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
  };
}
