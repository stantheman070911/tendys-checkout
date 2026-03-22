import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import {
  confirmShipment,
  batchConfirmShipment,
} from "@/lib/db/orders";
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
          { status: 404 }
        );
      }
      const notifications = await sendShipmentNotifications(
        order,
        order.order_items
      );
      return NextResponse.json({ order, notifications });
    }

    // Batch mode
    if (
      Array.isArray(orderIds) &&
      orderIds.length > 0 &&
      orderIds.every((id) => typeof id === "string" && id.trim())
    ) {
      const trimmedIds = orderIds.map((id) => id.trim());
      const shippedOrders = await batchConfirmShipment(trimmedIds);

      // Send notifications concurrently (EFF-1)
      const settled = await Promise.allSettled(
        shippedOrders.map(async (order) => {
          const notifications = await sendShipmentNotifications(
            order,
            order.order_items
          );
          return {
            orderId: order.id,
            orderNumber: order.order_number,
            notifications,
          };
        })
      );
      const notificationResults = settled
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<{ orderId: string; orderNumber: string; notifications: unknown }>).value);

      return NextResponse.json({
        shipped: shippedOrders.length,
        results: notificationResults,
      });
    }

    return NextResponse.json(
      { error: "Provide orderId (string) or orderIds (string[])" },
      { status: 400 }
    );
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
