import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { listRoundOrdersBatch } from "@/lib/db/orders";
import { STATUS_LABELS } from "@/constants";
import type { OrderStatus } from "@/types";

const CSV_BATCH_SIZE = 500;

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
    const headers = [
      "訂單編號",
      "暱稱",
      "訂購人",
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

    const encoder = new TextEncoder();
    let offset = 0;
    let wroteHeader = false;
    const stream = new ReadableStream({
      async pull(controller) {
        if (!wroteHeader) {
          wroteHeader = true;
          controller.enqueue(encoder.encode("\uFEFF"));
          controller.enqueue(
            encoder.encode(headers.map(escapeCsvField).join(",") + "\r\n"),
          );
        }

        const orders = await listRoundOrdersBatch(roundId.trim(), {
          skip: offset,
          take: CSV_BATCH_SIZE,
        });
        if (orders.length === 0) {
          controller.close();
          return;
        }

        offset += orders.length;
        for (const order of orders) {
          const itemsText = order.order_items
            .map((i) => `${i.product_name}x${i.quantity}`)
            .join(", ");
          const itemsSubtotal = order.order_items.reduce(
            (sum, i) => sum + i.subtotal,
            0,
          );

          const row = [
            order.order_number ?? "",
            order.user?.nickname ?? "",
            order.user?.purchaser_name ?? "",
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

          controller.enqueue(
            encoder.encode(row.map(escapeCsvField).join(",") + "\r\n"),
          );
        }
      },
    });

    return new Response(stream, {
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
