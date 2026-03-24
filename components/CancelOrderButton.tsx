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
  orderId: string;
  userPhone: string;
}

export function CancelOrderButton({ orderId, userPhone }: CancelOrderButtonProps) {
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
          orderId,
          phone_last4: userPhone.replace(/\D/g, "").slice(-4),
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
      router.refresh();
    } catch {
      toast({ title: "網路錯誤，請重試", variant: "destructive" });
      setCancelling(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="w-full border-2 border-red-200 text-red-600 rounded-xl py-2.5 text-sm font-medium min-h-[44px]">
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
            className="flex-1 border-2 rounded-xl py-2.5 font-medium text-gray-600"
          >
            返回
          </button>
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="flex-1 bg-red-600 text-white rounded-xl py-2.5 font-bold disabled:opacity-50"
          >
            {cancelling ? "取消中..." : "確定取消"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
