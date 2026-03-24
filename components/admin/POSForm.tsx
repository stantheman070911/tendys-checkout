"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getRoundPickupOptions } from "@/lib/pickup-options";
import { formatCurrency, generateSubmissionKey } from "@/lib/utils";
import type { ProductWithProgress, Round } from "@/types";

interface POSFormProps {
  open: boolean;
  onClose: () => void;
  round: Round;
  products: ProductWithProgress[];
  adminFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
  onSuccess: () => void;
}

interface CartEntry {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
}

export function POSForm({
  open,
  onClose,
  round,
  products,
  adminFetch,
  onSuccess,
}: POSFormProps) {
  const { toast } = useToast();
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [nickname, setNickname] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [pickup, setPickup] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setCart([]);
      setNickname("");
      setRecipientName("");
      setPhone("");
      setAddress("");
      setEmail("");
      setPickup("");
      setNote("");
      setAutoFilled(false);
    }
  }, [open]);

  // Auto-fill from nickname
  useEffect(() => {
    if (!nickname.trim() || autoFilled) return;
    const timer = setTimeout(async () => {
      try {
        const data = await adminFetch<{
          user: {
            recipient_name?: string | null;
            phone?: string | null;
            address?: string | null;
            email?: string | null;
          } | null;
        }>(`/api/users/lookup?nickname=${encodeURIComponent(nickname.trim())}`);
        if (data.user) {
          setRecipientName(data.user.recipient_name ?? "");
          setPhone(data.user.phone ?? "");
          setAddress(data.user.address ?? "");
          setEmail(data.user.email ?? "");
          setAutoFilled(true);
        }
      } catch {
        // silent
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [nickname, autoFilled, adminFetch]);

  const activeProducts = products.filter((p) => p.is_active);
  const pickupOptions = getRoundPickupOptions(round);

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product_id === productId);
      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) return prev.filter((c) => c.product_id !== productId);
        const prod = products.find((p) => p.id === productId);
        if (prod?.stock != null && newQty > prod.stock) return prev;
        return prev.map((c) =>
          c.product_id === productId ? { ...c, quantity: newQty } : c,
        );
      }
      if (delta <= 0) return prev;
      const prod = products.find((p) => p.id === productId);
      if (!prod) return prev;
      if (prod.stock != null && prod.stock <= 0) return prev;
      return [
        ...prev,
        {
          product_id: prod.id,
          product_name: prod.name,
          unit_price: prod.price,
          quantity: 1,
        },
      ];
    });
  };

  const itemsTotal = cart.reduce(
    (sum, c) => sum + c.unit_price * c.quantity,
    0,
  );
  const isDelivery = pickup === "";
  const appliedFee = isDelivery && round.shipping_fee ? round.shipping_fee : 0;
  const total = itemsTotal + appliedFee;

  const canSubmit =
    cart.length > 0 &&
    nickname.trim() &&
    recipientName.trim() &&
    phone.trim() &&
    (!isDelivery || address.trim());

  const handleSubmit = async (quickConfirm: boolean) => {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const submissionKey = generateSubmissionKey();
      const items = cart.map((c) => ({
        product_id: c.product_id,
        product_name: c.product_name,
        unit_price: c.unit_price,
        quantity: c.quantity,
        subtotal: c.unit_price * c.quantity,
      }));

      // Create order
      const orderData = await adminFetch<{ order?: { id: string } }>(
        "/api/submit-order",
        {
          method: "POST",
          body: JSON.stringify({
            round_id: round.id,
            nickname: nickname.trim(),
            recipient_name: recipientName.trim(),
            phone: phone.trim(),
            address: address.trim() || undefined,
            email: email.trim() || undefined,
            pickup_location: pickup,
            items,
            submission_key: submissionKey,
            note: note.trim() || undefined,
          }),
        },
      );

      // Quick confirm if requested
      if (quickConfirm && orderData.order?.id) {
        await adminFetch("/api/quick-confirm", {
          method: "POST",
          body: JSON.stringify({
            orderId: orderData.order.id,
            paymentAmount: total,
          }),
        });
      }

      toast({
        title: quickConfirm ? "訂單已建立並收款" : "訂單已建立",
      });
      onClose();
      onSuccess();
    } catch {
      toast({ title: "操作失敗", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>代客下單</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product picker */}
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
              選擇商品
            </div>
            <div className="space-y-2">
              {activeProducts.map((p) => {
                const inCart = cart.find((c) => c.product_id === p.id);
                const qty = inCart?.quantity ?? 0;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-[1.15rem] border border-[rgba(177,140,92,0.16)] bg-[rgba(244,239,230,0.72)] px-3 py-3"
                  >
                    <div className="text-sm text-[hsl(var(--ink))]">
                      {p.name}{" "}
                      <span className="text-[hsl(var(--muted-foreground))]">
                        {formatCurrency(p.price)}/{p.unit}
                      </span>
                      {p.stock != null && (
                        <span className="ml-1 text-xs text-[hsl(var(--muted-foreground))]">
                          庫存{p.stock}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(p.id, -1)}
                        disabled={qty === 0}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(177,140,92,0.24)] bg-[rgba(255,251,246,0.88)] text-sm disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-semibold text-[hsl(var(--ink))]">
                        {qty}
                      </span>
                      <button
                        onClick={() => updateQty(p.id, 1)}
                        disabled={p.stock != null && qty >= p.stock}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--forest))] text-sm text-[hsl(var(--mist))] disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Customer info */}
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
              客戶資料
            </div>
            <input
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setAutoFilled(false);
              }}
              placeholder="LINE 暱稱"
              className="lux-input"
            />
            <div className="grid gap-2 md:grid-cols-2">
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="收貨人姓名"
                className="lux-input"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="電話"
                className="lux-input"
              />
            </div>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="地址（宅配時填寫）"
              className="lux-input"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email（選填）"
              className="lux-input"
            />
          </div>

          {/* Pickup */}
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
              取貨方式
            </div>
            <div className="flex gap-2 flex-wrap">
              {pickupOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPickup(opt.value)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    pickup === opt.value
                      ? "bg-[hsl(var(--forest))] text-[hsl(var(--mist))]"
                      : "border border-[rgba(177,140,92,0.24)] bg-[rgba(255,251,246,0.88)] text-[hsl(var(--muted-foreground))]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="備註（選填）"
            className="lux-input"
          />

          {/* Summary */}
          {cart.length > 0 && (
            <div className="lux-panel-muted space-y-1 p-4 text-sm">
              {cart.map((c) => (
                <div key={c.product_id} className="flex justify-between">
                  <span>
                    {c.product_name} ×{c.quantity}
                  </span>
                  <span>{formatCurrency(c.unit_price * c.quantity)}</span>
                </div>
              ))}
              {appliedFee > 0 && (
                <div className="flex justify-between text-[rgb(74,96,136)]">
                  <span>宅配運費</span>
                  <span>{formatCurrency(appliedFee)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-[rgba(177,140,92,0.16)] pt-1 font-semibold text-[hsl(var(--ink))]">
                <span>合計</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          )}

          {/* Submit buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => handleSubmit(false)}
              disabled={!canSubmit || submitting}
              className="flex-1 rounded-[1.1rem] border border-[rgba(177,140,92,0.28)] bg-[rgba(255,251,246,0.9)] py-3 text-sm font-semibold text-[hsl(var(--ink))] disabled:opacity-50"
            >
              建立訂單
            </button>
            <button
              onClick={() => handleSubmit(true)}
              disabled={!canSubmit || submitting}
              className="flex-1 rounded-[1.1rem] bg-[hsl(var(--forest))] py-3 text-sm font-semibold text-[hsl(var(--mist))] disabled:opacity-50"
            >
              {submitting ? "處理中…" : "建立並現場收款"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
