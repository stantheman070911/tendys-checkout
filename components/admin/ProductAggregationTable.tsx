"use client";

import { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { buildAdminPath } from "@/lib/admin/paths";
import type { OrderByProduct, ProductWithProgress } from "@/types";

interface ProductAggregationTableProps {
  products: ProductWithProgress[];
  orderItems: Array<{
    product_id: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
  }>;
  roundId: string;
  adminFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
}

interface AggRow {
  productId: string;
  name: string;
  supplierName: string | null;
  unit: string;
  qty: number;
  revenue: number;
}

export function ProductAggregationTable({
  products,
  orderItems,
  roundId,
  adminFetch,
}: ProductAggregationTableProps) {
  const { toast } = useToast();
  const [expandedProd, setExpandedProd] = useState<string | null>(null);
  const [customersByProduct, setCustomersByProduct] = useState<
    Record<string, OrderByProduct[]>
  >({});
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
  const [arrivalSending, setArrivalSending] = useState<string | null>(null);
  const [arrivalSent, setArrivalSent] = useState<Set<string>>(new Set());

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  const rows = useMemo(() => {
    const aggMap = new Map<string, AggRow>();

    for (const item of orderItems) {
      if (!item.product_id) continue;

      const existing = aggMap.get(item.product_id);
      if (existing) {
        existing.qty += item.quantity;
        existing.revenue += item.quantity * item.unit_price;
        continue;
      }

      const product = productById.get(item.product_id);
      aggMap.set(item.product_id, {
        productId: item.product_id,
        name: item.product_name,
        supplierName: product?.supplier_name ?? null,
        unit: product?.unit ?? "份",
        qty: item.quantity,
        revenue: item.quantity * item.unit_price,
      });
    }

    // Include zero-demand products so suppliers see the full product list
    for (const product of products) {
      if (!aggMap.has(product.id)) {
        aggMap.set(product.id, {
          productId: product.id,
          name: product.name,
          supplierName: product.supplier_name ?? null,
          unit: product.unit,
          qty: 0,
          revenue: 0,
        });
      }
    }

    return Array.from(aggMap.values());
  }, [orderItems, productById, products]);

  const loadCustomers = async (productId: string): Promise<OrderByProduct[]> => {
    const existingCustomers = customersByProduct[productId];
    if (existingCustomers) {
      return existingCustomers;
    }

    setLoadingProductId(productId);
    try {
      const data = await adminFetch<{ customers: OrderByProduct[] }>(
        `/api/orders-by-product?productId=${productId}&roundId=${roundId}`
      );
      setCustomersByProduct((prev) => ({
        ...prev,
        [productId]: data.customers,
      }));
      return data.customers;
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "客戶資料載入失敗",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoadingProductId((current) =>
        current === productId ? null : current
      );
    }
  };

  const toggleExpand = async (productId: string) => {
    if (expandedProd === productId) {
      setExpandedProd(null);
      return;
    }

    setExpandedProd(productId);
    await loadCustomers(productId);
  };

  const sendArrival = async (productId: string) => {
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
        body: JSON.stringify({ productId, roundId }),
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

  const printAllocationList = async (row: AggRow) => {
    const customers = await loadCustomers(row.productId);
    if (customers.length === 0) {
      toast({
        title: "沒有可列印的客戶資料",
        variant: "destructive",
      });
      return;
    }

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      toast({
        title: "無法開啟列印視窗",
        variant: "destructive",
      });
      return;
    }

    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const rowsHtml = customers
      .map(
        (customer) => `
          <tr>
            <td>${escapeHtml(customer.nickname)}</td>
            <td>${escapeHtml(customer.recipient_name ?? "—")}</td>
            <td>${escapeHtml(customer.phone ?? "—")}</td>
            <td>${escapeHtml(customer.order_number)}</td>
            <td>${customer.quantity}${escapeHtml(row.unit)}</td>
          </tr>
        `
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>${escapeHtml(row.name)} 理貨清單</title>
          <style>
            body { font-family: sans-serif; padding: 24px; color: #111827; }
            h1, h2 { margin: 0 0 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(row.name)} 理貨清單</h1>
          <h2>總需求 ${row.qty}${escapeHtml(row.unit)}</h2>
          <table>
            <thead>
              <tr>
                <th>暱稱</th>
                <th>收貨人</th>
                <th>電話</th>
                <th>訂單編號</th>
                <th>數量</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <script>window.onload = function () { window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-4">
        <div className="font-medium text-sm mb-2 text-gray-700">商品需求彙總</div>
        <div className="text-sm text-gray-400 text-center py-4">尚無訂單資料</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex justify-between items-center mb-3">
        <div className="font-medium text-sm text-gray-700">商品需求彙總</div>
        <button
          onClick={() => window.print()}
          className="text-xs text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200 print:hidden flex items-center gap-1.5 font-medium transition-colors"
        >
          🖨️ 列印總表
        </button>
      </div>
      {rows.map((row) => {
        const isExpanded = expandedProd === row.productId;
        const customers = customersByProduct[row.productId] ?? [];
        const isSent = arrivalSent.has(row.productId);
        const isSending = arrivalSending === row.productId;
        const isLoadingCustomers = loadingProductId === row.productId;

        return (
          <div key={row.productId} className="border-b last:border-0 py-2">
            <div className="flex justify-between items-center gap-3">
              <button
                onClick={() => toggleExpand(row.productId)}
                className="flex items-center gap-1 text-sm font-medium hover:text-indigo-600 text-left"
              >
                <span className="text-xs text-gray-400">
                  {isExpanded ? "▼" : "▶"}
                </span>{" "}
                {row.name}
                {row.supplierName && (
                  <span className="text-xs text-gray-400">
                    ({row.supplierName})
                  </span>
                )}
              </button>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className="font-bold text-indigo-600 text-sm">
                  {row.qty}
                  {row.unit}
                </span>
                <span className="text-xs text-gray-400">${row.revenue}</span>
                <button
                  onClick={() =>
                    window.open(
                      buildAdminPath(
                        `/shipments?productId=${row.productId}&productName=${encodeURIComponent(row.name)}`
                      ),
                      "_self"
                    )
                  }
                  className="text-xs px-2 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100"
                >
                  📦 前往出貨
                </button>
                <button
                  onClick={() => void printAllocationList(row)}
                  className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  🖨️ 列印理貨清單
                </button>
                <button
                  onClick={() => sendArrival(row.productId)}
                  disabled={isSent || isSending}
                  className={`text-xs px-2 py-1 rounded-lg ${
                    isSent
                      ? "bg-green-100 text-green-700"
                      : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                  }`}
                >
                  {isSending ? "…" : isSent ? "✓ 已通知" : "📢 通知到貨"}
                </button>
              </div>
            </div>
            {isExpanded && (
              <div className="mt-2 ml-4 bg-gray-50 rounded-xl p-2.5 space-y-1">
                {isLoadingCustomers ? (
                  <div className="text-xs text-gray-400 text-center py-2">載入中…</div>
                ) : customers.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-2">無客戶資料</div>
                ) : (
                  customers.map((c, i) => (
                    <div key={i} className="grid grid-cols-[4.5rem,5rem,1fr,7.5rem,4rem] text-xs gap-2">
                      <span className="font-medium">{c.nickname}</span>
                      <span>{c.recipient_name ?? "—"}</span>
                      <span className="text-gray-400 truncate">{c.phone ?? "—"}</span>
                      <span className="font-mono text-gray-500">{c.order_number}</span>
                      <span className="font-bold text-indigo-600 text-right">
                        {c.quantity}
                        {row.unit}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
