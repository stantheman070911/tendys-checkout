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
  const [recipientName, setRecipientName] = useState("");
  const [phoneLast3, setPhoneLast3] = useState("");
  const [results, setResults] = useState<OrderResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmedRecipientName = recipientName.trim();
    const trimmedPhoneLast3 = phoneLast3.replace(/\D/g, "").slice(0, 3);
    if (!trimmedRecipientName || trimmedPhoneLast3.length !== 3) return;

    setSearching(true);
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_name: trimmedRecipientName,
          phone_last3: trimmedPhoneLast3,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.orders ?? []);
      } else {
        setResults([]);
        toast({ title: "查詢失敗", variant: "destructive" });
      }
    } catch {
      setResults([]);
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
          輸入訂購人姓名與手機末三碼查詢
        </div>

        <form onSubmit={handleSearch} className="space-y-2">
          <input
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="訂購人姓名"
            className="w-full border rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
          />
          <input
            value={phoneLast3}
            onChange={(e) =>
              setPhoneLast3(e.target.value.replace(/\D/g, "").slice(0, 3))
            }
            inputMode="numeric"
            maxLength={3}
            placeholder="手機末三碼"
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

        {searched && results.length === 0 && (
          <div className="text-center py-10 text-gray-400">找不到相關訂單</div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-gray-500">
              找到 {results.length} 筆訂單
            </div>
            {results.map((result) => (
              <Link
                key={result.order_number}
                href={`/order/${encodeURIComponent(result.order_number)}`}
              >
                <div className="bg-white rounded-xl border p-3 cursor-pointer hover:border-gray-400 transition space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm">
                      {result.order_number}
                    </span>
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
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
