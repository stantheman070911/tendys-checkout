"use client";

import { useState } from "react";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { STATUS_LABELS } from "@/constants";
import { formatCurrency, formatOrderItems } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { Order, OrderItem, OrderStatus, User } from "@/types";

type OrderWithRelations = Order & {
  order_items: OrderItem[];
  user: User | null;
};

interface OrderCardProps {
  order: OrderWithRelations;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onRefresh: () => void;
  adminFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
}

export function OrderCard({
  order,
  selected,
  onToggleSelect,
  onRefresh,
  adminFetch,
}: OrderCardProps) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const o = order;
  const showCheckbox =
    o.status === "pending_confirm" || o.status === "pending_payment";
  const amtMatch =
    o.payment_amount != null && o.payment_amount === o.total_amount;
  const amtMismatch =
    o.payment_amount != null && o.payment_amount !== o.total_amount;

  const doAction = async (
    url: string,
    body: Record<string, unknown>,
    successMsg: string
  ) => {
    setActing(true);
    try {
      const res = await adminFetch<{ error?: string }>(url, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.error) {
        toast({ title: res.error, variant: "destructive" });
      } else {
        toast({ title: successMsg });
        setExpanded(false);
        onRefresh();
      }
    } catch {
      toast({ title: "操作失敗", variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const confirmPayment = () =>
    doAction(
      "/api/confirm-order",
      { orderId: o.id },
      "已確認付款"
    );

  const quickConfirm = () =>
    doAction(
      "/api/quick-confirm",
      { orderId: o.id, paymentAmount: o.total_amount },
      "已現場收款"
    );

  const confirmShipment = () =>
    doAction(
      "/api/confirm-shipment",
      { orderId: o.id },
      o.pickup_location ? "已確認取貨" : "已確認寄出"
    );

  const handleCancel = async () => {
    setActing(true);
    try {
      const res = await adminFetch<{ error?: string }>("/api/cancel-order", {
        method: "POST",
        body: JSON.stringify({
          orderId: o.id,
          isAdmin: true,
          cancel_reason: cancelReason.trim() || undefined,
        }),
      });
      if (res.error) {
        toast({ title: res.error, variant: "destructive" });
      } else {
        toast({ title: "訂單已取消" });
        setCancelOpen(false);
        setCancelReason("");
        setExpanded(false);
        onRefresh();
      }
    } catch {
      toast({ title: "取消失敗", variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  return (
    <>
      <div
        className={`bg-white rounded-xl border transition ${
          expanded ? "border-indigo-400 shadow-md" : "hover:border-gray-300"
        }`}
      >
        {/* Collapsed row */}
        <div
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 p-3 cursor-pointer select-none"
        >
          {showCheckbox && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(o.id)}
              onClick={(e) => e.stopPropagation()}
              className="accent-indigo-600 w-4 h-4 shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs text-gray-400">
                {o.order_number}
              </span>
              <span className="font-semibold text-sm">
                {o.user?.nickname ?? "—"}
              </span>
              {o.pickup_location ? (
                <span className="text-xs text-purple-500 bg-purple-50 px-1.5 rounded">
                  面交
                </span>
              ) : (
                <span className="text-xs text-blue-400 bg-blue-50 px-1.5 rounded">
                  宅配
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 truncate">
              {formatOrderItems(o.order_items)}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-bold text-sm">
              {formatCurrency(o.total_amount)}
            </span>
            <OrderStatusBadge status={o.status} />
            <span className="text-gray-300 text-xs">
              {expanded ? "▲" : "▼"}
            </span>
          </div>
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="border-t px-3 pb-3 space-y-3">
            {/* Items breakdown */}
            <div className="pt-2 space-y-1 text-sm">
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
              {o.pickup_location && !o.shipping_fee && (
                <div className="flex justify-between text-green-500">
                  <span>面交免運</span>
                  <span>$0</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t pt-1">
                <span>合計</span>
                <span>{formatCurrency(o.total_amount)}</span>
              </div>
            </div>

            {/* Payment info */}
            {o.payment_amount != null && (
              <div
                className={`rounded-xl p-2.5 text-sm ${
                  amtMatch
                    ? "bg-green-50 border border-green-200"
                    : "bg-orange-50 border border-orange-200"
                }`}
              >
                <div className="flex flex-wrap gap-4">
                  <span>
                    {amtMatch ? "✅" : "⚠️"} 匯款{" "}
                    <b>{formatCurrency(o.payment_amount)}</b>
                  </span>
                  <span>
                    後五碼 <b>{o.payment_last5 ?? "—"}</b>
                  </span>
                  {o.payment_reported_at && (
                    <span className="text-gray-400">
                      {new Date(o.payment_reported_at).toLocaleString("zh-TW")}
                    </span>
                  )}
                </div>
                {amtMismatch && (
                  <div className="text-orange-700 text-xs mt-1">
                    金額不符：訂單 {formatCurrency(o.total_amount)} ≠ 匯款{" "}
                    {formatCurrency(o.payment_amount)}
                  </div>
                )}
              </div>
            )}

            {/* Customer info */}
            <div className="text-xs text-gray-500 bg-gray-50 rounded-xl p-2.5 space-y-0.5">
              <div>
                <span className="font-medium">
                  {o.user?.recipient_name ?? "—"}
                </span>{" "}
                · {o.user?.phone ?? "—"}
              </div>
              {o.pickup_location ? (
                <div className="text-purple-600">📍 {o.pickup_location}</div>
              ) : (
                <div className="text-blue-500">🚚 {o.user?.address ?? "—"}</div>
              )}
              {o.cancel_reason && (
                <div className="text-red-500 mt-0.5">{o.cancel_reason}</div>
              )}
              {o.shipped_at && (
                <div className="text-purple-600 mt-0.5">
                  📦 {new Date(o.shipped_at).toLocaleString("zh-TW")}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              {o.status === "pending_confirm" && (
                <>
                  <button
                    onClick={confirmPayment}
                    disabled={acting}
                    className="flex-1 min-w-0 bg-green-600 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
                  >
                    ✓ 確認付款
                  </button>
                  <button
                    onClick={() => setCancelOpen(true)}
                    disabled={acting}
                    className="px-3 py-2.5 border border-red-200 rounded-xl text-sm text-red-500"
                  >
                    ✕
                  </button>
                </>
              )}
              {o.status === "pending_payment" && (
                <>
                  <button
                    onClick={quickConfirm}
                    disabled={acting}
                    className="flex-1 bg-green-600 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
                  >
                    ✓ 已現場收款
                  </button>
                  <button
                    onClick={() => setCancelOpen(true)}
                    disabled={acting}
                    className="px-3 py-2.5 border border-red-200 rounded-xl text-sm text-red-500"
                  >
                    ✕
                  </button>
                </>
              )}
              {o.status === "confirmed" && (
                <>
                  <button
                    onClick={confirmShipment}
                    disabled={acting}
                    className="flex-1 bg-purple-600 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
                  >
                    {o.pickup_location ? "確認取貨 📍" : "確認寄出 🚚"}
                  </button>
                  <button
                    onClick={() => setCancelOpen(true)}
                    disabled={acting}
                    className="px-3 py-2.5 border border-red-200 rounded-xl text-sm text-red-500"
                  >
                    ✕
                  </button>
                </>
              )}
              {o.status === "shipped" && (
                <span className="text-sm text-gray-400 py-2">
                  出貨{" "}
                  {o.shipped_at
                    ? new Date(o.shipped_at).toLocaleString("zh-TW")
                    : ""}
                </span>
              )}
              {o.status === "cancelled" && (
                <span className="text-sm text-red-400 py-2">
                  {o.cancel_reason ?? "已取消"}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>取消訂單 {o.order_number}</DialogTitle>
          </DialogHeader>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="取消原因（選填）"
            className="w-full border rounded-xl px-3 py-2.5 text-sm min-h-[80px]"
          />
          <DialogFooter>
            <button
              onClick={() => setCancelOpen(false)}
              disabled={acting}
              className="flex-1 border-2 rounded-xl py-2.5 font-medium text-gray-600"
            >
              返回
            </button>
            <button
              onClick={handleCancel}
              disabled={acting}
              className="flex-1 bg-red-600 text-white rounded-xl py-2.5 font-bold disabled:opacity-50"
            >
              {acting ? "取消中…" : "確定取消"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
