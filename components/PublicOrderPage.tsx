import Link from "next/link";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { PaymentReportForm } from "@/components/PaymentReportForm";
import { CancelOrderButton } from "@/components/CancelOrderButton";
import { SharePanel } from "@/components/SharePanel";
import { CopyTextButton } from "@/components/CopyTextButton";
import { BANK_INFO } from "@/constants";
import { buildShareUrl, formatCurrency, maskPhone } from "@/lib/utils";
import type { OrderStatus } from "@/types";

const LINE_OA_URL = "https://lin.ee/Q1Ma43N";

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
  status: OrderStatus | string;
  payment_amount: number | null;
  payment_last5: string | null;
  payment_reported_at: string | null | Date;
  confirmed_at: string | null | Date;
  shipped_at: string | null | Date;
  note: string | null;
  pickup_location: string | null;
  cancel_reason: string | null;
  line_user_id: string | null;
  created_at: string | Date;
  user: {
    nickname: string | null;
    purchaser_name: string | null;
    recipient_name: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  order_items: PublicOrderItem[];
}

function getErrorMessage(error: string | null | undefined) {
  switch (error) {
    case "not_found":
      return "找不到符合資料的訂單，請確認訂購人姓名與手機末三碼。";
    case "rate_limited":
      return "嘗試次數過多，請稍後再試。";
    case "invalid":
      return "驗證資訊無效，請重新輸入。";
    case "service_unavailable":
      return "訂單查詢暫時無法使用，請稍後再試。";
    default:
      return null;
  }
}

