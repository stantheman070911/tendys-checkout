import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { batchConfirm } from "@/lib/db/orders";
import { mapWithConcurrency } from "@/lib/async";
import { fireAndForget } from "@/lib/notifications/fire-and-forget";
import { sendPaymentConfirmedNotifications } from "@/lib/notifications/send";
import { parseJsonBody, uuidStringSchema, z } from "@/lib/validation";

const batchConfirmSchema = z.object({
  orderIds: z
    .array(uuidStringSchema("orderId"))
    .min(1, { message: "orderIds must be a non-empty array of UUIDs" }),
});

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = await parseJsonBody(request, batchConfirmSchema);
    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const trimmedIds = parsedBody.data.orderIds;
    const confirmedOrders = await batchConfirm(trimmedIds);
    const changedIds = new Set(confirmedOrders.map((order) => order.id));
    const skipped = trimmedIds.filter((id) => !changedIds.has(id));

    fireAndForget(() =>
      mapWithConcurrency(confirmedOrders, 10, (order) =>
        sendPaymentConfirmedNotifications(order, order.order_items),
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
