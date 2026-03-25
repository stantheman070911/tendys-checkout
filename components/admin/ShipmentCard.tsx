"use client";

import { useState } from "react";
import { buildAdminPath } from "@/lib/admin/paths";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { AdminOrderDetail, AdminOrderListRow } from "@/types";

interface ShipmentCardProps {
  order: AdminOrderListRow;
  detail?: AdminOrderDetail;
  loadingDetail: boolean;
  onLoadDetail: (orderId: string) => Promise<AdminOrderDetail>;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onShipmentConfirmed: (orderId: string) => void;
  adminFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
}

export function ShipmentCard({
  order,
  detail,
  loadingDetail,
  onLoadDetail,
  selected,
  onToggleSelect,
  onShipmentConfirmed,
  adminFetch,
}: ShipmentCardProps) {
  const { toast } = useToast();
  const [acting, setActing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isPickup = !!order.pickup_location;
  const detailOrder = detail ?? null;

  const toggleExpanded = () => {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);

    if (nextExpanded && !detailOrder && !loadingDetail) {
      void onLoadDetail(order.id).catch((error) => {
        toast({
          title: error instanceof Error ? error.message : "明細載入失敗",
          variant: "destructive",
        });
      });
    }
  };

  const confirmShipment = async () => {
    setActing(true);
    try {
      await adminFetch("/api/confirm-shipment", {
        method: "POST",
        body: JSON.stringify({ orderId: order.id }),
      });

      toast({ title: isPickup ? "已確認取貨" : "已確認寄出" });
      onShipmentConfirmed(order.id);
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "操作失敗",
        variant: "destructive",
      });
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="lux-panel space-y-3 p-4">
      <div className="flex items-start gap-2 sm:items-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(order.id)}
          className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--forest))] sm:mt-0"
        />
        <button
          onClick={toggleExpanded}
          className="flex flex-1 min-w-0 items-start gap-3 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
                {order.order_number}
              </span>
              <span className="text-sm font-semibold text-[hsl(var(--ink))]">
                {order.user?.nickname ?? "—"}
              </span>
              {isPickup ? (
                <span className="rounded-full border border-[rgba(115,107,153,0.18)] bg-[rgba(230,228,242,0.74)] px-2 py-0.5 text-[11px] font-medium text-[rgb(74,70,113)]">
                  {order.pickup_location}
                </span>
              ) : (
                <span className="rounded-full border border-[rgba(80,112,147,0.16)] bg-[rgba(222,231,242,0.8)] px-2 py-0.5 text-[11px] font-medium text-[rgb(74,96,136)]">
                  宅配
                </span>
              )}
            </div>
            <div className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">
              {order.items_preview || "無商品明細"}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="font-display text-lg text-[hsl(var(--ink))] sm:text-xl">
              {formatCurrency(order.total_amount)}
            </span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {expanded ? "▲" : "▼"}
            </span>
          </div>
        </button>
      </div>

      {expanded && (
        <>
          {detailOrder ? (
            <>
              <div className="lux-panel-muted space-y-1 p-3 text-xs text-[hsl(var(--muted-foreground))]">
                <div>
                  暱稱：{" "}
                  <span className="font-medium text-[hsl(var(--ink))]">
                    {detailOrder.user?.nickname ?? "—"}
                  </span>
                </div>
                <div>
                  訂購人：{" "}
                  <span className="font-medium text-[hsl(var(--ink))]">
                    {detailOrder.user?.purchaser_name ?? "—"}
                  </span>
                </div>
                <div>
                  收貨人：{" "}
                  <span className="font-medium text-[hsl(var(--ink))]">
                    {detailOrder.user?.recipient_name ?? "—"}
                  </span>{" "}
                  · {detailOrder.user?.phone ?? "—"}
                </div>
                {isPickup ? (
                  <div className="text-[rgb(74,70,113)]">
                    {detailOrder.pickup_location}
                  </div>
                ) : (
                  <div className="text-[rgb(74,96,136)]">
                    {detailOrder.user?.address ?? "—"}
                  </div>
                )}
              </div>

              <div className="space-y-2 text-sm">
                {detailOrder.order_items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between text-[hsl(var(--ink))]"
                  >
                    <span>
                      {item.product_name} ×{item.quantity}
                    </span>
                    <span>{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
                {detailOrder.shipping_fee != null && detailOrder.shipping_fee > 0 && (
                  <div className="flex justify-between text-[rgb(74,96,136)]">
                    <span>宅配運費</span>
                    <span>{formatCurrency(detailOrder.shipping_fee)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-[rgba(177,140,92,0.16)] pt-2 font-semibold text-[hsl(var(--ink))]">
                  <span>合計</span>
                  <span>{formatCurrency(detailOrder.total_amount)}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
              {loadingDetail ? "載入明細中…" : "展開後載入出貨明細"}
            </div>
          )}
        </>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={confirmShipment}
          disabled={acting}
          className="flex-1 rounded-[1.1rem] bg-[rgb(74,70,113)] py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {acting ? "處理中…" : isPickup ? "確認取貨" : "確認寄出"}
        </button>
        <button
          onClick={() =>
            window.open(buildAdminPath(`/orders/${order.id}/print`), "_blank")
          }
          className="rounded-[1.1rem] border border-[rgba(177,140,92,0.28)] bg-[rgba(255,251,246,0.9)] px-4 py-3 text-sm font-medium text-[hsl(var(--ink))]"
        >
          列印
        </button>
      </div>
    </div>
  );
}
