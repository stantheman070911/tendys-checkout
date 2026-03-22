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
  const [formOpen, setFormOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductWithProgress | null>(
    null
  );

  const fetchData = useCallback(async () => {
    try {
      const roundsData = await adminFetch<{ rounds: Round[] }>(
        "/api/rounds?all=true"
      );
      const openRound = roundsData.rounds.find((r) => r.is_open);
      if (!openRound) {
        setLoading(false);
        return;
      }
      setRound(openRound);

      const [productsData, suppliersData] = await Promise.all([
        adminFetch<{ products: ProductWithProgress[] }>(
          `/api/products?roundId=${openRound.id}&all=true`
        ),
        adminFetch<{ suppliers: Supplier[] }>("/api/suppliers"),
      ]);

      setProducts(productsData.products);
      setSuppliers(suppliersData.suppliers);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleActive = async (product: ProductWithProgress) => {
    try {
      await adminFetch("/api/products", {
        method: "PUT",
        body: JSON.stringify({ id: product.id, is_active: !product.is_active }),
      });
      toast({ title: product.is_active ? "已下架" : "已上架" });
      fetchData();
    } catch {
      toast({ title: "操作失敗", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
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
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-gray-700 text-sm">商品管理</h3>
        <button
          onClick={() => {
            setEditProduct(null);
            setFormOpen(true);
          }}
          className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-sm"
        >
          + 新增
        </button>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-10 text-gray-400">尚無商品</div>
      ) : (
        products.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border p-3">
            <div className="flex justify-between items-center">
              <div>
                <span className="font-medium">{p.name}</span>
                <span className="text-gray-400 ml-2 text-sm">
                  {formatCurrency(p.price)}/{p.unit}
                </span>
                {p.supplier_name && (
                  <span className="text-xs text-gray-400 ml-2">
                    {p.supplier_name}
                  </span>
                )}
              </div>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => toggleActive(p)}
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    p.is_active
                      ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700 transition-colors"
                      : "bg-red-100 text-red-700 hover:bg-green-100 hover:text-green-700 transition-colors"
                  }`}
                >
                  {p.is_active ? "下架" : "上架"}
                </button>
                <button
                  onClick={() => {
                    setEditProduct(p);
                    setFormOpen(true);
                  }}
                  className="text-xs text-gray-400 hover:text-blue-500"
                >
                  編輯
                </button>
              </div>
            </div>
            <div className="flex gap-4 text-xs text-gray-400 mt-1">
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
