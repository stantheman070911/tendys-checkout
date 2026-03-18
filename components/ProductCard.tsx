"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-base truncate">{product.name}</h3>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(product.price)} / {product.unit}
            </p>
          </div>
          {product.stock !== null && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              庫存 {product.stock}
            </span>
          )}
        </div>

        <ProgressBar
          currentQty={product.current_qty}
          goalQty={product.goal_qty}
        />

        {outOfStock ? (
          <div className="text-center text-sm text-muted-foreground py-2">
            已售完
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11"
              onClick={onRemove}
              disabled={cartQty === 0 || disabled}
            >
              −
            </Button>
            <span className="w-8 text-center font-medium tabular-nums">
              {cartQty}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11"
              onClick={onAdd}
              disabled={atStockLimit || disabled}
            >
              +
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
