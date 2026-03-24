import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdminSession,
  getSupabaseAdmin,
} from "@/lib/auth/supabase-admin";
import { listByRound } from "@/lib/db/orders";
import { STATUS_LABELS } from "@/constants";
import type { OrderStatus } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roundId = request.nextUrl.searchParams.get("roundId");
    if (!roundId || !roundId.trim()) {
      return NextResponse.json(
        { error: "roundId is required" },
        { status: 400 },
      );
    }

    const orders = await listByRound(roundId.trim());

    // CSV headers
    const headers = [
      "訂單編號",
      "暱稱",
      "收件人",
      "電話",
      "地址",
      "取貨方式",
      "商品明細",
      "商品小計",
      "運費",
      "總金額",
      "狀態",
      "付款金額",
      "帳號末五碼",
      "回報時間",
      "確認時間",
      "出貨時間",
      "取消原因",
      "備註",
      "建立時間",
    ];

    const rows = orders.map((order) => {
      const itemsText = order.order_items
        .map((i) => `${i.product_name}x${i.quantity}`)
        .join(", ");
      const itemsSubtotal = order.order_items.reduce(
        (sum, i) => sum + i.subtotal,
        0,
      );

      return [
        order.order_number ?? "",
        order.user?.nickname ?? "",
        order.user?.recipient_name ?? "",
        order.user?.phone ?? "",
        order.user?.address ?? "",
        order.pickup_location ?? "宅配",
        itemsText,
        String(itemsSubtotal),
        order.shipping_fee != null ? String(order.shipping_fee) : "",
        String(order.total_amount),
        STATUS_LABELS[order.status as OrderStatus] ?? order.status,
        order.payment_amount != null ? String(order.payment_amount) : "",
        order.payment_last5 ?? "",
        order.payment_reported_at
          ? new Date(order.payment_reported_at).toLocaleString("zh-TW")
          : "",
        order.confirmed_at
          ? new Date(order.confirmed_at).toLocaleString("zh-TW")
          : "",
        order.shipped_at
          ? new Date(order.shipped_at).toLocaleString("zh-TW")
          : "",
        order.cancel_reason ?? "",
        order.note ?? "",
        new Date(order.created_at).toLocaleString("zh-TW"),
      ];
    });

    // Build CSV string with UTF-8 BOM for Excel
    const csvLines = [headers, ...rows].map((row) =>
      row.map(escapeCsvField).join(","),
    );
    const csv = "\uFEFF" + csvLines.join("\r\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="orders.csv"',
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

function escapeCsvField(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}
