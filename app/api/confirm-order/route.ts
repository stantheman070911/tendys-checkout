import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/auth/supabase-admin";
import { confirmOrder } from "@/lib/db/orders";
import { getRequestId, getRouteFromRequest, logError } from "@/lib/logger";
import { parseJsonBody, uuidStringSchema, z } from "@/lib/validation";

const confirmOrderSchema = z.object({
  orderId: uuidStringSchema("orderId"),
});

export async function POST(request: NextRequest) {
  let authMode: "cookie" | "bearer" | "none" = "none";

  try {
    const authorization = await authorizeAdminRequest(request);
    authMode = authorization.mode;
    if (!authorization.authorized) {
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

    return NextResponse.json({ order });
  } catch (error) {
    logError({
      event: "confirm_order_failed",
      requestId: getRequestId(request),
      route: getRouteFromRequest(request),
      authMode,
      error,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
