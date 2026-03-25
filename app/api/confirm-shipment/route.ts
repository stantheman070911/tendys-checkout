import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { confirmShipment, batchConfirmShipment } from "@/lib/db/orders";
import { fireAndForget } from "@/lib/notifications/fire-and-forget";
import { sendShipmentNotifications } from "@/lib/notifications/send";

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

    const { orderId, orderIds } = body as {
      orderId?: string;
      orderIds?: string[];
    };

    // Single mode
    if (orderId && typeof orderId === "string" && orderId.trim()) {
      const order = await confirmShipment(orderId.trim());
      if (!order) {
        return NextResponse.json(
          { error: "Order not found or not in confirmed status" },
          { status: 404 },
        );
      }
      fireAndForget(() => sendShipmentNotifications(order, order.order_items));
      return NextResponse.json({ order });
    }

    // Batch mode
    if (
      Array.isArray(orderIds) &&
      orderIds.length > 0 &&
      orderIds.every((id) => typeof id === "string" && id.trim())
    ) {
      const trimmedIds = orderIds.map((id) => id.trim());
      const shippedOrders = await batchConfirmShipment(trimmedIds);
      const changedIds = new Set(shippedOrders.map((order) => order.id));
      const skipped = trimmedIds.filter((id) => !changedIds.has(id));

      fireAndForget(() =>
        Promise.allSettled(
          shippedOrders.map((order) =>
            sendShipmentNotifications(order, order.order_items),
          ),
        ).then(() => undefined),
      );

      return NextResponse.json({
        shipped: shippedOrders.length,
        skipped,
      });
    }

    return NextResponse.json(
      { error: "Provide orderId (string) or orderIds (string[])" },
      { status: 400 },
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
