import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { cancelOrder } from "@/lib/db/orders";
import { sendOrderCancelledNotifications } from "@/lib/notifications/send";

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { orderId, cancel_reason } = body as {
      orderId?: string;
      cancel_reason?: string;
    };

    if (!orderId || typeof orderId !== "string" || !orderId.trim()) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    // Determine mode by auth — don't 401 if not admin, just use user mode
    const isAdmin = await verifyAdminSession(request);
    const reason =
      isAdmin && typeof cancel_reason === "string"
        ? cancel_reason.trim() || undefined
        : undefined;

    const result = await cancelOrder(orderId.trim(), isAdmin, reason);

    if (result === null) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Admin cancel: send cancellation notifications only if status actually changed
    let notifications = null;
    if (isAdmin && result.changed && result.order.order_items) {
      notifications = await sendOrderCancelledNotifications(
        result.order,
        result.order.order_items,
        reason
      );
    }

    return NextResponse.json({ order: result.order, notifications });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
