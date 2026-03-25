"use client";

import { useState } from "react";
import Link from "next/link";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { serializePublicOrderAccess } from "@/lib/public-order-access";
import { formatCurrency } from "@/lib/utils";
import { getPublicOrderAccessSessionKey } from "@/lib/utils";
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
        for (const order of data.orders ?? []) {
          if (
            typeof order.order_number === "string" &&
            order.order_number.trim()
          ) {
            sessionStorage.setItem(
              getPublicOrderAccessSessionKey(order.order_number),
              serializePublicOrderAccess(
                {
                  recipient_name: trimmedRecipientName,
                  phone_last3: trimmedPhoneLast3,
                },
                "lookup",
              ),
            );
          }
        }
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
    <div className="lux-shell">
      <header className="sticky top-0 z-20 border-b border-[rgba(177,140,92,0.18)] bg-[rgba(246,241,233,0.72)] backdrop-blur-xl">
        <div className="lux-page flex items-center gap-3 py-3">
          <Link
            href="/"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(177,140,92,0.24)] bg-[rgba(255,251,246,0.88)] text-lg text-[hsl(var(--ink))]"
          >
            ←
          </Link>
          <div>
            <div className="lux-kicker">Order Lookup</div>
            <span className="font-display text-xl text-[hsl(var(--ink))]">
              查詢既有訂單
            </span>
          </div>
        </div>
      </header>
      <main className="lux-page space-y-6">
        <section className="lux-panel-strong mx-auto max-w-3xl overflow-hidden p-5 md:p-8">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)] md:items-end">
            <div className="space-y-3">
              <div className="lux-kicker">Recipient Verification</div>
              <h1 className="font-display text-3xl text-[hsl(var(--ink))] md:text-4xl">
                用姓名與手機末三碼，快速找回訂單。
              </h1>
              <p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                系統會列出所有符合的歷史訂單，點進去即可查看完整內容與後續操作。
              </p>
            </div>

            <form onSubmit={handleSearch} className="space-y-3">
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="訂購人姓名"
              />
              <Input
                value={phoneLast3}
                onChange={(e) =>
                  setPhoneLast3(e.target.value.replace(/\D/g, "").slice(0, 3))
                }
                inputMode="numeric"
                maxLength={3}
                placeholder="手機末三碼"
                className="font-mono tracking-[0.35em]"
              />
              <Button
                type="submit"
                disabled={searching}
                size="lg"
                className="w-full"
              >
                {searching ? "搜尋中..." : "查詢訂單"}
              </Button>
            </form>
          </div>
        </section>

        {searched && results.length === 0 && (
          <div className="lux-panel mx-auto max-w-3xl p-10 text-center text-[hsl(var(--muted-foreground))]">
            找不到相關訂單
          </div>
        )}

        {results.length > 0 && (
          <section className="mx-auto max-w-3xl space-y-3">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">
              找到 {results.length} 筆訂單
            </div>
            {results.map((result) => (
              <Link
                key={result.order_number}
                href={`/order/${encodeURIComponent(result.order_number)}`}
              >
                <div className="lux-panel lux-card-hover cursor-pointer space-y-3 p-4 md:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="lux-kicker">Order Number</div>
                      <span className="font-mono text-sm font-semibold text-[hsl(var(--ink))]">
                        {result.order_number}
                      </span>
                    </div>
                    <OrderStatusBadge status={result.status as OrderStatus} />
                  </div>
                  <div className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                    {result.order_items
                      .map((i) => `${i.product_name} × ${i.quantity}`)
                      .join("、")}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(177,140,92,0.16)] pt-3 text-sm">
                    <span className="text-[hsl(var(--muted-foreground))]">
                      商品小計{" "}
                      {formatCurrency(
                        result.total_amount - (result.shipping_fee ?? 0),
                      )}
                      {result.shipping_fee ? (
                        <span className="ml-1 text-[hsl(var(--bronze))]">
                          + {formatCurrency(result.shipping_fee)} 運費
                        </span>
                      ) : null}
                    </span>
                    <span className="font-display text-2xl text-[hsl(var(--ink))]">
                      {formatCurrency(result.total_amount)}
                    </span>
                  </div>
                  <div className="text-right text-xs uppercase tracking-[0.22em] text-[hsl(var(--bronze))]">
                    view detail / 查詢細節
                  </div>
                </div>
              </Link>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
