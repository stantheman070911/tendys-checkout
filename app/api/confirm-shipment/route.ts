import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { confirmShipment, batchConfirmShipment } from "@/lib/db/orders";
import { mapWithConcurrency } from "@/lib/async";
import { fireAndForget } from "@/lib/notifications/fire-and-forget";
import { sendShipmentNotifications } from "@/lib/notifications/send";
import { parseJsonBody, uuidStringSchema, z } from "@/lib/validation";

const confirmShipmentSingleSchema = z
  .object({
    orderId: uuidStringSchema("orderId"),
    orderIds: z.any().optional(),
  })
  .transform((value) => ({
    mode: "single" as const,
    orderId: value.orderId,
  }));

const confirmShipmentBatchSchema = z
  .object({
    orderId: z.any().optional(),
    orderIds: z
      .array(uuidStringSchema("orderId"))
      .min(1, { message: "Provide orderId (string) or orderIds (string[])" }),
  })
  .transform((value) => ({
    mode: "batch" as const,
    orderIds: value.orderIds,
  }));

const confirmShipmentSchema = z.union([
  confirmShipmentSingleSchema,
  confirmShipmentBatchSchema,
]);

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = await parseJsonBody(request, confirmShipmentSchema);
    if (!parsedBody.success) {
      return parsedBody.response;
    }

    if (parsedBody.data.mode === "single") {
      const order = await confirmShipment(parsedBody.data.orderId);
      if (!order) {
        return NextResponse.json(
          { error: "Order not found or not in confirmed status" },
          { status: 404 },
        );
      }
      fireAndForget(() => sendShipmentNotifications(order, order.order_items));
      return NextResponse.json({ order });
    }

    const trimmedIds = parsedBody.data.orderIds;
    const shippedOrders = await batchConfirmShipment(trimmedIds);
    const changedIds = new Set(shippedOrders.map((order) => order.id));
    const skipped = trimmedIds.filter((id) => !changedIds.has(id));

    fireAndForget(() =>
      mapWithConcurrency(shippedOrders, 10, (order) =>
        sendShipmentNotifications(order, order.order_items),
      ).then(() => undefined),
    );

    return NextResponse.json({
      shipped: shippedOrders.length,
      skipped,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
