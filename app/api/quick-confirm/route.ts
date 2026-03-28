import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { quickConfirm } from "@/lib/db/orders";
import { fireAndForget } from "@/lib/notifications/fire-and-forget";
import { sendPaymentConfirmedNotifications } from "@/lib/notifications/send";
import {
  parseJsonBody,
  positiveIntegerSchema,
  uuidStringSchema,
  z,
} from "@/lib/validation";

const quickConfirmSchema = z.object({
  orderId: uuidStringSchema("orderId"),
  paymentAmount: positiveIntegerSchema("paymentAmount"),
});

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = await parseJsonBody(request, quickConfirmSchema);
    if (!parsedBody.success) {
      return parsedBody.response;
    }
    const { orderId, paymentAmount } = parsedBody.data;

    const order = await quickConfirm(orderId, paymentAmount);

    if (!order) {
      return NextResponse.json(
        { error: "Order not found or not in pending_payment status" },
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
