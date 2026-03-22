"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  const { adminFetch } = useAdminFetch();
  const [round, setRound] = useState<Round | null>(null);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [products, setProducts] = useState<ProductWithProgress[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setError(null);
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
    } catch (error) {
      setError(error instanceof Error ? error.message : "資料載入失敗");
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

  const notificationSummary = summarizeNotificationLogs(logs);

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
      {notificationSummary.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <div className="font-medium text-sm mb-3 text-gray-700">通知發送統計 (本團)</div>
          <div className="space-y-3">
            {notificationSummary.map((entry) => (
              <div key={entry.type} className="border-b last:border-0 pb-3 last:pb-0">
                <div className="text-xs font-bold text-gray-600 mb-1">{entry.type}</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-50 rounded p-1.5 flex justify-between items-center">
                    <span className="font-medium text-gray-500">LINE</span>
                    <span>
                      <span className="text-green-600 font-medium mr-2">✓ {entry.line.success}</span>
                      <span className="text-red-500 font-medium mr-2">✗ {entry.line.failed}</span>
                      <span className="text-gray-400 font-medium">— {entry.line.skipped}</span>
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded p-1.5 flex justify-between items-center">
                    <span className="font-medium text-gray-500">Email</span>
                    <span>
                      <span className="text-green-600 font-medium mr-2">✓ {entry.email.success}</span>
                      <span className="text-red-500 font-medium mr-2">✗ {entry.email.failed}</span>
                      <span className="text-gray-400 font-medium">— {entry.email.skipped}</span>
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
