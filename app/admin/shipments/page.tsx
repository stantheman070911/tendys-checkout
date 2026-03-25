"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAdminRound } from "@/contexts/AdminRoundContext";
import {
  matchesOrderSearch,
  groupOrdersByPickup,
} from "@/lib/admin/order-search";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import { useToast } from "@/hooks/use-toast";
import { ShipmentCard } from "@/components/admin/ShipmentCard";
import type { Round, OrderWithItems } from "@/types";

export default function ShipmentsPage() {
  const searchParams = useSearchParams();
  const { round, loading: roundLoading, refreshRound } = useAdminRound();
  const { adminFetch } = useAdminFetch();
  const { toast } = useToast();

  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [batchSel, setBatchSel] = useState<Set<string>>(new Set());
  const [batchActing, setBatchActing] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );

  // Product filter from query param (e.g., from dashboard "前往出貨" shortcut)
  const productFilterId = searchParams.get("productId") ?? "";
  const productFilterName = searchParams.get("productName") ?? "";

  const fetchData = useCallback(async () => {
    setError(null);
    if (!round) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const ordersData = await adminFetch<{ orders: OrderWithItems[] }>(
        `/api/orders?roundId=${round.id}&status=confirmed`,
      );
      setOrders(ordersData.orders);
    } catch (error) {
      setError(error instanceof Error ? error.message : "資料載入失敗");
    } finally {
      setLoading(false);
    }
  }, [adminFetch, round]);

  useEffect(() => {
    if (roundLoading) return;
    void fetchData();
  }, [fetchData, roundLoading]);

  // Filter by search + optional product filter
  const filtered = orders.filter((o) => {
    if (!matchesOrderSearch(o, search)) return false;
    if (productFilterId) {
      return o.order_items.some((item) => item.product_id === productFilterId);
    }
    return true;
  });

  // Group with 宅配 first
  const groups = groupOrdersByPickup(filtered);
  const sortedGroups = [...groups].sort((a, b) => {
    if (a.label === "宅配") return -1;
    if (b.label === "宅配") return 1;
    return a.label.localeCompare(b.label);
  });

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setBatchSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setBatchSel(new Set(filtered.map((o) => o.id)));
  };

  // Determine batch button label
  const getBatchLabel = () => {
    const selectedOrders = orders.filter((o) => batchSel.has(o.id));
    const hasDelivery = selectedOrders.some((o) => !o.pickup_location);
    const hasPickup = selectedOrders.some((o) => !!o.pickup_location);
    if (hasDelivery && hasPickup) return "批次確認出貨 / 取貨";
    if (hasPickup) return "批次確認取貨";
    return "批次確認寄出";
  };

  const batchConfirmShipment = async () => {
    if (batchSel.size === 0) return;
    setBatchActing(true);
    try {
      const res = await adminFetch<{
        shipped: number;
        skipped: string[];
        results: Array<{
          orderId: string;
          orderNumber: string;
          notifications: {
            line?: { success: boolean; error?: string };
            email?: { success: boolean; error?: string } | null;
          };
        }>;
      }>("/api/confirm-shipment", {
        method: "POST",
        body: JSON.stringify({ orderIds: Array.from(batchSel) }),
      });

      const skipped = res.skipped?.length ?? 0;
      toast({
        title:
          skipped > 0
            ? `已出貨 ${res.shipped} 筆，略過 ${skipped} 筆`
            : `已出貨 ${res.shipped} 筆`,
      });

      setBatchSel(new Set());
      await Promise.all([fetchData(), refreshRound()]);
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "批次出貨失敗",
        variant: "destructive",
      });
    } finally {
      setBatchActing(false);
    }
  };

  // Print all pending shipment slips
  const printAll = () => {
    if (orders.length === 0) return;

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      toast({ title: "無法開啟列印視窗", variant: "destructive" });
      return;
    }

    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const slips = orders
      .map(
        (o) => `
      <div class="slip">
        <h2>${escapeHtml(o.order_number)}</h2>
        <div class="info">
          <div><b>暱稱：</b>${escapeHtml(o.user?.nickname ?? "—")}</div>
          <div><b>訂購人：</b>${escapeHtml(o.user?.purchaser_name ?? "—")}</div>
          <div><b>收貨人：</b>${escapeHtml(o.user?.recipient_name ?? "—")} · ${escapeHtml(o.user?.phone ?? "—")}</div>
          <div>${o.pickup_location ? `📍 ${escapeHtml(o.pickup_location)}` : `🚚 ${escapeHtml(o.user?.address ?? "—")}`}</div>
        </div>
        <table>
          <thead><tr><th>品名</th><th>數量</th><th>小計</th></tr></thead>
          <tbody>
            ${o.order_items
              .map(
                (item) =>
                  `<tr><td>${escapeHtml(item.product_name)}</td><td>${item.quantity}</td><td>$${item.subtotal}</td></tr>`,
              )
              .join("")}
            ${o.shipping_fee ? `<tr><td>宅配運費</td><td></td><td>$${o.shipping_fee}</td></tr>` : ""}
          </tbody>
          <tfoot><tr><td colspan="2"><b>合計</b></td><td><b>$${o.total_amount}</b></td></tr></tfoot>
        </table>
      </div>
    `,
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>待出貨裝箱單</title>
          <style>
            body { font-family: sans-serif; padding: 0; margin: 0; color: #111827; }
            .slip { padding: 24px; page-break-after: always; }
            .slip:last-child { page-break-after: auto; }
            h2 { margin: 0 0 8px; font-size: 18px; }
            .info { margin-bottom: 12px; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; font-size: 14px; }
            th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
            th { background: #f3f4f6; }
            tfoot td { border-top: 2px solid #111827; }
          </style>
        </head>
        <body>${slips}</body>
        <script>window.onload = function () { window.print(); };</script>
      </html>
    `);
    printWindow.document.close();
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
      {/* Header */}
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
            <span className="lux-pill">{filtered.length} 筆待處理</span>
          {orders.length > 0 && (
            <button
              onClick={printAll}
              className="print:hidden inline-flex min-h-[40px] items-center rounded-full border border-[rgba(177,140,92,0.24)] bg-[rgba(255,251,246,0.88)] px-4 py-2 text-xs font-semibold text-[hsl(var(--ink))]"
            >
              列印全部
            </button>
          )}
        </div>
        </div>
      </section>

      {/* Product filter chip */}
      {productFilterId && (
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[rgba(80,112,147,0.16)] bg-[rgba(222,231,242,0.8)] px-3 py-1.5 text-xs font-semibold text-[rgb(74,96,136)]">
            篩選: {productFilterName || productFilterId}
          </span>
          <button
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.delete("productId");
              url.searchParams.delete("productName");
              window.history.replaceState(null, "", url.toString());
              window.location.reload();
            }}
            className="text-xs text-[rgb(140,67,56)]"
          >
            ✕ 清除
          </button>
        </div>
      )}

      {/* Search */}
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
        {filtered.length > 0 && (
          <button
            onClick={selectAll}
            className="rounded-full border border-[rgba(80,112,147,0.16)] bg-[rgba(222,231,242,0.8)] px-4 py-2.5 text-xs font-semibold text-[rgb(74,96,136)] whitespace-nowrap"
          >
            全選
          </button>
        )}
      </div>

      {/* Grouped orders */}
      {filtered.length === 0 ? (
        <div className="lux-panel p-12 text-center text-[hsl(var(--muted-foreground))]">
          {orders.length === 0 ? "沒有待出貨的訂單" : "沒有符合搜尋條件的訂單"}
        </div>
      ) : (
        sortedGroups.map((group) => {
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
                  {group.orders.map((o) => (
                    <ShipmentCard
                      key={o.id}
                      order={o}
                      selected={batchSel.has(o.id)}
                      onToggleSelect={toggleSelect}
                      onRefresh={fetchData}
                      adminFetch={adminFetch}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })
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
