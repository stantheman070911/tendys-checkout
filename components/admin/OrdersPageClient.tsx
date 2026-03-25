"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OrderCard } from "@/components/admin/OrderCard";
import { POSForm } from "@/components/admin/POSForm";
import { useAdminChrome } from "@/components/admin/AdminChromeState";
import { STATUS_LABELS } from "@/constants";
import { getCsvExportErrorMessage } from "@/lib/admin/csv-export";
import { detailToAdminOrderListRow } from "@/lib/admin/order-view";
import {
  applyBatchStatusTransition,
  applyPendingCountDelta,
  getPendingConfirmCountDelta,
  replaceItemById,
} from "@/lib/admin/order-state";
import { buildAdminPath } from "@/lib/admin/paths";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import { useAdminOrderDetails } from "@/hooks/use-admin-order-details";
import { useToast } from "@/hooks/use-toast";
import type {
  AdminOrderDetail,
  AdminOrderListRow,
  ProductWithProgress,
  Round,
} from "@/types";

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
  initialOrders: AdminOrderListRow[];
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
  const { setPendingCount } = useAdminChrome();
  const { toast } = useToast();
  const {
    detailsById,
    loadingDetailIds,
    loadOrderDetail,
    setOrderDetail,
    removeOrderDetails,
  } = useAdminOrderDetails(adminFetch);

  const [orders, setOrders] = useState(initialOrders);
  const [searchDraft, setSearchDraft] = useState(initialSearch);
  const [batchSel, setBatchSel] = useState<Set<string>>(new Set());
  const [batchActing, setBatchActing] = useState(false);
  const [showPOS, setShowPOS] = useState(initialShowPos);
  const [csvCooldown, setCsvCooldown] = useState(false);
  const [csvExporting, setCsvExporting] = useState(false);
  const csvCooldownTimerRef = useRef<number | null>(null);
  const csvFrameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  useEffect(() => {
    setSearchDraft(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setShowPOS(initialShowPos);
  }, [initialShowPos]);

  useEffect(
    () => () => {
      if (csvCooldownTimerRef.current != null) {
        window.clearTimeout(csvCooldownTimerRef.current);
      }
      if (csvFrameRef.current) {
        csvFrameRef.current.remove();
        csvFrameRef.current = null;
      }
    },
    [],
  );

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
    previousOrder: AdminOrderListRow,
    updatedOrder: AdminOrderDetail,
  ) {
    const updatedRow = detailToAdminOrderListRow(updatedOrder);

    setOrders((currentOrders) => {
      const nextOrders = replaceItemById(currentOrders, updatedRow);
      if (filter !== "all" && updatedRow.status !== filter) {
        return nextOrders.filter((entry) => entry.id !== updatedRow.id);
      }
      return nextOrders;
    });
    setOrderDetail(updatedOrder);
    setBatchSel((current) => {
      if (!current.has(updatedRow.id)) {
        return current;
      }
      const next = new Set(current);
      next.delete(updatedRow.id);
      return next;
    });

    const pendingDelta = getPendingConfirmCountDelta(
      previousOrder.status,
      updatedRow.status,
    );
    if (pendingDelta !== 0) {
      setPendingCount((current) => applyPendingCountDelta(current, pendingDelta));
    }

    startTransition(() => {
      router.refresh();
    });
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
    const selectedIdSet = new Set(selectedIds);
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
      const skippedIdSet = new Set(res.skipped ?? []);
      const confirmedCount = orders.filter(
        (order) =>
          selectedIdSet.has(order.id) &&
          !skippedIdSet.has(order.id) &&
          order.status === "pending_confirm",
      ).length;

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
      removeOrderDetails(
        selectedIds.filter((orderId) => !skippedIdSet.has(orderId)),
      );
      setBatchSel(new Set());

      if (confirmedCount > 0) {
        setPendingCount((current) =>
          applyPendingCountDelta(current, -confirmedCount),
        );
      }

      startTransition(() => {
        router.refresh();
      });
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
    if (csvCooldown || csvExporting) {
      return;
    }

    setCsvExporting(true);
    const exportUrl = `/api/export-csv?roundId=${encodeURIComponent(round.id)}`;

    try {
      const preflight = await fetch(exportUrl, {
        method: "HEAD",
        credentials: "include",
      });

      if (!preflight.ok) {
        throw new Error(getCsvExportErrorMessage(preflight.status));
      }

      let iframe = csvFrameRef.current;
      if (!iframe || !document.body.contains(iframe)) {
        iframe = document.createElement("iframe");
        iframe.name = "admin-csv-download";
        iframe.setAttribute("aria-hidden", "true");
        iframe.style.display = "none";
        document.body.appendChild(iframe);
        csvFrameRef.current = iframe;
      }

      iframe.src = "about:blank";
      iframe.src = exportUrl;

      setCsvCooldown(true);
      csvCooldownTimerRef.current = window.setTimeout(() => {
        setCsvCooldown(false);
        csvCooldownTimerRef.current = null;
      }, 1500);
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "匯出失敗",
        variant: "destructive",
      });
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
          disabled={csvCooldown || csvExporting}
          className={`inline-flex min-h-[44px] items-center justify-center rounded-full border border-[rgba(177,140,92,0.24)] bg-[rgba(255,251,246,0.88)] px-4 py-2.5 text-xs font-semibold tracking-[0.08em] whitespace-nowrap ${
            csvCooldown || csvExporting
              ? "opacity-50 text-[hsl(var(--muted-foreground))]"
              : "text-[hsl(var(--ink))]"
          }`}
        >
          {csvExporting ? "準備中…" : csvCooldown ? "已開始" : "CSV"}
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
              detail={detailsById[order.id]}
              loadingDetail={loadingDetailIds.has(order.id)}
              onLoadDetail={loadOrderDetail}
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
