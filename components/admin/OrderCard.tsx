"use client";

import { useState } from "react";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { buildAdminPath } from "@/lib/admin/paths";
import { formatCurrency, formatOrderItems } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { Order, OrderItem, User } from "@/types";

type OrderWithRelations = Order & {
  order_items: OrderItem[];
  user: User | null;
};

interface OrderCardProps {
  order: OrderWithRelations;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOrderMutated: (
    previousOrder: OrderWithRelations,
    updatedOrder: OrderWithRelations,
  ) => void;
  adminFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
}

export function OrderCard({
  order,
  selected,
  onToggleSelect,
  onOrderMutated,
  adminFetch,
}: OrderCardProps) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const o = order;
  const showCheckbox = o.status === "pending_confirm";
  const amtMatch =
    o.payment_amount != null && o.payment_amount === o.total_amount;
  const amtMismatch =
    o.payment_amount != null && o.payment_amount !== o.total_amount;

  const doAction = async (
    url: string,
    body: Record<string, unknown>,
    successMsg: string,
  ) => {
    setActing(true);
    try {
      const response = await adminFetch<{ order: OrderWithRelations }>(url, {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast({ title: successMsg });
      setExpanded(false);
      onOrderMutated(o, response.order);
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "操作失敗",
        variant: "destructive",
      });
    } finally {
      setActing(false);
    }
  };

  const confirmPayment = () =>
    doAction("/api/confirm-order", { orderId: o.id }, "已確認付款");

  const quickConfirm = () =>
    doAction(
      "/api/quick-confirm",
      { orderId: o.id, paymentAmount: o.total_amount },
      "已現場收款",
    );

  const confirmShipment = () =>
    doAction(
      "/api/confirm-shipment",
      { orderId: o.id },
      o.pickup_location ? "已確認取貨" : "已確認寄出",
    );

  const handleCancel = async () => {
    setActing(true);
    try {
      const response = await adminFetch<{ order: OrderWithRelations }>(
        "/api/cancel-order",
        {
          method: "POST",
          body: JSON.stringify({
            orderId: o.id,
            isAdmin: true,
            cancel_reason: cancelReason.trim() || undefined,
          }),
        },
      );
      toast({ title: "訂單已取消" });
      setCancelOpen(false);
      setCancelReason("");
      setExpanded(false);
      onOrderMutated(o, response.order);
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "取消失敗",
        variant: "destructive",
      });
    } finally {
      setActing(false);
    }
  };

  return (
    <>
      <div
        className={`lux-panel transition ${
          expanded
            ? "border-[rgba(177,140,92,0.34)] shadow-[var(--shadow-soft)]"
            : "lux-card-hover"
        }`}
      >
        {/* Collapsed row */}
        <div
          onClick={() => setExpanded(!expanded)}
          className="flex cursor-pointer items-start gap-3 p-4 select-none sm:items-center"
        >
          {showCheckbox && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(o.id)}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 shrink-0 accent-[hsl(var(--forest))]"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
                {o.order_number}
              </span>
              <span className="text-sm font-semibold text-[hsl(var(--ink))]">
                {o.user?.nickname ?? "—"}
              </span>
              {o.pickup_location ? (
                <span className="rounded-full border border-[rgba(115,107,153,0.18)] bg-[rgba(230,228,242,0.74)] px-2 py-0.5 text-[11px] font-medium text-[rgb(74,70,113)]">
                  面交
                </span>
              ) : (
                <span className="rounded-full border border-[rgba(80,112,147,0.16)] bg-[rgba(222,231,242,0.8)] px-2 py-0.5 text-[11px] font-medium text-[rgb(74,96,136)]">
                  宅配
                </span>
              )}
            </div>
            <div className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">
              {formatOrderItems(o.order_items)}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
            <span className="font-display text-lg text-[hsl(var(--ink))] sm:text-xl">
              {formatCurrency(o.total_amount)}
            </span>
            <OrderStatusBadge status={o.status} />
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {expanded ? "▲" : "▼"}
            </span>
          </div>
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="space-y-4 border-t border-[rgba(177,140,92,0.14)] px-4 pb-4">
            {/* Items breakdown */}
            <div className="space-y-2 pt-4 text-sm">
              {o.order_items.map((item) => (
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
              {o.shipping_fee != null && o.shipping_fee > 0 && (
                <div className="flex justify-between text-[rgb(74,96,136)]">
                  <span>宅配運費</span>
                  <span>{formatCurrency(o.shipping_fee)}</span>
                </div>
              )}
              {o.pickup_location && !o.shipping_fee && (
                <div className="flex justify-between text-[rgb(65,98,61)]">
                  <span>面交免運</span>
                  <span>$0</span>
                </div>
              )}
              <div className="flex justify-between border-t border-[rgba(177,140,92,0.16)] pt-2 font-semibold text-[hsl(var(--ink))]">
                <span>合計</span>
                <span>{formatCurrency(o.total_amount)}</span>
              </div>
            </div>

            {/* Payment info */}
            {o.payment_amount != null && (
              <div
                className={`rounded-[1.25rem] p-3 text-sm ${
                  amtMatch
                    ? "border border-[rgba(95,126,92,0.2)] bg-[rgba(228,239,223,0.78)]"
                    : "border border-[rgba(184,132,71,0.22)] bg-[rgba(242,228,203,0.82)]"
                }`}
              >
                <div className="flex flex-wrap gap-4 text-[hsl(var(--ink))]">
                  <span>
                    匯款 <b>{formatCurrency(o.payment_amount)}</b>
                  </span>
                  <span>
                    後五碼 <b>{o.payment_last5 ?? "—"}</b>
                  </span>
                  {o.payment_reported_at && (
                    <span className="text-[hsl(var(--muted-foreground))]">
                      {new Date(o.payment_reported_at).toLocaleString("zh-TW")}
                    </span>
                  )}
                </div>
                {amtMismatch && (
                  <div className="mt-1 text-xs text-[rgb(120,84,39)]">
                    金額不符：訂單 {formatCurrency(o.total_amount)} ≠ 匯款{" "}
                    {formatCurrency(o.payment_amount)}
                  </div>
                )}
              </div>
            )}

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
                · {o.user?.phone ?? "—"}
              </div>
              {o.pickup_location ? (
                <div className="text-[rgb(74,70,113)]">{o.pickup_location}</div>
              ) : (
                <div className="text-[rgb(74,96,136)]">{o.user?.address ?? "—"}</div>
              )}
              {o.cancel_reason && (
                <div className="mt-0.5 text-[rgb(140,67,56)]">{o.cancel_reason}</div>
              )}
              {o.shipped_at && (
                <div className="mt-0.5 text-[rgb(74,70,113)]">
                  {new Date(o.shipped_at).toLocaleString("zh-TW")}
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
                    className="min-w-0 basis-full rounded-[1.1rem] bg-[hsl(var(--forest))] py-3 text-sm font-semibold text-[hsl(var(--mist))] disabled:opacity-50 sm:basis-auto sm:flex-1"
                  >
                    確認付款
                  </button>
                  <button
                    onClick={() => setCancelOpen(true)}
                    disabled={acting}
                    className="rounded-[1.1rem] border border-[rgba(189,111,98,0.28)] px-3 py-3 text-sm font-medium text-[rgb(140,67,56)]"
                  >
                    取消
                  </button>
                </>
              )}
              {o.status === "pending_payment" && (
                <>
                  <button
                    onClick={quickConfirm}
                    disabled={acting}
                    className="basis-full rounded-[1.1rem] bg-[hsl(var(--forest))] py-3 text-sm font-semibold text-[hsl(var(--mist))] disabled:opacity-50 sm:basis-auto sm:flex-1"
                  >
                    已現場收款
                  </button>
                  <button
                    onClick={() => setCancelOpen(true)}
                    disabled={acting}
                    className="rounded-[1.1rem] border border-[rgba(189,111,98,0.28)] px-3 py-3 text-sm font-medium text-[rgb(140,67,56)]"
                  >
                    取消
                  </button>
                </>
              )}
              {o.status === "confirmed" && (
                <>
                  <button
                    onClick={confirmShipment}
                    disabled={acting}
                    className="basis-full rounded-[1.1rem] bg-[rgb(74,70,113)] py-3 text-sm font-semibold text-white disabled:opacity-50 sm:basis-auto sm:flex-1"
                  >
                    {o.pickup_location ? "確認取貨" : "確認寄出"}
                  </button>
                  <button
                    onClick={() => setCancelOpen(true)}
                    disabled={acting}
                    className="rounded-[1.1rem] border border-[rgba(189,111,98,0.28)] px-3 py-3 text-sm font-medium text-[rgb(140,67,56)]"
                  >
                    取消
                  </button>
                </>
              )}
              {o.status !== "cancelled" && (
                <button
                  onClick={() =>
                    window.open(
                      buildAdminPath(`/orders/${o.id}/print`),
                      "_blank",
                    )
                  }
                  className="flex items-center gap-1.5 rounded-[1.1rem] border border-[rgba(177,140,92,0.28)] bg-[rgba(255,251,246,0.9)] px-4 py-3 text-sm font-medium text-[hsl(var(--ink))]"
                >
                  列印裝箱單
                </button>
              )}
              {o.status === "shipped" && (
                <span className="py-2 text-sm text-[hsl(var(--muted-foreground))]">
                  出貨{" "}
                  {o.shipped_at
                    ? new Date(o.shipped_at).toLocaleString("zh-TW")
                    : ""}
                </span>
              )}
              {o.status === "cancelled" && (
                <span className="py-2 text-sm text-[rgb(140,67,56)]">
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
            className="lux-textarea"
          />
          <DialogFooter>
            <button
              onClick={() => setCancelOpen(false)}
              disabled={acting}
              className="flex-1 rounded-[1.1rem] border border-[rgba(177,140,92,0.28)] bg-[rgba(255,251,246,0.9)] py-3 text-sm font-semibold text-[hsl(var(--ink))]"
            >
              返回
            </button>
            <button
              onClick={handleCancel}
              disabled={acting}
              className="flex-1 rounded-[1.1rem] bg-red-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {acting ? "取消中…" : "確定取消"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
