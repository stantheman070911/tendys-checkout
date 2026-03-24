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
  const orderTotal = calcOrderTotal(items, shippingFee);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <div className="lux-floating-bar pointer-events-auto mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 md:px-5">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[rgba(245,240,231,0.78)]">
            {count} items selected
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-2xl text-white md:text-3xl">
              {formatCurrency(orderTotal)}
            </span>
            <span className="text-xs text-[rgba(245,240,231,0.78)]">
              商品小計 {formatCurrency(itemsTotal)}
            </span>
            {shippingFee ? (
              <span className="text-xs text-[rgba(245,240,231,0.78)]">
                宅配運費 {formatCurrency(shippingFee)}
              </span>
            ) : null}
          </div>
        </div>
        <button
          onClick={onCheckout}
          className="shrink-0 rounded-full border border-white/20 bg-[rgba(255,248,240,0.96)] px-5 py-3 text-sm font-semibold text-[hsl(var(--forest-deep))] shadow-[0_18px_30px_-24px_rgba(0,0,0,0.55)] active:translate-y-px"
        >
          前往下單
        </button>
      </div>
    </div>
  );
}
