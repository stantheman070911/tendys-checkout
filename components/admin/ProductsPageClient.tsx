"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import { useToast } from "@/hooks/use-toast";
import { deriveStockLimitQty } from "@/lib/progress-bar";
import { formatCurrency } from "@/lib/utils";
import { ProgressBar } from "@/components/ProgressBar";
import { ProductForm } from "@/components/admin/ProductForm";
import type { ProductWithProgress, Round, Supplier } from "@/types";

export function ProductsPageClient({
  round,
  initialProducts,
  suppliers,
}: {
  round: Round;
  initialProducts: ProductWithProgress[];
  suppliers: Supplier[];
}) {
  const router = useRouter();
  const { adminFetch } = useAdminFetch();
  const { toast } = useToast();
  const [products, setProducts] = useState(initialProducts);
  const [formOpen, setFormOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductWithProgress | null>(
    null,
  );
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  async function toggleActive(product: ProductWithProgress) {
    setTogglingId(product.id);
    try {
      await adminFetch("/api/products", {
        method: "PUT",
        body: JSON.stringify({ id: product.id, is_active: !product.is_active }),
      });
      setProducts((current) =>
        current.map((entry) =>
          entry.id === product.id
            ? { ...entry, is_active: !entry.is_active }
            : entry,
        ),
      );
      toast({ title: product.is_active ? "已下架" : "已上架" });
      router.refresh();
    } catch {
      toast({ title: "操作失敗", variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="lux-panel-strong p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="lux-kicker">Product Atelier</div>
            <h1 className="font-display text-3xl text-[hsl(var(--ink))] md:text-4xl">
              商品管理
            </h1>
            <p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              維護本輪商品、價格、成團門檻與供應商關聯。
            </p>
          </div>
          <div className="lux-pill">{products.length} 款商品</div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={() => {
            setEditProduct(null);
            setFormOpen(true);
          }}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[hsl(var(--forest))] px-5 py-2.5 text-sm font-semibold text-[hsl(var(--mist))]"
        >
          新增商品
        </button>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-10 text-gray-400">尚無商品</div>
      ) : (
        products.map((product) => (
          <div key={product.id} className="lux-panel p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <span className="font-display text-2xl text-[hsl(var(--ink))]">
                  {product.name}
                </span>
                <span className="ml-2 text-sm text-[hsl(var(--muted-foreground))]">
                  {formatCurrency(product.price)}/{product.unit}
                </span>
                {product.supplier_name && (
                  <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
                    {product.supplier_name}
                  </span>
                )}
              </div>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => toggleActive(product)}
                  disabled={togglingId === product.id}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    togglingId === product.id
                      ? "opacity-50"
                      : product.is_active
                        ? "border border-[rgba(95,126,92,0.2)] bg-[rgba(228,239,223,0.82)] text-[rgb(65,98,61)]"
                        : "border border-[rgba(189,111,98,0.18)] bg-[rgba(246,225,220,0.82)] text-[rgb(140,67,56)]"
                  }`}
                >
                  {product.is_active ? "下架" : "上架"}
                </button>
                <button
                  onClick={() => {
                    setEditProduct(product);
                    setFormOpen(true);
                  }}
                  className="text-xs font-medium text-[hsl(var(--muted-foreground))]"
                >
                  編輯
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-[hsl(var(--muted-foreground))]">
              <span>庫存 {product.stock ?? "不限"}</span>
              <span>目標 {product.goal_qty ?? "—"}</span>
              <span>已訂 {product.current_qty}</span>
            </div>
            <ProgressBar
              currentQty={product.current_qty}
              goalQty={product.goal_qty}
              stockLimitQty={deriveStockLimitQty(product.current_qty, product.stock)}
              unit={product.unit}
            />
          </div>
        ))
      )}

      <ProductForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        product={editProduct}
        roundId={round.id}
        suppliers={suppliers}
        adminFetch={adminFetch}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
