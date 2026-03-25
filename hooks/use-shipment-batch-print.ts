"use client";

import { useState } from "react";
import { buildShipmentPrintDocument } from "@/lib/admin/shipment-print";
import type { AdminOrderDetail } from "@/types";

type AdminFetch = <T = unknown>(url: string, options?: RequestInit) => Promise<T>;

export function useShipmentBatchPrint(args: {
  adminFetch: AdminFetch;
  roundId: string;
  onError: (message: string) => void;
}) {
  const { adminFetch, roundId, onError } = args;
  const [printing, setPrinting] = useState(false);

  async function printOrders(orderIds: string[]) {
    if (orderIds.length === 0 || printing) {
      return;
    }

    setPrinting(true);
    try {
      const { orders } = await adminFetch<{
        orders: AdminOrderDetail[];
      }>("/api/orders/print-batch", {
        method: "POST",
        body: JSON.stringify({
          roundId,
          orderIds,
        }),
      });

      const printWindow = window.open("", "_blank", "noopener,noreferrer");
      if (!printWindow) {
        onError("無法開啟列印視窗");
        return;
      }

      printWindow.document.write(buildShipmentPrintDocument(orders));
      printWindow.document.close();
    } catch (error) {
      onError(error instanceof Error ? error.message : "列印資料載入失敗");
    } finally {
      setPrinting(false);
    }
  }

  return {
    printing,
    printOrders,
  };
}
