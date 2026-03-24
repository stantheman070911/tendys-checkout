import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { quickConfirm } from "@/lib/db/orders";
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

    const { orderId, paymentAmount } = body as {
      orderId?: string;
      paymentAmount?: number;
    };

    if (!orderId || typeof orderId !== "string" || !orderId.trim()) {
      return NextResponse.json(
        { error: "orderId is required" },
        { status: 400 },
      );
    }

    if (
      paymentAmount === undefined ||
      typeof paymentAmount !== "number" ||
      !Number.isInteger(paymentAmount) ||
      paymentAmount <= 0
    ) {
      return NextResponse.json(
        { error: "paymentAmount must be a positive integer" },
        { status: 400 },
      );
    }

    const order = await quickConfirm(orderId.trim(), paymentAmount);

    if (!order) {
      return NextResponse.json(
        { error: "Order not found or not in pending_payment status" },
        { status: 404 },
      );
    }

    const notifications = await sendPaymentConfirmedNotifications(
      order,
      order.order_items,
    );

    return NextResponse.json({ order, notifications });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
