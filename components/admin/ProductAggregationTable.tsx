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
    [products],
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

  const loadCustomers = async (
    productId: string,
  ): Promise<OrderByProduct[]> => {
    const existingCustomers = customersByProduct[productId];
    if (existingCustomers) {
      return existingCustomers;
    }

    setLoadingProductId(productId);
    try {
      const data = await adminFetch<{ customers: OrderByProduct[] }>(
        `/api/orders-by-product?productId=${productId}&roundId=${roundId}`,
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
        current === productId ? null : current,
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
        `,
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
      <div className="lux-panel p-5">
        <div className="mb-2 font-display text-2xl text-[hsl(var(--ink))]">
          商品需求彙總
        </div>
        <div className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
          尚無訂單資料
        </div>
      </div>
    );
  }

  return (
    <div className="lux-panel p-5 md:p-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="lux-kicker">Demand Snapshot</div>
          <div className="mt-2 font-display text-2xl text-[hsl(var(--ink))]">
            商品需求彙總
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="print:hidden inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[rgba(177,140,92,0.24)] bg-[rgba(255,251,246,0.88)] px-4 py-2 text-xs font-semibold text-[hsl(var(--ink))]"
        >
          列印總表
        </button>
      </div>
      {rows.map((row) => {
        const isExpanded = expandedProd === row.productId;
        const customers = customersByProduct[row.productId] ?? [];
        const isSent = arrivalSent.has(row.productId);
        const isSending = arrivalSending === row.productId;
        const isLoadingCustomers = loadingProductId === row.productId;

        return (
          <div
            key={row.productId}
            className="border-b border-[rgba(177,140,92,0.14)] py-3 last:border-0"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <button
                onClick={() => toggleExpand(row.productId)}
                className="flex items-center gap-2 text-left text-sm font-medium text-[hsl(var(--ink))]"
              >
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {isExpanded ? "▼" : "▶"}
                </span>
                <span>{row.name}</span>
                {row.supplierName && (
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {row.supplierName}
                  </span>
                )}
              </button>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <span className="lux-pill">
                  {row.qty}
                  {row.unit}
                </span>
                <span className="text-sm text-[hsl(var(--muted-foreground))]">
                  {row.revenue.toLocaleString("zh-TW", {
                    style: "currency",
                    currency: "TWD",
                    maximumFractionDigits: 0,
                  })}
                </span>
                <button
                  onClick={() =>
                    window.open(
                      buildAdminPath(
                        `/shipments?productId=${row.productId}&productName=${encodeURIComponent(row.name)}`,
                      ),
                      "_self",
                    )
                  }
                  className="rounded-full border border-[rgba(115,107,153,0.18)] bg-[rgba(230,228,242,0.74)] px-3 py-1.5 text-xs font-medium text-[rgb(74,70,113)]"
                >
                  前往出貨
                </button>
                <button
                  onClick={() => void printAllocationList(row)}
                  className="rounded-full border border-[rgba(177,140,92,0.24)] bg-[rgba(255,251,246,0.88)] px-3 py-1.5 text-xs font-medium text-[hsl(var(--ink))]"
                >
                  列印理貨清單
                </button>
                <button
                  onClick={() => sendArrival(row.productId)}
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
            {isExpanded && (
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
                      <span className="font-medium text-[hsl(var(--ink))]">
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
