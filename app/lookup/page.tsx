"use client";

import { useState } from "react";
import Link from "next/link";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Order, OrderItem, OrderStatus } from "@/types";

interface OrderResult extends Pick<
  Order,
  "order_number" | "status" | "total_amount" | "shipping_fee" | "created_at"
> {
  order_items: OrderItem[];
}

export default function LookupPage() {
  const { toast } = useToast();
  const [orderNumber, setOrderNumber] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [result, setResult] = useState<OrderResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmedOrderNumber = orderNumber.trim();
    const trimmedAccessCode = accessCode.trim();
    if (!trimmedOrderNumber || !trimmedAccessCode) return;

    setSearching(true);
    try {
      const res = await fetch(
        `/api/lookup?orderNumber=${encodeURIComponent(trimmedOrderNumber)}&accessCode=${encodeURIComponent(trimmedAccessCode)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setResult(data.order ?? null);
      } else {
        setResult(null);
        toast({ title: "查詢失敗", variant: "destructive" });
      }
    } catch {
      setResult(null);
      toast({ title: "網路錯誤，請稍後再試", variant: "destructive" });
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
          輸入訂單編號與查詢碼查詢
        </div>

        <form onSubmit={handleSearch} className="space-y-2">
          <input
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="訂單編號，例如 ORD-20260324-001"
            className="w-full border rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
          />
          <input
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
            placeholder="12 碼查詢碼"
            className="w-full border rounded-xl px-3 py-2.5 text-sm min-h-[44px] font-mono tracking-widest"
          />
          <button
            type="submit"
            disabled={searching}
            className="w-full bg-gray-800 text-white px-5 rounded-xl text-sm font-medium min-h-[44px]"
          >
            {searching ? "搜尋中..." : "查詢"}
          </button>
        </form>

        {searched && !result && (
          <div className="text-center py-10 text-gray-400">找不到相關訂單</div>
        )}

        {result && (
          <Link href={`/order/${encodeURIComponent(result.order_number)}?code=${encodeURIComponent(accessCode.trim())}`}>
            <div className="bg-white rounded-xl border p-3 cursor-pointer hover:border-gray-400 transition space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm">{result.order_number}</span>
                <OrderStatusBadge status={result.status as OrderStatus} />
              </div>
              <div className="text-xs text-gray-400">
                {result.order_items
                  .map((i) => `${i.product_name}x${i.quantity}`)
                  .join("、")}
              </div>
              <div className="flex justify-between text-sm">
                <span>
                  小計{" "}
                  {formatCurrency(
                    result.total_amount - (result.shipping_fee ?? 0),
                  )}
                  {result.shipping_fee ? (
                    <span className="text-gray-400">
                      {" "}
                      +{formatCurrency(result.shipping_fee)}運
                    </span>
                  ) : null}
                </span>
                <span className="font-bold">
                  合計 {formatCurrency(result.total_amount)}
                </span>
              </div>
            </div>
          </Link>
        )}
      </main>
    </div>
  );
}
