"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const orderTotal = calcOrderTotal(cartItems, shippingFee);
  const anyUnderGoal = products.some(
    (p) => p.goal_qty !== null && p.current_qty < p.goal_qty
  );
  const roundClosed =
    !round.is_open ||
    (round.deadline !== null && new Date(round.deadline) < new Date());

  // Cart actions
  const addToCart = useCallback(
    (product: ProductWithProgress) => {
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
    },
    []
  );

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

  // Nickname auto-fill
  async function handleNicknameBlur() {
    const trimmed = nickname.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(
        `/api/users/lookup?nickname=${encodeURIComponent(trimmed)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.user) {
        if (data.user.recipient_name) setRecipientName(data.user.recipient_name);
        if (data.user.phone) setPhone(data.user.phone);
        if (data.user.address) setAddress(data.user.address);
        if (data.user.email) setEmail(data.user.email);
        toast({ title: "已自動帶入上次資料" });
      }
    } catch {
      // Silent fail — auto-fill is convenience only
    }
  }

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

      router.push(`/order/${data.order.id}`);
    } catch {
      toast({ title: "網路錯誤，請重試", variant: "destructive" });
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 pt-6 pb-32 space-y-6">
      <h1 className="text-xl font-bold text-center">{round.name}</h1>

      <DeadlineBanner deadline={round.deadline} isOpen={round.is_open} />
      <SharePanel roundId={round.id} show={anyUnderGoal} />

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <p className="text-center text-muted-foreground py-8">
          目前沒有商品
        </p>
      )}

      {/* Checkout Form */}
      {checkoutOpen && (
        <div ref={checkoutRef} className="space-y-6 border-t pt-6">
          <h2 className="text-lg font-semibold">結帳資訊</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nickname">暱稱 *</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onBlur={handleNicknameBlur}
                placeholder="輸入暱稱（回購自動帶入資料）"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipientName">收件人姓名 *</Label>
              <Input
                id="recipientName"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="真實姓名"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">電話 *</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912-345-678"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickup">取貨方式</Label>
              <Select value={pickupLocation} onValueChange={setPickupLocation}>
                <SelectTrigger id="pickup" className="h-11">
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
                <Label htmlFor="address">地址</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="宅配地址"
                />
                {shippingFee && <ShippingFeeNote fee={shippingFee} />}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email（選填，收通知用）</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">備註（選填）</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="特殊需求"
              />
            </div>

            {/* Order Summary */}
            <div className="rounded-lg border p-4 space-y-2">
              <h3 className="font-semibold">訂單摘要</h3>
              {cartItems.map((item) => (
                <div
                  key={item.product_id}
                  className="flex justify-between text-sm"
                >
                  <span>
                    {item.product_name} x{item.quantity}
                  </span>
                  <span>{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
              {shippingFee && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>宅配運費</span>
                  <span>{formatCurrency(shippingFee)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>合計</span>
                <span>{formatCurrency(orderTotal)}</span>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base"
              disabled={submitting || cartItems.length === 0 || roundClosed}
            >
              {submitting ? "送出中..." : "確認下單"}
            </Button>
          </form>
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
  );
}
