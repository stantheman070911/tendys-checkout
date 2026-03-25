"use client";

import { useState } from "react";
import type { CartItem, ProductWithProgress } from "@/types";

export function useStorefrontCart() {
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());

  function addToCart(product: ProductWithProgress) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(product.id);
      const currentQty = existing?.quantity ?? 0;
      if (product.stock !== null && currentQty >= product.stock) {
        return prev;
      }

      const newQty = currentQty + 1;
      next.set(product.id, {
        product_id: product.id,
        product_name: product.name,
        unit_price: product.price,
        quantity: newQty,
        subtotal: product.price * newQty,
      });
      return next;
    });
  }

  function removeFromCart(productId: string) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(productId);
      if (!existing) {
        return prev;
      }

      if (existing.quantity <= 1) {
        next.delete(productId);
      } else {
        const newQty = existing.quantity - 1;
        next.set(productId, {
          ...existing,
          quantity: newQty,
          subtotal: existing.unit_price * newQty,
        });
      }

      return next;
    });
  }

  return {
    cart,
    cartItems: Array.from(cart.values()),
    addToCart,
    removeFromCart,
  };
}
