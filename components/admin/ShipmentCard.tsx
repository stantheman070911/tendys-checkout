"use client";

import { useState } from "react";
import { buildAdminPath } from "@/lib/admin/paths";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  mapNotifyStatus,
  renderNotifyIcon,
  type NotifyStatus,
} from "@/lib/admin/shipment-status";
import type { OrderWithItems } from "@/types";

interface ShipmentConfirmResult {
  orderNumber: string;
  line: NotifyStatus;
  email: NotifyStatus;
}

interface ShipmentCardProps {
  order: OrderWithItems;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onRefresh: () => void;
  adminFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
  onConfirmed?: (result: ShipmentConfirmResult) => void;
}

export function ShipmentCard({
  order,
  selected,
  onToggleSelect,
  onRefresh,
  adminFetch,
  onConfirmed,
}: ShipmentCardProps) {
  const { toast } = useToast();
  const [acting, setActing] = useState(false);
  const [shipped, setShipped] = useState(false);

  const o = order;
  const isPickup = !!o.pickup_location;

  const confirmShipment = async () => {
    setActing(true);
    try {
      const res = await adminFetch<{
        notifications?: {
          line?: { success: boolean; error?: string };
          email?: { success: boolean; error?: string } | null;
        };
      }>("/api/confirm-shipment", {
        method: "POST",
        body: JSON.stringify({ orderId: o.id }),
      });

      const { line: lineStatus, email: emailStatus } = mapNotifyStatus(
        res.notifications,
      );

      setShipped(true);
      onConfirmed?.({
        orderNumber: o.order_number,
        line: lineStatus,
        email: emailStatus,
      });
      toast({
        title: isPickup ? "已確認取貨" : "已確認寄出",
        description: `LINE ${renderNotifyIcon(lineStatus)} · Email ${renderNotifyIcon(emailStatus)}`,
      });
      onRefresh();
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "操作失敗",
        variant: "destructive",
      });
    } finally {
      setActing(false);
    }
  };

  if (shipped) return null;

  return (
    <div className="lux-panel space-y-3 p-4">
      {/* Header row */}
      <div className="flex items-start gap-2 sm:items-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(o.id)}
          className="h-4 w-4 shrink-0 accent-[hsl(var(--forest))]"
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
              {o.order_number}
            </span>
            <span className="text-sm font-semibold text-[hsl(var(--ink))]">
              {o.user?.nickname ?? "—"}
            </span>
            {isPickup ? (
              <span className="rounded-full border border-[rgba(115,107,153,0.18)] bg-[rgba(230,228,242,0.74)] px-2 py-0.5 text-[11px] font-medium text-[rgb(74,70,113)]">
                {o.pickup_location}
              </span>
            ) : (
              <span className="rounded-full border border-[rgba(80,112,147,0.16)] bg-[rgba(222,231,242,0.8)] px-2 py-0.5 text-[11px] font-medium text-[rgb(74,96,136)]">
                宅配
              </span>
            )}
          </div>
        </div>
        <span className="shrink-0 font-display text-lg text-[hsl(var(--ink))] sm:text-xl">
          {formatCurrency(o.total_amount)}
        </span>
      </div>

      {/* Customer info */}
      <div className="lux-panel-muted space-y-1 p-3 text-xs text-[hsl(var(--muted-foreground))]">
        <div>
          暱稱：{" "}
          <span className="font-medium text-[hsl(var(--ink))]">
            {o.user?.nickname ?? "—"}
          </span>
        </div>
        <div>
          訂購人：{" "}
          <span className="font-medium text-[hsl(var(--ink))]">
            {o.user?.purchaser_name ?? "—"}
          </span>
        </div>
        <div>
          收貨人：{" "}
          <span className="font-medium text-[hsl(var(--ink))]">
            {o.user?.recipient_name ?? "—"}
          </span>{" "}
          ·{" "}
          {o.user?.phone ?? "—"}
        </div>
        {isPickup ? (
          <div className="text-[rgb(74,70,113)]">{o.pickup_location}</div>
        ) : (
          <div className="text-[rgb(74,96,136)]">{o.user?.address ?? "—"}</div>
        )}
      </div>

      {/* Items */}
      <div className="space-y-2 text-sm">
        {o.order_items.map((item) => (
          <div key={item.id} className="flex justify-between text-[hsl(var(--ink))]">
            <span>
              {item.product_name} ×{item.quantity}
            </span>
            <span>{formatCurrency(item.subtotal)}</span>
          </div>
        ))}
        {o.shipping_fee != null && o.shipping_fee > 0 && (
          <div className="flex justify-between text-[rgb(74,96,136)]">
            <span>宅配運費</span>
            <span>{formatCurrency(o.shipping_fee)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-[rgba(177,140,92,0.16)] pt-2 font-semibold text-[hsl(var(--ink))]">
          <span>合計</span>
          <span>{formatCurrency(o.total_amount)}</span>
        </div>
      </div>

      {/* Action */}
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
            window.open(buildAdminPath(`/orders/${o.id}/print`), "_blank")
          }
          className="rounded-[1.1rem] border border-[rgba(177,140,92,0.28)] bg-[rgba(255,251,246,0.9)] px-4 py-3 text-sm font-medium text-[hsl(var(--ink))]"
        >
          列印
        </button>
      </div>
    </div>
  );
}
