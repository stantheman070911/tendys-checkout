"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  applyBatchStatusTransition,
  replaceItemById,
} from "@/lib/admin/order-state";
import { buildAdminPath } from "@/lib/admin/paths";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import { useToast } from "@/hooks/use-toast";
import { STATUS_LABELS } from "@/constants";
import { OrderCard } from "@/components/admin/OrderCard";
import { POSForm } from "@/components/admin/POSForm";
import type { Order, OrderItem, ProductWithProgress, Round, User } from "@/types";

type OrderWithRelations = Order & {
  order_items: OrderItem[];
  user: User | null;
};

const FILTER_OPTIONS = [
  "all",
  "pending_payment",
  "pending_confirm",
  "confirmed",
  "shipped",
  "cancelled",
] as const;

function updateQueryString(
  searchParams: URLSearchParams,
  updates: Record<string, string | null>,
) {
  const next = new URLSearchParams(searchParams.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (!value) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }

  const nextQuery = next.toString();
  return nextQuery ? `?${nextQuery}` : "";
}

export function OrdersPageClient({
  round,
  initialOrders,
  total,
  page,
  pageSize,
  hasMore,
  initialStatus,
  initialSearch,
  initialShowPos,
  products,
}: {
  round: Round;
  initialOrders: OrderWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  initialStatus: string;
  initialSearch: string;
  initialShowPos: boolean;
  products: ProductWithProgress[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { adminFetch } = useAdminFetch();
  const { toast } = useToast();

  const [orders, setOrders] = useState(initialOrders);
  const [searchDraft, setSearchDraft] = useState(initialSearch);
  const [batchSel, setBatchSel] = useState<Set<string>>(new Set());
  const [batchActing, setBatchActing] = useState(false);
  const [showPOS, setShowPOS] = useState(initialShowPos);
  const [csvExporting, setCsvExporting] = useState(false);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  useEffect(() => {
    setSearchDraft(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setShowPOS(initialShowPos);
  }, [initialShowPos]);

  useEffect(() => {
    const trimmed = searchDraft.trim();
    const current = searchParams.get("q") ?? "";
    if (trimmed === current) {
      return;
    }

    const timer = window.setTimeout(() => {
      const nextSearch = updateQueryString(
        new URLSearchParams(searchParams.toString()),
        {
          q: trimmed || null,
          page: "1",
        },
      );
      router.replace(`${buildAdminPath("/orders")}${nextSearch}`, {
        scroll: false,
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [router, searchDraft, searchParams]);

  const filter = initialStatus;
  const pendingConfirm = useMemo(
    () => orders.filter((order) => order.status === "pending_confirm"),
    [orders],
  );

  function navigateWithUpdates(updates: Record<string, string | null>) {
    const nextSearch = updateQueryString(
      new URLSearchParams(searchParams.toString()),
      updates,
    );
    router.push(`${buildAdminPath("/orders")}${nextSearch}`, { scroll: false });
  }

  function handleOrderMutated(
    previousOrder: OrderWithRelations,
    updatedOrder: OrderWithRelations,
  ) {
    setOrders((currentOrders) => {
      const nextOrders = replaceItemById(currentOrders, updatedOrder);
      if (filter !== "all" && updatedOrder.status !== filter) {
        return nextOrders.filter((entry) => entry.id !== updatedOrder.id);
      }
      return nextOrders;
    });
    setBatchSel((current) => {
      if (!current.has(updatedOrder.id)) return current;
      const next = new Set(current);
      next.delete(updatedOrder.id);
      return next;
    });
    if (previousOrder.status !== updatedOrder.status) {
      router.refresh();
    }
  }

  function selectAllPending() {
    setBatchSel(new Set(pendingConfirm.map((order) => order.id)));
  }

  function toggleSelect(id: string) {
    const order = orders.find((entry) => entry.id === id);
    if (!order || order.status !== "pending_confirm") {
      toast({
        title: "限制操作",
        description: "只能批次確認「待確認」狀態的訂單",
        variant: "destructive",
      });
      return;
    }

    setBatchSel((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function batchConfirm() {
    if (batchSel.size === 0) return;

    const selectedIds = Array.from(batchSel);
    setBatchActing(true);
    try {
      const res = await adminFetch<{
        confirmed: number;
        skipped?: string[];
      }>("/api/batch-confirm", {
        method: "POST",
        body: JSON.stringify({ orderIds: selectedIds }),
      });

      const skipped = res.skipped?.length ?? 0;
      toast({
        title:
          skipped > 0
            ? `已確認 ${res.confirmed} 筆訂單，略過 ${skipped} 筆`
            : `已確認 ${res.confirmed} 筆訂單`,
      });

      const confirmedAt = new Date().toISOString();
      setOrders((currentOrders) => {
        const nextOrders = applyBatchStatusTransition(currentOrders, {
          ids: selectedIds,
          skippedIds: res.skipped,
          fromStatus: "pending_confirm",
          toStatus: "confirmed",
          patch: (order) => ({ ...order, confirmed_at: confirmedAt }),
        });

        if (filter === "pending_confirm") {
          return nextOrders.filter((entry) => entry.status === "pending_confirm");
        }

        return nextOrders;
      });
      setBatchSel(new Set());
      router.refresh();
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "批次確認失敗",
        variant: "destructive",
      });
    } finally {
      setBatchActing(false);
    }
  }

  async function handleCSVExport() {
    setCsvExporting(true);
    try {
      const res = await fetch(`/api/export-csv?roundId=${round.id}`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Export failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `orders_${round.id}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);
    } catch {
      toast({ title: "匯出失敗", variant: "destructive" });
    } finally {
      setCsvExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="lux-panel-strong p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="lux-kicker">Order Desk</div>
            <h1 className="font-display text-3xl text-[hsl(var(--ink))] md:text-4xl">
              訂單管理
            </h1>
            <p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              搜尋、篩選、快速收款與列印，維持本輪訂單節奏。
            </p>
          </div>
          <div className="lux-pill">{total} 筆結果</div>
        </div>
      </section>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          placeholder="搜尋 暱稱 / 訂購人 / 收貨人 / 電話 / 訂單號"
          className="lux-input flex-1"
        />
        {searchDraft && (
          <button
            onClick={() => setSearchDraft("")}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(177,140,92,0.24)] bg-[rgba(255,251,246,0.88)] text-[hsl(var(--muted-foreground))]"
          >
            ✕
          </button>
        )}
        <button
          onClick={handleCSVExport}
          disabled={csvExporting}
          className={`inline-flex min-h-[44px] items-center justify-center rounded-full border border-[rgba(177,140,92,0.24)] bg-[rgba(255,251,246,0.88)] px-4 py-2.5 text-xs font-semibold tracking-[0.08em] whitespace-nowrap ${
            csvExporting
              ? "opacity-50 text-[hsl(var(--muted-foreground))]"
              : "text-[hsl(var(--ink))]"
          }`}
        >
          {csvExporting ? "匯出中..." : "CSV"}
        </button>
      </div>

      <div className="lux-panel flex flex-wrap items-center gap-2 p-3">
        {FILTER_OPTIONS.map((status) => (
          <button
            key={status}
            onClick={() =>
              navigateWithUpdates({
                status: status === "all" ? null : status,
                page: "1",
              })
            }
            className={`rounded-full px-4 py-2 text-xs font-semibold tracking-[0.08em] transition ${
              filter === status
                ? "bg-[hsl(var(--forest))] text-[hsl(var(--mist))]"
                : "border border-[rgba(177,140,92,0.24)] bg-[rgba(255,251,246,0.88)] text-[hsl(var(--muted-foreground))]"
            }`}
          >
            {status === "all" ? "全部" : STATUS_LABELS[status]}
          </button>
        ))}
        {pendingConfirm.length > 0 &&
          (filter === "all" || filter === "pending_confirm") && (
            <button
              onClick={selectAllPending}
              className="ml-auto rounded-full border border-[rgba(80,112,147,0.16)] bg-[rgba(222,231,242,0.8)] px-4 py-2 text-xs font-semibold text-[rgb(74,96,136)]"
            >
              全選待確認
            </button>
          )}
      </div>

      {orders.length === 0 ? (
        <div className="lux-panel p-12 text-center text-[hsl(var(--muted-foreground))]">
          沒有符合的訂單
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              selected={batchSel.has(order.id)}
              onToggleSelect={toggleSelect}
              onOrderMutated={handleOrderMutated}
              adminFetch={adminFetch}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-[hsl(var(--muted-foreground))]">
        <span>
          第 {page} 頁 · 每頁 {pageSize} 筆
        </span>
        <div className="flex gap-2">
          <button
            onClick={() =>
              navigateWithUpdates({ page: page > 1 ? String(page - 1) : "1" })
            }
            disabled={page <= 1}
            className="rounded-full border border-[rgba(177,140,92,0.24)] bg-[rgba(255,251,246,0.88)] px-4 py-2 disabled:opacity-40"
          >
            上一頁
          </button>
          <button
            onClick={() => navigateWithUpdates({ page: String(page + 1) })}
            disabled={!hasMore}
            className="rounded-full border border-[rgba(177,140,92,0.24)] bg-[rgba(255,251,246,0.88)] px-4 py-2 disabled:opacity-40"
          >
            下一頁
          </button>
        </div>
      </div>

      {batchSel.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <div className="lux-floating-bar pointer-events-auto mx-auto flex w-full max-w-6xl flex-col items-stretch gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium">
              已選 <b>{batchSel.size}</b> 筆
            </span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => setBatchSel(new Set())}
                className="rounded-full border border-white/20 px-4 py-2 text-sm"
              >
                清除
              </button>
              <button
                onClick={batchConfirm}
                disabled={batchActing}
                className="rounded-full bg-[rgba(255,248,240,0.96)] px-5 py-2 text-sm font-semibold text-[hsl(var(--forest-deep))] disabled:opacity-50"
              >
                {batchActing ? "處理中…" : "批次確認付款"}
              </button>
            </div>
          </div>
        </div>
      )}

      <POSForm
        open={showPOS}
        onClose={() => {
          setShowPOS(false);
          navigateWithUpdates({ showPOS: null });
        }}
        round={round}
        products={products}
        adminFetch={adminFetch}
        onSuccess={() => {
          setShowPOS(false);
          navigateWithUpdates({ showPOS: null });
          router.refresh();
        }}
      />
    </div>
  );
}
