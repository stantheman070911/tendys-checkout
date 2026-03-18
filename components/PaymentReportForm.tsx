"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    const mismatch = parsedAmount !== orderTotal;

    return (
      <div className="rounded-lg border p-4 space-y-4">
        <h3 className="font-semibold">確認匯款資訊</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>訂單金額</span>
            <span>{formatCurrency(orderTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>回報金額</span>
            <span
              className={mismatch ? "text-orange-600 font-medium" : ""}
            >
              {formatCurrency(parsedAmount)}
            </span>
          </div>
          {mismatch && (
            <p className="text-orange-600 text-xs">
              回報金額與訂單金額不同，請確認是否正確
            </p>
          )}
          <div className="flex justify-between">
            <span>帳號末五碼</span>
            <span>{last5.trim()}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 h-11"
            onClick={() => setConfirming(false)}
            disabled={submitting}
          >
            返回修改
          </Button>
          <Button
            className="flex-1 h-11"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "送出中..." : "確認送出"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleReview}
      className="rounded-lg border p-4 space-y-4"
    >
      <h3 className="font-semibold">回報匯款</h3>
      <div className="space-y-2">
        <Label htmlFor="paymentAmount">匯款金額</Label>
        <Input
          id="paymentAmount"
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`應付 ${formatCurrency(orderTotal)}`}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="last5">帳號末五碼</Label>
        <Input
          id="last5"
          maxLength={5}
          value={last5}
          onChange={(e) => setLast5(e.target.value)}
          placeholder="12345"
          required
        />
      </div>
      <Button type="submit" className="w-full h-11">
        回報匯款
      </Button>
    </form>
  );
}
