"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface CancelOrderButtonProps {
  orderNumber: string;
  recipientName: string;
  phoneLast3: string;
  onSuccess?: () => void | Promise<void>;
}

export function CancelOrderButton({
  orderNumber,
  recipientName,
  phoneLast3,
  onSuccess,
}: CancelOrderButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch("/api/cancel-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_number: orderNumber,
          recipient_name: recipientName,
          phone_last3: phoneLast3,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "取消失敗", variant: "destructive" });
        setCancelling(false);
        return;
      }

      toast({ title: "訂單已取消" });
      setOpen(false);
      if (onSuccess) {
        await onSuccess();
      } else {
        router.refresh();
      }
    } catch {
      toast({ title: "網路錯誤，請重試", variant: "destructive" });
      setCancelling(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="w-full rounded-[1.2rem] border border-[rgba(189,111,98,0.28)] bg-[rgba(255,249,248,0.88)] py-3 text-sm font-semibold text-[rgb(140,67,56)] min-h-[44px]">
          取消訂單
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>確定取消訂單？</DialogTitle>
          <DialogDescription>
            取消後無法恢復，商品將釋放回庫存。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            onClick={() => setOpen(false)}
            disabled={cancelling}
            className="flex-1 rounded-[1.1rem] border border-[rgba(177,140,92,0.28)] bg-[rgba(255,251,246,0.9)] py-3 text-sm font-semibold text-[hsl(var(--ink))]"
          >
            返回
          </button>
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="flex-1 rounded-[1.1rem] bg-red-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {cancelling ? "取消中..." : "確定取消"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
