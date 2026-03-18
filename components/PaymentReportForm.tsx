"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface PaymentReportFormProps {
  orderId: string;
  orderTotal: number;
}

export function PaymentReportForm({
  orderId,
  orderTotal,
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
          order_id: orderId,
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
      router.refresh();
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
        className={`rounded-xl p-4 border-2 ${
          match
            ? "border-green-400 bg-green-50"
            : "border-orange-300 bg-orange-50"
        }`}
      >
        <div className="font-bold text-center mb-3">
          {match ? "金額吻合" : "金額不符，請確認"}
        </div>
        <div className="space-y-2 text-sm bg-white rounded-xl p-3">
          <div className="flex justify-between">
            <span className="text-gray-500">訂單應付</span>
            <span className="font-bold">{formatCurrency(orderTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">填寫匯款</span>
            <span
              className={`font-bold ${match ? "text-green-700" : "text-orange-600"}`}
            >
              {formatCurrency(parsedAmount)}
            </span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="text-gray-500">帳號後五碼</span>
            <span className="font-bold font-mono tracking-widest">
              {last5.trim()}
            </span>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => setConfirming(false)}
            disabled={submitting}
            className="flex-1 border-2 rounded-xl py-3 font-medium text-gray-600"
          >
            ← 修改
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 bg-green-600 text-white rounded-xl py-3 font-bold disabled:opacity-50"
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
        <label className="block text-sm font-medium text-gray-600 mb-1.5">
          匯款金額
        </label>
        <input
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={String(orderTotal)}
          className="w-full border rounded-xl px-4 py-3.5 text-2xl font-bold"
          required
          autoFocus
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1.5">
          帳號後五碼
        </label>
        <input
          maxLength={5}
          value={last5}
          onChange={(e) => setLast5(e.target.value)}
          placeholder="56789"
          className="w-full border rounded-xl px-4 py-3.5 text-2xl font-bold tracking-widest"
          required
        />
      </div>
      <button
        type="submit"
        disabled={!amount || last5.length < 5}
        className="w-full bg-green-600 text-white rounded-xl py-4 font-bold text-lg disabled:opacity-40 hover:bg-green-700 transition"
      >
        核對後確認送出 →
      </button>
    </form>
  );
}
