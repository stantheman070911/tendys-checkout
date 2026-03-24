"use client";

import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ProgressBar";
import { formatCurrency } from "@/lib/utils";
import type { ProductWithProgress } from "@/types";

interface ProductCardProps {
  product: ProductWithProgress;
  cartQty: number;
  onAdd: () => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function ProductCard({
  product,
  cartQty,
  onAdd,
  onRemove,
  disabled,
}: ProductCardProps) {
  const atStockLimit = product.stock !== null && cartQty >= product.stock;
  const outOfStock = product.stock !== null && product.stock <= 0;
  const remainingStock =
    product.stock !== null ? product.stock - cartQty : null;
  const hasImage = !!product.image_url;
  const placeholderTone =
    product.current_qty >= (product.goal_qty ?? Number.MAX_SAFE_INTEGER)
      ? "from-[rgba(70,108,83,0.22)] via-[rgba(250,244,234,0.75)] to-[rgba(177,140,92,0.2)]"
      : "from-[rgba(177,140,92,0.2)] via-[rgba(250,244,234,0.8)] to-[rgba(128,145,122,0.16)]";

  return (
    <div
      className={`lux-panel-strong lux-card-hover overflow-hidden ${outOfStock ? "opacity-70" : ""}`}
    >
      <div className="grid gap-0 md:grid-cols-[1.2fr_1fr]">
        <div className="relative min-h-[220px]">
          {hasImage ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url("${product.image_url}")` }}
            />
          ) : (
            <div
              className={`absolute inset-0 bg-gradient-to-br ${placeholderTone}`}
            />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(23,28,24,0.08),rgba(23,28,24,0.48))]" />
          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
            <div className="flex flex-wrap gap-2">
              {product.supplier_name && (
                <span className="rounded-full border border-white/24 bg-[rgba(255,251,246,0.14)] px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-white/90 backdrop-blur-sm">
                  {product.supplier_name}
                </span>
              )}
              {outOfStock && (
                <span className="rounded-full border border-[rgba(255,255,255,0.28)] bg-[rgba(140,67,56,0.88)] px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-white">
                  售完
                </span>
              )}
            </div>
            {remainingStock !== null && !outOfStock && (
              <span className="rounded-full border border-white/24 bg-[rgba(255,251,246,0.14)] px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
                餘量 {remainingStock}
                {product.unit}
              </span>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 p-4 text-white">
            <div className="lux-kicker text-[rgba(255,242,224,0.78)]">
              seasonal selection
            </div>
            <div className="mt-2 font-display text-2xl leading-tight">
              {product.name}
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-5 p-4 md:p-5">
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-[hsl(var(--bronze))]">
                  curated price
                </div>
                <div className="mt-1 font-display text-3xl text-[hsl(var(--ink))]">
                  {formatCurrency(product.price)}
                </div>
                <div className="text-sm text-[hsl(var(--muted-foreground))]">
                  每 {product.unit}
                </div>
              </div>
              {!outOfStock && (
                <div className="rounded-[1.4rem] border border-[rgba(177,140,92,0.24)] bg-[rgba(255,251,246,0.82)] p-2 shadow-[0_18px_32px_-30px_rgba(31,40,32,0.4)]">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="text-xl font-bold"
                      onClick={onRemove}
                      disabled={cartQty === 0 || disabled}
                    >
                      −
                    </Button>
                    <span className="w-8 text-center text-lg font-semibold tabular-nums text-[hsl(var(--ink))]">
                      {cartQty}
                    </span>
                    <Button
                      size="icon"
                      className="text-xl font-bold"
                      onClick={onAdd}
                      disabled={atStockLimit || disabled}
                    >
                      +
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <ProgressBar
              currentQty={product.current_qty + cartQty}
              goalQty={product.goal_qty}
              unit={product.unit}
            />
          </div>

          <div className="flex items-center justify-between gap-3 text-xs text-[hsl(var(--muted-foreground))]">
            <span>已預訂 {product.current_qty + cartQty}{product.unit}</span>
            {atStockLimit && !outOfStock ? (
              <span className="rounded-full border border-[rgba(184,132,71,0.2)] bg-[rgba(242,228,203,0.8)] px-2.5 py-1 font-medium text-[rgb(120,84,39)]">
                已達庫存上限
              </span>
            ) : (
              <span>新鮮直送</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
