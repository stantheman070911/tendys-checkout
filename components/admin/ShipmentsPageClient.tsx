"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShipmentCard } from "@/components/admin/ShipmentCard";
import { groupOrdersByPickup } from "@/lib/admin/order-search";
import { removeBatchItemsById, removeItemsById } from "@/lib/admin/order-state";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import { useAdminOrderDetails } from "@/hooks/use-admin-order-details";
import { useAdminQueryControls } from "@/hooks/use-admin-query-controls";
import { useShipmentBatchPrint } from "@/hooks/use-shipment-batch-print";
import { useToast } from "@/hooks/use-toast";
import type { AdminOrderListRow, Round } from "@/types";

export function ShipmentsPageClient({
  round,
  initialOrders,
  total,
  page,
  pageSize,
  hasMore,
  initialSearch,
  productFilterId,
  productFilterName,
}: {
  round: Round;
  initialOrders: AdminOrderListRow[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  initialSearch: string;
  productFilterId: string;
  productFilterName: string;
}) {
  const router = useRouter();
  const { adminFetch } = useAdminFetch();
  const { toast } = useToast();
  const {
    searchDraft,
    setSearchDraft,
    navigateWithUpdates: navigateWithUpdatesBase,
  } = useAdminQueryControls({
    path: "/shipments",
    initialSearch,
  });
  const {
    detailsById,
    loadingDetailIds,
    loadOrderDetail,
    removeOrderDetails,
  } = useAdminOrderDetails(adminFetch);

  const [orders, setOrders] = useState(initialOrders);
  const [batchSel, setBatchSel] = useState<Set<string>>(new Set());
  const [batchActing, setBatchActing] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const { printing, printOrders } = useShipmentBatchPrint({
    adminFetch,
    roundId: round.id,
    onError: (message) =>
      toast({
        title: message,
        variant: "destructive",
      }),
  });

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  function navigateWithUpdates(updates: Record<string, string | null>) {
    navigateWithUpdatesBase(updates);
  }

  function handleShipmentConfirmed(orderId: string) {
    setOrders((currentOrders) => removeItemsById(currentOrders, [orderId]));
    removeOrderDetails([orderId]);
    setBatchSel((current) => {
      if (!current.has(orderId)) return current;
      const next = new Set(current);
      next.delete(orderId);
      return next;
    });
    startTransition(() => {
      router.refresh();
    });
  }

  const groups = useMemo(() => {
    const grouped = groupOrdersByPickup(orders);
    return [...grouped].sort((left, right) => {
      if (left.label === "宅配") return -1;
      if (right.label === "宅配") return 1;
      return left.label.localeCompare(right.label);
    });
  }, [orders]);

  function toggleGroup(label: string) {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function toggleSelect(id: string) {
    setBatchSel((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setBatchSel(new Set(orders.map((order) => order.id)));
  }

  function getBatchLabel() {
    const selectedOrders = orders.filter((order) => batchSel.has(order.id));
    const hasDelivery = selectedOrders.some((order) => !order.pickup_location);
    const hasPickup = selectedOrders.some((order) => !!order.pickup_location);
    if (hasDelivery && hasPickup) return "批次確認出貨 / 取貨";
    if (hasPickup) return "批次確認取貨";
    return "批次確認寄出";
  }

  async function batchConfirmShipment() {
    if (batchSel.size === 0) return;

    const selectedIds = Array.from(batchSel);
    setBatchActing(true);
    try {
      const res = await adminFetch<{
        shipped: number;
        skipped: string[];
      }>("/api/confirm-shipment", {
        method: "POST",
        body: JSON.stringify({ orderIds: selectedIds }),
      });

      const skipped = res.skipped?.length ?? 0;
      toast({
        title:
          skipped > 0
            ? `已出貨 ${res.shipped} 筆，略過 ${skipped} 筆`
            : `已出貨 ${res.shipped} 筆`,
      });

      const skippedIdSet = new Set(res.skipped ?? []);
      setOrders((currentOrders) =>
        removeBatchItemsById(currentOrders, selectedIds, res.skipped),
      );
      removeOrderDetails(
        selectedIds.filter((orderId) => !skippedIdSet.has(orderId)),
      );
      setBatchSel(new Set());
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "批次出貨失敗",
        variant: "destructive",
      });
    } finally {
      setBatchActing(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="lux-panel-strong p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="lux-kicker">Shipment Queue</div>
            <h1 className="font-display text-3xl text-[hsl(var(--ink))] md:text-4xl">
              待出貨 · {round.name}
            </h1>
            <p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              依宅配與面交點分組確認，並即時追蹤通知送達結果。
            </p>
          </div>
          <div className="flex gap-2">
            <span className="lux-pill">{total} 筆待處理</span>
            {orders.length > 0 && (
              <button
                onClick={() => void printOrders(orders.map((order) => order.id))}
                disabled={printing}
                className="print:hidden inline-flex min-h-[40px] items-center rounded-full border border-[rgba(177,140,92,0.24)] bg-[rgba(255,251,246,0.88)] px-4 py-2 text-xs font-semibold text-[hsl(var(--ink))] disabled:opacity-50"
              >
                {printing ? "準備中…" : "列印本頁"}
              </button>
            )}
          </div>
        </div>
      </section>

      {productFilterId && (
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[rgba(80,112,147,0.16)] bg-[rgba(222,231,242,0.8)] px-3 py-1.5 text-xs font-semibold text-[rgb(74,96,136)]">
            篩選: {productFilterName || productFilterId}
          </span>
          <button
            onClick={() =>
              navigateWithUpdates({
                productId: null,
                productName: null,
                page: "1",
              })
            }
            className="text-xs text-[rgb(140,67,56)]"
          >
            ✕ 清除
          </button>
        </div>
      )}

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
        {orders.length > 0 && (
          <button
            onClick={selectAll}
            className="rounded-full border border-[rgba(80,112,147,0.16)] bg-[rgba(222,231,242,0.8)] px-4 py-2.5 text-xs font-semibold text-[rgb(74,96,136)] whitespace-nowrap"
          >
            全選
          </button>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="lux-panel p-12 text-center text-[hsl(var(--muted-foreground))]">
          沒有符合搜尋條件的訂單
        </div>
      ) : (
        groups.map((group) => {
          const isCollapsed = collapsedGroups.has(group.label);
          return (
            <div key={group.label} className="space-y-3">
              <button
                onClick={() => toggleGroup(group.label)}
                className="lux-panel flex w-full items-center gap-2 p-3 text-left"
              >
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {isCollapsed ? "▶" : "▼"}
                </span>
                <span className="text-sm font-semibold text-[hsl(var(--ink))]">
                  {group.label === "宅配" ? "宅配" : group.label}
                </span>
                <span className="rounded-full border border-[rgba(177,140,92,0.2)] bg-[rgba(255,251,246,0.88)] px-2.5 py-1 text-xs text-[hsl(var(--muted-foreground))]">
                  {group.orders.length}
                </span>
              </button>
              {!isCollapsed && (
                <div className="space-y-2 ml-1">
                  {group.orders.map((order) => (
                    <ShipmentCard
                      key={order.id}
                      order={order}
                      detail={detailsById[order.id]}
                      loadingDetail={loadingDetailIds.has(order.id)}
                      onLoadDetail={loadOrderDetail}
                      selected={batchSel.has(order.id)}
                      onToggleSelect={toggleSelect}
                      onShipmentConfirmed={handleShipmentConfirmed}
                      adminFetch={adminFetch}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })
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
                onClick={batchConfirmShipment}
                disabled={batchActing}
                className="rounded-full bg-[rgba(255,248,240,0.96)] px-5 py-2 text-sm font-semibold text-[rgb(74,70,113)] disabled:opacity-50"
              >
                {batchActing ? "處理中…" : getBatchLabel()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
