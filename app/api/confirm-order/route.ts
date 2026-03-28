import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { confirmOrder } from "@/lib/db/orders";
import { fireAndForget } from "@/lib/notifications/fire-and-forget";
import { sendPaymentConfirmedNotifications } from "@/lib/notifications/send";
import { parseJsonBody, uuidStringSchema, z } from "@/lib/validation";

const confirmOrderSchema = z.object({
  orderId: uuidStringSchema("orderId"),
});

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = await parseJsonBody(request, confirmOrderSchema);
    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const order = await confirmOrder(parsedBody.data.orderId);

    if (!order) {
      return NextResponse.json(
        { error: "Order not found or not in pending_confirm status" },
        { status: 404 },
      );
    }

    fireAndForget(() =>
      sendPaymentConfirmedNotifications(order, order.order_items),
    );

    return NextResponse.json({ order });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
