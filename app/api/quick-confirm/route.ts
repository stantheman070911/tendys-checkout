import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/auth/supabase-admin";
import { quickConfirm } from "@/lib/db/orders";
import { getRequestId, getRouteFromRequest, logError } from "@/lib/logger";
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
  let authMode: "cookie" | "bearer" | "none" = "none";

  try {
    const authorization = await authorizeAdminRequest(request);
    authMode = authorization.mode;
    if (!authorization.authorized) {
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

    return NextResponse.json({ order });
  } catch (error) {
    logError({
      event: "quick_confirm_failed",
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
