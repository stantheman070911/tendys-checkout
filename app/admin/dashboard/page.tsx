"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAdminRound } from "@/contexts/AdminRoundContext";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import { ADMIN_BASE } from "@/constants";
import { summarizeNotificationLogs } from "@/lib/admin/notification-summary";
import { formatCurrency } from "@/lib/utils";
import { ProductAggregationTable } from "@/components/admin/ProductAggregationTable";
import type {
  Round,
  Order,
  OrderItem,
  NotificationLog,
  ProductWithProgress,
} from "@/types";

type OrderWithItems = Order & {
  order_items: OrderItem[];
  user: { nickname: string } | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const { round, loading: roundLoading } = useAdminRound();
  const { adminFetch } = useAdminFetch();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [products, setProducts] = useState<ProductWithProgress[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setError(null);
    if (!round) {
      setOrders([]);
      setProducts([]);
      setLogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [ordersData, productsData, logsData] = await Promise.all([
        adminFetch<{ orders: OrderWithItems[] }>(
          `/api/orders?roundId=${round.id}`,
        ),
        adminFetch<{ products: ProductWithProgress[] }>(
          `/api/products?roundId=${round.id}&all=true`,
        ),
        adminFetch<{ logs: NotificationLog[] }>(
          `/api/notification-logs?roundId=${round.id}`,
        ),
      ]);

      setOrders(ordersData.orders);
      setProducts(productsData.products);
      setLogs(logsData.logs);
    } catch (error) {
      setError(error instanceof Error ? error.message : "資料載入失敗");
    } finally {
      setLoading(false);
    }
  }, [adminFetch, round]);

  useEffect(() => {
    if (roundLoading) return;
    void fetchData();
  }, [fetchData, roundLoading]);

  if (loading || roundLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--forest))] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!round) {
    return (
      <div className="text-center py-20 text-gray-400">
        目前沒有進行中的團購。請先到「開團」頁面新開一團。
      </div>
    );
  }

  // Compute stats
  const nonCancelled = orders.filter((o) => o.status !== "cancelled");
  const totalOrders = orders.length;
  const totalRevenue = nonCancelled.reduce((s, o) => s + o.total_amount, 0);
  const pendingConfirm = orders.filter(
    (o) => o.status === "pending_confirm",
  ).length;
  const pendingPayment = orders.filter(
    (o) => o.status === "pending_payment",
  ).length;
  const confirmed = orders.filter((o) => o.status === "confirmed").length;
  const shipped = orders.filter((o) => o.status === "shipped").length;

  const stats: Array<[string, string, (() => void) | null]> = [
    ["總訂單", `${totalOrders}`, null],
    ["總營收", formatCurrency(totalRevenue), null],
    [
      "待確認",
      `${pendingConfirm}`,
      () => router.push(`${ADMIN_BASE}/orders?status=pending_confirm`),
    ],
    [
      "待付款",
      `${pendingPayment}`,
      () => router.push(`${ADMIN_BASE}/orders?status=pending_payment`),
    ],
    ["待出貨", `${confirmed}`, () => router.push(`${ADMIN_BASE}/shipments`)],
    [
      "已出貨",
      `${shipped}`,
      () => router.push(`${ADMIN_BASE}/orders?status=shipped`),
    ],
  ];

  // Flatten order items from non-cancelled orders for aggregation
  const allItems = nonCancelled.flatMap((o) =>
    o.order_items.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
    })),
  );

  const notificationSummary = summarizeNotificationLogs(logs);

  return (
    <div className="space-y-5">
      <section className="lux-panel-strong p-5 md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="lux-kicker">Live Round Overview</div>
            <h1 className="font-display text-3xl text-[hsl(var(--ink))] md:text-4xl">
              {round.name}
            </h1>
            <p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              掌握本輪訂單、營收、待確認付款與待出貨節奏。
              {round.shipping_fee != null &&
                ` 宅配運費目前為 ${formatCurrency(round.shipping_fee)}。`}
            </p>
          </div>
          <div className="lux-panel-muted p-4 text-right">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[hsl(var(--bronze))]">
              Active Orders
            </div>
            <div className="mt-2 font-display text-3xl text-[hsl(var(--ink))]">
              {nonCancelled.length}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {stats.map(([label, value, fn], i) => (
          <div
            key={i}
            onClick={fn ?? undefined}
            className={`lux-panel lux-card-hover p-4 ${
              fn ? "cursor-pointer" : ""
            }`}
          >
            <div className="text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--bronze))]">
              {label}
            </div>
            <div className="mt-3 font-display text-3xl text-[hsl(var(--ink))]">
              {value}
            </div>
            {fn && (
              <div className="mt-2 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                查看明細
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Product Aggregation */}
      <ProductAggregationTable
        products={products}
        orderItems={allItems}
        roundId={round.id}
        adminFetch={adminFetch}
      />

      {/* Notification Summary */}
      {notificationSummary.length > 0 && (
        <div className="lux-panel p-5">
          <div className="mb-3 font-display text-2xl text-[hsl(var(--ink))]">
            通知發送統計 (本團)
          </div>
          <div className="space-y-3">
            {notificationSummary.map((entry) => (
              <div
                key={entry.type}
                className="border-b border-[rgba(177,140,92,0.14)] pb-3 last:border-0 last:pb-0"
              >
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--bronze))]">
                  {entry.type}
                </div>
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  <div className="lux-panel-muted flex items-center justify-between rounded-[1rem] p-3">
                    <span className="font-medium text-[hsl(var(--muted-foreground))]">LINE</span>
                    <span>
                      <span className="mr-2 font-medium text-[rgb(65,98,61)]">
                        ✓ {entry.line.success}
                      </span>
                      <span className="mr-2 font-medium text-[rgb(140,67,56)]">
                        ✗ {entry.line.failed}
                      </span>
                      <span className="font-medium text-[hsl(var(--muted-foreground))]">
                        — {entry.line.skipped}
                      </span>
                    </span>
                  </div>
                  <div className="lux-panel-muted flex items-center justify-between rounded-[1rem] p-3">
                    <span className="font-medium text-[hsl(var(--muted-foreground))]">Email</span>
                    <span>
                      <span className="mr-2 font-medium text-[rgb(65,98,61)]">
                        ✓ {entry.email.success}
                      </span>
                      <span className="mr-2 font-medium text-[rgb(140,67,56)]">
                        ✗ {entry.email.failed}
                      </span>
                      <span className="font-medium text-[hsl(var(--muted-foreground))]">
                        — {entry.email.skipped}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
