"use client";

import { Button } from "@/components/ui/button";
import { formatCurrency, calcOrderTotal } from "@/lib/utils";
import type { CartItem } from "@/types";

interface CartBarProps {
  items: CartItem[];
  shippingFee: number | null;
  onCheckout: () => void;
}

export function CartBar({ items, shippingFee, onCheckout }: CartBarProps) {
  if (items.length === 0) return null;

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const itemsTotal = items.reduce((sum, i) => sum + i.subtotal, 0);
  const total = calcOrderTotal(items, shippingFee);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background shadow-lg pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-lg flex items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <p className="font-medium">
            共 {count} 件，合計 {formatCurrency(total)}
          </p>
          {shippingFee ? (
            <p className="text-xs text-muted-foreground truncate">
              商品 {formatCurrency(itemsTotal)} + 宅配運費{" "}
              {formatCurrency(shippingFee)}
            </p>
          ) : null}
        </div>
        <Button onClick={onCheckout} className="ml-3 shrink-0 h-11">
          前往結帳
        </Button>
      </div>
    </div>
  );
}
