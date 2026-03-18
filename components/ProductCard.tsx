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
  const atStockLimit =
    product.stock !== null && cartQty >= product.stock;
  const outOfStock = product.stock !== null && product.stock <= 0;
  const remainingStock =
    product.stock !== null ? product.stock - cartQty : null;

  return (
    <div
      className={`bg-white rounded-xl border p-3 transition ${outOfStock ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium">
            {product.name}
            {outOfStock && (
              <span className="ml-1.5 text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                已售完
              </span>
            )}
          </div>
          <div className="text-green-600 font-bold text-lg">
            {formatCurrency(product.price)}
            <span className="text-sm font-normal text-gray-400">
              /{product.unit}
            </span>
          </div>
          {remainingStock !== null && !outOfStock && (
            <div className="text-xs text-gray-400">
              庫存 {remainingStock} {product.unit}
            </div>
          )}
        </div>
        {!outOfStock && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 rounded-full text-xl font-bold"
              onClick={onRemove}
              disabled={cartQty === 0 || disabled}
            >
              −
            </Button>
            <span className="w-7 text-center font-bold text-lg tabular-nums">
              {cartQty}
            </span>
            <Button
              size="icon"
              className="h-11 w-11 rounded-full bg-green-600 text-white text-xl font-bold hover:bg-green-700"
              onClick={onAdd}
              disabled={atStockLimit || disabled}
            >
              +
            </Button>
          </div>
        )}
      </div>
      <ProgressBar
        currentQty={product.current_qty + cartQty}
        goalQty={product.goal_qty}
        unit={product.unit}
      />
      {atStockLimit && !outOfStock && (
        <p className="text-xs text-orange-500 mt-1">已達庫存上限</p>
      )}
    </div>
  );
}
