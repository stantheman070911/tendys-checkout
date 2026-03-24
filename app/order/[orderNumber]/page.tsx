export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { findOrderByNumberAndAccessCode } from "@/lib/db/orders";
import { listActiveByRound } from "@/lib/db/products";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { PaymentReportForm } from "@/components/PaymentReportForm";
import { CancelOrderButton } from "@/components/CancelOrderButton";
import { SharePanel } from "@/components/SharePanel";
import {
  formatCurrency,
  buildShareUrl,
  maskPhone,
  normalizeAccessCode,
} from "@/lib/utils";
import { BANK_INFO } from "@/constants";
import type { OrderStatus } from "@/types";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { id } = await params;
  const { code } = await searchParams;
  const accessCode =
    typeof code === "string" ? normalizeAccessCode(code) : "";

  if (!id || accessCode.length !== 12) return notFound();

  const order = await findOrderByNumberAndAccessCode(
    decodeURIComponent(id).toUpperCase(),
    accessCode,
  );

  if (!order) return notFound();

  // Check if any product in this round is under goal (for share panel)
  let anyUnderGoal = false;
  if (order.round_id) {
    const products = await listActiveByRound(order.round_id);
    anyUnderGoal = products.some(
      (p) => p.goal_qty !== null && Number(p.current_qty) < Number(p.goal_qty),
    );
  }

  const status = order.status as OrderStatus;
  const items = order.order_items;
  const itemsTotal = items.reduce((sum, i) => sum + i.subtotal, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-700 text-white p-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <span className="font-bold">訂單詳情</span>
          <OrderStatusBadge status={status} />
        </div>
      </header>
      <main className="max-w-lg mx-auto p-4 space-y-4">
        {/* Status-specific hero */}
        {status === "pending_payment" && (
          <div className="text-center py-4">
            <div className="text-5xl mb-2">📋</div>
            <h2 className="font-bold text-xl">訂單已成立</h2>
            <p className="text-gray-400 text-sm mt-1 font-mono">
              {order.order_number}
            </p>
          </div>
        )}

        {status === "pending_confirm" && (
          <div className="text-center py-4">
            <div className="text-5xl mb-2">⏳</div>
            <h2 className="font-bold text-xl">匯款回報完成</h2>
            <p className="text-gray-400 text-sm mt-1">
              等待賣家確認，確認後收到 LINE + Email 通知
            </p>
            <div className="mt-3 bg-white rounded-xl border p-4 text-sm text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">訂單</span>
                <span className="font-mono">{order.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">狀態</span>
                <span className="text-blue-600 font-medium">待確認</span>
              </div>
              {order.payment_amount !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-400">匯款</span>
                  <span>{formatCurrency(order.payment_amount)}</span>
                </div>
              )}
              {order.payment_last5 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">後五碼</span>
                  <span className="font-mono tracking-widest">
                    {order.payment_last5}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {status === "confirmed" && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
            <p className="font-medium text-green-700">
              訂單已確認，等待出貨中...
            </p>
          </div>
        )}

        {status === "shipped" && (
          <div className="rounded-xl bg-purple-50 border border-purple-200 p-4 text-center">
            <p className="font-medium text-purple-700">已出貨！</p>
            {order.shipped_at && (
              <p className="text-sm text-purple-600 mt-1">
                📦 出貨：{new Date(order.shipped_at).toLocaleString("zh-TW")}
              </p>
            )}
          </div>
        )}

        {status === "cancelled" && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-center space-y-1">
            <p className="font-medium text-red-700">訂單已取消</p>
            {order.cancel_reason && (
              <p className="text-sm text-red-600">
                取消：{order.cancel_reason}
              </p>
            )}
          </div>
        )}

        {/* Bank info for pending_payment */}
        {status === "pending_payment" && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="font-bold text-blue-800 text-center mb-3 text-sm">
              匯款帳戶資訊
            </div>
            <div className="bg-white rounded-xl p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">銀行</span>
                <span className="font-medium">{BANK_INFO.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">戶名</span>
                <span className="font-medium">{BANK_INFO.holder}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">帳號</span>
                <span className="font-bold font-mono text-lg tracking-widest">
                  {BANK_INFO.account}
                </span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between text-gray-400">
                  <span>商品小計</span>
                  <span>{formatCurrency(itemsTotal)}</span>
                </div>
                {order.shipping_fee !== null && order.shipping_fee > 0 && (
                  <div className="flex justify-between text-blue-500">
                    <span>宅配運費</span>
                    <span>{formatCurrency(order.shipping_fee)}</span>
                  </div>
                )}
                {order.pickup_location && (
                  <div className="flex justify-between text-green-600">
                    <span>面交免運</span>
                    <span>$0</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-green-700 text-2xl mt-1">
                  <span>應付</span>
                  <span>{formatCurrency(order.total_amount)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LINE Linking Guide */}
        {status !== "cancelled" && !order.line_user_id && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-sm">
            <h3 className="font-bold text-green-800 text-sm mb-1.5 flex items-center">
              <span className="text-lg mr-1.5">💬</span> 接收 LINE 出貨通知
            </h3>
            <p className="text-green-700 text-xs mb-3 text-balance leading-relaxed">
              將下方訂單編號和查詢碼一起貼到官方 LINE，才會綁定這筆訂單。
            </p>
            <div className="bg-white rounded-lg p-3 border text-green-800 font-mono font-bold text-sm shadow-inner space-y-2 mb-3">
              <div className="text-center select-all cursor-text">
                {order.order_number}
              </div>
              <div className="border-t pt-2 text-center select-all cursor-text">
                查詢碼：{order.access_code}
              </div>
            </div>
            <div className="text-center text-xs text-green-600 mb-2">
              傳送格式：{order.order_number} {order.access_code}
            </div>
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
          <div className="font-bold mb-1">請保存查詢碼</div>
          <div className="font-mono tracking-widest">{order.access_code}</div>
          <p className="mt-2 text-xs text-amber-700">
            之後查訂單、回報匯款、取消訂單，以及 LINE 綁定都需要這組查詢碼。
          </p>
        </div>

        {/* Payment report form */}
        {status === "pending_payment" && (
          <PaymentReportForm
            orderNumber={order.order_number}
            accessCode={order.access_code}
            orderTotal={order.total_amount}
          />
        )}

        {/* Order summary card (non-pending_payment) */}
        {status !== "pending_payment" && (
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <div>
              <div className="font-bold">{order.order_number}</div>
              <div className="text-gray-500 text-sm">
                {order.user?.recipient_name ?? "收貨人未提供"}
                {order.user?.phone ? ` · ${maskPhone(order.user.phone)}` : ""}
              </div>
            </div>
            <div className="border-t pt-3 space-y-1 text-sm">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span>
                    {item.product_name} x{item.quantity}
                  </span>
                  <span>{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
              {order.shipping_fee !== null && order.shipping_fee > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>運費</span>
                  <span>{formatCurrency(order.shipping_fee)}</span>
                </div>
              )}
              <div className="border-t pt-1.5 font-bold flex justify-between">
                <span>合計</span>
                <span>{formatCurrency(order.total_amount)}</span>
              </div>
            </div>
            {order.pickup_location && (
              <div className="text-sm text-purple-600 bg-purple-50 rounded-lg p-2">
                📍 {order.pickup_location}
              </div>
            )}
            {order.note && (
              <p className="text-sm text-gray-500">備註：{order.note}</p>
            )}
          </div>
        )}

        {/* Actions for pending_payment */}
        {status === "pending_payment" && (
          <div className="space-y-3">
            {order.round_id && (
              <SharePanel roundId={order.round_id} show={anyUnderGoal} />
            )}
            <div className="flex gap-3">
              {order.round_id && (
                <a
                  href={buildShareUrl(order.round_id)}
                  className="flex-1 border-2 border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 text-center"
                >
                  繼續選購
                </a>
              )}
              <div className="flex-1">
                <CancelOrderButton
                  orderNumber={order.order_number}
                  accessCode={order.access_code}
                />
              </div>
            </div>
          </div>
        )}

        {/* Share + continue shopping (non-cancelled, non-pending_payment) */}
        {status !== "cancelled" &&
          status !== "pending_payment" &&
          order.round_id && (
            <div className="space-y-3">
              <SharePanel roundId={order.round_id} show={anyUnderGoal} />
              <div className="flex gap-3">
                <a
                  href={buildShareUrl(order.round_id)}
                  className="flex-1 bg-green-600 text-white rounded-xl py-3 font-bold text-center"
                >
                  繼續選購
                </a>
                <Link
                  href="/"
                  className="flex-1 border-2 rounded-xl py-3 text-sm text-gray-600 text-center"
                >
                  返回首頁
                </Link>
              </div>
            </div>
          )}
      </main>
    </div>
  );
}
