"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { ProgressBar } from "@/components/ProgressBar";
import { ProductForm } from "@/components/admin/ProductForm";
import type { Round, ProductWithProgress, Supplier } from "@/types";

export default function ProductsPage() {
  const { adminFetch } = useAdminFetch();
  const { toast } = useToast();
  const [round, setRound] = useState<Round | null>(null);
  const [products, setProducts] = useState<ProductWithProgress[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductWithProgress | null>(
    null,
  );

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const roundsData = await adminFetch<{ rounds: Round[] }>(
        "/api/rounds?all=true",
      );
      const openRound = roundsData.rounds.find((r) => r.is_open);
      if (!openRound) {
        setLoading(false);
        return;
      }
      setRound(openRound);

      const [productsData, suppliersData] = await Promise.all([
        adminFetch<{ products: ProductWithProgress[] }>(
          `/api/products?roundId=${openRound.id}&all=true`,
        ),
        adminFetch<{ suppliers: Supplier[] }>("/api/suppliers"),
      ]);

      setProducts(productsData.products);
      setSuppliers(suppliersData.suppliers);
    } catch (error) {
      setError(error instanceof Error ? error.message : "資料載入失敗");
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const toggleActive = async (product: ProductWithProgress) => {
    setTogglingId(product.id);
    try {
      await adminFetch("/api/products", {
        method: "PUT",
        body: JSON.stringify({ id: product.id, is_active: !product.is_active }),
      });
      toast({ title: product.is_active ? "已下架" : "已上架" });
      fetchData();
    } catch {
      toast({ title: "操作失敗", variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--forest))] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!round) {
    return (
      <div className="text-center py-20 text-gray-400">
        目前沒有進行中的團購。
      </div>
    );
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
        products.map((p) => (
          <div key={p.id} className="lux-panel p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <span className="font-display text-2xl text-[hsl(var(--ink))]">
                  {p.name}
                </span>
                <span className="ml-2 text-sm text-[hsl(var(--muted-foreground))]">
                  {formatCurrency(p.price)}/{p.unit}
                </span>
                {p.supplier_name && (
                  <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
                    {p.supplier_name}
                  </span>
                )}
              </div>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => toggleActive(p)}
                  disabled={togglingId === p.id}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    togglingId === p.id
                      ? "opacity-50"
                      : p.is_active
                        ? "border border-[rgba(95,126,92,0.2)] bg-[rgba(228,239,223,0.82)] text-[rgb(65,98,61)]"
                        : "border border-[rgba(189,111,98,0.18)] bg-[rgba(246,225,220,0.82)] text-[rgb(140,67,56)]"
                  }`}
                >
                  {p.is_active ? "下架" : "上架"}
                </button>
                <button
                  onClick={() => {
                    setEditProduct(p);
                    setFormOpen(true);
                  }}
                  className="text-xs font-medium text-[hsl(var(--muted-foreground))]"
                >
                  編輯
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-[hsl(var(--muted-foreground))]">
              <span>庫存 {p.stock ?? "不限"}</span>
              <span>目標 {p.goal_qty ?? "—"}</span>
              <span>已訂 {p.current_qty}</span>
            </div>
            <ProgressBar
              currentQty={p.current_qty}
              goalQty={p.goal_qty}
              unit={p.unit}
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
        onSuccess={fetchData}
      />
    </div>
  );
}