export function PublicOrderPage({
  orderNumber,
  order,
  anyUnderGoal,
  identity,
  error,
}: {
  orderNumber: string;
  order: PublicOrder | null;
  anyUnderGoal: boolean;
  identity: {
    purchaser_name: string;
    phone_last3: string;
  } | null;
  error?: string | null;
}) {
  if (!order || !identity) {
    const errorMessage = getErrorMessage(error);

    return (
      <div className="lux-shell">
        <header className="sticky top-0 z-20 border-b border-[rgba(177,140,92,0.18)] bg-[rgba(246,241,233,0.72)] backdrop-blur-xl">
          <div className="lux-page flex items-center justify-between gap-3 py-3">
            <div>
              <div className="lux-kicker">Order Access</div>
              <span className="font-display text-xl text-[hsl(var(--ink))]">
                訂單詳情
              </span>
            </div>
            <span className="rounded-full border border-[rgba(177,140,92,0.2)] bg-[rgba(255,251,246,0.88)] px-3 py-1.5 font-mono text-xs text-[hsl(var(--muted-foreground))]">
              {orderNumber}
            </span>
          </div>
        </header>
        <main className="lux-page">
          <section className="mx-auto max-w-3xl space-y-5">
            <div className="lux-panel-strong overflow-hidden p-6 md:p-8">
              <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)] md:items-end">
                <div className="space-y-3">
                  <div className="lux-kicker">Order Recovery</div>
                  <h1 className="font-display text-3xl text-[hsl(var(--ink))] md:text-4xl">
                    請先確認訂購人資訊，再開啟這筆訂單。
                  </h1>
                  <p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                    若你不是從訂單查詢頁或剛下單後直接進來，請重新輸入訂購人姓名與手機末三碼。
                  </p>
                  {errorMessage && (
                    <div className="rounded-[1rem] border border-[rgba(189,111,98,0.22)] bg-[rgba(246,225,220,0.82)] px-4 py-3 text-sm text-[rgb(140,67,56)]">
                      {errorMessage}
                    </div>
                  )}
                </div>

                <form action="/api/public-order/access" method="post" className="space-y-3">
                  <input type="hidden" name="order_number" value={orderNumber} />
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
                      訂單編號
                    </label>
                    <div className="lux-input flex items-center font-mono text-sm text-[hsl(var(--muted-foreground))]">
                      {orderNumber}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
                      訂購人姓名
                    </label>
                    <input
                      name="purchaser_name"
                      placeholder="王小美"
                      className="lux-input"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
                      手機末三碼
                    </label>
                    <input
                      name="phone_last3"
                      inputMode="numeric"
                      maxLength={3}
                      placeholder="678"
                      className="lux-input font-mono tracking-[0.35em]"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-[1.2rem] bg-[hsl(var(--forest))] px-5 py-4 text-sm font-semibold text-[hsl(var(--mist))] shadow-[0_24px_46px_-32px_rgba(22,31,26,0.78)]"
                  >
                    查看訂單
                  </button>
                </form>
              </div>
            </div>

            <Link
              href="/lookup"
              className="block text-center text-sm text-[hsl(var(--muted-foreground))] underline underline-offset-4"
            >
              返回訂單查詢
            </Link>
          </section>
        </main>
      </div>
    );
  }

  const items = order.order_items;
  const itemsTotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const status = order.status as OrderStatus;
  const lineBindMessage = `${order.order_number} ${identity.purchaser_name} ${identity.phone_last3}`;

  return (
    <div className="lux-shell">
      <header className="sticky top-0 z-20 border-b border-[rgba(177,140,92,0.18)] bg-[rgba(246,241,233,0.72)] backdrop-blur-xl">
        <div className="lux-page flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <div className="lux-kicker">Order Detail</div>
            <span className="truncate font-display text-xl text-[hsl(var(--ink))]">
              {order.order_number}
            </span>
          </div>
          <OrderStatusBadge status={status} />
        </div>
      </header>
      <main className="lux-page space-y-5">
        <section className="lux-panel-strong overflow-hidden p-5 md:p-7">
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-3">
              <div className="lux-kicker">Order Receipt</div>
              <h1 className="font-display text-3xl text-[hsl(var(--ink))] md:text-4xl">
                {status === "pending_payment" && "訂單已成立，等待匯款。"}
                {status === "pending_confirm" && "匯款回報已送出，等待賣家確認。"}
                {status === "confirmed" && "付款已確認，正在安排出貨。"}
                {status === "shipped" && "訂單已完成出貨。"}
                {status === "cancelled" && "這筆訂單已取消。"}
              </h1>
              <div className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                <span className="font-mono">{order.order_number}</span>
                {order.user?.purchaser_name && (
                  <span>
                    {" "}· 訂購人 {order.user.purchaser_name}
                    {order.user?.recipient_name
                      ? ` · 收貨人 ${order.user.recipient_name}`
                      : ""}
                    {order.user?.phone ? ` · ${maskPhone(order.user.phone)}` : ""}
                  </span>
                )}
              </div>
              {status === "pending_confirm" && order.payment_amount !== null && (
                <div className="flex flex-wrap gap-2">
                  <span className="lux-pill">
                    已回報 {formatCurrency(order.payment_amount)}
                  </span>
                  {order.payment_last5 && (
                    <span className="lux-pill font-mono">
                      後五碼 {order.payment_last5}
                    </span>
                  )}
                </div>
              )}
              {status === "shipped" && order.shipped_at && (
                <div className="lux-pill">
                  出貨時間 {new Date(order.shipped_at).toLocaleString("zh-TW")}
                </div>
              )}
              {status === "cancelled" && order.cancel_reason && (
                <div className="lux-pill border-[rgba(189,111,98,0.22)] bg-[rgba(246,225,220,0.82)] text-[rgb(140,67,56)]">
                  取消原因：{order.cancel_reason}
                </div>
              )}
            </div>
            <div className="lux-panel-muted p-4 text-right">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[hsl(var(--bronze))]">
                Total
              </div>
              <div className="mt-2 font-display text-3xl text-[hsl(var(--ink))]">
                {formatCurrency(order.total_amount)}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="lux-panel p-5 md:p-6">
            <div className="lux-kicker">Order Summary</div>
            <div className="mt-2 font-display text-2xl text-[hsl(var(--ink))]">
              訂單內容
            </div>
            <div className="mt-5 space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 border-b border-[rgba(177,140,92,0.14)] pb-3 text-sm last:border-0 last:pb-0"
                >
                  <span className="leading-6 text-[hsl(var(--ink))]">
                    {item.product_name} ×{item.quantity}
                  </span>
                  <span className="shrink-0 font-semibold text-[hsl(var(--ink))]">
                    {formatCurrency(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-2 border-t border-[rgba(177,140,92,0.18)] pt-4 text-sm">
              <div className="flex justify-between text-[hsl(var(--muted-foreground))]">
                <span>商品小計</span>
                <span>{formatCurrency(itemsTotal)}</span>
              </div>
              {order.shipping_fee !== null && order.shipping_fee > 0 && (
                <div className="flex justify-between text-[rgb(74,96,136)]">
                  <span>宅配運費</span>
                  <span>{formatCurrency(order.shipping_fee)}</span>
                </div>
              )}
              {order.pickup_location && (
                <div className="flex justify-between text-[rgb(65,98,61)]">
                  <span>面交免運</span>
                  <span>$0</span>
                </div>
              )}
              <div className="flex justify-between pt-2 font-display text-2xl text-[hsl(var(--ink))]">
                <span>合計</span>
                <span>{formatCurrency(order.total_amount)}</span>
              </div>
            </div>

            <div className="mt-6 space-y-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              {order.user?.nickname && (
                <div className="lux-panel-muted p-3">暱稱：{order.user.nickname}</div>
              )}
              {order.user?.purchaser_name && (
                <div className="lux-panel-muted p-3">
                  訂購人：{order.user.purchaser_name}
                </div>
              )}
              {order.user?.recipient_name && (
                <div className="lux-panel-muted p-3">
                  收貨人：{order.user.recipient_name}
                </div>
              )}
              {order.user?.phone && (
                <div className="lux-panel-muted p-3">
                  聯絡電話：{order.user.phone}
                </div>
              )}
              {order.user?.address && (
                <div className="lux-panel-muted p-3">
                  收貨地址：{order.user.address}
                </div>
              )}
              {order.pickup_location ? (
                <div className="lux-panel-muted p-3">面交地點：{order.pickup_location}</div>
              ) : (
                <div className="lux-panel-muted p-3">
                  回報匯款商家確認後將儘速安排出貨，屆時請留意通知。
                </div>
              )}
              {order.note && <div className="lux-panel-muted p-3">備註：{order.note}</div>}
            </div>
          </div>

          <div className="space-y-4">
            {status === "pending_payment" && (
              <div className="lux-panel-strong p-5 md:p-6">
                <div className="lux-kicker">Bank Transfer</div>
                <div className="mt-2 font-display text-2xl text-[hsl(var(--ink))]">
                  匯款帳戶資訊
                </div>
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[hsl(var(--muted-foreground))]">銀行</span>
                    <span className="font-medium text-[hsl(var(--ink))]">{BANK_INFO.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[hsl(var(--muted-foreground))]">戶名</span>
                    <span className="font-medium text-[hsl(var(--ink))]">{BANK_INFO.holder}</span>
                  </div>
                  <div className="rounded-[1.2rem] border border-[rgba(177,140,92,0.2)] bg-[rgba(255,251,246,0.88)] px-4 py-3 text-center">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-[hsl(var(--bronze))]">
                      Account
                    </div>
                    <div className="mt-2 font-mono text-lg font-semibold tracking-[0.28em] text-[hsl(var(--ink))]">
                      {BANK_INFO.account}
                    </div>
                  </div>
                  <div className="lux-panel-muted p-4">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-[hsl(var(--bronze))]">
                      Amount Due
                    </div>
                    <div className="mt-2 font-display text-3xl text-[hsl(var(--forest))]">
                      {formatCurrency(order.total_amount)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {status !== "cancelled" && !order.line_user_id && (
              <div className="lux-panel p-5 md:p-6">
                <div className="lux-kicker">LINE Binding</div>
                <div className="mt-2 font-display text-2xl text-[hsl(var(--ink))]">
                  綁定 LINE 通知
                </div>
                <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                  將以下內容完整貼到官方 LINE，之後這筆訂單的到貨與出貨通知就會直接送到你。
                </p>
                <div className="mt-4 rounded-[1.35rem] border border-[rgba(177,140,92,0.2)] bg-[rgba(255,251,246,0.92)] px-4 py-4 text-center font-mono text-sm font-semibold tracking-[0.12em] text-[hsl(var(--ink))]">
                  <span className="select-all cursor-text">{lineBindMessage}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <CopyTextButton
                    text={lineBindMessage}
                    label="一鍵複製綁定內容"
                  />
                  <a
                    href={LINE_OA_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[hsl(var(--forest))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--mist))]"
                  >
                    前往官方 LINE
                  </a>
                </div>
              </div>
            )}

            {status === "pending_payment" && (
              <div className="lux-panel p-5 md:p-6">
                <div className="lux-kicker">Payment Report</div>
                <div className="mt-2 font-display text-2xl text-[hsl(var(--ink))]">
                  完成匯款回報
                </div>
                <div className="mt-5">
                  <PaymentReportForm
                    orderNumber={order.order_number}
                    purchaserName={identity.purchaser_name}
                    phoneLast3={identity.phone_last3}
                    orderTotal={order.total_amount}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {order.round_id && <SharePanel roundId={order.round_id} show={anyUnderGoal} />}

        <section className="flex flex-col gap-3 md:flex-row">
          {order.round_id && (
            <a
              href={buildShareUrl(order.round_id)}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[1.2rem] border border-[rgba(177,140,92,0.28)] bg-[rgba(255,251,246,0.9)] px-5 py-3 text-sm font-semibold text-[hsl(var(--ink))]"
            >
              繼續選購
            </a>
          )}
          {status === "pending_payment" ? (
            <div className="flex-1">
              <CancelOrderButton
                orderNumber={order.order_number}
                purchaserName={identity.purchaser_name}
                phoneLast3={identity.phone_last3}
              />
            </div>
          ) : (
            <Link
              href="/"
              className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[1.2rem] bg-[hsl(var(--forest))] px-5 py-3 text-sm font-semibold text-[hsl(var(--mist))]"
            >
              返回首頁
            </Link>
          )}
        </section>

        {status !== "pending_payment" && (
          <Link
            href="/lookup"
            className="block text-center text-sm text-[hsl(var(--muted-foreground))] underline underline-offset-4"
          >
            重新查詢其他訂單
          </Link>
        )}
      </main>
    </div>
  );
}
