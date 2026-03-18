"use client";

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

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-green-700 text-white shadow-2xl pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-lg flex items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <span className="text-green-300 text-sm">{count} 件</span>
          <span className="font-bold text-2xl ml-2">
            {formatCurrency(itemsTotal)}
          </span>
          {shippingFee ? (
            <span className="text-green-400 text-xs ml-2">
              宅配另加 {formatCurrency(shippingFee)}
            </span>
          ) : null}
        </div>
        <button
          onClick={onCheckout}
          className="bg-white text-green-700 font-bold px-6 py-2.5 rounded-xl text-sm shrink-0 ml-3 active:bg-green-50"
        >
          結帳 →
        </button>
      </div>
    </div>
  );
}
