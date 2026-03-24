"use client";

import Link from "next/link";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeadlineBanner } from "@/components/DeadlineBanner";
import { ProductCard } from "@/components/ProductCard";
import { CartBar } from "@/components/CartBar";
import { SharePanel } from "@/components/SharePanel";
import { ShippingFeeNote } from "@/components/ShippingFeeNote";
import {
  formatCurrency,
  calcOrderTotal,
  generateSubmissionKey,
  getPublicOrderAccessSessionKey,
  getPhoneLast3,
} from "@/lib/utils";
import { PICKUP_OPTIONS } from "@/constants";
import { useToast } from "@/hooks/use-toast";
import type { Round, ProductWithProgress, CartItem } from "@/types";

// Radix Select doesn't support empty string values — use sentinel
const DELIVERY_VALUE = "__delivery__";

interface StorefrontClientProps {
  round: Round;
  products: ProductWithProgress[];
}

export function StorefrontClient({ round, products }: StorefrontClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const checkoutRef = useRef<HTMLDivElement>(null);

  // Cart state
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionKey, setSubmissionKey] = useState<string | null>(null);

  // Form state
  const [nickname, setNickname] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [pickupLocation, setPickupLocation] = useState(DELIVERY_VALUE);
  const [note, setNote] = useState("");

  // Derived
  const isDelivery = pickupLocation === DELIVERY_VALUE;
  const shippingFee =
    isDelivery && round.shipping_fee ? round.shipping_fee : null;
  const cartItems = Array.from(cart.values());
  const itemsTotal = cartItems.reduce((sum, i) => sum + i.subtotal, 0);
  const orderTotal = calcOrderTotal(cartItems, shippingFee);
  const anyUnderGoal = products.some(
    (p) => p.goal_qty !== null && p.current_qty < p.goal_qty,
  );
  const roundClosed =
    !round.is_open ||
    (round.deadline !== null && new Date(round.deadline) < new Date());

  // Cart actions
  const addToCart = useCallback((product: ProductWithProgress) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(product.id);
      const currentQty = existing?.quantity ?? 0;
      if (product.stock !== null && currentQty >= product.stock) return prev;
      const newQty = currentQty + 1;
      next.set(product.id, {
        product_id: product.id,
        product_name: product.name,
        unit_price: product.price,
        quantity: newQty,
        subtotal: product.price * newQty,
      });
      return next;
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(productId);
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        next.delete(productId);
      } else {
        const newQty = existing.quantity - 1;
        next.set(productId, {
          ...existing,
          quantity: newQty,
          subtotal: existing.unit_price * newQty,
        });
      }
      return next;
    });
  }, []);

  // Checkout open
  function handleCheckout() {
    setCheckoutOpen(true);
    if (!submissionKey) setSubmissionKey(generateSubmissionKey());
    setTimeout(() => {
      checkoutRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  // Submit order
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || cartItems.length === 0) return;

    const trimmedNickname = nickname.trim();
    const trimmedName = recipientName.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedNickname) {
      toast({ title: "請輸入暱稱", variant: "destructive" });
      return;
    }
    if (!trimmedName) {
      toast({ title: "請輸入收件人姓名", variant: "destructive" });
      return;
    }
    if (!trimmedPhone) {
      toast({ title: "請輸入電話", variant: "destructive" });
      return;
    }

    const key = submissionKey ?? generateSubmissionKey();
    if (!submissionKey) setSubmissionKey(key);

    setSubmitting(true);
    try {
      const res = await fetch("/api/submit-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          round_id: round.id,
          nickname: trimmedNickname,
          recipient_name: trimmedName,
          phone: trimmedPhone,
          address: address.trim() || undefined,
          email: email.trim() || undefined,
          pickup_location: isDelivery ? "" : pickupLocation,
          items: cartItems,
          submission_key: key,
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "下單失敗", variant: "destructive" });
        setSubmitting(false);
        return;
      }

      const orderNumber = data.order.order_number as string;
      sessionStorage.setItem(
        getPublicOrderAccessSessionKey(orderNumber),
        JSON.stringify({
          recipient_name: trimmedName,
          phone_last3: getPhoneLast3(trimmedPhone),
        }),
      );

      router.push(`/order/${encodeURIComponent(orderNumber)}`);
    } catch {
      toast({ title: "網路錯誤，請重試", variant: "destructive" });
      setSubmitting(false);
    }
  }

  return (
    <div className="lux-shell">
      <header className="sticky top-0 z-20 border-b border-[rgba(177,140,92,0.18)] bg-[rgba(246,241,233,0.72)] backdrop-blur-xl">
        <div className="lux-page flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <div className="lux-kicker">Tendy Market Round</div>
            <span className="truncate font-display text-lg text-[hsl(var(--ink))] md:text-xl">
              {round.name}
            </span>
          </div>
          <Link
            href="/lookup"
            className="shrink-0 rounded-full border border-[rgba(177,140,92,0.28)] bg-[rgba(255,251,246,0.9)] px-4 py-2 text-xs font-semibold tracking-[0.08em] text-[hsl(var(--ink))] hover:-translate-y-0.5 hover:bg-white"
          >
            查訂單
          </Link>
        </div>
      </header>
      <main className="lux-page space-y-6 md:space-y-8">
        <section className="lux-panel-strong relative overflow-hidden p-5 md:p-8">
          <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(177,140,92,0.24),transparent_48%)] md:block" />
          <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)] lg:items-end">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="lux-kicker">你好！我們是 Tendy。</div>
                <h1 className="lux-title text-balance">
                  <span className="block">讓好好種的人，</span>
                  <span className="block">被好好吃的人看見。</span>
                </h1>
                <p className="lux-subtitle max-w-2xl">
                  一個連結優質農民與消費者的生鮮品牌。為消費者策展優質蔬果，一次完成下單與匯款回報。
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <span className="lux-pill">{products.length} 款商品</span>
                <span className="lux-pill">
                  {round.shipping_fee
                    ? `宅配運費 ${formatCurrency(round.shipping_fee)}`
                    : "依團務設定運費"}
                </span>
                <span className="lux-pill">
                  指定面交點免運
                </span>
                {roundClosed && (
                  <span className="lux-pill border-[rgba(189,111,98,0.22)] bg-[rgba(246,225,220,0.82)] text-[rgb(140,67,56)]">
                    本輪已截單
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <DeadlineBanner
                deadline={round.deadline}
                isOpen={round.is_open}
                roundName={round.name}
              />
              <div className="lux-panel-muted p-4">
                <div className="lux-kicker">How It Works</div>
                <div className="mt-2 space-y-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                  <p>挑選商品後直接完成下單，訂單成立後即可查看匯款資訊與後續狀態。</p>
                  <p>如有成團中商品，可直接把本團分享給熟客朋友一起湊單。</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <SharePanel roundId={round.id} show={anyUnderGoal} />

        <section className="space-y-4">
          <div className="lux-section-heading">
            <div>
              <div className="lux-eyebrow">Current Selection</div>
              <h2 className="font-display text-2xl text-[hsl(var(--ink))] md:text-3xl">
                本輪鮮貨清單
              </h2>
            </div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">
              {roundClosed ? "本輪已結束，仍可查詢既有訂單" : "點擊加減，直接完成選購"}
            </div>
          </div>

          {products.length === 0 ? (
            <div className="lux-panel p-12 text-center text-[hsl(var(--muted-foreground))]">
              目前沒有商品
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  cartQty={cart.get(product.id)?.quantity ?? 0}
                  onAdd={() => addToCart(product)}
                  onRemove={() => removeFromCart(product.id)}
                  disabled={roundClosed}
                />
              ))}
            </div>
          )}
        </section>

        {checkoutOpen && (
          <section ref={checkoutRef} className="space-y-4 md:space-y-5">
            <div className="lux-section-heading">
              <div>
                <div className="lux-eyebrow">Order Composition</div>
                <h2 className="font-display text-2xl text-[hsl(var(--ink))] md:text-3xl">
                  完成這筆訂單
                </h2>
              </div>
              <div className="text-sm text-[hsl(var(--muted-foreground))]">
                一頁完成收貨資訊與訂單確認
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
              <div className="lux-panel-strong p-5 md:p-6">
                <div className="lux-kicker">Order Summary</div>
                <div className="mt-2 font-display text-2xl text-[hsl(var(--ink))]">
                  訂單明細
                </div>
                <div className="mt-5 space-y-3">
                  {cartItems.map((item) => (
                    <div
                      key={item.product_id}
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
                  {shippingFee ? (
                    <div className="flex justify-between text-[rgb(74,96,136)]">
                      <span>宅配運費</span>
                      <span>{formatCurrency(shippingFee)}</span>
                    </div>
                  ) : !isDelivery ? (
                    <div className="flex justify-between text-[rgb(65,98,61)]">
                      <span>面交免運</span>
                      <span>$0</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between pt-2 font-display text-2xl text-[hsl(var(--ink))]">
                    <span>合計</span>
                    <span>{formatCurrency(orderTotal)}</span>
                  </div>
                </div>
              </div>

              <div className="lux-panel p-5 md:p-6">
                <div className="space-y-2">
                  <div className="lux-kicker">Recipient Details</div>
                  <div className="font-display text-2xl text-[hsl(var(--ink))]">
                    收貨與聯絡資訊
                  </div>
                  <p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                    為保護個資，系統不再自動帶入舊資料。請重新確認本次收貨資訊。
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
                      LINE 暱稱
                    </label>
                    <Input
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="你在群組的暱稱"
                      required
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
                        收貨人
                      </label>
                      <Input
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="真實姓名"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
                        電話
                      </label>
                      <Input
                        type="tel"
                        inputMode="tel"
                        maxLength={20}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0912-345-678"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
                      取貨方式
                    </label>
                    <Select
                      value={pickupLocation}
                      onValueChange={setPickupLocation}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PICKUP_OPTIONS.map((opt) => (
                          <SelectItem
                            key={opt.value || DELIVERY_VALUE}
                            value={opt.value || DELIVERY_VALUE}
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {isDelivery && (
                    <div className="space-y-2">
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
                        收貨地址
                      </label>
                      <Input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="縣市、區、路、號"
                      />
                      {shippingFee && <ShippingFeeNote fee={shippingFee} />}
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
                        Email
                      </label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
                        備註
                      </label>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="特殊需求"
                        className="lux-textarea min-h-[48px]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      submitting ||
                      cartItems.length === 0 ||
                      roundClosed ||
                      (isDelivery && !address.trim())
                    }
                    className="w-full rounded-[1.2rem] bg-[hsl(var(--forest))] px-5 py-4 text-base font-semibold text-[hsl(var(--mist))] shadow-[0_24px_46px_-32px_rgba(22,31,26,0.78)] disabled:opacity-50"
                  >
                    {submitting
                      ? "送出中..."
                      : `送出訂單 · ${formatCurrency(orderTotal)}`}
                  </button>
                  {isDelivery && !address.trim() && (
                    <p className="text-center text-xs text-[hsl(var(--muted-foreground))]">
                      宅配請填寫完整收貨地址。
                    </p>
                  )}
                </form>
              </div>
            </div>
          </section>
        )}

        {!roundClosed && (
          <CartBar
            items={cartItems}
            shippingFee={shippingFee}
            onCheckout={handleCheckout}
          />
        )}
      </main>
    </div>
  );
}
