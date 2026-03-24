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

      router.push(
        `/order/${encodeURIComponent(data.order.order_number)}?code=${encodeURIComponent(data.order.access_code)}`,
      );
    } catch {
      toast({ title: "網路錯誤，請重試", variant: "destructive" });
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <header className="bg-green-700 text-white p-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <span className="font-bold text-sm">{round.name}</span>
          <Link
            href="/lookup"
            className="shrink-0 rounded-xl border border-green-500/60 bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500"
          >
            查訂單
          </Link>
        </div>
      </header>
      <main className="max-w-lg mx-auto p-3 space-y-3">
        <DeadlineBanner
          deadline={round.deadline}
          isOpen={round.is_open}
          roundName={round.name}
        />
        {round.shipping_fee && (
          <p className="text-xs text-center text-gray-400">
            宅配 +{formatCurrency(round.shipping_fee)} · 指定面交點免運費
          </p>
        )}
        <SharePanel roundId={round.id} show={anyUnderGoal} />

        {/* Product List */}
        <div className="space-y-3">
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

        {products.length === 0 && (
          <p className="text-center text-muted-foreground py-8">目前沒有商品</p>
        )}

        {/* Checkout Form */}
        {checkoutOpen && (
          <div ref={checkoutRef} className="space-y-4">
            {/* Order Details Card */}
            <div className="bg-white rounded-xl border p-4">
              <div className="font-medium text-gray-600 mb-2 text-sm">
                訂單明細
              </div>
              {cartItems.map((item) => (
                <div
                  key={item.product_id}
                  className="flex justify-between text-sm py-0.5"
                >
                  <span>
                    {item.product_name} x{item.quantity}
                  </span>
                  <span>{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
              <div className="border-t mt-2 pt-2 space-y-1">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>商品小計</span>
                  <span>{formatCurrency(itemsTotal)}</span>
                </div>
                {shippingFee ? (
                  <div className="flex justify-between text-sm text-blue-600">
                    <span>宅配運費</span>
                    <span>{formatCurrency(shippingFee)}</span>
                  </div>
                ) : !isDelivery ? (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>面交免運</span>
                    <span>$0</span>
                  </div>
                ) : null}
                <div className="flex justify-between font-bold text-lg pt-1">
                  <span>合計</span>
                  <span>{formatCurrency(orderTotal)}</span>
                </div>
              </div>
            </div>

            {/* Customer Info Card */}
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <div className="font-medium text-gray-600 text-sm">收貨資訊</div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    LINE 暱稱 *
                  </label>
                  <Input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="你在群組的暱稱"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    為保護個資，系統不再自動帶入舊的收貨資料。
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    收貨人 *
                  </label>
                  <Input
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="真實姓名"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    電話 *
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

                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    取貨方式
                  </label>
                  <Select
                    value={pickupLocation}
                    onValueChange={setPickupLocation}
                  >
                    <SelectTrigger className="h-11">
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
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
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

                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Email（選填）
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    備註（選填）
                  </label>
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="特殊需求"
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    cartItems.length === 0 ||
                    roundClosed ||
                    (isDelivery && !address.trim())
                  }
                  className="w-full bg-green-600 text-white rounded-xl py-4 font-bold text-lg disabled:opacity-50 hover:bg-green-700 transition"
                >
                  {submitting
                    ? "送出中..."
                    : `送出訂單 · ${formatCurrency(orderTotal)}`}
                </button>
                {isDelivery && !address.trim() && (
                  <p className="text-xs text-center text-gray-400">
                    宅配請填寫收貨地址
                  </p>
                )}
              </form>
            </div>
          </div>
        )}

        {/* CartBar */}
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
