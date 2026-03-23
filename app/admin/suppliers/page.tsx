"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import { useToast } from "@/hooks/use-toast";
import { buildAdminPath } from "@/lib/admin/paths";
import { formatCurrency } from "@/lib/utils";
import { ProgressBar } from "@/components/ProgressBar";
import { SupplierForm } from "@/components/admin/SupplierForm";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  Round,
  Supplier,
  ProductWithProgress,
  OrderByProduct,
} from "@/types";

type SupplierWithCount = Supplier & { _count: { products: number } };

export default function SuppliersPage() {
  const { adminFetch } = useAdminFetch();
  const { toast } = useToast();

  const [round, setRound] = useState<Round | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierWithCount[]>([]);
  const [products, setProducts] = useState<ProductWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<SupplierWithCount | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  // Expansion state
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [customersByProduct, setCustomersByProduct] = useState<
    Record<string, OrderByProduct[]>
  >({});
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);

  // Arrival notification state
  const [arrivalSending, setArrivalSending] = useState<string | null>(null);
  const [arrivalSent, setArrivalSent] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      // Always fetch suppliers
      const suppliersData = await adminFetch<{
        suppliers: SupplierWithCount[];
      }>("/api/suppliers");
      setSuppliers(suppliersData.suppliers);

      // Try to get open round + products
      const roundsData = await adminFetch<{ rounds: Round[] }>(
        "/api/rounds?all=true"
      );
      const openRound = roundsData.rounds.find((r) => r.is_open);
      setRound(openRound ?? null);

      if (openRound) {
        const productsData = await adminFetch<{
          products: ProductWithProgress[];
        }>(`/api/products?roundId=${openRound.id}&all=true`);
        setProducts(productsData.products);
      } else {
        setProducts([]);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "資料載入失敗");
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminFetch(`/api/suppliers?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      toast({ title: "供應商已刪除" });
      setDeleteTarget(null);
      fetchData();
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "刪除失敗",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const getSupplierProducts = (supplierId: string) =>
    products.filter((p) => p.supplier_id === supplierId);

  const loadCustomers = async (productId: string) => {
    if (customersByProduct[productId]) return;
    if (!round) return;

    setLoadingProductId(productId);
    try {
      const data = await adminFetch<{ customers: OrderByProduct[] }>(
        `/api/orders-by-product?productId=${productId}&roundId=${round.id}`
      );
      setCustomersByProduct((prev) => ({
        ...prev,
        [productId]: data.customers,
      }));
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "客戶資料載入失敗",
        variant: "destructive",
      });
    } finally {
      setLoadingProductId((current) =>
        current === productId ? null : current
      );
    }
  };

  const toggleProduct = async (productId: string) => {
    if (expandedProduct === productId) {
      setExpandedProduct(null);
      return;
    }
    setExpandedProduct(productId);
    await loadCustomers(productId);
  };

  const sendArrival = async (productId: string) => {
    if (!round) return;
    setArrivalSending(productId);
    try {
      const result = await adminFetch<{
        customersNotified: number;
        line: { success: boolean; error?: string };
        emailResults: Array<{
          email: string;
          result: { success: boolean; error?: string };
        }>;
      }>("/api/notify-arrival", {
        method: "POST",
        body: JSON.stringify({ productId, roundId: round.id }),
      });

      const emailSuccesses = result.emailResults.filter(
        (entry) => entry.result.success
      ).length;
      const emailFailures = result.emailResults.length - emailSuccesses;
      const lineStatus = result.line.success
        ? "成功"
        : result.line.error === "No customers have linked LINE accounts"
          ? "略過"
          : "失敗";

      setArrivalSent((prev) => new Set([...prev, productId]));
      toast({
        title: `已通知 ${result.customersNotified} 位客戶`,
        description: `LINE ${lineStatus} · Email ${emailSuccesses} 成功${emailFailures > 0 ? ` / ${emailFailures} 失敗` : ""}`,
      });
      setTimeout(() => {
        setArrivalSent((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
      }, 3000);
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "到貨通知失敗",
        variant: "destructive",
      });
    } finally {
      setArrivalSending(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
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

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-700 text-sm">
          供應商管理
          <span className="ml-2 text-gray-400 font-normal">
            ({suppliers.length})
          </span>
        </h3>
        <button
          onClick={() => {
            setEditSupplier(null);
            setFormOpen(true);
          }}
          className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-xl font-medium"
        >
          + 新增供應商
        </button>
      </div>

      {/* Supplier list */}
      {suppliers.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          尚無供應商，請點「新增供應商」建立。
        </div>
      ) : (
        <div className="space-y-2">
          {suppliers.map((s) => {
            const isExpanded = expandedSupplier === s.id;
            const supplierProducts = getSupplierProducts(s.id);

            return (
              <div
                key={s.id}
                className={`bg-white rounded-xl border transition ${
                  isExpanded ? "border-indigo-400 shadow-md" : ""
                }`}
              >
                {/* Supplier header */}
                <div
                  onClick={() =>
                    setExpandedSupplier(isExpanded ? null : s.id)
                  }
                  className="flex items-center gap-2 p-3 cursor-pointer select-none"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm">{s.name}</span>
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                        {s._count.products} 商品
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {[s.contact_name, s.phone, s.email]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditSupplier(s);
                        setFormOpen(true);
                      }}
                      className="text-xs px-2 py-1 border rounded-lg text-gray-500 hover:text-indigo-600"
                    >
                      編輯
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(s);
                      }}
                      className="text-xs px-2 py-1 border rounded-lg text-gray-500 hover:text-red-500"
                    >
                      刪除
                    </button>
                    <span className="text-gray-300 text-xs">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>
                </div>

                {/* Expanded: supplier products */}
                {isExpanded && (
                  <div className="border-t px-3 pb-3 space-y-2 pt-2">
                    {!round ? (
                      <div className="text-xs text-gray-400 text-center py-4">
                        目前沒有進行中的團購，無法顯示商品資料。
                      </div>
                    ) : supplierProducts.length === 0 ? (
                      <div className="text-xs text-gray-400 text-center py-4">
                        本團沒有此供應商的商品。
                      </div>
                    ) : (
                      supplierProducts.map((p) => {
                        const isProdExpanded = expandedProduct === p.id;
                        const customers = customersByProduct[p.id] ?? [];
                        const isLoadingCustomers = loadingProductId === p.id;
                        const isSent = arrivalSent.has(p.id);
                        const isSending = arrivalSending === p.id;

                        return (
                          <div key={p.id} className="border-b last:border-0 pb-2">
                            <div className="flex justify-between items-center gap-2">
                              <button
                                onClick={() => toggleProduct(p.id)}
                                className="flex items-center gap-1 text-sm font-medium hover:text-indigo-600 text-left"
                              >
                                <span className="text-xs text-gray-400">
                                  {isProdExpanded ? "▼" : "▶"}
                                </span>{" "}
                                {p.name}
                              </button>
                              <div className="flex items-center gap-2 flex-wrap justify-end">
                                {p.goal_qty != null && p.goal_qty > 0 && (
                                  <div className="w-20">
                                    <ProgressBar
                                      currentQty={p.current_qty}
                                      goalQty={p.goal_qty}
                                      unit={p.unit}
                                    />
                                  </div>
                                )}
                                <span className="font-bold text-indigo-600 text-xs">
                                  {p.current_qty}
                                  {p.unit}
                                </span>
                                <button
                                  onClick={() =>
                                    window.open(
                                      buildAdminPath(
                                        `/shipments?productId=${p.id}&productName=${encodeURIComponent(p.name)}`
                                      ),
                                      "_self"
                                    )
                                  }
                                  className="text-xs px-2 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100"
                                >
                                  📦 前往出貨
                                </button>
                                <button
                                  onClick={() => sendArrival(p.id)}
                                  disabled={isSent || isSending}
                                  className={`text-xs px-2 py-1 rounded-lg ${
                                    isSent
                                      ? "bg-green-100 text-green-700"
                                      : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                                  }`}
                                >
                                  {isSending
                                    ? "…"
                                    : isSent
                                      ? "✓ 已通知"
                                      : "📢 通知到貨"}
                                </button>
                              </div>
                            </div>

                            {/* Customer drill-down */}
                            {isProdExpanded && (
                              <div className="mt-2 ml-4 bg-gray-50 rounded-xl p-2.5 space-y-1">
                                {isLoadingCustomers ? (
                                  <div className="text-xs text-gray-400 text-center py-2">
                                    載入中…
                                  </div>
                                ) : customers.length === 0 ? (
                                  <div className="text-xs text-gray-400 text-center py-2">
                                    無客戶資料
                                  </div>
                                ) : (
                                  customers.map((c, i) => (
                                    <div
                                      key={i}
                                      className="grid grid-cols-[4.5rem,5rem,1fr,7.5rem,4rem] text-xs gap-2"
                                    >
                                      <span className="font-medium">
                                        {c.nickname}
                                      </span>
                                      <span>
                                        {c.recipient_name ?? "—"}
                                      </span>
                                      <span className="text-gray-400 truncate">
                                        {c.phone ?? "—"}
                                      </span>
                                      <span className="font-mono text-gray-500">
                                        {c.order_number}
                                      </span>
                                      <span className="font-bold text-indigo-600 text-right">
                                        {c.quantity}
                                        {p.unit}
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}

                    {/* Supplier note */}
                    {s.note && (
                      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-2 mt-1">
                        {s.note}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Supplier Form Dialog */}
      <SupplierForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditSupplier(null);
        }}
        supplier={editSupplier}
        adminFetch={adminFetch}
        onSuccess={fetchData}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            確定要刪除供應商「{deleteTarget?.name}」嗎？
            {(deleteTarget?._count.products ?? 0) > 0 && (
              <span className="text-red-500 block mt-1">
                此供應商有 {deleteTarget?._count.products} 個關聯商品，無法刪除。
              </span>
            )}
          </p>
          <DialogFooter>
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="flex-1 border-2 rounded-xl py-2.5 font-medium text-gray-600"
            >
              取消
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting || (deleteTarget?._count.products ?? 0) > 0}
              className="flex-1 bg-red-600 text-white rounded-xl py-2.5 font-bold disabled:opacity-50"
            >
              {deleting ? "刪除中…" : "確定刪除"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
