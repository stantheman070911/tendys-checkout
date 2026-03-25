"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import { useToast } from "@/hooks/use-toast";
import { buildAdminPath } from "@/lib/admin/paths";
import { deriveStockLimitQty } from "@/lib/progress-bar";
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
    null,
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
        "/api/rounds?all=true",
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
        `/api/orders-by-product?productId=${productId}&roundId=${round.id}`,
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
        current === productId ? null : current,
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
        (entry) => entry.result.success,
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="lux-panel-strong p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="lux-kicker">Supplier Directory</div>
            <h1 className="font-display text-3xl text-[hsl(var(--ink))] md:text-4xl">
              供應商管理
            </h1>
            <p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              維護供應商資料，並追蹤本輪各供應商商品需求與到貨通知。
            </p>
          </div>
          <div className="lux-pill">{suppliers.length} 位供應商</div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={() => {
            setEditSupplier(null);
            setFormOpen(true);
          }}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[hsl(var(--forest))] px-5 py-2.5 text-sm font-semibold text-[hsl(var(--mist))]"
        >
          新增供應商
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
                className={`lux-panel transition ${
                  isExpanded
                    ? "border-[rgba(177,140,92,0.34)] shadow-[var(--shadow-soft)]"
                    : "lux-card-hover"
                }`}
              >
                {/* Supplier header */}
                <div
                  onClick={() => setExpandedSupplier(isExpanded ? null : s.id)}
                  className="flex cursor-pointer items-center gap-3 p-4 select-none"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-2xl text-[hsl(var(--ink))]">
                        {s.name}
                      </span>
                      <span className="rounded-full border border-[rgba(177,140,92,0.22)] bg-[rgba(255,251,246,0.88)] px-2 py-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                        {s._count.products} 商品
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
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
                      className="rounded-full border border-[rgba(177,140,92,0.24)] px-3 py-1.5 text-xs font-medium text-[hsl(var(--ink))]"
                    >
                      編輯
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(s);
                      }}
                      className="rounded-full border border-[rgba(189,111,98,0.22)] px-3 py-1.5 text-xs font-medium text-[rgb(140,67,56)]"
                    >
                      刪除
                    </button>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>
                </div>

                {/* Expanded: supplier products */}
                {isExpanded && (
                  <div className="space-y-3 border-t border-[rgba(177,140,92,0.14)] px-4 pb-4 pt-4">
                    {!round ? (
                      <div className="py-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
                        目前沒有進行中的團購，無法顯示商品資料。
                      </div>
                    ) : supplierProducts.length === 0 ? (
                      <div className="py-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
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
                          <div
                            key={p.id}
                            className="border-b border-[rgba(177,140,92,0.14)] pb-3 last:border-0"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <button
                                onClick={() => toggleProduct(p.id)}
                                className="flex items-center gap-2 text-left text-sm font-medium text-[hsl(var(--ink))]"
                              >
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                  {isProdExpanded ? "▼" : "▶"}
                                </span>
                                {p.name}
                              </button>
                              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                {p.goal_qty != null && p.goal_qty > 0 && (
                                  <div className="w-40">
                                    <ProgressBar
                                      currentQty={p.current_qty}
                                      goalQty={p.goal_qty}
                                      stockLimitQty={deriveStockLimitQty(
                                        p.current_qty,
                                        p.stock,
                                      )}
                                      unit={p.unit}
                                    />
                                  </div>
                                )}
                                <span className="lux-pill">
                                  {p.current_qty}
                                  {p.unit}
                                </span>
                                <button
                                  onClick={() =>
                                    window.open(
                                      buildAdminPath(
                                        `/shipments?productId=${p.id}&productName=${encodeURIComponent(p.name)}`,
                                      ),
                                      "_self",
                                    )
                                  }
                                  className="rounded-full border border-[rgba(115,107,153,0.18)] bg-[rgba(230,228,242,0.74)] px-3 py-1.5 text-xs font-medium text-[rgb(74,70,113)]"
                                >
                                  前往出貨
                                </button>
                                <button
                                  onClick={() => sendArrival(p.id)}
                                  disabled={isSent || isSending}
                                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                                    isSent
                                      ? "border border-[rgba(95,126,92,0.2)] bg-[rgba(228,239,223,0.82)] text-[rgb(65,98,61)]"
                                      : "border border-[rgba(184,132,71,0.22)] bg-[rgba(242,228,203,0.82)] text-[rgb(120,84,39)]"
                                  }`}
                                >
                                  {isSending ? "處理中" : isSent ? "已通知" : "通知到貨"}
                                </button>
                              </div>
                            </div>

                            {/* Customer drill-down */}
                            {isProdExpanded && (
                              <div className="mt-3 rounded-[1.25rem] bg-[rgba(244,239,230,0.72)] p-3">
                                {isLoadingCustomers ? (
                                  <div className="py-2 text-center text-xs text-[hsl(var(--muted-foreground))]">
                                    載入中…
                                  </div>
                                ) : customers.length === 0 ? (
                                  <div className="py-2 text-center text-xs text-[hsl(var(--muted-foreground))]">
                                    無客戶資料
                                  </div>
                                ) : (
                                  customers.map((c, i) => (
                                    <div
                                      key={i}
                                      className="grid gap-2 border-b border-[rgba(177,140,92,0.12)] py-2 text-xs last:border-0 lg:grid-cols-[5rem,6rem,1fr,8rem,5rem]"
                                    >
                                      <span className="font-medium">
                                        {c.nickname}
                                      </span>
                                      <span>{c.recipient_name ?? "—"}</span>
                                      <span className="truncate text-[hsl(var(--muted-foreground))]">
                                        {c.phone ?? "—"}
                                      </span>
                                      <span className="font-mono text-[hsl(var(--muted-foreground))]">
                                        {c.order_number}
                                      </span>
                                      <span className="text-right font-semibold text-[hsl(var(--ink))]">
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
                      <div className="lux-panel-muted mt-1 p-3 text-xs text-[hsl(var(--muted-foreground))]">
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
              <span className="mt-1 block text-[rgb(140,67,56)]">
                此供應商有 {deleteTarget?._count.products}{" "}
                個關聯商品，無法刪除。
              </span>
            )}
          </p>
          <DialogFooter>
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="flex-1 rounded-[1.1rem] border border-[rgba(177,140,92,0.28)] bg-[rgba(255,251,246,0.9)] py-3 text-sm font-semibold text-[hsl(var(--ink))]"
            >
              取消
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting || (deleteTarget?._count.products ?? 0) > 0}
              className="flex-1 rounded-[1.1rem] bg-red-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {deleting ? "刪除中…" : "確定刪除"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
