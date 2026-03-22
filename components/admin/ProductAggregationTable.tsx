"use client";

import { useState } from "react";
import type { OrderByProduct, ProductWithProgress } from "@/types";

interface ProductAggregationTableProps {
  products: ProductWithProgress[];
  orderItems: Array<{
    product_id: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
  }>;
  roundId: string;
  adminFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
}

interface AggRow {
  productId: string;
  name: string;
  supplierName: string | null;
  unit: string;
  qty: number;
  revenue: number;
}

export function ProductAggregationTable({
  products,
  orderItems,
  roundId,
  adminFetch,
}: ProductAggregationTableProps) {
  const [expandedProd, setExpandedProd] = useState<string | null>(null);
  const [customers, setCustomers] = useState<OrderByProduct[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [arrivalSending, setArrivalSending] = useState<string | null>(null);
  const [arrivalSent, setArrivalSent] = useState<Set<string>>(new Set());

  // Aggregate order items by product
  const aggMap = new Map<string, AggRow>();
  for (const item of orderItems) {
    if (!item.product_id) continue;
    const existing = aggMap.get(item.product_id);
    if (existing) {
      existing.qty += item.quantity;
      existing.revenue += item.quantity * item.unit_price;
    } else {
      const prod = products.find((p) => p.id === item.product_id);
      aggMap.set(item.product_id, {
        productId: item.product_id,
        name: item.product_name,
        supplierName: prod?.supplier_name ?? null,
        unit: prod?.unit ?? "份",
        qty: item.quantity,
        revenue: item.quantity * item.unit_price,
      });
    }
  }
  const rows = Array.from(aggMap.values());

  const toggleExpand = async (productId: string) => {
    if (expandedProd === productId) {
      setExpandedProd(null);
      return;
    }
    setExpandedProd(productId);
    setLoadingCustomers(true);
    try {
      const data = await adminFetch<{ customers: OrderByProduct[] }>(
        `/api/orders-by-product?productId=${productId}&roundId=${roundId}`
      );
      setCustomers(data.customers);
    } catch {
      setCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const sendArrival = async (productId: string) => {
    setArrivalSending(productId);
    try {
      await adminFetch("/api/notify-arrival", {
        method: "POST",
        body: JSON.stringify({ productId, roundId }),
      });
      setArrivalSent((prev) => new Set([...prev, productId]));
      setTimeout(() => {
        setArrivalSent((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
      }, 3000);
    } catch {
      // silent
    } finally {
      setArrivalSending(null);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-4">
        <div className="font-medium text-sm mb-2 text-gray-700">商品需求彙總</div>
        <div className="text-sm text-gray-400 text-center py-4">尚無訂單資料</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="font-medium text-sm mb-3 text-gray-700">商品需求彙總</div>
      {rows.map((row) => {
        const isExpanded = expandedProd === row.productId;
        const isSent = arrivalSent.has(row.productId);
        const isSending = arrivalSending === row.productId;

        return (
          <div key={row.productId} className="border-b last:border-0 py-2">
            <div className="flex justify-between items-center">
              <button
                onClick={() => toggleExpand(row.productId)}
                className="flex items-center gap-1 text-sm font-medium hover:text-indigo-600 text-left"
              >
                <span className="text-xs text-gray-400">
                  {isExpanded ? "▼" : "▶"}
                </span>{" "}
                {row.name}
                {row.supplierName && (
                  <span className="text-xs text-gray-400">
                    ({row.supplierName})
                  </span>
                )}
              </button>
              <div className="flex items-center gap-2">
                <span className="font-bold text-indigo-600 text-sm">
                  {row.qty}
                  {row.unit}
                </span>
                <span className="text-xs text-gray-400">${row.revenue}</span>
                <button
                  onClick={() => sendArrival(row.productId)}
                  disabled={isSent || isSending}
                  className={`text-xs px-2 py-1 rounded-lg ${
                    isSent
                      ? "bg-green-100 text-green-700"
                      : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                  }`}
                >
                  {isSending ? "…" : isSent ? "✓ 已通知" : "📢 通知到貨"}
                </button>
              </div>
            </div>
            {isExpanded && (
              <div className="mt-2 ml-4 bg-gray-50 rounded-xl p-2.5 space-y-1">
                {loadingCustomers ? (
                  <div className="text-xs text-gray-400 text-center py-2">載入中…</div>
                ) : customers.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-2">無客戶資料</div>
                ) : (
                  customers.map((c, i) => (
                    <div key={i} className="flex text-xs gap-2">
                      <span className="w-12 font-medium">{c.nickname}</span>
                      <span className="w-14">{c.recipient_name}</span>
                      <span className="flex-1 text-gray-400">{c.phone}</span>
                      <span className="font-bold text-indigo-600">
                        {c.quantity}
                        {row.unit}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
