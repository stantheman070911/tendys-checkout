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
        res.notifications
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
    <div className="bg-white rounded-xl border p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(o.id)}
          className="accent-indigo-600 w-4 h-4 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-xs text-gray-400">
              {o.order_number}
            </span>
            <span className="font-semibold text-sm">
              {o.user?.nickname ?? "—"}
            </span>
            {isPickup ? (
              <span className="text-xs text-purple-500 bg-purple-50 px-1.5 rounded">
                {o.pickup_location}
              </span>
            ) : (
              <span className="text-xs text-blue-400 bg-blue-50 px-1.5 rounded">
                宅配
              </span>
            )}
          </div>
        </div>
        <span className="font-bold text-sm shrink-0">
          {formatCurrency(o.total_amount)}
        </span>
      </div>

      {/* Customer info */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded-xl p-2.5 space-y-0.5">
        <div>
          <span className="font-medium">
            {o.user?.recipient_name ?? "—"}
          </span>{" "}
          · {o.user?.phone ?? "—"}
        </div>
        {isPickup ? (
          <div className="text-purple-600">📍 {o.pickup_location}</div>
        ) : (
          <div className="text-blue-500">🚚 {o.user?.address ?? "—"}</div>
        )}
      </div>

      {/* Items */}
      <div className="space-y-1 text-sm">
        {o.order_items.map((item) => (
          <div
            key={item.id}
            className="flex justify-between text-gray-600"
          >
            <span>
              {item.product_name} ×{item.quantity}
            </span>
            <span>{formatCurrency(item.subtotal)}</span>
          </div>
        ))}
        {o.shipping_fee != null && o.shipping_fee > 0 && (
          <div className="flex justify-between text-blue-500">
            <span>宅配運費</span>
            <span>{formatCurrency(o.shipping_fee)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold border-t pt-1">
          <span>合計</span>
          <span>{formatCurrency(o.total_amount)}</span>
        </div>
      </div>

      {/* Action */}
      <div className="flex gap-2">
        <button
          onClick={confirmShipment}
          disabled={acting}
          className="flex-1 bg-purple-600 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
        >
          {acting
            ? "處理中…"
            : isPickup
              ? "確認取貨 📍"
              : "確認寄出 🚚"}
        </button>
        <button
          onClick={() =>
            window.open(buildAdminPath(`/orders/${o.id}/print`), "_blank")
          }
          className="px-3 py-2.5 border rounded-xl text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1.5"
        >
          🖨️
        </button>
      </div>
    </div>
  );
}
