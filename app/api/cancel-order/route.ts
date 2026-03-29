import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/auth/supabase-admin";
import {
  cancelOrder,
  findPublicOrderByOrderNumberAndIdentity,
} from "@/lib/db/orders";
import { getRequestId, getRouteFromRequest, logError } from "@/lib/logger";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizePhoneDigits } from "@/lib/utils";
import { optionalTrimmedStringSchema, optionalUuidStringSchema, parseJsonBody, z } from "@/lib/validation";

const cancelOrderSchema = z
  .object({
    orderId: optionalUuidStringSchema("orderId"),
    order_number: optionalTrimmedStringSchema(),
    purchaser_name: optionalTrimmedStringSchema(),
    recipient_name: optionalTrimmedStringSchema(),
    phone_last3: z.string().optional(),
    cancel_reason: optionalTrimmedStringSchema(),
  })
  .transform((value) => ({
    orderId: value.orderId,
    orderNumber: value.order_number?.toUpperCase() ?? "",
    purchaserName: value.purchaser_name || value.recipient_name || "",
    phoneLast3: normalizePhoneDigits(value.phone_last3),
    cancelReason: value.cancel_reason,
  }));

export async function POST(request: NextRequest) {
  let authMode: "cookie" | "bearer" | "none" = "none";

  try {
    const parsedBody = await parseJsonBody(request, cancelOrderSchema);
    if (!parsedBody.success) {
      return parsedBody.response;
    }
    const {
      orderId,
      orderNumber,
      purchaserName,
      phoneLast3,
      cancelReason,
    } = parsedBody.data;

    // Determine mode by auth — don't 401 if not admin, just use user mode
    const authorization = await authorizeAdminRequest(request);
    authMode = authorization.mode;
    const isAdmin = authorization.authorized;

    let resolvedOrderId = orderId;

    // Non-admin callers must provide order_number + public identity
    if (!isAdmin) {
      const clientIp = getClientIp(request);
      const rateLimit = await checkRateLimit(
        `cancel-order:${clientIp}`,
        5,
        60_000,
        {
          route: getRouteFromRequest(request),
          requestId: getRequestId(request),
        },
      );
      if (rateLimit.error === "backend_unavailable") {
        return NextResponse.json(
          { error: "Order cancellation is temporarily unavailable" },
          { status: 503 },
        );
      }
      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: "Too many requests" },
          {
            status: 429,
            headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
          },
        );
      }

      if (!orderNumber) {
        return NextResponse.json(
          { error: "order_number is required" },
          { status: 400 },
        );
      }

      if (!purchaserName) {
        return NextResponse.json(
          { error: "purchaser_name is required" },
          { status: 400 },
        );
      }

      if (phoneLast3.length !== 3) {
        return NextResponse.json(
          { error: "phone_last3 must be exactly 3 digits" },
          { status: 400 },
        );
      }

      const order = await findPublicOrderByOrderNumberAndIdentity(
        orderNumber,
        purchaserName,
        phoneLast3,
      );
      if (!order) {
        return NextResponse.json(
          { error: "Order not found" },
          { status: 404 },
        );
      }
      resolvedOrderId = order.id;
    } else if (!resolvedOrderId) {
      return NextResponse.json(
        { error: "orderId is required" },
        { status: 400 },
      );
    }

    const reason = isAdmin ? cancelReason : undefined;

    const result = await cancelOrder(resolvedOrderId, isAdmin, reason);

    if (result === null) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ order: result.order });
  } catch (error) {
    logError({
      event: "cancel_order_failed",
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
