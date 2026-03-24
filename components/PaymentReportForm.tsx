"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface PaymentReportFormProps {
  orderNumber: string;
  recipientName: string;
  phoneLast3: string;
  orderTotal: number;
  onSuccess?: () => void | Promise<void>;
}

export function PaymentReportForm({
  orderNumber,
  recipientName,
  phoneLast3,
  orderTotal,
  onSuccess,
}: PaymentReportFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [last5, setLast5] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function handleReview(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = parseInt(amount, 10);
    if (!parsedAmount || parsedAmount <= 0) {
      toast({ title: "請輸入有效金額", variant: "destructive" });
      return;
    }
    if (last5.trim().length !== 5) {
      toast({ title: "帳號末五碼必須為 5 位", variant: "destructive" });
      return;
    }
    setConfirming(true);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/report-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_number: orderNumber,
          recipient_name: recipientName,
          phone_last3: phoneLast3,
          payment_amount: parseInt(amount, 10),
          payment_last5: last5.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "回報失敗", variant: "destructive" });
        setSubmitting(false);
        return;
      }

      toast({ title: "回報成功！" });
      if (onSuccess) {
        await onSuccess();
      } else {
        router.refresh();
      }
    } catch {
      toast({ title: "網路錯誤，請重試", variant: "destructive" });
      setSubmitting(false);
    }
  }

  if (confirming) {
    const parsedAmount = parseInt(amount, 10);
    const match = parsedAmount === orderTotal;

    return (
      <div
        className={`rounded-[1.4rem] border p-5 ${
          match
            ? "border-[rgba(95,126,92,0.2)] bg-[rgba(228,239,223,0.78)]"
            : "border-[rgba(184,132,71,0.24)] bg-[rgba(242,228,203,0.82)]"
        }`}
      >
        <div className="mb-3 text-center font-display text-2xl text-[hsl(var(--ink))]">
          {match ? "金額吻合" : "金額不符，請確認"}
        </div>
        <div className="space-y-2 rounded-[1.2rem] bg-[rgba(255,251,246,0.88)] p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-[hsl(var(--muted-foreground))]">訂單應付</span>
            <span className="font-semibold text-[hsl(var(--ink))]">
              {formatCurrency(orderTotal)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[hsl(var(--muted-foreground))]">填寫匯款</span>
            <span
              className={`font-semibold ${match ? "text-[rgb(65,98,61)]" : "text-[rgb(120,84,39)]"}`}
            >
              {formatCurrency(parsedAmount)}
            </span>
          </div>
          <div className="flex justify-between border-t border-[rgba(177,140,92,0.16)] pt-2">
            <span className="text-[hsl(var(--muted-foreground))]">帳號後五碼</span>
            <span className="font-mono font-semibold tracking-[0.28em] text-[hsl(var(--ink))]">
              {last5.trim()}
            </span>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => setConfirming(false)}
            disabled={submitting}
            className="flex-1 rounded-[1.1rem] border border-[rgba(177,140,92,0.28)] bg-[rgba(255,251,246,0.9)] py-3 text-sm font-semibold text-[hsl(var(--ink))]"
          >
            返回修改
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 rounded-[1.1rem] bg-[hsl(var(--forest))] py-3 text-sm font-semibold text-[hsl(var(--mist))] disabled:opacity-50"
          >
            {submitting ? "送出中..." : "確認送出"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleReview} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
          匯款金額
        </label>
        <input
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={String(orderTotal)}
          className="lux-input text-2xl font-semibold"
          required
          autoFocus
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
          帳號後五碼
        </label>
        <input
          maxLength={5}
          value={last5}
          onChange={(e) => setLast5(e.target.value)}
          placeholder="56789"
          className="lux-input text-2xl font-semibold tracking-[0.35em]"
          required
        />
      </div>
      <button
        type="submit"
        disabled={!amount || last5.length < 5}
        className="w-full rounded-[1.2rem] bg-[hsl(var(--forest))] py-4 text-base font-semibold text-[hsl(var(--mist))] disabled:opacity-40"
      >
        核對後送出
      </button>
    </form>
  );
}
