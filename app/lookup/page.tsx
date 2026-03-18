"use client";

import { useState } from "react";
import Link from "next/link";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { formatCurrency } from "@/lib/utils";
import type { Order, OrderItem, User, OrderStatus } from "@/types";

interface OrderResult extends Order {
  order_items: OrderItem[];
  user: User | null;
}

export default function LookupPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OrderResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setSearching(true);
    try {
      const res = await fetch(
        `/api/lookup?q=${encodeURIComponent(trimmed)}`
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data.orders ?? []);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    }
    setSearched(true);
    setSearching(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-700 text-white p-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/" className="text-xl leading-none">
            ←
          </Link>
          <span className="font-bold">訂單查詢</span>
        </div>
      </header>
      <main className="max-w-lg mx-auto p-4 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-sm text-amber-800">
          輸入 LINE 暱稱或訂單編號查詢
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="LINE 暱稱 或 訂單編號"
            className="flex-1 border rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
          />
          <button
            type="submit"
            disabled={searching}
            className="bg-gray-800 text-white px-5 rounded-xl text-sm font-medium min-h-[44px]"
          >
            {searching ? "搜尋中..." : "查詢"}
          </button>
        </form>

        {searched && results.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            找不到相關訂單
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-gray-400">
              找到 {results.length} 筆，點擊查看詳情
            </div>
            {results.map((order) => (
              <Link key={order.id} href={`/order/${order.id}`}>
                <div className="bg-white rounded-xl border p-3 cursor-pointer hover:border-gray-400 transition space-y-1.5">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-sm">
                        {order.order_number}
                      </span>
                      <span className="ml-2 text-gray-500 text-xs">
                        {order.user?.nickname}
                      </span>
                    </div>
                    <OrderStatusBadge
                      status={order.status as OrderStatus}
                    />
                  </div>
                  <div className="text-xs text-gray-400">
                    {order.order_items
                      .map((i) => `${i.product_name}x${i.quantity}`)
                      .join("、")}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>
                      小計 {formatCurrency(order.total_amount - (order.shipping_fee ?? 0))}
                      {order.shipping_fee ? (
                        <span className="text-gray-400">
                          {" "}+{formatCurrency(order.shipping_fee)}運
                        </span>
                      ) : null}
                    </span>
                    <span className="font-bold">
                      合計 {formatCurrency(order.total_amount)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
