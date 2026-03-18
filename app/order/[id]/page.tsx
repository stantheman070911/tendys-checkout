export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getOrderWithItems } from "@/lib/db/orders";
import { listActiveByRound } from "@/lib/db/products";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { PaymentReportForm } from "@/components/PaymentReportForm";
import { CancelOrderButton } from "@/components/CancelOrderButton";
import { SharePanel } from "@/components/SharePanel";
import { formatCurrency, buildShareUrl } from "@/lib/utils";
import { BANK_INFO } from "@/constants";
import type { OrderStatus } from "@/types";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderWithItems(id);

  if (!order) return notFound();

  // Check if any product in this round is under goal (for share panel)
  let anyUnderGoal = false;
  if (order.round_id) {
    const products = await listActiveByRound(order.round_id);
    anyUnderGoal = products.some(
      (p) => p.goal_qty !== null && Number(p.current_qty) < Number(p.goal_qty)
    );
  }

  const status = order.status as OrderStatus;
  const items = order.order_items;

  return (
    <main className="mx-auto max-w-lg px-4 py-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">{order.order_number}</h1>
          <OrderStatusBadge status={status} />
        </div>
        {order.user && (
          <p className="text-sm text-muted-foreground">
            {order.user.nickname}
          </p>
        )}
      </div>

      {/* Status-specific content */}
      {status === "pending_payment" && (
        <PendingPaymentSection
          orderId={order.id}
          orderTotal={order.total_amount}
        />
      )}

      {status === "pending_confirm" && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-center">
          <p className="font-medium text-blue-700">
            已回報匯款，等待主辦確認中...
          </p>
          {order.payment_amount !== null && (
            <p className="text-sm text-blue-600 mt-1">
              回報金額 {formatCurrency(order.payment_amount)}，末五碼{" "}
              {order.payment_last5}
            </p>
          )}
        </div>
      )}

      {status === "confirmed" && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
          <p className="font-medium text-green-700">
            訂單已確認，等待出貨中...
          </p>
        </div>
      )}

      {status === "shipped" && (
        <div className="rounded-lg bg-purple-50 border border-purple-200 p-4 text-center">
          <p className="font-medium text-purple-700">已出貨！</p>
          {order.shipped_at && (
            <p className="text-sm text-purple-600 mt-1">
              出貨時間：{new Date(order.shipped_at).toLocaleString("zh-TW")}
            </p>
          )}
        </div>
      )}

      {status === "cancelled" && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-center space-y-1">
          <p className="font-medium text-red-700">訂單已取消</p>
          {order.cancel_reason && (
            <p className="text-sm text-red-600">
              原因：{order.cancel_reason}
            </p>
          )}
        </div>
      )}

      {/* Order summary */}
      <div className="rounded-lg border p-4 space-y-2">
        <h3 className="font-semibold">訂單內容</h3>
        {items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span>
              {item.product_name} x{item.quantity}
            </span>
            <span>{formatCurrency(item.subtotal)}</span>
          </div>
        ))}
        {order.shipping_fee !== null && order.shipping_fee > 0 && (
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>宅配運費</span>
            <span>{formatCurrency(order.shipping_fee)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold border-t pt-2">
          <span>合計</span>
          <span>{formatCurrency(order.total_amount)}</span>
        </div>
        {order.pickup_location ? (
          <p className="text-sm text-muted-foreground">
            取貨方式：{order.pickup_location}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            取貨方式：宅配
            {order.user?.address ? `（${order.user.address}）` : ""}
          </p>
        )}
        {order.note && (
          <p className="text-sm text-muted-foreground">備註：{order.note}</p>
        )}
      </div>

      {/* Share + continue shopping (non-cancelled) */}
      {status !== "cancelled" && order.round_id && (
        <div className="space-y-3">
          <SharePanel roundId={order.round_id} show={anyUnderGoal} />
          <a
            href={buildShareUrl(order.round_id)}
            className="block text-center text-sm text-primary hover:underline"
          >
            繼續選購
          </a>
        </div>
      )}
    </main>
  );
}

function PendingPaymentSection({
  orderId,
  orderTotal,
}: {
  orderId: string;
  orderTotal: number;
}) {
  return (
    <div className="space-y-4">
      {/* Bank info */}
      <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 space-y-2">
        <h3 className="font-semibold text-yellow-800">請匯款至以下帳戶</h3>
        <div className="text-sm space-y-1">
          <p>
            銀行：<span className="font-medium">{BANK_INFO.name}</span>
          </p>
          <p>
            帳號：
            <span className="font-medium font-mono">{BANK_INFO.account}</span>
          </p>
          <p>
            戶名：<span className="font-medium">{BANK_INFO.holder}</span>
          </p>
          <p>
            應付金額：
            <span className="font-bold text-base">
              {formatCurrency(orderTotal)}
            </span>
          </p>
        </div>
      </div>

      <PaymentReportForm orderId={orderId} orderTotal={orderTotal} />

      <div className="flex justify-center">
        <CancelOrderButton orderId={orderId} />
      </div>
    </div>
  );
}
