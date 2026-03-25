"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAdminRound } from "@/contexts/AdminRoundContext";
import {
  applyBatchStatusTransition,
  getPendingConfirmCountDelta,
  replaceItemById,
} from "@/lib/admin/order-state";
import { matchesOrderSearch } from "@/lib/admin/order-search";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import { useToast } from "@/hooks/use-toast";
import { STATUS_LABELS } from "@/constants";
import { OrderCard } from "@/components/admin/OrderCard";
import { POSForm } from "@/components/admin/POSForm";
import type { Order, OrderItem, User, ProductWithProgress } from "@/types";

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

export default function OrdersPage() {
  const searchParams = useSearchParams();
  const { round, loading: roundLoading, refreshRound, adjustPendingCount } =
    useAdminRound();
  const { adminFetch } = useAdminFetch();
  const { toast } = useToast();
  const revalidateTimerRef = useRef<number | null>(null);

  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [products, setProducts] = useState<ProductWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>(
    searchParams.get("status") ?? "all",
  );
  const [search, setSearch] = useState("");
  const [batchSel, setBatchSel] = useState<Set<string>>(new Set());
  const [batchActing, setBatchActing] = useState(false);
  const [showPOS, setShowPOS] = useState(searchParams.get("showPOS") === "1");

  const fetchData = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (silent) {
        setSyncError(null);
      } else {
        setError(null);
      }
      if (!round) {
        setOrders([]);
        setProducts([]);
        setLoading(false);
        return;
      }

      if (!silent) {
        setLoading(true);
      }

      try {
        const [ordersData, productsData] = await Promise.all([
          adminFetch<{ orders: OrderWithRelations[] }>(
            `/api/orders?roundId=${round.id}`,
          ),
          adminFetch<{ products: ProductWithProgress[] }>(
            `/api/products?roundId=${round.id}&all=true`,
          ),
        ]);

        setOrders(ordersData.orders);
        setProducts(productsData.products);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "資料載入失敗";
        if (silent) {
          setSyncError(message);
        } else {
          setError(message);
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [adminFetch, round],
  );

  useEffect(() => {
    if (roundLoading) return;
    void fetchData();
  }, [fetchData, roundLoading]);

  const scheduleRevalidate = useCallback(() => {
    if (revalidateTimerRef.current !== null) {
      window.clearTimeout(revalidateTimerRef.current);
    }

    revalidateTimerRef.current = window.setTimeout(() => {
      void Promise.all([fetchData({ silent: true }), refreshRound()]);
      revalidateTimerRef.current = null;
    }, 2000);
  }, [fetchData, refreshRound]);

  useEffect(() => {
    return () => {
      if (revalidateTimerRef.current !== null) {
        window.clearTimeout(revalidateTimerRef.current);
      }
    };
  }, []);

  const clearSelectionForOrder = useCallback((orderId: string) => {
    setBatchSel((prev) => {
      if (!prev.has(orderId)) {
        return prev;
      }

      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
  }, []);

  const handleOrderMutated = useCallback(
    (previousOrder: OrderWithRelations, updatedOrder: OrderWithRelations) => {
      setOrders((currentOrders) => replaceItemById(currentOrders, updatedOrder));
      clearSelectionForOrder(updatedOrder.id);

      const pendingCountDelta = getPendingConfirmCountDelta(
        previousOrder.status,
        updatedOrder.status,
      );
      if (pendingCountDelta !== 0) {
        adjustPendingCount(pendingCountDelta);
      }

      setSyncError(null);
      scheduleRevalidate();
    },
    [adjustPendingCount, clearSelectionForOrder, scheduleRevalidate],
  );

  // Filter + search
  const filtered = orders.filter((o) => {
    if (filter !== "all" && o.status !== filter) return false;
    return matchesOrderSearch(o, search);
  });

  const pendingConfirm = orders.filter((o) => o.status === "pending_confirm");

  const selectAllPending = () => {
    setBatchSel(new Set(pendingConfirm.map((o) => o.id)));
  };

  const toggleSelect = (id: string) => {
    const order = orders.find((o) => o.id === id);
    if (!order || order.status !== "pending_confirm") {
      toast({
        title: "限制操作",
        description: "只能批次確認「待確認」狀態的訂單",
        variant: "destructive",
      });
      return;
    }
    setBatchSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const batchConfirm = async () => {
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
      setOrders((currentOrders) =>
        applyBatchStatusTransition(currentOrders, {
          ids: selectedIds,
          skippedIds: res.skipped,
          fromStatus: "pending_confirm",
          toStatus: "confirmed",
          patch: (order) => ({ ...order, confirmed_at: confirmedAt }),
        }),
      );
      setBatchSel(new Set());
      if (res.confirmed > 0) {
        adjustPendingCount(-res.confirmed);
      }
      setSyncError(null);
      scheduleRevalidate();
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "批次確認失敗",
        variant: "destructive",
      });
    } finally {
      setBatchActing(false);
    }
  };

  const [csvExporting, setCsvExporting] = useState(false);

  const handleCSVExport = async () => {
    if (!round) return;
    setCsvExporting(true);
    try {
      const { getSupabaseBrowser } =
        await import("@/lib/auth/supabase-browser");
      const supabase = getSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error("No token");

      const res = await fetch(`/api/export-csv?roundId=${round.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders_${round.id}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      toast({ title: "匯出失敗", variant: "destructive" });
    } finally {
      setCsvExporting(false);
    }
  };

  if (loading || roundLoading) {
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
            <div className="lux-kicker">Order Desk</div>
            <h1 className="font-display text-3xl text-[hsl(var(--ink))] md:text-4xl">
              訂單管理
            </h1>
            <p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              搜尋、篩選、快速收款與列印，維持本輪訂單節奏。
            </p>
          </div>
          <div className="lux-pill">{filtered.length} 筆顯示中</div>
        </div>
      </section>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋 暱稱 / 訂購人 / 收貨人 / 電話 / 訂單號"
          className="lux-input flex-1"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
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

      {syncError && (
        <div className="rounded-[1.1rem] border border-[rgba(184,132,71,0.26)] bg-[rgba(242,228,203,0.72)] px-4 py-3 text-sm text-[rgb(120,84,39)]">
          背景同步失敗，畫面保留目前資料。{syncError}
        </div>
      )}

      {/* Filter tabs */}
      <div className="lux-panel flex flex-wrap items-center gap-2 p-3">
        {FILTER_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-4 py-2 text-xs font-semibold tracking-[0.08em] transition ${
              filter === s
                ? "bg-[hsl(var(--forest))] text-[hsl(var(--mist))]"
                : "border border-[rgba(177,140,92,0.24)] bg-[rgba(255,251,246,0.88)] text-[hsl(var(--muted-foreground))]"
            }`}
          >
            {s === "all" ? "全部" : STATUS_LABELS[s]}
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

      {/* Orders */}
      {filtered.length === 0 ? (
        <div className="lux-panel p-12 text-center text-[hsl(var(--muted-foreground))]">
          沒有符合的訂單
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              selected={batchSel.has(o.id)}
              onToggleSelect={toggleSelect}
              onOrderMutated={handleOrderMutated}
              adminFetch={adminFetch}
            />
          ))}
        </div>
      )}

      {/* Batch confirm bar */}
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

      {/* POS Dialog */}
      <POSForm
        open={showPOS}
        onClose={() => setShowPOS(false)}
        round={round}
        products={products}
        adminFetch={adminFetch}
        onSuccess={fetchData}
      />
    </div>
  );
}
