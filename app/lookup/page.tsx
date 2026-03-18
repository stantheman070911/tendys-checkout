"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { formatCurrency, formatOrderItems } from "@/lib/utils";
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

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
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
    <main className="mx-auto max-w-lg px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold text-center">訂單查詢</h1>

      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="輸入暱稱或訂單編號"
          className="flex-1"
        />
        <Button type="submit" className="h-11 shrink-0" disabled={searching}>
          {searching ? "搜尋中..." : "搜尋"}
        </Button>
      </form>

      {/* Results */}
      {searched && results.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          找不到相關訂單
        </p>
      )}

      <div className="space-y-3">
        {results.map((order) => (
          <Link key={order.id} href={`/order/${order.id}`}>
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">
                    {order.order_number}
                  </span>
                  <OrderStatusBadge
                    status={order.status as OrderStatus}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatOrderItems(order.order_items)}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span>
                    合計 {formatCurrency(order.total_amount)}
                    {order.shipping_fee
                      ? `（含運費 ${formatCurrency(order.shipping_fee)}）`
                      : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString("zh-TW")}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {!searched && (
        <p className="text-center text-muted-foreground py-8">
          輸入暱稱或訂單編號查詢
        </p>
      )}
    </main>
  );
}
