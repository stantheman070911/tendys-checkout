import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { listRoundOrdersBatch } from "@/lib/db/orders";
import { STATUS_LABELS } from "@/constants";
import type { OrderStatus } from "@/types";
import { uuidStringSchema } from "@/lib/validation";

const CSV_BATCH_SIZE = 500;
const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
};

async function validateCsvExportRequest(request: NextRequest) {
  const isAdmin = await verifyAdminSession(request);
  if (!isAdmin) {
    return {
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: NO_STORE_HEADERS },
      ),
    };
  }

  const roundIdRaw = request.nextUrl.searchParams.get("roundId");
  const roundIdParsed = uuidStringSchema("roundId").safeParse(roundIdRaw ?? "");
  if (!roundIdParsed.success) {
    return {
      response: NextResponse.json(
        { error: roundIdParsed.error.issues[0]?.message ?? "roundId must be a valid UUID" },
        { status: 400, headers: NO_STORE_HEADERS },
      ),
    };
  }

  return { roundId: roundIdParsed.data };
}

export async function HEAD(request: NextRequest) {
  try {
    const validation = await validateCsvExportRequest(request);
    if ("response" in validation) {
      return validation.response;
    }

    return new NextResponse(null, {
      status: 204,
      headers: NO_STORE_HEADERS,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const validation = await validateCsvExportRequest(request);
    if ("response" in validation) {
      return validation.response;
    }

    const roundId = validation.roundId;
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

        const orders = await listRoundOrdersBatch(roundId, {
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
            .map((item) => `${item.product_name}x${item.quantity}`)
            .join(", ");
          const itemsSubtotal = order.order_items.reduce(
            (sum, item) => sum + item.subtotal,
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
        ...NO_STORE_HEADERS,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="orders.csv"',
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: NO_STORE_HEADERS },
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
