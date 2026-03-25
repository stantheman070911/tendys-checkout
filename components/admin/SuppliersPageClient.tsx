"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buildAdminPath } from "@/lib/admin/paths";
import { deriveStockLimitQty } from "@/lib/progress-bar";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import { useToast } from "@/hooks/use-toast";
import { ProgressBar } from "@/components/ProgressBar";
import { SupplierForm } from "@/components/admin/SupplierForm";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { OrderByProduct, ProductWithProgress, Round, Supplier } from "@/types";

type SupplierWithCount = Supplier & { _count: { products: number } };

export function SuppliersPageClient({
  round,
  initialSuppliers,
  initialProducts,
}: {
  round: Round | null;
  initialSuppliers: SupplierWithCount[];
  initialProducts: ProductWithProgress[];
}) {
  const router = useRouter();
  const { adminFetch } = useAdminFetch();
  const { toast } = useToast();

  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [products, setProducts] = useState(initialProducts);
  const [formOpen, setFormOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupplierWithCount | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [customersByProduct, setCustomersByProduct] = useState<
    Record<string, OrderByProduct[]>
  >({});
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
  const [arrivalSending, setArrivalSending] = useState<string | null>(null);
  const [arrivalSent, setArrivalSent] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSuppliers(initialSuppliers);
  }, [initialSuppliers]);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  function getSupplierProducts(supplierId: string) {
    return products.filter((product) => product.supplier_id === supplierId);
  }

  async function loadCustomers(productId: string) {
    if (customersByProduct[productId] || !round) return;

    setLoadingProductId(productId);
    try {
      const data = await adminFetch<{ customers: OrderByProduct[] }>(
        `/api/orders-by-product?productId=${productId}&roundId=${round.id}`,
      );
      setCustomersByProduct((current) => ({
        ...current,
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
  }

  async function toggleProduct(productId: string) {
    if (expandedProduct === productId) {
      setExpandedProduct(null);
      return;
    }
    setExpandedProduct(productId);
    await loadCustomers(productId);
  }

  async function sendArrival(productId: string) {
    if (!round) return;

    setArrivalSending(productId);
    try {
      const result = await adminFetch<{
        customersNotified: number;
        queued: boolean;
      }>("/api/notify-arrival", {
        method: "POST",
        body: JSON.stringify({ productId, roundId: round.id }),
      });

      setArrivalSent((current) => new Set([...current, productId]));
      toast({
        title:
          result.customersNotified > 0
            ? `已排入 ${result.customersNotified} 位客戶通知`
            : "沒有可通知的客戶",
        description: result.queued
          ? "通知已在背景發送。"
          : undefined,
      });
      setTimeout(() => {
        setArrivalSent((current) => {
          const next = new Set(current);
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
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await adminFetch(`/api/suppliers?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      toast({ title: "供應商已刪除" });
      setDeleteTarget(null);
      router.refresh();
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "刪除失敗",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
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

      {suppliers.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          尚無供應商，請點「新增供應商」建立。
        </div>
      ) : (
        <div className="space-y-2">
          {suppliers.map((supplier) => {
            const isExpanded = expandedSupplier === supplier.id;
            const supplierProducts = getSupplierProducts(supplier.id);

            return (
              <div
                key={supplier.id}
                className={`lux-panel transition ${
                  isExpanded
                    ? "border-[rgba(177,140,92,0.34)] shadow-[var(--shadow-soft)]"
                    : "lux-card-hover"
                }`}
              >
                <div
                  onClick={() =>
                    setExpandedSupplier(isExpanded ? null : supplier.id)
                  }
                  className="flex cursor-pointer items-center gap-3 p-4 select-none"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-2xl text-[hsl(var(--ink))]">
                        {supplier.name}
                      </span>
                      <span className="rounded-full border border-[rgba(177,140,92,0.22)] bg-[rgba(255,251,246,0.88)] px-2 py-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                        {supplier._count.products} 商品
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                      {[supplier.contact_name, supplier.phone, supplier.email]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditSupplier(supplier);
                        setFormOpen(true);
                      }}
                      className="rounded-full border border-[rgba(177,140,92,0.24)] px-3 py-1.5 text-xs font-medium text-[hsl(var(--ink))]"
                    >
                      編輯
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteTarget(supplier);
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
                      supplierProducts.map((product) => {
                        const isProdExpanded = expandedProduct === product.id;
                        const customers = customersByProduct[product.id] ?? [];
                        const isLoadingCustomers = loadingProductId === product.id;
                        const isSent = arrivalSent.has(product.id);

                        return (
                          <div
                            key={product.id}
                            className="rounded-[1.2rem] border border-[rgba(177,140,92,0.14)] bg-[rgba(255,251,246,0.72)] p-4"
                          >
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div className="space-y-3">
                                <div>
                                  <div className="font-semibold text-[hsl(var(--ink))]">
                                    {product.name}
                                  </div>
                                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                                    已訂 {product.current_qty}
                                    {product.unit} · 目標 {product.goal_qty ?? "—"}
                                    {product.unit}
                                  </div>
                                </div>
                                <ProgressBar
                                  currentQty={product.current_qty}
                                  goalQty={product.goal_qty}
                                  stockLimitQty={deriveStockLimitQty(
                                    product.current_qty,
                                    product.stock,
                                  )}
                                  unit={product.unit}
                                />
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => toggleProduct(product.id)}
                                  className="rounded-full border border-[rgba(177,140,92,0.24)] px-4 py-2 text-xs font-semibold text-[hsl(var(--ink))]"
                                >
                                  {isProdExpanded ? "收起名單" : "查看名單"}
                                </button>
                                <button
                                  onClick={() =>
                                    router.push(
                                      buildAdminPath(
                                        `/shipments?roundId=${round.id}&productId=${product.id}&productName=${encodeURIComponent(product.name)}`,
                                      ),
                                    )
                                  }
                                  className="rounded-full border border-[rgba(80,112,147,0.16)] bg-[rgba(222,231,242,0.8)] px-4 py-2 text-xs font-semibold text-[rgb(74,96,136)]"
                                >
                                  前往出貨
                                </button>
                                <button
                                  onClick={() => void sendArrival(product.id)}
                                  disabled={arrivalSending === product.id}
                                  className={`rounded-full px-4 py-2 text-xs font-semibold ${
                                    isSent
                                      ? "bg-[rgb(65,98,61)] text-white"
                                      : "bg-[hsl(var(--forest))] text-[hsl(var(--mist))]"
                                  } disabled:opacity-50`}
                                >
                                  {arrivalSending === product.id
                                    ? "通知中…"
                                    : isSent
                                      ? "已通知"
                                      : "通知到貨"}
                                </button>
                              </div>
                            </div>

                            {isProdExpanded && (
                              <div className="mt-4 space-y-2">
                                {isLoadingCustomers ? (
                                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                                    載入客戶資料中…
                                  </div>
                                ) : customers.length === 0 ? (
                                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                                    目前沒有客戶資料。
                                  </div>
                                ) : (
                                  customers.map((customer) => (
                                    <div
                                      key={`${customer.order_number}-${customer.product_id}`}
                                      className="flex flex-col gap-1 rounded-[1rem] border border-[rgba(177,140,92,0.12)] bg-white/70 px-4 py-3 text-xs"
                                    >
                                      <div className="font-medium text-[hsl(var(--ink))]">
                                        {customer.nickname} · {customer.order_number}
                                      </div>
                                      <div className="text-[hsl(var(--muted-foreground))]">
                                        {customer.recipient_name ?? customer.purchaser_name ?? "—"} · {customer.phone ?? "—"}
                                      </div>
                                      <div className="text-[hsl(var(--muted-foreground))]">
                                        {customer.pickup_location || "宅配"} · {customer.quantity}
                                        {product.unit}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SupplierForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        supplier={editSupplier}
        adminFetch={adminFetch}
        onSuccess={() => router.refresh()}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>刪除供應商？</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            刪除後無法復原。若供應商仍有商品關聯，系統會阻止刪除。
          </p>
          <DialogFooter>
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="rounded-full border border-[rgba(177,140,92,0.24)] px-4 py-2 text-sm"
            >
              取消
            </button>
            <button
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="rounded-full bg-[rgb(140,67,56)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {deleting ? "刪除中…" : "刪除"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
