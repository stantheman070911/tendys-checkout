"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PICKUP_OPTIONS } from "@/constants";
import { formatCurrency, generateSubmissionKey } from "@/lib/utils";
import type { ProductWithProgress } from "@/types";

interface POSFormProps {
  open: boolean;
  onClose: () => void;
  roundId: string;
  products: ProductWithProgress[];
  shippingFee: number | null;
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
  roundId,
  products,
  shippingFee,
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
        const res = await fetch(
          `/api/users/lookup?nickname=${encodeURIComponent(nickname.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setRecipientName(data.user.recipient_name ?? "");
            setPhone(data.user.phone ?? "");
            setAddress(data.user.address ?? "");
            setEmail(data.user.email ?? "");
            setAutoFilled(true);
          }
        }
      } catch {
        // silent
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [nickname, autoFilled]);

  const activeProducts = products.filter((p) => p.is_active);

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product_id === productId);
      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) return prev.filter((c) => c.product_id !== productId);
        const prod = products.find((p) => p.id === productId);
        if (prod?.stock != null && newQty > prod.stock) return prev;
        return prev.map((c) =>
          c.product_id === productId ? { ...c, quantity: newQty } : c
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
    0
  );
  const isDelivery = pickup === "";
  const appliedFee = isDelivery && shippingFee ? shippingFee : 0;
  const total = itemsTotal + appliedFee;

  const canSubmit =
    cart.length > 0 && nickname.trim() && recipientName.trim() && phone.trim();

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
      const orderRes = await fetch("/api/submit-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          round_id: roundId,
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
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        toast({
          title: orderData.error || "建立訂單失敗",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

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
            <div className="text-sm font-medium text-gray-700 mb-2">
              選擇商品
            </div>
            <div className="space-y-2">
              {activeProducts.map((p) => {
                const inCart = cart.find((c) => c.product_id === p.id);
                const qty = inCart?.quantity ?? 0;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2"
                  >
                    <div className="text-sm">
                      {p.name}{" "}
                      <span className="text-gray-400">
                        {formatCurrency(p.price)}/{p.unit}
                      </span>
                      {p.stock != null && (
                        <span className="text-xs text-gray-400 ml-1">
                          庫存{p.stock}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(p.id, -1)}
                        disabled={qty === 0}
                        className="w-7 h-7 rounded-lg border text-sm disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-bold">
                        {qty}
                      </span>
                      <button
                        onClick={() => updateQty(p.id, 1)}
                        disabled={p.stock != null && qty >= p.stock}
                        className="w-7 h-7 rounded-lg border text-sm disabled:opacity-30"
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
            <div className="text-sm font-medium text-gray-700">客戶資料</div>
            <input
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setAutoFilled(false);
              }}
              placeholder="LINE 暱稱"
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="收貨人姓名"
                className="border rounded-xl px-3 py-2.5 text-sm"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="電話"
                className="border rounded-xl px-3 py-2.5 text-sm"
              />
            </div>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="地址（宅配時填寫）"
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email（選填）"
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
            />
          </div>

          {/* Pickup */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">取貨方式</div>
            <div className="flex gap-2 flex-wrap">
              {PICKUP_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPickup(opt.value)}
                  className={`text-xs px-3 py-1.5 rounded-full transition ${
                    pickup === opt.value
                      ? "bg-indigo-600 text-white"
                      : "bg-white border"
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
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
          />

          {/* Summary */}
          {cart.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-1 text-sm">
              {cart.map((c) => (
                <div key={c.product_id} className="flex justify-between">
                  <span>
                    {c.product_name} ×{c.quantity}
                  </span>
                  <span>{formatCurrency(c.unit_price * c.quantity)}</span>
                </div>
              ))}
              {appliedFee > 0 && (
                <div className="flex justify-between text-blue-500">
                  <span>宅配運費</span>
                  <span>{formatCurrency(appliedFee)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t pt-1">
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
              className="flex-1 border-2 border-indigo-600 text-indigo-600 rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
            >
              建立訂單
            </button>
            <button
              onClick={() => handleSubmit(true)}
              disabled={!canSubmit || submitting}
              className="flex-1 bg-green-600 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
            >
              {submitting ? "處理中…" : "建立並現場收款"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
