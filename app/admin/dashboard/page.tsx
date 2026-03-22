"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import { ADMIN_BASE, STATUS_LABELS } from "@/constants";
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
  const { adminFetch } = useAdminFetch();
  const [round, setRound] = useState<Round | null>(null);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [products, setProducts] = useState<ProductWithProgress[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      // Get open round first
      const roundsData = await adminFetch<{ rounds: Round[] }>("/api/rounds?all=true");
      const openRound = roundsData.rounds.find((r) => r.is_open);
      if (!openRound) {
        setLoading(false);
        return;
      }
      setRound(openRound);

      // Fetch orders, products, logs in parallel
      const [ordersData, productsData, logsData] = await Promise.all([
        adminFetch<{ orders: OrderWithItems[] }>(
          `/api/orders?roundId=${openRound.id}`
        ),
        adminFetch<{ products: ProductWithProgress[] }>(
          `/api/products?roundId=${openRound.id}&all=true`
        ),
        adminFetch<{ logs: NotificationLog[] }>(
          `/api/notification-logs?roundId=${openRound.id}`
        ),
      ]);

      setOrders(ordersData.orders);
      setProducts(productsData.products);
      setLogs(logsData.logs);
    } catch {
      // silent — user will see empty state
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
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
  const pendingConfirm = orders.filter((o) => o.status === "pending_confirm").length;
  const pendingPayment = orders.filter((o) => o.status === "pending_payment").length;
  const confirmed = orders.filter((o) => o.status === "confirmed").length;
  const shipped = orders.filter((o) => o.status === "shipped").length;

  const stats: Array<[string, string, (() => void) | null]> = [
    ["總訂單", `${totalOrders}`, null],
    ["總營收", formatCurrency(totalRevenue), null],
    ["待確認", `${pendingConfirm}`, () => router.push(`${ADMIN_BASE}/orders?status=pending_confirm`)],
    ["待付款", `${pendingPayment}`, () => router.push(`${ADMIN_BASE}/orders?status=pending_payment`)],
    ["待出貨", `${confirmed}`, () => router.push(`${ADMIN_BASE}/shipments`)],
    ["已出貨", `${shipped}`, () => router.push(`${ADMIN_BASE}/orders?status=shipped`)],
  ];

  // Flatten order items from non-cancelled orders for aggregation
  const allItems = nonCancelled.flatMap((o) =>
    o.order_items.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }))
  );

  // Group logs by order for notification summary
  const orderLogs = new Map<
    string,
    { orderNumber: string; nickname: string; results: NotificationLog[] }
  >();
  for (const log of logs) {
    if (!log.order_id) continue;
    const order = orders.find((o) => o.id === log.order_id);
    if (!order) continue;
    const existing = orderLogs.get(log.order_id);
    if (existing) {
      existing.results.push(log);
    } else {
      orderLogs.set(log.order_id, {
        orderNumber: order.order_number,
        nickname: order.user?.nickname ?? "—",
        results: [log],
      });
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-gray-700 text-sm">
        {round.name}
        {round.shipping_fee != null && ` · 宅配運費 ${formatCurrency(round.shipping_fee)}`}
      </h3>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-2">
        {stats.map(([label, value, fn], i) => (
          <div
            key={i}
            onClick={fn ?? undefined}
            className={`bg-white rounded-xl border p-3 text-center transition ${
              fn ? "cursor-pointer hover:border-indigo-400" : ""
            }`}
          >
            <div className="text-xs text-gray-400 mb-0.5">{label}</div>
            <div className="font-bold text-xl">{value}</div>
            {fn && <div className="text-xs text-indigo-400 mt-0.5">→</div>}
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
      {orderLogs.size > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <div className="font-medium text-sm mb-2 text-gray-700">通知狀態</div>
          {Array.from(orderLogs.values()).map((entry) => (
            <div
              key={entry.orderNumber}
              className="flex justify-between items-center text-xs py-1.5 border-b last:border-0"
            >
              <span className="text-gray-500">
                {entry.orderNumber} · {entry.nickname}
              </span>
              <div className="flex gap-1">
                {/* Group by type, show latest LINE + Email result */}
                {groupNotifResults(entry.results).map((g, i) => (
                  <span key={i} className="flex gap-0.5">
                    <span
                      className={`px-1 py-0.5 rounded text-xs ${
                        g.line === "success"
                          ? "bg-green-100 text-green-700"
                          : g.line === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      L{g.line === "success" ? "✓" : g.line === "failed" ? "✗" : "—"}
                    </span>
                    <span
                      className={`px-1 py-0.5 rounded text-xs ${
                        g.email === "success"
                          ? "bg-green-100 text-green-700"
                          : g.email === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      E{g.email === "success" ? "✓" : g.email === "failed" ? "✗" : "—"}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function groupNotifResults(
  results: NotificationLog[]
): Array<{ type: string; line: string | null; email: string | null }> {
  const byType = new Map<
    string,
    { type: string; line: string | null; email: string | null }
  >();
  for (const r of results) {
    const key = r.type;
    const existing = byType.get(key);
    if (!existing) {
      byType.set(key, {
        type: key,
        line: r.channel === "line" ? r.status : null,
        email: r.channel === "email" ? r.status : null,
      });
    } else {
      if (r.channel === "line") existing.line = r.status;
      if (r.channel === "email") existing.email = r.status;
    }
  }
  return Array.from(byType.values());
}
