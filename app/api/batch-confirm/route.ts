import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { batchConfirm } from "@/lib/db/orders";
import { fireAndForget } from "@/lib/notifications/fire-and-forget";
import { sendPaymentConfirmedNotifications } from "@/lib/notifications/send";

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { orderIds } = body as { orderIds?: string[] };

    if (
      !Array.isArray(orderIds) ||
      orderIds.length === 0 ||
      !orderIds.every((id) => typeof id === "string" && id.trim())
    ) {
      return NextResponse.json(
        { error: "orderIds must be a non-empty array of strings" },
        { status: 400 },
      );
    }

    const trimmedIds = orderIds.map((id) => id.trim());
    const confirmedOrders = await batchConfirm(trimmedIds);
    const changedIds = new Set(confirmedOrders.map((order) => order.id));
    const skipped = trimmedIds.filter((id) => !changedIds.has(id));

    fireAndForget(() =>
      Promise.allSettled(
        confirmedOrders.map((order) =>
          sendPaymentConfirmedNotifications(order, order.order_items),
        ),
      ).then(() => undefined),
    );

    return NextResponse.json({
      confirmed: confirmedOrders.length,
      skipped,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
