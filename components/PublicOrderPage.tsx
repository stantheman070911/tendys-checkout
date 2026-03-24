"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { PaymentReportForm } from "@/components/PaymentReportForm";
import { CancelOrderButton } from "@/components/CancelOrderButton";
import { SharePanel } from "@/components/SharePanel";
import { useToast } from "@/hooks/use-toast";
import { BANK_INFO } from "@/constants";
import {
  buildShareUrl,
  formatCurrency,
  getPhoneLast3,
  getPublicOrderAccessSessionKey,
} from "@/lib/utils";
import type { OrderStatus } from "@/types";

interface PublicOrderItem {
  id: string;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

interface PublicOrder {
  id: string;
  order_number: string;
  round_id: string | null;
  total_amount: number;
  shipping_fee: number | null;
  status: OrderStatus;
  payment_amount: number | null;
  payment_last5: string | null;
  payment_reported_at: string | null;
  confirmed_at: string | null;
  shipped_at: string | null;
  note: string | null;
  pickup_location: string | null;
  cancel_reason: string | null;
  line_user_id: string | null;
  created_at: string;
  user: {
    recipient_name: string | null;
    masked_phone: string;
  } | null;
  order_items: PublicOrderItem[];
}

interface PublicOrderResponse {
  any_under_goal: boolean;
  order: PublicOrder;
}

interface PublicIdentity {
  recipient_name: string;
  phone_last3: string;
}

export function PublicOrderPage({
  orderNumber,
}: {
  orderNumber: string;
}) {
  const { toast } = useToast();
  const [recipientName, setRecipientName] = useState("");
  const [phoneLast3, setPhoneLast3] = useState("");
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [anyUnderGoal, setAnyUnderGoal] = useState(false);
  const [identity, setIdentity] = useState<PublicIdentity | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [autoUnlockChecked, setAutoUnlockChecked] = useState(false);

  const unlockOrder = useCallback(
    async (
      nextIdentity: PublicIdentity,
      options?: { consumeStoredAccess?: boolean; showErrorToast?: boolean },
    ) => {
      setUnlocking(true);
      try {
        const res = await fetch("/api/lookup/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_number: orderNumber,
            recipient_name: nextIdentity.recipient_name,
            phone_last3: nextIdentity.phone_last3,
          }),
        });

        if (!res.ok) {
          setOrder(null);
          if (options?.consumeStoredAccess) {
            sessionStorage.removeItem(getPublicOrderAccessSessionKey(orderNumber));
          }
          if (options?.showErrorToast !== false) {
            toast({ title: "找不到訂單", variant: "destructive" });
          }
          return;
        }

        const data = (await res.json()) as PublicOrderResponse;
        setRecipientName(nextIdentity.recipient_name);
        setPhoneLast3(nextIdentity.phone_last3);
        setIdentity(nextIdentity);
        setOrder(data.order);
        setAnyUnderGoal(data.any_under_goal);

        if (options?.consumeStoredAccess) {
          sessionStorage.removeItem(getPublicOrderAccessSessionKey(orderNumber));
        }
      } catch {
        if (options?.showErrorToast !== false) {
          toast({ title: "網路錯誤，請稍後再試", variant: "destructive" });
        }
      } finally {
        setUnlocking(false);
        setAutoUnlockChecked(true);
      }
    },
    [orderNumber, toast],
  );

  useEffect(() => {
    const stored = sessionStorage.getItem(
      getPublicOrderAccessSessionKey(orderNumber),
    );
    if (!stored) {
      setAutoUnlockChecked(true);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as Partial<PublicIdentity>;
      const storedRecipientName = parsed.recipient_name?.trim() ?? "";
      const storedPhoneLast3 = parsed.phone_last3?.replace(/\D/g, "") ?? "";
      if (!storedRecipientName || storedPhoneLast3.length !== 3) {
        sessionStorage.removeItem(getPublicOrderAccessSessionKey(orderNumber));
        setAutoUnlockChecked(true);
        return;
      }
      void unlockOrder(
        {
          recipient_name: storedRecipientName,
          phone_last3: storedPhoneLast3,
        },
        { consumeStoredAccess: true, showErrorToast: false },
      );
    } catch {
      sessionStorage.removeItem(getPublicOrderAccessSessionKey(orderNumber));
      setAutoUnlockChecked(true);
    }
  }, [orderNumber, unlockOrder]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    const nextIdentity = {
      recipient_name: recipientName.trim(),
      phone_last3: phoneLast3.replace(/\D/g, "").slice(0, 3),
    };

    if (!nextIdentity.recipient_name) {
      toast({ title: "請輸入訂購人姓名", variant: "destructive" });
      return;
    }
    if (nextIdentity.phone_last3.length !== 3) {
      toast({ title: "請輸入手機末三碼", variant: "destructive" });
      return;
    }

    await unlockOrder(nextIdentity);
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-green-700 text-white p-3 sticky top-0 z-10">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <span className="font-bold">訂單詳情</span>
            <span className="font-mono text-xs">{orderNumber}</span>
          </div>
        </header>
        <main className="max-w-lg mx-auto p-4 space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            輸入訂購人姓名與手機末三碼，才能查看這張訂單。
          </div>

          <form
            onSubmit={handleUnlock}
            className="space-y-3 rounded-xl border bg-white p-4"
          >
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                訂單編號
              </label>
              <div className="rounded-xl bg-gray-50 px-3 py-2.5 font-mono text-sm text-gray-700">
                {orderNumber}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                訂購人姓名
              </label>
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="王小美"
                className="w-full border rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                手機末三碼
              </label>
              <input
                value={phoneLast3}
                onChange={(e) =>
                  setPhoneLast3(e.target.value.replace(/\D/g, "").slice(0, 3))
                }
                inputMode="numeric"
                maxLength={3}
                placeholder="678"
                className="w-full border rounded-xl px-3 py-2.5 text-sm min-h-[44px] font-mono tracking-widest"
              />
            </div>
            <button
              type="submit"
              disabled={unlocking}
              className="w-full bg-green-600 text-white rounded-xl py-3 font-bold disabled:opacity-50"
            >
              {unlocking
                ? autoUnlockChecked
                  ? "驗證中..."
                  : "載入中..."
                : "查看訂單"}
            </button>
          </form>

          <Link
            href="/lookup"
            className="block text-center text-sm text-gray-500 underline underline-offset-4"
          >
            返回訂單查詢
          </Link>
        </main>
      </div>
    );
  }

  const items = order.order_items;
  const itemsTotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const status = order.status;
  const lineBindMessage =
    identity &&
    `${order.order_number} ${identity.recipient_name} ${identity.phone_last3}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-700 text-white p-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <span className="font-bold">訂單詳情</span>
          <OrderStatusBadge status={status} />
        </div>
      </header>
      <main className="max-w-lg mx-auto p-4 space-y-4">
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
              <p className="text-sm text-red-600">取消：{order.cancel_reason}</p>
            )}
          </div>
        )}

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

        {status !== "cancelled" && !order.line_user_id && lineBindMessage && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-sm">
            <h3 className="font-bold text-green-800 text-sm mb-1.5 flex items-center">
              <span className="text-lg mr-1.5">💬</span> 接收 LINE 出貨通知
            </h3>
            <p className="text-green-700 text-xs mb-3 text-balance leading-relaxed">
              將下方內容貼到官方 LINE，才會綁定這筆訂單。
            </p>
            <div className="bg-white rounded-lg p-3 border text-green-800 font-mono font-bold text-sm shadow-inner space-y-2 mb-3">
              <div className="text-center select-all cursor-text">
                {lineBindMessage}
              </div>
            </div>
            <div className="text-center text-xs text-green-600">
              傳送格式：{lineBindMessage}
            </div>
          </div>
        )}

        {status === "pending_payment" && identity && (
          <PaymentReportForm
            orderNumber={order.order_number}
            recipientName={identity.recipient_name}
            phoneLast3={identity.phone_last3}
            orderTotal={order.total_amount}
            onSuccess={() => unlockOrder(identity, { showErrorToast: false })}
          />
        )}

        {status !== "pending_payment" && (
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <div>
              <div className="font-bold">{order.order_number}</div>
              <div className="text-gray-500 text-sm">
                {order.user?.recipient_name ?? "收貨人未提供"}
                {order.user?.masked_phone ? ` · ${order.user.masked_phone}` : ""}
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
                {identity && (
                  <CancelOrderButton
                    orderNumber={order.order_number}
                    recipientName={identity.recipient_name}
                    phoneLast3={identity.phone_last3}
                    onSuccess={() =>
                      unlockOrder(identity, { showErrorToast: false })
                    }
                  />
                )}
              </div>
            </div>
          </div>
        )}

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

        {status !== "pending_payment" && identity && (
          <button
            onClick={() => {
              setOrder(null);
              setIdentity(null);
            }}
            className="w-full text-sm text-gray-500 underline underline-offset-4"
          >
            重新驗證其他訂單
          </button>
        )}
      </main>
    </div>
  );
}
