"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import { useToast } from "@/hooks/use-toast";
import { STATUS_LABELS } from "@/constants";
import { OrderCard } from "@/components/admin/OrderCard";
import { POSForm } from "@/components/admin/POSForm";
import type {
  Round,
  Order,
  OrderItem,
  User,
  ProductWithProgress,
} from "@/types";

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
  const { adminFetch } = useAdminFetch();
  const { toast } = useToast();

  const [round, setRound] = useState<Round | null>(null);
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [products, setProducts] = useState<ProductWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>(
    searchParams.get("status") ?? "all"
  );
  const [search, setSearch] = useState("");
  const [batchSel, setBatchSel] = useState<Set<string>>(new Set());
  const [batchActing, setBatchActing] = useState(false);
  const [showPOS, setShowPOS] = useState(
    searchParams.get("showPOS") === "1"
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

      const [ordersData, productsData] = await Promise.all([
        adminFetch<{ orders: OrderWithRelations[] }>(
          `/api/orders?roundId=${openRound.id}`
        ),
        adminFetch<{ products: ProductWithProgress[] }>(
          `/api/products?roundId=${openRound.id}&all=true`
        ),
      ]);

      setOrders(ordersData.orders);
      setProducts(productsData.products);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter + search
  const filtered = orders.filter((o) => {
    if (filter !== "all" && o.status !== filter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (o.user?.nickname ?? "").toLowerCase().includes(q) ||
      (o.user?.phone ?? "").includes(q) ||
      o.order_number.toLowerCase().includes(q) ||
      (o.user?.recipient_name ?? "").toLowerCase().includes(q)
    );
  });

  const pendingConfirm = orders.filter(
    (o) => o.status === "pending_confirm"
  );

  const selectAllPending = () => {
    setBatchSel(new Set(pendingConfirm.map((o) => o.id)));
  };

  const toggleSelect = (id: string) => {
    setBatchSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const batchConfirm = async () => {
    if (batchSel.size === 0) return;
    setBatchActing(true);
    try {
      const res = await adminFetch<{
        results?: Array<{ orderId: string; success: boolean }>;
        error?: string;
      }>("/api/batch-confirm", {
        method: "POST",
        body: JSON.stringify({ orderIds: Array.from(batchSel) }),
      });
      if (res.error) {
        toast({ title: res.error, variant: "destructive" });
      } else {
        const count = res.results?.filter((r) => r.success).length ?? 0;
        toast({ title: `已確認 ${count} 筆訂單` });
        setBatchSel(new Set());
        fetchData();
      }
    } catch {
      toast({ title: "批次確認失敗", variant: "destructive" });
    } finally {
      setBatchActing(false);
    }
  };

  const handleCSVExport = () => {
    if (!round) return;
    // Use window.open to trigger download — the API route sets Content-Disposition
    window.open(`/api/export-csv?roundId=${round.id}`, "_blank");
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
    <div className="space-y-2">
      {/* Search */}
      <div className="flex gap-2 items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋 暱稱 / 電話 / 訂單號"
          className="flex-1 border rounded-xl px-3 py-2.5 text-sm"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="w-9 h-9 flex items-center justify-center border rounded-xl text-gray-400 hover:text-red-500"
          >
            ✕
          </button>
        )}
        <button
          onClick={handleCSVExport}
          className="text-xs px-3 py-2.5 border rounded-xl text-gray-500 hover:text-indigo-600 whitespace-nowrap"
        >
          CSV
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap items-center">
        {FILTER_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full transition ${
              filter === s
                ? "bg-indigo-600 text-white"
                : "bg-white border"
            }`}
          >
            {s === "all" ? "全部" : STATUS_LABELS[s]}
          </button>
        ))}
        {pendingConfirm.length > 0 &&
          (filter === "all" || filter === "pending_confirm") && (
            <button
              onClick={selectAllPending}
              className="text-xs px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 ml-auto"
            >
              全選待確認
            </button>
          )}
      </div>

      {/* Orders */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400">沒有符合的訂單</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => (
            <OrderCard
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

      {/* Batch confirm bar */}
      {batchSel.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-indigo-700 text-white px-4 py-3 flex items-center justify-between z-40 shadow-2xl">
          <span className="font-medium text-sm">
            已選 <b>{batchSel.size}</b> 筆
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setBatchSel(new Set())}
              className="px-3 py-1.5 border border-indigo-500 rounded-xl text-sm"
            >
              清除
            </button>
            <button
              onClick={batchConfirm}
              disabled={batchActing}
              className="px-4 py-1.5 bg-green-500 rounded-xl text-sm font-bold disabled:opacity-50"
            >
              {batchActing ? "處理中…" : "批次確認付款"}
            </button>
          </div>
        </div>
      )}

      {/* POS Dialog */}
      <POSForm
        open={showPOS}
        onClose={() => setShowPOS(false)}
        roundId={round.id}
        products={products}
        shippingFee={round.shipping_fee}
        adminFetch={adminFetch}
        onSuccess={fetchData}
      />
    </div>
  );
}
