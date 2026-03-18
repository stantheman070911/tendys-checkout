import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { batchConfirm } from "@/lib/db/orders";
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
        { status: 400 }
      );
    }

    const trimmedIds = orderIds.map((id) => id.trim());
    const confirmedOrders = await batchConfirm(trimmedIds);

    // Send notifications sequentially to avoid rate limiting
    const notificationResults = [];
    for (const order of confirmedOrders) {
      const notifications = await sendPaymentConfirmedNotifications(
        order,
        order.order_items
      );
      notificationResults.push({
        orderId: order.id,
        orderNumber: order.order_number,
        notifications,
      });
    }

    return NextResponse.json({
      confirmed: confirmedOrders.length,
      results: notificationResults,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
