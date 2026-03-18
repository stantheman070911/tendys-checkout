import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { confirmOrder } from "@/lib/db/orders";
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

    const { orderId } = body as { orderId?: string };

    if (!orderId || typeof orderId !== "string" || !orderId.trim()) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const order = await confirmOrder(orderId.trim());

    // Send notifications (fire-and-forget — failure doesn't affect response)
    const notifications = await sendPaymentConfirmedNotifications(
      order,
      order.order_items
    );

    return NextResponse.json({ order, notifications });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
